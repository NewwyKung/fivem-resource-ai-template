SendNuiEvent = function (action, data)
    if action ~= "IS_READY" then
        while not NUI_READY do
            Wait(100)
        end
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