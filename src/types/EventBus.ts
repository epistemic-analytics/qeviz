export type EventBusListener = (details: { key: string, newValue: any, oldValue: any }) => any;

/**
 * Minimal local pub/sub used by vizena Graph and Layer objects.
 * Has the same API surface as arbor's StateManager but carries no R/arbor deps.
 */
export class EventBus {
  private _state: Map<string, any> = new Map();
  private listeners: Map<string, Map<string, Set<EventBusListener>>> = new Map();

  get state(): Map<string, any> {
    return this._state;
  }

  hasVariable(key: string): boolean {
    return this._state.has(key);
  }

  getVariable(key: string): any {
    return this._state.get(key);
  }

  setVariable(key: string, value: any, options?: { lazy?: boolean }): void {
    const oldValue = this._state.get(key);
    this._state.set(key, value);
    if (!options?.lazy) {
      this.notifyListeners(key, value, oldValue);
    }
  }

  addListener(key: string, type: string, listener: EventBusListener): void {
    if (!this.listeners.has(key)) this.listeners.set(key, new Map());
    const typeMap = this.listeners.get(key)!;
    if (!typeMap.has(type)) typeMap.set(type, new Set());
    typeMap.get(type)!.add(listener);
  }

  removeListener(key: string, type: string, listener: EventBusListener): void {
    this.listeners.get(key)?.get(type)?.delete(listener);
  }

  getListeners(key: string, type: string): EventBusListener[] {
    return Array.from(this.listeners.get(key)?.get(type) ?? []);
  }

  notifyListeners(key: string, newValue: any, oldValue: any): void {
    const typeMap = this.listeners.get(key);
    if (!typeMap) return;
    for (const set of typeMap.values()) {
      set.forEach((listener) => {
        if (typeof listener === 'function') {
          listener({ key, newValue, oldValue });
        } else if (typeof (listener as any).calculate === 'function') {
          (listener as any).calculate.call(listener, { key, newValue, oldValue });
        }
      });
    }
  }
}
