export {};

declare global {
  interface Window {
    GetParentResourceName?: () => string;
    invokeNative?: (...arguments_: unknown[]) => unknown;
  }
}
