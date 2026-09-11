Debug = {}

function Debug.Info(mgs)
    if not Config.Debug then
        print('[^5INFO^7]: ' .. mgs)
    end
end

function Debug.Success(mgs)
    if not Config.Debug then
        print('[^2Success^7]: ' .. mgs)
    end
end

function Debug.Warning(mgs)
    if not Config.Debug then
        print('[^3Warning^7]: ' .. mgs)
    end
end

function Debug.Error(mgs)
    if not Config.Debug then
        print('[^1Warning^7]: ' .. mgs)
    end
end

