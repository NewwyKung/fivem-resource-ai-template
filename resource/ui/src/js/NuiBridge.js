import { isBrowser, Post, scriptName } from './Post.js';

/** @typedef {(data: unknown) => void} NuiMessageHandler */
/** @typedef {{ fallbackResourceName?: string, allowEscapeKey?: boolean, defaultTimeout?: number, maxPendingRequests?: number }} NuiConfigOptions */
/** @typedef {{ timeout?: number, requestId?: string, validate?: (result: NuiResult) => boolean }} NuiRequestOptions */
/** @typedef {{ ok: boolean, data?: unknown, error?: unknown, requestId: string, [key: string]: unknown }} NuiResult */
/** @typedef {{ action: string, data?: unknown }} NuiMessage */
/** @typedef {{ action: string, startedAt: number, controller: AbortController, abortReason: 'timeout' | 'disposed' | null }} PendingRequest */

const config = {
    fallbackResourceName: 'resource',
    allowEscapeKey: true,
    defaultTimeout: 5000,
    maxPendingRequests: 64,
};
const ACTION_PATTERN = /^[A-Za-z][A-Za-z0-9:_-]{0,63}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9:_-]{1,64}$/;

/** @type {Map<string, Set<NuiMessageHandler>>} */
const listeners = new Map();
/** @type {Map<string, PendingRequest>} */
const pendingRequests = new Map();
let requestSequence = 0;
let disposed = false;

export class NuiError extends Error {
    /**
     * @param {string} code
     * @param {string} message
     * @param {Record<string, unknown>} [details]
     */
    constructor(code, message, details = {}) {
        super(message);
        this.name = 'NuiError';
        this.code = code;
        this.details = details;
        this.messageKey = typeof details.messageKey === 'string' ? details.messageKey : `error.${code.toLowerCase()}`;
        this.requestId = typeof details.requestId === 'string' ? details.requestId : null;
        this.retryable = details.retryable === true;
    }
}

/**
 * Retries only when the caller explicitly declares an operation idempotent.
 * Mutations such as purchases must use sendNuiCallback directly.
 * @param {string} action
 * @param {Record<string, unknown>} [data]
 * @param {NuiRequestOptions & { idempotent: true, retries?: number }} [options]
 */
export async function sendIdempotentNuiCallback(action, data = {}, options) {
    if (options?.idempotent !== true) {
        throw new TypeError('NUI retry requires idempotent: true.');
    }

    const retries = typeof options.retries === 'number'
        ? Math.min(Math.max(Math.trunc(options.retries), 0), 2)
        : 1;
    const requestOptions = {
        ...options,
        requestId: options.requestId ?? createRequestId(action),
    };
    let attempt = 0;

    while (true) {
        try {
            return await sendNuiCallback(action, data, requestOptions);
        } catch (error) {
            const retryable = error instanceof NuiError
                && ['NUI_TIMEOUT', 'NUI_NETWORK_ERROR'].includes(error.code);
            if (!retryable || attempt >= retries) throw error;
            attempt += 1;
        }
    }
}

/** @param {NuiConfigOptions} [options] */
export function configureNui(options = {}) {
    if (typeof options.fallbackResourceName === 'string' && options.fallbackResourceName.length > 0) {
        config.fallbackResourceName = options.fallbackResourceName;
    }

    if (typeof options.allowEscapeKey === 'boolean') {
        config.allowEscapeKey = options.allowEscapeKey;
    }

    if (typeof options.defaultTimeout === 'number' && Number.isFinite(options.defaultTimeout) && options.defaultTimeout > 0) {
        config.defaultTimeout = Math.min(Math.max(Math.trunc(options.defaultTimeout), 100), 60000);
    }

    if (typeof options.maxPendingRequests === 'number' && Number.isInteger(options.maxPendingRequests) && options.maxPendingRequests > 0) {
        config.maxPendingRequests = Math.min(options.maxPendingRequests, 256);
    }

    return getNuiConfig();
}

export function getNuiConfig() {
    return Object.freeze({ ...config, resourceName: scriptName || config.fallbackResourceName, isBrowser });
}

/** @param {string} action */
function createRequestId(action) {
    requestSequence = (requestSequence + 1) % Number.MAX_SAFE_INTEGER;
    return `${action.slice(0, 24)}:${Date.now().toString(36)}:${requestSequence.toString(36)}`;
}

/**
 * @param {unknown} result
 * @param {string} requestId
 * @returns {NuiResult}
 */
function validateResult(result, requestId) {
    const candidate = /** @type {Partial<NuiResult> | null} */ (result);
    if (!candidate || typeof candidate !== 'object' || typeof candidate.ok !== 'boolean') {
        throw new NuiError('NUI_INVALID_RESPONSE', 'NUI callback returned an invalid response.', {
            requestId,
            result,
        });
    }

    if (candidate.requestId !== requestId) {
        throw new NuiError('NUI_STALE_RESPONSE', 'NUI callback did not return the matching request ID.', {
            requestId,
            receivedRequestId: candidate.requestId,
        });
    }

    return /** @type {NuiResult} */ (candidate);
}

/**
 * @param {string} action
 * @param {Record<string, unknown>} [data]
 * @param {NuiRequestOptions} [options]
 * @returns {Promise<NuiResult>}
 */
export async function sendNuiCallback(action, data = {}, options = {}) {
    if (disposed) {
        throw new NuiError('NUI_DISPOSED', 'The NUI bridge has been disposed.');
    }
    if (typeof action !== 'string' || !ACTION_PATTERN.test(action)) {
        throw new TypeError('NUI callback action must match the bounded action contract.');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new TypeError('NUI callback data must be an object.');
    }

    if (pendingRequests.size >= config.maxPendingRequests) {
        throw new NuiError('NUI_PENDING_LIMIT', 'Too many NUI callbacks are pending.');
    }

    const timeout = typeof options.timeout === 'number' && Number.isFinite(options.timeout) && options.timeout > 0
        ? options.timeout
        : config.defaultTimeout;
    const requestId = options.requestId ?? createRequestId(action);
    if (typeof requestId !== 'string' || !REQUEST_ID_PATTERN.test(requestId)) {
        throw new TypeError('NUI request ID must match the bounded request contract.');
    }
    if (pendingRequests.has(requestId)) {
        throw new NuiError('NUI_DUPLICATE_REQUEST_ID', 'A NUI callback with this request ID is already pending.', {
            action,
            requestId,
        });
    }
    const controller = new AbortController();
    /** @type {PendingRequest} */
    const pendingRequest = { action, startedAt: Date.now(), controller, abortReason: null };
    const timeoutId = window.setTimeout(() => {
        pendingRequest.abortReason = 'timeout';
        controller.abort();
    }, timeout);

    pendingRequests.set(requestId, pendingRequest);

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

        if (error instanceof Error && error.name === 'AbortError') {
            if (pendingRequest.abortReason === 'disposed') {
                throw new NuiError('NUI_DISPOSED', 'The NUI bridge was disposed while the callback was pending.', {
                    action,
                    requestId,
                });
            }
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

/**
 * @param {string} action
 * @param {unknown} [data]
 */
export function emitNuiMessage(action, data = {}) {
    if (typeof action !== 'string' || !ACTION_PATTERN.test(action)) {
        throw new TypeError('NUI message action must match the bounded action contract.');
    }

    window.postMessage({ action, data }, '*');
}

/**
 * @param {string} action
 * @param {NuiMessageHandler} callback
 */
export function onNuiMessage(action, callback) {
    if (typeof action !== 'string' || !ACTION_PATTERN.test(action) || typeof callback !== 'function') {
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

/**
 * @param {string} action
 * @param {NuiMessageHandler} callback
 */
export function onceNuiMessage(action, callback) {
    let dispose = () => {};
    dispose = onNuiMessage(action, (data) => {
        dispose();
        callback(data);
    });
    return dispose;
}

/** @param {NuiMessage} message */
export function dispatchNuiMessage(message) {
    if (!message || typeof message.action !== 'string' || !ACTION_PATTERN.test(message.action)) return false;

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
    /** @param {KeyboardEvent} event */
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
    disposed = true;
    for (const request of pendingRequests.values()) {
        if (request.abortReason === null) request.abortReason = 'disposed';
        request.controller.abort();
    }
    pendingRequests.clear();
    listeners.clear();
}

export function getNuiDiagnostics() {
    return Object.freeze({
        pendingRequestCount: pendingRequests.size,
        listenerActionCount: listeners.size,
        disposed,
    });
}
