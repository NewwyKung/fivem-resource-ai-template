const DEFAULT_STATUS = 'idle';
/** @typedef {'idle' | 'loading' | 'ready' | 'submitting' | 'success' | 'error'} FeatureStatus */
/** @typedef {{ code: string, messageKey: string | null, details: Record<string, unknown>, requestId: string | null, retryable: boolean }} FeatureError */
/** @template {Record<string, unknown>} T @typedef {{ status: FeatureStatus, data: T, error: FeatureError | null, requestId: string | null, updatedAt: number | null }} FeatureState */
const VALID_STATUS = new Set(['idle', 'loading', 'ready', 'submitting', 'success', 'error']);

/** @template {Record<string, unknown>} T @param {T} initialData @returns {T} */
function cloneInitialData(initialData) {
    return typeof structuredClone === 'function'
        ? structuredClone(initialData)
        : JSON.parse(JSON.stringify(initialData));
}

/** @template {Record<string, unknown>} T @param {T} initialData */
export function createFeatureState(initialData) {
    /** @type {FeatureState<T>} */
    const state = $state({
        status: DEFAULT_STATUS,
        data: cloneInitialData(initialData),
        error: null,
        requestId: null,
        updatedAt: null,
    });

    /** @param {FeatureStatus} status */
    function setStatus(status) {
        if (!VALID_STATUS.has(status)) {
            throw new TypeError(`Invalid feature state status: ${status}`);
        }
        state.status = status;
        state.updatedAt = Date.now();
    }

    return {
        state,
        /** @param {string | null} [requestId] */
        begin(requestId = null) {
            state.error = null;
            state.requestId = requestId;
            setStatus('loading');
        },
        /** @param {T} data */
        ready(data) {
            state.data = data;
            state.error = null;
            state.requestId = null;
            setStatus('ready');
        },
        /** @param {string | null} [requestId] */
        submit(requestId = null) {
            state.error = null;
            state.requestId = requestId;
            setStatus('submitting');
        },
        /** @param {T} [data] */
        succeed(data = state.data) {
            state.data = data;
            state.error = null;
            state.requestId = null;
            setStatus('success');
        },
        /** @param {unknown} error */
        fail(error) {
            state.error = normalizeFeatureError(error);
            state.requestId = null;
            setStatus('error');
        },
        /** @param {Partial<T>} partialData */
        patch(partialData) {
            if (!partialData || typeof partialData !== 'object') {
                throw new TypeError('Feature state patch requires an object.');
            }
            state.data = { ...state.data, ...partialData };
            state.updatedAt = Date.now();
        },
        reset() {
            state.status = DEFAULT_STATUS;
            state.data = cloneInitialData(initialData);
            state.error = null;
            state.requestId = null;
            state.updatedAt = Date.now();
        },
    };
}

/** @param {unknown} error @returns {FeatureError} */
export function normalizeFeatureError(error) {
    const candidate = /** @type {Record<string, unknown> | null} */ (error);
    if (candidate && typeof candidate.code === 'string') {
        return {
            code: candidate.code,
            messageKey: typeof candidate.messageKey === 'string' ? candidate.messageKey : null,
            details: candidate.details && typeof candidate.details === 'object'
                ? /** @type {Record<string, unknown>} */ (candidate.details)
                : {},
            requestId: typeof candidate.requestId === 'string' ? candidate.requestId : null,
            retryable: candidate.retryable === true,
        };
    }

    return {
        code: 'UNKNOWN_ERROR',
        messageKey: null,
        details: {
            message: error instanceof Error ? error.message : String(error),
        },
        requestId: null,
        retryable: false,
    };
}
