const DEFAULT_STATUS = 'idle';
const VALID_STATUS = new Set(['idle', 'loading', 'ready', 'submitting', 'success', 'error']);

function cloneInitialData(initialData) {
    return typeof structuredClone === 'function'
        ? structuredClone(initialData)
        : JSON.parse(JSON.stringify(initialData));
}

export function createFeatureState(initialData = {}) {
    const state = $state({
        status: DEFAULT_STATUS,
        data: cloneInitialData(initialData),
        error: null,
        requestId: null,
        updatedAt: null,
    });

    function setStatus(status) {
        if (!VALID_STATUS.has(status)) {
            throw new TypeError(`Invalid feature state status: ${status}`);
        }
        state.status = status;
        state.updatedAt = Date.now();
    }

    return {
        state,
        begin(requestId = null) {
            state.error = null;
            state.requestId = requestId;
            setStatus('loading');
        },
        ready(data) {
            state.data = data;
            state.error = null;
            state.requestId = null;
            setStatus('ready');
        },
        submit(requestId = null) {
            state.error = null;
            state.requestId = requestId;
            setStatus('submitting');
        },
        succeed(data = state.data) {
            state.data = data;
            state.error = null;
            state.requestId = null;
            setStatus('success');
        },
        fail(error) {
            state.error = normalizeFeatureError(error);
            state.requestId = null;
            setStatus('error');
        },
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

export function normalizeFeatureError(error) {
    if (error && typeof error === 'object' && typeof error.code === 'string') {
        return {
            code: error.code,
            messageKey: error.messageKey || null,
            details: error.details || {},
        };
    }

    return {
        code: 'UNKNOWN_ERROR',
        messageKey: null,
        details: {
            message: error instanceof Error ? error.message : String(error),
        },
    };
}
