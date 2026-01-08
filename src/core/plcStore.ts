import { produce, Draft } from "immer";
import { shallowEqual } from "./helpers/core";

export type Listener = () => void;
export type keyListenerMap = Map<string, Set<Listener>>;

export class PlcStore {
    private storeData: Map<string, any> = new Map();
    private substoresData: Map<string, Map<string, any>> = new Map();
    
    private subscriptions: keyListenerMap = new Map();
    private isBatching = false;
    private dirtyKeys: Set<string> = new Set();
    private activeDependencyTracker: Map<string, any> | null = null;

    // ----------------------
    // Root store
    // ----------------------
    createStore<K extends string, T>(key: K, initial: T) {
        if (this.storeData.has(key)) return;
        this.storeData.set(key, initial);
        this.markDirty(key);
    }

    getStore(key: string) {
        const value = this.storeData.get(key);
        this.recordDependency(key, value);
        return value;
    }

    setStore<T>(key: string, updater: T | ((draft: Draft<T>) => void | T)) {
        const prev = this.storeData.get(key);

        const next = typeof updater === 'function'
            ? produce(prev, updater as any)
            : updater;

        if (shallowEqual(prev, next)) return;

        this.storeData.set(key, next);
        this.markDirty(key);
    }

    // ----------------------
    // Substores
    // ----------------------
    createSubstore<K extends string, T>(substore: string, key: K, initial: T) {
        if (!this.substoresData.has(substore)) this.substoresData.set(substore, new Map());
        const fStore = this.substoresData.get(substore)!;
        
        if (fStore.has(key)) return;
        
        fStore.set(key, initial);
        this.markDirty(`${substore}:${key}`);
    }

    getSubstore(substore: string, key: string) {
        const fStore = this.substoresData.get(substore);
        const value = fStore?.get(key);
        this.recordDependency(`${substore}:${key}`, value);
        return value;
    }

    setSubstore<T>(substore: string, key: string, updater: T | ((draft: Draft<T>) => void | T)) {
        if (!this.substoresData.has(substore)) this.substoresData.set(substore, new Map());
        const fStore = this.substoresData.get(substore)!;
        
        const prev = fStore.get(key);

        const next = typeof updater === 'function'
            ? produce(prev, updater as any)
            : updater;

        if (shallowEqual(prev, next)) return;
        
        fStore.set(key, next);
        this.markDirty(`${substore}:${key}`);
    }

    // ----------------------
    // Dependency tracking
    // ----------------------
    protected recordDependency(key: string, value: any) {
        if (this.activeDependencyTracker) this.activeDependencyTracker.set(key, value);
    }

    async runWithDependencyTracker<T>(tracker: Map<string, any> | null, fn: () => T | Promise<T>): Promise<T> {
        const prev = this.activeDependencyTracker;
        this.activeDependencyTracker = tracker;
        try {
            return await fn();
        } finally {
            this.activeDependencyTracker = prev;
        }
    }

    // ----------------------
    // Subscriptions & batching
    // ----------------------
    batch(fn: () => void) {
        const prev = this.isBatching;
        this.isBatching = true;
        try {
            fn();
        } finally {
            this.isBatching = prev;
            this.flush();
        }
    }

    subscribe(key: string, listener: Listener): () => void {
        if (!this.subscriptions.has(key)) this.subscriptions.set(key, new Set());
        this.subscriptions.get(key)!.add(listener);
        return () => this.subscriptions.get(key)!.delete(listener);
    }

    private markDirty(key: string) {
        if (this.isBatching) this.dirtyKeys.add(key);
        else this.notify(key);
    }

    private flush() {
        if (this.isBatching) return;
        for (const key of this.dirtyKeys) this.notify(key);
        this.dirtyKeys.clear();
    }

    private notify(key: string) {
        const listeners = this.subscriptions.get(key);
        listeners?.forEach(fn => {
            try { fn(); } catch (err) { console.error('[PlcStore] listener threw', err); }
        });
    }
}

// ----------------------
// LRUCache
// ----------------------
export class LRUCache<K, V> {
    private map: Map<K, V> = new Map<K, V>();

    constructor(private maxEntries: number = 100) { }

    get(key: K): V | undefined {
        if (!this.map.has(key)) return undefined;
        const val = this.map.get(key)!;
        this.map.delete(key);
        this.map.set(key, val);
        return val;
    }

    set(key: K, value: V) {
        if (this.map.has(key)) this.map.delete(key);
        else if (this.map.size >= this.maxEntries) {
            const oldest = this.map.keys().next().value as K;
            this.map.delete(oldest);
        }
        this.map.set(key, value);
    }

    delete(key: K) {
        this.map.delete(key);
    }

    clear() {
        this.map.clear();
    }
}