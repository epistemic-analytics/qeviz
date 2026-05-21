export const DEBUG: boolean = (globalThis as any).__QEVIZ_DEBUG__ === true;

export function dbg(...args: any[]): void {
  if (DEBUG) console.log(...args);
}
