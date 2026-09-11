--[[
    Opt-in log capture for the MCP dev bridge (see README.md in this
    folder). Copy this file into the server/ folder of the resource you
    want /mcp/logs to cover, and list it FIRST in that resource's
    server_scripts so it captures everything printed after it.

    Does nothing unless mcp_dev_mode is true, so it is safe to leave in a
    branch as long as that convar stays off in production.
]]

if GetConvar('mcp_dev_mode', 'false') ~= 'true' then
    return
end

local LOG_BUFFER = {}
local LOG_BUFFER_MAX = 300
local rawPrint = print

local function levelOf(message)
    local lower = message:lower()
    if lower:find('error', 1, true) or lower:find('fatal', 1, true) then
        return 'error'
    elseif lower:find('warn', 1, true) then
        return 'warn'
    end
    return 'info'
end

print = function(...)
    local parts = {}
    for i = 1, select('#', ...) do
        parts[#parts + 1] = tostring(select(i, ...))
    end
    local message = table.concat(parts, '\t')

    LOG_BUFFER[#LOG_BUFFER + 1] = { ts = os.time(), level = levelOf(message), message = message }
    if #LOG_BUFFER > LOG_BUFFER_MAX then
        table.remove(LOG_BUFFER, 1)
    end

    rawPrint(...)
end

exports('mcp_getLogs', function(lines, levelFilter)
    lines = math.min(tonumber(lines) or 20, 200)
    local out = {}
    for i = #LOG_BUFFER, 1, -1 do
        local entry = LOG_BUFFER[i]
        if not levelFilter or entry.level == levelFilter then
            table.insert(out, 1, entry)
            if #out >= lines then
                break
            end
        end
    end
    return out
end)
