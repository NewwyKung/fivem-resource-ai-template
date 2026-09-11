local resourceName = GetCurrentResourceName()
NUI_READY = false

Init = function()
    Debug.Info('Initialize Resource..')

    -- NUI_READY Init Nui
    repeat
		Wait(300)
		SendNuiEvent("IS_READY")
	until NUI_READY

    --[[
        Init Resource And data
    ]]
    Config.ClientLoaded()
    Debug.Success('Success Initialize !')
end

AddEventHandler('onClientResourceStart', function(startedResource)
    if startedResource ~= resourceName then
        return
    end

    -- Bootstrap client modules here when the resource needs runtime behavior.
    -- Add your own logic under resource/client/modules/ (see docs/module-loading.md)
    -- and wire it into resource/fxmanifest.lua the same way this file is loaded.
end)

AddEventHandler('onClientResourceStop', function(stoppedResource)
    if stoppedResource ~= resourceName then
        return
    end

    -- Always release NUI focus during a resource restart/stop.
    SetNuiFocus(false, false)
end)

-- Example ENUM for down size data
RegisterNetEvent(resourceName .. ':server:status', function(status)
    Debug.Info( 'Server Status: ' .. ENUM.SERVER_STATUS.RESULT[status])
end)

RegisterNUICallback("READY", function(data, cb)
    cb({ ok = true, requestId = data and data.requestId })
    NUI_READY = true
end)

Init()