Debug = {}

function Debug.Info(mgs)
    if Config.Debug then
        print('[^5INFO^7]: ' .. mgs)
    end
end

function Debug.Success(mgs)
    if Config.Debug then
        print('[^2Success^7]: ' .. mgs)
    end
end

function Debug.Warning(mgs)
    if Config.Debug then
        print('[^3Warning^7]: ' .. mgs)
    end
end

function Debug.Error(mgs)
    if Config.Debug then
        print('[^1Error^7]: ' .. mgs)
    end
end

