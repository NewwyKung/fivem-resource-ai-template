--[[
    MCP dev bridge. Development-only HTTP control surface for an AI coding
    agent's write -> build -> restart -> log loop. See ../README.md.

    Never enable mcp_dev_mode on a server that is not a personal dev
    environment, and never commit a real mcp_token.
]]

if GetConvar('mcp_dev_mode', 'false') ~= 'true' then
    return
end

local MCP_TOKEN = GetConvar('mcp_token', '')
if MCP_TOKEN == '' then
    print('[mcp-dev-bridge] mcp_dev_mode is true but mcp_token is empty. Refusing to start the HTTP bridge.')
    return
end

local ALLOW_REMOTE = GetConvar('mcp_bridge_allow_remote', 'false') == 'true'

-- ---------------------------------------------------------------------
-- Own ring-buffer log capture (used when /mcp/logs asks for this
-- resource itself rather than a resource running dev_bridge_logger.lua).
-- ---------------------------------------------------------------------

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

local function readOwnLogs(lines, levelFilter)
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
end

-- ---------------------------------------------------------------------
-- Rate limiting + audit
-- ---------------------------------------------------------------------

local RATE_LIMIT_WINDOW_SECONDS = 10
local RATE_LIMIT_MAX_REQUESTS = 40
local rateState = {}

local function withinRateLimit(ip)
    local now = os.time()
    local entry = rateState[ip]
    if not entry or (now - entry.windowStart) >= RATE_LIMIT_WINDOW_SECONDS then
        entry = { windowStart = now, count = 0 }
        rateState[ip] = entry
    end
    entry.count = entry.count + 1
    return entry.count <= RATE_LIMIT_MAX_REQUESTS
end

local function audit(action, ip, ok, detail)
    rawPrint(('[mcp-dev-bridge] action=%s ip=%s ok=%s detail=%s'):format(
        action, ip or '?', tostring(ok), detail or ''
    ))
end

-- ---------------------------------------------------------------------
-- Whitelisted agent actions. No arbitrary command execution: see
-- ../README.md for why that was intentionally dropped from the spec.
-- ---------------------------------------------------------------------

local ACTIONS = {}

ACTIONS.teleport = function(payload)
    local serverId = payload.serverId and tostring(payload.serverId)
    local coords = payload.coords
    if not serverId or type(coords) ~= 'table' or not coords.x or not coords.y or not coords.z then
        return false, 'serverId and coords {x, y, z} are required'
    end

    local ped = GetPlayerPed(serverId)
    if not ped or ped == 0 then
        return false, ('no connected player with serverId %s'):format(serverId)
    end

    SetEntityCoords(ped, tonumber(coords.x), tonumber(coords.y), tonumber(coords.z), false, false, false, true)
    if coords.heading then
        SetEntityHeading(ped, tonumber(coords.heading))
    end
    return true, ('teleported serverId %s'):format(serverId)
end

ACTIONS.trigger_event = function(payload)
    local eventName = payload.event
    if type(eventName) ~= 'string' or eventName == '' then
        return false, 'event is required'
    end

    local args = type(payload.args) == 'table' and payload.args or {}

    if payload.target == nil or payload.target == 'server' then
        TriggerEvent(eventName, table.unpack(args))
        return true, ('triggered server event %s'):format(eventName)
    end

    local serverId = tostring(payload.target)
    TriggerClientEvent(eventName, serverId, table.unpack(args))
    return true, ('triggered client event %s for serverId %s'):format(eventName, serverId)
end

ACTIONS.give_item = function(payload)
    local serverId = payload.serverId and tostring(payload.serverId)
    if not serverId or not payload.item then
        return false, 'serverId and item are required'
    end

    -- Intentionally does not assume any inventory system. The resource
    -- under test owns the actual grant logic; this only fires the hook.
    local eventName = ('%s:mcp:giveItem'):format(GetCurrentResourceName())
    TriggerEvent(eventName, serverId, payload.item, tonumber(payload.count) or 1)
    return true, ('fired %s (resource must register a handler to grant the item)'):format(eventName)
end

ACTIONS.restart = function(payload)
    local resourceName = payload.resource
    if type(resourceName) ~= 'string' or resourceName == '' then
        return false, 'resource is required'
    end

    ExecuteCommand('restart ' .. resourceName)
    return true, ('restart issued for %s'):format(resourceName)
end

-- ---------------------------------------------------------------------
-- HTTP handler
-- ---------------------------------------------------------------------

local function isLocalAddress(address)
    if not address then
        return false
    end
    return address:find('^127%.0%.0%.1') ~= nil
        or address:find('^::1') ~= nil
        or address:find('^localhost') ~= nil
end

local function parseQuery(query)
    local params = {}
    if not query then
        return params
    end
    for key, value in query:gmatch('([^&=?]+)=([^&]*)') do
        params[key] = value:gsub('%%(%x%x)', function(hex)
            return string.char(tonumber(hex, 16))
        end):gsub('+', ' ')
    end
    return params
end

local function sendJson(res, status, body)
    res.writeHead(status, { ['Content-Type'] = 'application/json' })
    res.send(json.encode(body))
end

local function readBodyJson(req, cb)
    req.setDataHandler(function(body)
        local ok, payload = pcall(json.decode, body ~= '' and body or '{}')
        if not ok or type(payload) ~= 'table' then
            cb(nil, 'invalid json body')
            return
        end
        cb(payload, nil)
    end)
end

SetHttpHandler(function(req, res)
    local path = req.path or '/'
    local barePath, query = path:match('^([^?]*)%??(.*)$')
    local ip = (req.address or ''):match('^([^:]+)') or req.address

    if not ALLOW_REMOTE and not isLocalAddress(ip) then
        audit('blocked-remote', ip, false, barePath)
        sendJson(res, 403, { error = 'remote access disabled; set mcp_bridge_allow_remote true to override (not recommended)' })
        return
    end

    if not withinRateLimit(ip or 'unknown') then
        sendJson(res, 429, { error = 'rate limit exceeded' })
        return
    end

    local authHeader = req.headers['Authorization'] or req.headers['authorization']
    if authHeader ~= ('Bearer %s'):format(MCP_TOKEN) then
        audit('auth-failed', ip, false, barePath)
        sendJson(res, 401, { error = 'unauthorized' })
        return
    end

    if barePath == '/mcp/logs' and req.method == 'GET' then
        local params = parseQuery(query)
        local lines = math.min(tonumber(params.lines) or 20, 200)
        local levelFilter = params.level
        local targetResource = params.resource

        if targetResource and targetResource ~= GetCurrentResourceName() then
            local ok, result = pcall(function()
                return exports[targetResource]:mcp_getLogs(lines, levelFilter)
            end)
            if not ok or result == nil then
                audit('logs', ip, false, ('resource=%s has no dev_bridge_logger.lua installed'):format(targetResource))
                sendJson(res, 404, {
                    error = ('resource "%s" has no mcp log export; copy dev_bridge_logger.lua into its server/ scripts'):format(targetResource),
                })
                return
            end
            audit('logs', ip, true, ('resource=%s lines=%d'):format(targetResource, #result))
            sendJson(res, 200, { resource = targetResource, lines = result })
            return
        end

        local result = readOwnLogs(lines, levelFilter)
        audit('logs', ip, true, ('resource=%s lines=%d'):format(GetCurrentResourceName(), #result))
        sendJson(res, 200, { resource = GetCurrentResourceName(), lines = result })
        return
    end

    if barePath == '/mcp/db/schema' and req.method == 'GET' then
        -- Read-only introspection: only ever runs SHOW TABLES / DESCRIBE,
        -- never a caller-supplied query, so there is no SQL injection
        -- surface and no write/delete/update path exists here at all.
        if GetResourceState('oxmysql') ~= 'started' then
            sendJson(res, 501, { error = 'oxmysql is not running on this server; live schema introspection is unavailable' })
            return
        end

        local okTables, tableRows = pcall(function()
            return exports.oxmysql:executeSync('SHOW TABLES')
        end)
        if not okTables or type(tableRows) ~= 'table' then
            audit('db-schema', ip, false, 'SHOW TABLES failed')
            sendJson(res, 500, { error = 'SHOW TABLES query failed' })
            return
        end

        local schema = {}
        for _, row in ipairs(tableRows) do
            local tableName
            for _, value in pairs(row) do
                tableName = value
                break
            end
            -- Table names come from SHOW TABLES itself, not caller input,
            -- but this is still validated before interpolation as defense
            -- in depth (identifiers cannot be bound as query parameters).
            if type(tableName) == 'string' and tableName:match('^[%w_]+$') then
                local okDescribe, columns = pcall(function()
                    return exports.oxmysql:executeSync('DESCRIBE `' .. tableName .. '`')
                end)
                schema[#schema + 1] = { table = tableName, columns = okDescribe and columns or nil }
            end
        end

        audit('db-schema', ip, true, ('tables=%d'):format(#schema))
        sendJson(res, 200, { tables = schema })
        return
    end

    if barePath == '/mcp/players' and req.method == 'GET' then
        local players = {}
        for _, serverId in ipairs(GetPlayers()) do
            local ped = GetPlayerPed(serverId)
            local coords = ped and ped ~= 0 and GetEntityCoords(ped) or nil
            players[#players + 1] = {
                serverId = serverId,
                name = GetPlayerName(serverId),
                coords = coords and { x = coords.x, y = coords.y, z = coords.z } or nil,
            }
        end
        audit('players', ip, true, ('count=%d'):format(#players))
        sendJson(res, 200, { players = players })
        return
    end

    if barePath == '/mcp/restart' and req.method == 'POST' then
        readBodyJson(req, function(payload, err)
            if err then
                sendJson(res, 400, { error = err })
                return
            end
            local ok, message = ACTIONS.restart(payload)
            audit('restart', ip, ok, message)
            sendJson(res, ok and 200 or 400, { ok = ok, message = message })
        end)
        return
    end

    if barePath == '/mcp/agent/action' and req.method == 'POST' then
        readBodyJson(req, function(payload, err)
            if err then
                sendJson(res, 400, { error = err })
                return
            end

            local handler = type(payload.action) == 'string' and ACTIONS[payload.action]
            if not handler then
                sendJson(res, 400, {
                    error = 'unknown action',
                    allowed = { 'teleport', 'trigger_event', 'give_item', 'restart' },
                })
                return
            end

            local ok, message = handler(payload)
            audit(payload.action, ip, ok, message)
            sendJson(res, ok and 200 or 400, { ok = ok, message = message })
        end)
        return
    end

    sendJson(res, 404, { error = 'not found' })
end)

rawPrint(('[mcp-dev-bridge] active. resource=%s allow_remote=%s'):format(
    GetCurrentResourceName(), tostring(ALLOW_REMOTE)
))
