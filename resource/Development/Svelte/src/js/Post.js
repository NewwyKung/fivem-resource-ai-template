export const scriptName = 'SCRIPT_NAME';

export const Post = async (action = '', data = {}) => fetch(`https://${scriptName}/${action}`, {
    method: 'POST',
    body: JSON.stringify(data)
});