local scriptName = GetCurrentResourceName()

-- Max time (ms) to wait on any single switch-state poll before giving up.
-- Without this, a switch that never reaches the expected state (e.g. because
-- IsPlayerSwitchInProgress() was already true and SwitchOutPlayer was skipped,
-- or the state machine got interrupted) leaves the player frozen forever.
local SWITCH_TIMEOUT_MS = 10000

-- Max extra time (ms) to wait for overlord_identify's release after it asks us
-- to hold, on top of the normal 1500ms fade wait. Bounds the wait so a stalled
-- DB lookup (or overlord_identify not running at all) can't freeze new players
-- on the loading screen forever.
local IDENTITY_HOLD_TIMEOUT_MS = 8000

local isTransitioning = false

-- Set by overlord_identify (server/main.lua) right after esx:playerLoaded, before
-- its DB lookup + showRegisterIdentity round trip. When set, the NEW PLAYER branch
-- below waits for the matching release instead of opening the creator UI on a fixed
-- timer that can fire before overlord_identify's own isGuiPreparing flag is ready —
-- previously that race silently dropped the openCreatorUI() call and the creator UI
-- never appeared.
local identityHoldRequested = false
local identityReleaseReceived = false

RegisterNetEvent('overlord_loadingscreen:hold')
AddEventHandler('overlord_loadingscreen:hold', function()
    identityHoldRequested = true
    identityReleaseReceived = false
end)

RegisterNetEvent('overlord_loadingscreen:release')
AddEventHandler('overlord_loadingscreen:release', function()
    identityReleaseReceived = true
end)

-- Hides HUD/radar and dims the sky clouds. These are "ThisFrame" natives, so
-- they must be re-applied every tick while the switch camera is up, or the
-- default HUD/minimap will flash back into view during the sky-drop.
local function clearSwitchScreen()
    SetCloudHatOpacity(0.01)
    HideHudAndRadarThisFrame()
    SetDrawOrigin(0.0, 0.0, 0.0, 0)
end

-- Blocks until GetPlayerSwitchState() reaches `state`, or SWITCH_TIMEOUT_MS elapses.
local function waitForSwitchState(state)
    local timeout = GetGameTimer() + SWITCH_TIMEOUT_MS
    while GetPlayerSwitchState() ~= state do
        clearSwitchScreen()
        if GetGameTimer() > timeout then
            break
        end
        Wait(0)
    end
end

-- Sends the camera up into the sky and parks it there (switch state 5).
-- Shared by every flow that needs to hide the ped before showing the HUD, so
-- the SwitchOutPlayer call site and its guard only exist in one place.
local function doSwitchOutToSky(ped)
    if not IsPlayerSwitchInProgress() then
        SwitchOutPlayer(ped, 0, 1)
    end
    waitForSwitchState(5)
end

-- Function to handle the drop from the sky and show HUD
local function doSkyDropAndShowHUD()
    local ped = PlayerPedId()

    -- Wait until the camera has reached the sky (state 5) before switching in
    waitForSwitchState(5)

    -- Initiate the drop down from the sky
    SwitchInPlayer(ped)

    -- Wait for the camera to finish dropping
    local timeout = GetGameTimer() + SWITCH_TIMEOUT_MS
    while GetPlayerSwitchState() ~= 12 and GetPlayerSwitchState() ~= 0 do
        clearSwitchScreen()
        if GetGameTimer() > timeout then
            break
        end
        Wait(0)
    end

    -- Undo the per-frame HUD hide from clearSwitchScreen()
    ClearDrawOrigin()

    -- Allow the player to move again
    FreezeEntityPosition(ped, false)

    isTransitioning = false
    Wait(1000) -- Wait a moment before turning on the HUD to ensure the camera has settled
    -- Turn on the HUD
    exports['overlord-hud']:ToggleUI(true)
end

-- Listen for the ESX player loaded event
RegisterNetEvent('esx:playerLoaded')
AddEventHandler('esx:playerLoaded', function(xPlayer, isNew, skin)
    if isTransitioning then return end
    isTransitioning = true

    local ped = PlayerPedId()

    -- Send a message to the frontend (Svelte) to start the fade out and shutdown process
    SendNUIMessage({
        eventName = 'closeLoadingScreen'
    })
    if not isNew then
        -- EXISTING PLAYER
        Citizen.CreateThread(function()
            -- Prevent player from moving while camera drops
            FreezeEntityPosition(ped, true)

            -- Send the camera to the sky (Flag 0 is safer than 255)
            doSwitchOutToSky(ped)

            -- Wait for the Svelte UI fade-out animation to finish (1.5s)
            Wait(1500)

            ShutdownLoadingScreen()
            ShutdownLoadingScreenNui()
            TriggerEvent('overlord-loadingscreen:closed')

            -- Camera is already parked in the sky, drop it down and open the HUD
            doSkyDropAndShowHUD()
        end)
    else
        -- NEW PLAYER (Needs to register identity)
        Citizen.CreateThread(function()
            Wait(1500)

            -- overlord_identify sends :hold almost immediately on esx:playerLoaded
            -- (server-side), so it should already be set by now if that resource is
            -- running. If it asked us to hold, wait for its :release (fired once its
            -- own creator UI is actually ready) instead of calling openCreatorUI()
            -- blind — otherwise the call can land before the creator UI is ready to
            -- receive it and gets silently dropped.
            if identityHoldRequested then
                local timeout = GetGameTimer() + IDENTITY_HOLD_TIMEOUT_MS
                while not identityReleaseReceived and GetGameTimer() < timeout do
                    Wait(0)
                end
            end
            identityHoldRequested, identityReleaseReceived = false, false

            ShutdownLoadingScreen()
            ShutdownLoadingScreenNui()
            TriggerEvent('overlord-loadingscreen:closed')

            isTransitioning = false

            -- Open the identity creator UI instead of the HUD
            exports['overlord-identify']:openCreatorUI()
        end)
    end
end)

-- This event can be triggered by your identity script after the player finishes creating their character
RegisterNetEvent('overlord-loadingscreen:playTransitionAndHUD')
AddEventHandler('overlord-loadingscreen:playTransitionAndHUD', function()
    if isTransitioning then return end
    isTransitioning = true

    local ped = PlayerPedId()

    Citizen.CreateThread(function()
        FreezeEntityPosition(ped, true)

        -- Fade out the screen to black smoothly
        DoScreenFadeOut(500)
        Wait(500)

        -- Move camera to the sky and wait for it to park there
        doSwitchOutToSky(ped)

        -- Fade back in to reveal the sky
        DoScreenFadeIn(500)

        -- Start dropping the camera down to the player and open HUD
        doSkyDropAndShowHUD()
    end)
end)

-- Resource-restart safety: if this resource gets restarted while a switch was
-- left in progress (player stuck frozen in the sky from a previous instance),
-- resolve it immediately instead of leaving them stranded until relog.
AddEventHandler('onResourceStart', function(resource)
    if resource ~= scriptName then return end
    if IsPlayerSwitchInProgress() then
        Citizen.CreateThread(doSkyDropAndShowHUD)
    end
end)

-- Resource-stop safety: never leave the player frozen or with the HUD hidden
-- if this resource is stopped mid-transition.
AddEventHandler('onResourceStop', function(resource)
    if resource ~= scriptName then return end
    ClearDrawOrigin()
    FreezeEntityPosition(PlayerPedId(), false)
end)
