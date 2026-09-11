local resourceName = GetCurrentResourceName()

Init = function()
    Debug.Info('Initialize Resource..')
    --[[
        Init Resource And data
    ]]
    Config.ServerLoaded()
    Debug.Success('Success Initialize !')
end

-- Add your own logic under resource/server/modules/ (see docs/module-loading.md)
-- and wire it into resource/fxmanifest.lua the same way this file is loaded.

-- example enum
CreateThread(function()
    while true do
        Wait(3000)
        local status = math.random(1, 2) == 1 and 'COMPLETE' or 'FAIL'
        TriggerClientEvent(resourceName .. ':server:status', -1, ENUM.SERVER_STATUS.CODE[status])
    end
end)

Init()