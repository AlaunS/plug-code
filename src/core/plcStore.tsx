import { produce, type Draft } from "immer";
import type { ObjectType } from "../types/general";
import type { Listener } from "../types/store";

export class PlcStore<S extends ObjectType> {
    private state: S;
    private listeners = new Set<Listener<S>>();
    private batchQueue = new Set<keyof S | undefined>();
    private debug: boolean;
    
    private isBatching = false

    constructor(initial: S, debug: boolean) {
        debug = false;

        this.state = initial;
        this.debug = debug;
    }

    get<K extends keyof S>(key: K): S[K] {
        return this.state[key]
    }

    getState(): S {
        return this.state
    }

    set<K extends keyof S>(key: K, value: S[K]) {
        if (this.state[key] === value) return

        const oldValue = this.state[key]
        this.state = produce(this.state, draft => {
            (draft as any)[key] = value
        })

        if (this.debug) {
            console.log(`[Store][set] ${String(key)}:`, { oldValue, newValue: value })
        }


        if (this.isBatching) {
            this.batchQueue.add(key)
        } else {
            this.emit(key)
        }
    }

    batch(updater: (draft: Draft<S>) => void) {
        this.isBatching = true

        const nextState = produce(this.state, draft => {
            updater(draft)
        })

        if (nextState === this.state) {
            this.isBatching = false
            return
        }

        this.state = nextState
        this.isBatching = false

        this.batchQueue.forEach(key => this.emit(key))
        this.batchQueue.clear()
    }

    subscribe(listener: () => void): () => void
    subscribe<K extends keyof S>(key: K, listener: () => void): () => void
    subscribe<K extends keyof S>(keyOrListener: K | (() => void), maybeListener?: () => void): () => void {
        let listenerObj: Listener<S>

        if (typeof keyOrListener === "function") {
            listenerObj = { callback: keyOrListener }
        } else {
            listenerObj = { key: keyOrListener, callback: maybeListener! }
        }

        this.listeners.add(listenerObj)
        return () => {
            this.listeners.delete(listenerObj)
        }
    }

    private emit(changedKey?: keyof S) {
        this.listeners.forEach(l => {
            if (!l.key || l.key === changedKey) {
                if (this.debug) {
                    console.log(`[Store][emit] key: ${String(changedKey)}`, l)
                }
                l.callback()
            }
        })
    }
}