import { isBrowser, Post, scriptName } from './Post.js';

const config = {
    fallbackResourceName: 'resource',
    allowEscapeKey: true,
    defaultTimeout: 5000,
    maxPendingRequests: 64,
};

const listeners = new Map();
const pendingRequests = new Map();
let requestSequence = 0;

export class NuiError extends Error {
    constructor(code, message, details = {}) {
        super(message);
        this.name = 'NuiError';
        this.code = code;
        this.details = details;
    }
}

export function configureNui(options = {}) {
    if (typeof options.fallbackResourceName === 'string' && options.fallbackResourceName.length > 0) {
        config.fallbackResourceName = options.fallbackResourceName;
    }

    if (typeof options.allowEscapeKey === 'boolean') {
        config.allowEscapeKey = options.allowEscapeKey;
    }

    if (Number.isFinite(options.defaultTimeout) && options.defaultTimeout > 0) {
        config.defaultTimeout = options.defaultTimeout;
    }

    if (Number.isInteger(options.maxPendingRequests) && options.maxPendingRequests > 0) {
        config.maxPendingRequests = options.maxPendingRequests;
    }

    return getNuiConfig();
}

export function getNuiConfig() {
    return Object.freeze({ ...config, resourceName: scriptName || config.fallbackResourceName, isBrowser });
}

function createRequestId(action) {
    requestSequence = (requestSequence + 1) % Number.MAX_SAFE_INTEGER;
    return `${action}:${Date.now()}:${requestSequence}`;
}

function validateResult(result, requestId) {
    if (!result || typeof result !== 'object' || typeof result.ok !== 'boolean') {
        throw new NuiError('NUI_INVALID_RESPONSE', 'NUI callback returned an invalid response.', {
            requestId,
            result,
        });
    }

    return result;
}

export async function sendNuiCallback(action, data = {}, options = {}) {
    if (typeof action !== 'string' || action.length === 0) {
        throw new TypeError('NUI callback action must be a non-empty string.');
    }

    if (pendingRequests.size >= config.maxPendingRequests) {
        throw new NuiError('NUI_PENDING_LIMIT', 'Too many NUI callbacks are pending.');
    }

    const timeout = Number.isFinite(options.timeout) && options.timeout > 0
        ? options.timeout
        : config.defaultTimeout;
    const requestId = options.requestId || createRequestId(action);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeout);

    pendingRequests.set(requestId, { action, startedAt: Date.now(), controller });

    try {
        const response = await Post(action, { ...data, requestId }, { signal: controller.signal });

        if (!response.ok) {
            throw new NuiError('NUI_CALLBACK_FAILED', `NUI callback failed with HTTP ${response.status}.`, {
                action,
                requestId,
                status: response.status,
            });
        }

        const contentType = response.headers.get('content-type') || '';
        const result = contentType.includes('application/json')
            ? await response.json()
            : { ok: true, data: await response.text(), error: null, requestId };

        const validated = validateResult(result, requestId);
        if (typeof options.validate === 'function' && !options.validate(validated)) {
            throw new NuiError('NUI_INVALID_RESPONSE', 'NUI callback response failed schema validation.', {
                action,
                requestId,
            });
        }

        return validated;
    } catch (error) {
        if (error instanceof NuiError) throw error;

        if (error?.name === 'AbortError') {
            throw new NuiError('NUI_TIMEOUT', `NUI callback timed out after ${timeout}ms.`, {
                action,
                requestId,
                timeout,
            });
        }

        throw new NuiError('NUI_NETWORK_ERROR', 'Unable to reach the NUI callback.', {
            action,
            requestId,
            cause: error instanceof Error ? error.message : String(error),
        });
    } finally {
        window.clearTimeout(timeoutId);
        pendingRequests.delete(requestId);
    }
}

export function emitNuiMessage(action, data = {}) {
    if (typeof action !== 'string' || action.length === 0) {
        throw new TypeError('NUI message action must be a non-empty string.');
    }

    window.postMessage({ action, data }, '*');
}

export function onNuiMessage(action, callback) {
    if (typeof action !== 'string' || typeof callback !== 'function') {
        throw new TypeError('onNuiMessage requires an action and callback.');
    }

    const handlers = listeners.get(action) || new Set();
    handlers.add(callback);
    listeners.set(action, handlers);

    return () => {
        handlers.delete(callback);
        if (handlers.size === 0) listeners.delete(action);
    };
}

export function onceNuiMessage(action, callback) {
    let dispose = () => {};
    dispose = onNuiMessage(action, (data) => {
        dispose();
        callback(data);
    });
    return dispose;
}

export function dispatchNuiMessage(message) {
    if (!message || typeof message.action !== 'string') return false;

    const handlers = listeners.get(message.action);
    if (!handlers) return false;

    for (const handler of [...handlers]) {
        try {
            handler(message.data);
        } catch (error) {
            console.error(`[NUI:${message.action}] listener failed`, error);
        }
    }

    return true;
}

export function bindEscape(closeAction = 'CLOSE') {
    const handler = (event) => {
        if (event.key !== 'Escape' || !config.allowEscapeKey) return;
        void sendNuiCallback(closeAction).catch((error) => {
            console.error('[NUI] Failed to close with Escape.', error);
        });
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
}

export function disposeNuiBridge() {
    for (const request of pendingRequests.values()) request.controller.abort();
    pendingRequests.clear();
    listeners.clear();
}

export function getNuiDiagnostics() {
    return Object.freeze({
        pendingRequestCount: pendingRequests.size,
        listenerActionCount: listeners.size,
    });
}
