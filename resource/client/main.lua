local resourceName = GetCurrentResourceName()

AddEventHandler('onClientResourceStart', function(startedResource)
    if startedResource ~= resourceName then
        return
    end

    -- Bootstrap client modules here when the resource needs runtime behavior.
end)

AddEventHandler('onClientResourceStop', function(stoppedResource)
    if stoppedResource ~= resourceName then
        return
    end

    -- Always release NUI focus during a resource restart/stop.
    SetNuiFocus(false, false)
end)
