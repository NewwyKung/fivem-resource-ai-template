SendNuiEvent = function (action, data)
    if action ~= "IS_READY" then
        CreateThread(function()
            while not NUI_READY do
                Wait(500)
            end
        end)
    end

    if data then
        SendNUIMessage({
            action = action,
            data = data
        })
    else
        SendNUIMessage({
            action = action,
        })
    end
end