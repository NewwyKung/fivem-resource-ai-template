---@meta

---@alias PlayerId integer|string

---@class vector2
---@field x number
---@field y number

---@class vector3
---@field x number
---@field y number
---@field z number

---@class vector4
---@field x number
---@field y number
---@field z number
---@field w number

---@class NuiResult<T>
---@field ok boolean
---@field data T?
---@field error string?
---@field requestId string?

---@class FeatureError
---@field code string
---@field messageKey string?
---@field details table?

---@class RuntimeTestResult
---@field name string
---@field passed boolean
---@field error string?

---@param milliseconds integer
function Wait(milliseconds) end

---@param callback fun()
---@return thread
function CreateThread(callback) end

---@param milliseconds integer
---@param callback fun()
function SetTimeout(milliseconds, callback) end

---@param eventName string
---@param callback? fun(...: any)
---@return integer
function RegisterNetEvent(eventName, callback) end

---@param eventName string
---@param callback fun(...: any)
---@return integer
function AddEventHandler(eventName, callback) end

---@param handlerId integer
function RemoveEventHandler(handlerId) end

---@param eventName string
---@param target PlayerId
---@param ... any
function TriggerClientEvent(eventName, target, ...) end

---@param eventName string
---@param ... any
function TriggerServerEvent(eventName, ...) end

---@param eventName string
---@param ... any
function TriggerEvent(eventName, ...) end

---@param callbackType string
---@param callback fun(data: table, cb: fun(response: any))
function RegisterNUICallback(callbackType, callback) end

---@param hasFocus boolean
---@param hasCursor boolean
function SetNuiFocus(hasFocus, hasCursor) end

---@param message table
---@return boolean
function SendNUIMessage(message) end

---@return string
function GetCurrentResourceName() end

---@param resourceName string
---@return string
function GetResourceState(resourceName) end

---@param resourceName string
---@param fileName string
---@return string?
function LoadResourceFile(resourceName, fileName) end

---@param resourceName string
---@param fileName string
---@param data string
---@param dataLength integer
---@return boolean
function SaveResourceFile(resourceName, fileName, data, dataLength) end

---@param source PlayerId
---@return integer
function GetPlayerPing(source) end

---@param source PlayerId
---@return integer
function GetPlayerPed(source) end

---@param source PlayerId
---@return string
function GetPlayerName(source) end

---@return PlayerId[]
function GetPlayers() end

---@param entity integer
---@return boolean
function DoesEntityExist(entity) end

---@param entity integer
---@return vector3
function GetEntityCoords(entity) end

---@param entity integer
---@param x number
---@param y number
---@param z number
---@param alive boolean?
---@param deadFlag boolean?
---@param ragdollFlag boolean?
---@param clearArea boolean?
function SetEntityCoords(entity, x, y, z, alive, deadFlag, ragdollFlag, clearArea) end

---@param entity integer
---@param heading number
function SetEntityHeading(entity, heading) end

---@param commandString string
function ExecuteCommand(commandString) end

---@param handler fun(req: table, res: table)
function SetHttpHandler(handler) end

---@param entity integer
---@return integer
function NetworkGetNetworkIdFromEntity(entity) end

---@param netId integer
---@return integer
function NetworkGetEntityFromNetworkId(netId) end

---@param entity integer
function DeleteEntity(entity) end

---@class ExportsTable
---@field [string] table<string, fun(...: any): any>
---@overload fun(name: string, callback: fun(...: any): any)
exports = {}

---@class Json
---@field encode fun(value: any, options: table?): string
---@field decode fun(value: string): any
json = {}

---@generic T
---@param value T
---@return T
function vector2(value) end

---@generic T
---@param value T
---@return T
function vector3(value) end

---@generic T
---@param value T
---@return T
function vector4(value) end
