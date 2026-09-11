local resourceName = GetCurrentResourceName()

Init = function()
    Debug.Info('Initialize Resource..')
    --[[
        Init Resource And data
    ]]
    Config.ServerLoaded()
    Debug.Success('Success Initialize !')
end

-- example enum
CreateThread(function()
    while true do
        Wait(3000)
        local status = math.random(1,2) > 2 and 'COMPLETE' or 'FAIL'
        TriggerClientEvent(resourceName .. ':client:status', ENUM.SERVER_STATUS.CODE[status])
    end
end)

Init()