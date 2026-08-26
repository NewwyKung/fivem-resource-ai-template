export {};

declare global {
    interface Window {
        GetParentResourceName?: () => string;
    }
}
