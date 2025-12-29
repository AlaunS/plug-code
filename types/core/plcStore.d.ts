import { type Draft } from "immer";
import type { ObjectType } from "../types/general";
export declare class PlcStore<S extends ObjectType> {
    private state;
    private listeners;
    private batchQueue;
    private debug;
    private isBatching;
    constructor(initial: S, debug: boolean);
    get<K extends keyof S>(key: K): S[K];
    getState(): S;
    set<K extends keyof S>(key: K, value: S[K]): void;
    batch(updater: (draft: Draft<S>) => void): void;
    subscribe(listener: () => void): () => void;
    subscribe<K extends keyof S>(key: K, listener: () => void): () => void;
    private emit;
}
