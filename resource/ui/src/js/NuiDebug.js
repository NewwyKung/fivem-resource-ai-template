import { emitNuiMessage, getNuiConfig } from './NuiBridge.js';

/** @typedef {{ action: string, delay?: number, data?: unknown }} DebugStep */
/** @type {Map<string, DebugStep[]>} */
const scenarios = new Map();

/**
 * @param {string} name
 * @param {DebugStep[]} steps
 */
export function registerDebugScenario(name, steps) {
    if (typeof name !== 'string' || name.length === 0 || !Array.isArray(steps)) {
        throw new TypeError('A debug scenario requires a name and an array of steps.');
    }

    scenarios.set(name, steps.map((step) => ({ delay: 0, data: {}, ...step })));
    return () => scenarios.delete(name);
}

/** @param {string} name */
export async function runDebugScenario(name) {
    const { isBrowser } = getNuiConfig();
    if (!isBrowser) throw new Error('Debug scenarios may run only in browser mode.');

    const steps = scenarios.get(name);
    if (!steps) throw new Error(`Unknown debug scenario: ${name}`);

    for (const step of steps) {
        const delay = step.delay ?? 0;
        if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
        emitNuiMessage(step.action, step.data);
    }
}

export function listDebugScenarios() {
    return [...scenarios.keys()];
}
