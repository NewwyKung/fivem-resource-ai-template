export const scriptName = window.GetParentResourceName ? window.GetParentResourceName() : 'SCRIPT_NAME';

// FiveM's CEF routes NUI fetches by document context, not by hostname, so the literal
// host below does not need to match the resource name. In a plain browser the callback
// endpoint is unavailable; browser debug scenarios should simulate the response flow.
export const isBrowser = typeof window.invokeNative !== 'function';

export const Post = async (action = '', data = {}, options = {}) => fetch(`https://${scriptName}/${action}`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(data),
    signal: options.signal,
});
