import React from "react";
import { shallowEqual, deepEqual } from "./helpers/core";
import { CommandFn, CommandWrapper, transformerType } from "../types/core/api";
import { ModuleManifest, ObjectType } from "../types/core/general"
import { PlcPipeline } from "./plcPipeline";
import { LRUCache, PlcStore } from "./plcStore"
import { Priority, Scheduler } from "./plcScheduler";
import { Draft } from "immer"
import { PlcLayout } from "./ui/plcLayout";
import { SlotWrapper } from "../types/core/ui";

import {
    CommandRegistry,
    FeatureRegistry,
    StoreKey,
    CommandKey,
    SlotKey,
    FeatureKey,
    StoreValue,
    SlotProps
} from "../types/registry";

type ReceiveCacheEntry = {
    input: any,
    result: any,
    dependencies: Map<string, any>,
    contextArgs: any
}

type SafeCmdPayload<K> = K extends keyof CommandRegistry
    ? (CommandRegistry[K] extends { payload: infer P } ? P : void)
    : any;

type SafeCmdResult<K> = K extends keyof CommandRegistry
    ? (CommandRegistry[K] extends { result: infer R } ? R : void)
    : any;

type SafeFeatureValue<F, K> = F extends keyof FeatureRegistry
    ? (K extends keyof FeatureRegistry[F] ? FeatureRegistry[F][K] : any)
    : any;


export class PlcAPI {
    private store: PlcStore;
    private pipeline: PlcPipeline;
    private scheduler: Scheduler;
    public layout: PlcLayout;

    private compiledPipelines = new Map<string, (input: any, ctx: any) => Promise<any>>();
    private moduleAssets = new Map<string, Array<{ slot: string, id: string }>>();
    private receiveCache = new LRUCache<string, ReceiveCacheEntry>(300);

    // Commands Registry
    private commands = new Map<string, CommandFn>();
    private activeDependencyTracker: Map<string, any> | null = null;
    

    // Loaded modules manager
    private loadedModules = new Set<string>();

    constructor() {
        this.store = new PlcStore();
        this.pipeline = new PlcPipeline();
        this.scheduler = new Scheduler();
        this.layout = new PlcLayout();
    }

    // ----------------------
    // Root store
    // ----------------------
    createStore<K extends StoreKey>(key: K, initial: StoreValue<K>) {
        this.store.createStore(key as string, initial);
    }

    getStore<K extends StoreKey>(key: K): StoreValue<K> {
        const value = this.store.getStore(key as string);
        this.recordDependency(key as string, value);
        return value;
    }

    setStore<K extends StoreKey>(
        key: K,
        updater: StoreValue<K> | ((draft: Draft<StoreValue<K>>) => void | StoreValue<K>),
        priority: Priority = "MED",
        useTransition: boolean = false
    ) {
        this.scheduler.schedule(() => {
            if (useTransition) {
                React.startTransition(() => {
                    this.store.setStore(key as string, updater);
                });
            } else {
                this.store.setStore(key as string, updater);
            }
        }, priority);
    }

    // ----------------------
    // Substores
    // ----------------------
    createSubstore<F extends FeatureKey, K extends keyof any>(
        substore: F,
        key: K,
        initial: SafeFeatureValue<F, K>
    ) {
        this.store.createSubstore(substore as string, key as string, initial);
    }

    getSubstore<F extends FeatureKey, K extends keyof any>(
        substore: F,
        key: K
    ): SafeFeatureValue<F, K> {
        const value = this.store.getSubstore(substore as string, key as string);
        this.recordDependency(`${substore}:${key as string}`, value);
        return value;
    }

    setSubstore<F extends FeatureKey, K extends keyof any>(
        substore: F,
        key: K,
        updater: SafeFeatureValue<F, K> | ((draft: Draft<SafeFeatureValue<F, K>>) => void | SafeFeatureValue<F, K>),
        priority: Priority = "MED",
        useTransition: boolean = false
    ) {
        this.scheduler.schedule(() => {
            if (useTransition) {
                React.startTransition(() => {
                    this.store.setSubstore(substore as string, key as string, updater as any);
                });
            }
            else {
                this.store.setSubstore(substore as string, key as string, updater as any);
            }
        }, priority);
    }

    // ----------------------
    // Dependency tracking
    // ----------------------
    protected recordDependency(key: string, value: any) {
        if (this.activeDependencyTracker) this.activeDependencyTracker.set(key, value);
    }

    // ----------------------
    // Transforms
    // ----------------------
    makeTransform<T = any>(
        channel: string,
        id: string,
        fn: (data: T, ctx: any) => T | Promise<T>,
        priority: number = 0
    ) {
        const t: transformerType = { id, priority, fn: (d, c) => fn(d, c) };
        this.pipeline.registerTransform(channel, t);

        this.compiledPipelines.delete(channel);
        this.receiveCache.delete(channel);
    }

    async getTransform<T = any>(
        channel: string,
        initialData: T,
        context: any = {},
        opts?: { equality?: 'identity' | 'shallow' | 'deep' }
    ): Promise<T> {
        const channelStr = channel;
        const cached = this.receiveCache.get(channelStr);
        const equality = opts?.equality ?? 'identity';

        if (cached) {
            const sameInput = equality === 'identity' ? cached.input === initialData : shallowEqual(cached.input, initialData);
            const sameContext = deepEqual(cached.contextArgs, context);

            if (sameInput && sameContext) {
                let depsChanged = false;
                for (const [key, lastValue] of cached.dependencies) {
                    let current;
                    if (key.includes(":")) {
                        const [substore, subKey] = key.split(":");
                        current = this.store.getSubstore(substore, subKey);
                    } else {
                        current = this.store.getStore(key);
                    }

                    if (current !== lastValue) { depsChanged = true; break; }
                }
                if (!depsChanged) return cached.result;
            }
        }

        let runner = this.compiledPipelines.get(channelStr);
        if (!runner) {
            const compiled = this.pipeline.compilePipeline(channelStr);
            this.compiledPipelines.set(channelStr, compiled);
            runner = compiled;
        }

        const prevTracker = this.activeDependencyTracker;
        const currentTracker = new Map<string, any>();
        this.activeDependencyTracker = currentTracker;

        let result: any;
        try {
            result = await this.store.runWithDependencyTracker(currentTracker, async () => {
                return await runner!(initialData, context);
            });
        } finally {
            this.activeDependencyTracker = prevTracker;
        }

        this.receiveCache.set(channelStr, {
            input: initialData,
            result,
            dependencies: currentTracker,
            contextArgs: context
        });

        return result;
    }

    receive<K extends string>(channel: K, initialData: any, context: any = {}) {
        const channelStr = channel as string;
        const runner = this.compiledPipelines.get(channelStr);
        if (!runner) throw new Error("[PlcAPI] Pipeline not compiled yet. Use getTransform (async).");

        const res = (runner as any)(initialData, context);
        if (res && typeof res.then === 'function') throw new Error("[PlcAPI] Pipeline contains async transforms; use getTransform (async).");
        return res;
    }


    // ----------------------
    // Command System
    // ----------------------
    registerCommand<K extends CommandKey>(
        id: K,
        fn: (payload?: SafeCmdPayload<K>) => SafeCmdResult<K> | Promise<SafeCmdResult<K>>
    ) {
        if (this.commands.has(id as string)) {
            console.warn(`[PlcAPI] Overwriting command '${id}'`);
        }
        this.commands.set(id as string, fn as any);
    }

    wrapCommand<K extends CommandKey>(
        id: K,
        wrapper: (next: CommandFn<SafeCmdPayload<K>, SafeCmdResult<K>>) => CommandFn<SafeCmdPayload<K>, SafeCmdResult<K>>
    ) {
        const currentFn = this.commands.get(id as string);
        if (!currentFn) {
            console.error(`[PlcAPI] Cannot wrap '${id}', command does not exist.`);
            return;
        }
        this.commands.set(id as string, wrapper(currentFn) as any);
    }

    async execute<K extends CommandKey>(
        id: K,
        payload?: SafeCmdPayload<K>
    ): Promise<SafeCmdResult<K>> {
        const fn = this.commands.get(id as string);
        if (!fn) {
            throw new Error(`[PlcAPI] Command '${id}' not found.`);
        }
        try {
            return await fn(payload);
        } catch (error) {
            console.error(`[PlcAPI] Error executing '${id}':`, error);
            throw error;
        }
    }

    // ----------------------
    // Derives
    // ----------------------
    deriveStore<K extends StoreKey, Output>(
        outputKey: K,
        outputSlot: StoreKey,
        dependencies: StoreKey[],
        calculator: (...args: any[]) => Output
    ) {
        let lastInputs: any[] | null = null;
        let lastOutput: any;
        let isComputing = false;
        let scheduled = false;

        const scheduleUpdate = () => {
            if (scheduled) return;
            scheduled = true;
            Promise.resolve().then(() => {
                scheduled = false;
                this.store.batch(runCompute);
            });
        };

        const runCompute = () => {
            if (isComputing) return;
            isComputing = true;
            try {
                const inputs = dependencies.map(dep => this.getStore(dep));
                if (lastInputs && inputs.every((v, i) => shallowEqual(v, lastInputs![i]))) return;

                const result = calculator(...inputs);
                if (shallowEqual(result, lastOutput)) { lastInputs = inputs; return; }

                lastInputs = inputs;
                lastOutput = result;

                this.setStore(outputSlot, (draft: any) => {
                    if (!draft) return { [String(outputKey)]: result };
                    draft[String(outputKey)] = result;
                    return;
                });
            } finally { isComputing = false; }
        };

        runCompute();
        const unsubscribers = dependencies.map(dep => this.store.subscribe(dep as string, scheduleUpdate));

        return {
            getValue: () => lastOutput,
            trigger: scheduleUpdate,
            dispose: () => unsubscribers.forEach(u => u())
        };
    }

    deriveSubstore<F extends FeatureKey, K extends keyof any, Output>(
        substore: F,
        outputKey: K,
        outputSlot: keyof any,
        dependencies: string[],
        calculator: (...args: any[]) => Output
    ) {
        let lastInputs: any[] | null = null;
        let lastOutput: any;
        let isComputing = false;
        let scheduled = false;

        const scheduleUpdate = () => {
            if (scheduled) return;
            scheduled = true;
            Promise.resolve().then(() => {
                scheduled = false;
                this.store.batch(runCompute);
            });
        };

        const runCompute = () => {
            if (isComputing) return;
            isComputing = true;
            try {
                const inputs = dependencies.map(dep => this.getSubstore(substore, dep as any));
                if (lastInputs && inputs.every((v, i) => shallowEqual(v, lastInputs![i]))) return;

                const result = calculator(...inputs);
                if (shallowEqual(result, lastOutput)) { lastInputs = inputs; return; }

                lastInputs = inputs;
                lastOutput = result;

                this.setSubstore(substore, outputSlot, (draft: any): any => {
                    if (!draft) return { [String(outputKey)]: result };
                    draft[String(outputKey)] = result;
                    return;
                });
            } finally { isComputing = false; }
        };

        runCompute();
        const unsubscribers = dependencies.map(dep =>
            this.store.subscribe(`${substore}:${dep}`, scheduleUpdate)
        );

        return {
            getValue: () => lastOutput,
            trigger: scheduleUpdate,
            dispose: () => unsubscribers.forEach(u => u())
        };
    }

    // ----------------------
    // Watchers
    // ----------------------
    private _triggerVersion = new Map<string, number>();
    private bumpVersion(key: string) {
        this._triggerVersion.set(key, (this._triggerVersion.get(key) || 0) + 1);
    }

    watch<K extends StoreKey, T>(
        key: K,
        selector: (data: StoreValue<K>) => T,
        callback: (newValue: T, oldValue: T) => void
    ): () => void;

    watch<F extends FeatureKey, K extends keyof any, T>(
        key: `${F}:${string & K}`,
        selector: (data: SafeFeatureValue<F, K>) => T,
        callback: (newValue: T, oldValue: T) => void
    ): () => void;

    watch(key: string, selector: (data: any) => any, callback: (newValue: any, oldValue: any) => void) {
        if (key.includes(":")) {
            const [module, subKey] = key.split(":");
            return this.watchSubstore(module as any, subKey, selector, callback);
        }
        return this.watchStore(key, selector, callback);
    }

    watchStore<T>(storeKey: string, selector: (data: any) => T, callback: (newValue: T, oldValue: T) => void) {
        let prevVersion = this._triggerVersion.get(storeKey) || 0;
        let prevValue = selector(this.getStore(storeKey as any));

        const handleChange = () => {
            const version = this._triggerVersion.get(storeKey) || 0;
            const newValue = selector(this.getStore(storeKey as any));

            if (version !== prevVersion || !shallowEqual(newValue, prevValue)) {
                const old = prevValue;
                prevValue = newValue;
                prevVersion = version;
                callback(newValue, old);
            }
        };
        return this.store.subscribe(storeKey, handleChange);
    }

    watchSubstore<T>(substore: string, key: string, selector: (data: any) => T, callback: (newValue: T, oldValue: T) => void) {
        const storeKey = `${substore}:${key}`;
        let prevVersion = this._triggerVersion.get(storeKey) || 0;
        let prevValue = selector(this.getSubstore(substore as any, key));

        const handleChange = () => {
            const version = this._triggerVersion.get(storeKey) || 0;
            const newValue = selector(this.getSubstore(substore as any, key));

            if (version !== prevVersion || !shallowEqual(newValue, prevValue)) {
                const old = prevValue;
                prevValue = newValue;
                prevVersion = version;
                callback(newValue, old);
            }
        };
        return this.store.subscribe(storeKey, handleChange);
    }

    watchAllStores<T = any>(
        definitions: Array<{ substore?: string; store: string; selector: (data: any) => Partial<T> }>,
        callback: (newValues: T, oldValues: T) => void
    ) {
        const getCombinedState = (): T => {
            let result: any = {};
            for (const def of definitions) {
                const slice = def.substore
                    ? def.selector(this.getSubstore(def.substore as any, def.store))
                    : def.selector(this.getStore(def.store as any));
                result = { ...result, ...slice };
            }
            return result;
        };

        let prevCombined = getCombinedState();
        const handleChange = () => {
            const currentCombined = getCombinedState();
            if (!shallowEqual(prevCombined, currentCombined)) {
                const old = prevCombined;
                prevCombined = currentCombined;
                callback(currentCombined, old);
            }
        };

        const unsubscribers = definitions.map(def => {
            const key = def.substore ? `${def.substore}:${def.store}` : def.store;
            return this.store.subscribe(key, handleChange);
        });

        return () => unsubscribers.forEach(u => u());
    }


    // ----------------------
    // Redraw
    // ----------------------
    redraw(keyOrSlot: string) {
        this.bumpVersion(keyOrSlot);
        this.layout.invalidate(keyOrSlot);

        const currentRoot = this.store.getStore(keyOrSlot);
        if (currentRoot !== undefined) {
            this.store.setStore(keyOrSlot, (d: any) => d);
        }
    }

    // ----------------------
    // UI
    // ----------------------
    register<K extends SlotKey>(
        slot: K,
        id: string,
        componentFn: (props?: SlotProps<K>) => React.ReactNode,
        priority: number = 0,
        keepAlive: boolean = false
    ) {
        this.layout.register(slot as string, id, componentFn, priority, keepAlive);
    }

    registerMany<K extends SlotKey>(
        slot: K,
        items: { id: string; fn: (props?: any) => React.ReactNode; priority?: number; keepAlive?: boolean }[]
    ) {
        this.layout.registerMany(slot as string, items);
    }

    wrap<K extends SlotKey>(slot: K, wrapper: SlotWrapper) {
        this.layout.wrap(slot as string, wrapper);
    }

    after<K extends SlotKey>(slot: K, targetId: string, newId: string, componentFn: () => React.ReactNode) {
        const targetPriority = this.layout.getPriority(slot as string, targetId);
        let newPriority: number;

        if (targetPriority !== undefined) {
            newPriority = targetPriority - 1;
        } else {
            console.warn(`[PlcAPI] 'after': Target '${targetId}' not found in slot '${slot}'. Registering '${newId}' at the end.`);
            newPriority = -999;
        }

        this.layout.register(slot as string, newId, componentFn, newPriority);
    }

    render<K extends SlotKey>(slot: K, props?: SlotProps<K>): React.ReactNode {
        return this.layout.render(slot as string, props);
    }

    markVirtual<K extends SlotKey>(
        slot: K,
        config?: {
            itemHeight?: number;
            overscan?: number;
            initialEstimatedHeight?: number;
            as?: any;
            itemAs?: any;
        }
    ) {
        this.layout.markVirtual(slot as string, config);
    }

    connect(renderFn: (props?: any) => React.ReactNode, dependencies: Array<string | { store: string, keys?: string[] }>): React.FC<any> {
        return (props: any) => {
            const [, forceUpdate] = React.useReducer(x => x + 1, 0);
            const prevValuesRef = React.useRef<Map<string, any>>(new Map());

            React.useEffect(() => {
                const unsubscribers: Array<() => void> = [];

                dependencies.forEach(dep => {
                    const keyStr = typeof dep === 'string' ? dep : dep.store;
                    const getValue = () => typeof dep === 'string'
                        ? this.getStore(dep as any)
                        : dep.store.includes(":")
                            ? this.store.getSubstore(...(dep.store.split(":") as [string, string]))
                            : this.getStore(dep.store as any);

                    prevValuesRef.current.set(keyStr, getValue());

                    unsubscribers.push(this.store.subscribe(keyStr, () => {
                        const newVal = getValue();
                        if (!shallowEqual(prevValuesRef.current.get(keyStr), newVal)) {
                            prevValuesRef.current.set(keyStr, newVal);
                            forceUpdate();
                        }
                    }));
                });

                return () => unsubscribers.forEach(u => u());
            }, []);

            return renderFn(props);
        };
    }

    // ----------------------
    // Modules
    // ----------------------
    registerModule(manifest: ModuleManifest) {
        const moduleName = manifest.name;
        const isUpdate = this.loadedModules.has(moduleName);

        const previousAssets = this.moduleAssets.get(moduleName) || [];

        const currentAssets: Array<{ slot: string, id: string }> = [];
        this.moduleAssets.set(moduleName, currentAssets);

        const track = (slot: string, id: string) => {
            currentAssets.push({ slot, id });
        };

        if (manifest.state && !isUpdate) {
            Object.entries(manifest.state).forEach(([key, val]) => {
                this.createSubstore(moduleName as any, key as any, val);
            });
        }

        if (manifest.commands) {
            Object.entries(manifest.commands).forEach(([cmdId, fn]) => {
                const fullId = cmdId.includes(":") ? cmdId : `${moduleName}:${cmdId}`;
                this.commands.set(fullId, fn);
            });
        }

        if (manifest.slots) {
            Object.entries(manifest.slots).forEach(([slotName, components]) => {
                components.forEach(comp => {
                    this.register(slotName as any, comp.id, comp.component, comp.priority, comp.keepAlive);
                    track(slotName, comp.id);
                });
            });
        }

        if (manifest.onLoad) {
            manifest.onLoad();
        }

        if (isUpdate) {
            previousAssets.forEach(prev => {
                const stillExists = currentAssets.some(curr =>
                    curr.slot === prev.slot && curr.id === prev.id
                );

                if (!stillExists) {
                    console.debug(`[PlcAPI] Cleaning up removed slot item: ${prev.slot} / ${prev.id}`);
                    this.layout.unregister(prev.slot, prev.id);
                }
            });
        }

        this.loadedModules.add(moduleName);

        if (!isUpdate) {
            console.debug(`[PlcAPI] Module loaded: ${moduleName}`);
        } else {
            console.debug(`[PlcAPI] Module updated (HMR): ${moduleName}`);
        }
    }

    async loadFeature(importer: () => Promise<{ default: ModuleManifest }>) {
        try {
            const module = await importer();
            this.registerModule(module.default);
        } catch (err) {
            console.error(`[PlcAPI] Failed to load module`, err);
            throw err;
        }
    }

    // ----------------------
    // Selector
    // ----------------------
    createSelector<S, R>(extractor: (state: S) => any[], calculator: (...args: any[]) => R) {
        let lastArgs: any[] | null = null;
        let lastResult: R | null = null;

        return (state: S): R => {
            const args = extractor(state);

            if (lastArgs && args.length === lastArgs.length && args.every((val, i) => val === lastArgs![i])) {
                return lastResult!;
            }

            const result = calculator(...args);
            lastArgs = args;
            lastResult = result;
            return result;
        };
    }
}