import { emitNuiMessage, getNuiConfig } from './NuiBridge.js';

const scenarios = new Map();

export function registerDebugScenario(name, steps) {
    if (typeof name !== 'string' || name.length === 0 || !Array.isArray(steps)) {
        throw new TypeError('A debug scenario requires a name and an array of steps.');
    }

    scenarios.set(name, steps.map((step) => ({ delay: 0, data: {}, ...step })));
    return () => scenarios.delete(name);
}

export async function runDebugScenario(name) {
    const { isBrowser } = getNuiConfig();
    if (!isBrowser) throw new Error('Debug scenarios may run only in browser mode.');

    const steps = scenarios.get(name);
    if (!steps) throw new Error(`Unknown debug scenario: ${name}`);

    for (const step of steps) {
        if (step.delay > 0) await new Promise((resolve) => setTimeout(resolve, step.delay));
        emitNuiMessage(step.action, step.data);
    }
}

export function listDebugScenarios() {
    return [...scenarios.keys()];
}
