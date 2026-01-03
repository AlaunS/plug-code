import { produce } from "immer";
import type { ObjectType } from "../types/general";
import { useEffect, useState } from "react";
import { PlcPipeline } from "./plcPipeline";
import type { PlcStore } from "./plcStore";
import type { CommandFn, transformerType } from "../types/api";

import type { ChannelRegistry, CommandRegistry, SlotRegistry } from "../types/registry";

type ChannelKey = keyof ChannelRegistry | (string & {});
type ChannelData<K> = K extends keyof ChannelRegistry ? ChannelRegistry[K] : any;

type CommandKey = keyof CommandRegistry | (string & {});
type CommandPayload<K> = K extends keyof CommandRegistry
    ? (CommandRegistry[K] extends { payload: infer P } ? P : any)
    : any;
type CommandResult<K> = K extends keyof CommandRegistry
    ? (CommandRegistry[K] extends { result: infer R } ? R : any)
    : any;

type SlotKey = keyof SlotRegistry | (string & {});


export class PlcAPI<S extends ObjectType> {
    private store: PlcStore<S>
    private pipeline: PlcPipeline<S>
    private substores = new Map<string, any>()

    private transformers = new Map<string, transformerType[]>()
    private commands = new Map<string, CommandFn>();
    private installedFeatures = new Set<string>();

    constructor(store: PlcStore<S>) {
        this.store = store
        this.pipeline = new PlcPipeline(store)
    }

    createFeature(name: string, setupFn: (api: PlcAPI<S>) => void): PlcAPI<S> {
        if (this.installedFeatures.has(name)) {
            console.warn(`[PlcFramework] Feature '${name}' is already registered. It will be skipped to avoid conflicts.`);
            return this;
        }

        try {
            setupFn(this);
            this.installedFeatures.add(name);
        } catch (error) {
            console.error(`[PlcFramework] 💥 Critical error initializing feature '${name}':`, error);
        }

        return this;
    }

    replace<K extends string>(key: K & "root", data: Partial<any>, slot?: string) {
        const currentSub = this.substores.get(key) || {};
        const newSub = { ...currentSub, ...data };

        this.substores.set(key, newSub);
        this.store.set(key as any, newSub);

        if (slot) {
            this.invalidate(slot);
        }
    }

    register(slot: SlotKey, node: () => React.ReactNode): void;
    register<K extends string>(slot: SlotKey, node: (data: any) => React.ReactNode, dependencyKey: K): void;
    register(slot: SlotKey, node: (data?: any) => React.ReactNode, dependencyKey?: string) {
        if (dependencyKey) {
            const ConnectedWrapper = () => {
                const [data, setData] = useState(() => this.substores.get(dependencyKey));

                useEffect(() => {
                    const unsubscribe = this.store.subscribe(dependencyKey as any, () => {
                        setData(this.substores.get(dependencyKey));
                    });
                    return unsubscribe;
                }, []);

                return node(data);
            };

            this.store.batch(() => {
                this.pipeline.register(slot as string, () => <ConnectedWrapper />);
            });
        }
        else {
            this.store.batch(() => {
                this.pipeline.register(slot as string, node as () => React.ReactNode);
            });
        }
    }

    scope<T = any>(key: string & "root"): {
        get: () => T;
        update: (updater: (draft: T) => void) => void;
        connect: (renderer: (data: T) => React.ReactNode) => React.FC;
        render: (slotName: SlotKey) => React.ReactNode | null;
        receive: (context?: any) => any;
        root: PlcAPI<S>;
    } {
        return {
            get: (): T => this.getData(key),

            update: (updater: (draft: T) => void) => {
                this.update(key, updater);
            },

            connect: (renderer: (data: T) => React.ReactNode) => {
                return this.connect(key, renderer);
            },

            render: (slotName: SlotKey) => {
                return this.connect(key, (localData) => {
                    return this.pipeline.render(slotName as string, localData) as React.ReactNode;
                }) as any;
            },

            receive: (context: any = {}) => {
                const currentData = this.getData(key);
                return this.receive(key as any, currentData, context);
            },

            root: this
        };
    }

    connect<T = any>(key: string, renderer: (data: T) => React.ReactNode): React.FC {
        return () => {
            const [data, setData] = useState<T>(() => this.substores.get(key));

            useEffect(() => {
                const unsubscribe = this.store.subscribe(key as any, () => {
                    setData(this.substores.get(key));
                });

                return () => {
                    unsubscribe();
                };
            }, []);

            if (data === undefined) return null;
            return <>{renderer(data)}</>;
        };
    }

    wrap(slot: SlotKey, fn: (next: () => React.ReactNode) => () => React.ReactNode) {
        this.store.batch(() => {
            this.pipeline.wrap(slot as string, fn)
        })
    }

    after(slot: SlotKey, node: () => React.ReactNode) {
        this.store.batch(() => {
            this.pipeline.register(slot as string, node)
        })
    }

    render(slot: SlotKey) {
        return this.pipeline.render(slot as string)
    }

    invalidate(slot?: SlotKey) {
        this.pipeline.invalidate(slot as string)
    }

    send<K extends ChannelKey>(
        channel: K,
        id: string,
        fn: (data: ChannelData<K>, context: any) => ChannelData<K>,
        priority: number = 0
    ) {
        const channelStr = channel as string;
        if (!this.transformers.has(channelStr)) {
            this.transformers.set(channelStr, []);
        }

        const channelList = this.transformers.get(channelStr)!;

        const existingIdx = channelList.findIndex(t => t.id === id);
        if (existingIdx >= 0) {
            channelList[existingIdx] = { id, priority, fn };
        } else {
            channelList.push({ id, priority, fn });
        }

        channelList.sort((a, b) => a.priority - b.priority);
    }

    receive<K extends ChannelKey>(
        channel: K,
        initialData: ChannelData<K>,
        context: any = {}
    ): ChannelData<K> {
        let currentData = initialData;
        const channelList = this.transformers.get(channel as string) || [];

        for (const transformer of channelList) {
            try {
                currentData = transformer.fn(currentData, context);
            } catch (error) {
                console.error(`[PlcAPI] Error in transform '${channel as string}/${transformer.id}':`, error);
            }
        }

        return currentData as ChannelData<K>;
    }

    registerCommand<K extends CommandKey>(
        id: K,
        fn: CommandFn<CommandPayload<K>, CommandResult<K>>
    ) {
        if (this.commands.has(id as string)) {
            console.warn(`[PlcAPI] Overwriting command '${id as string}'`);
        }
        this.commands.set(id as string, fn as any);
    }

    wrapCommand<K extends CommandKey>(
        id: K,
        wrapper: (next: CommandFn<CommandPayload<K>, CommandResult<K>>) => CommandFn<CommandPayload<K>, CommandResult<K>>
    ) {
        const currentFn = this.commands.get(id as string);
        if (!currentFn) {
            console.error(`[PlcAPI] Cannot wrap '${id as string}', command does not exist.`);
            return;
        }
        this.commands.set(id as string, wrapper(currentFn) as any);
    }

    async execute<K extends CommandKey>(
        id: K,
        payload?: CommandPayload<K>
    ): Promise<CommandResult<K>> {
        const fn = this.commands.get(id as string);
        if (!fn) {
            throw new Error(`[PlcAPI] Command '${id as string}' not found.`);
        }

        try {
            return await fn(payload);
        } catch (error) {
            console.error(`[PlcAPI] Error executing '${id as string}':`, error);
            throw error;
        }
    }

    getData(key: string): any {
        return this.substores.get(key)
    }

    subscribe(listener: () => void) {
        return this.store.subscribe(listener);
    }

    createData<K extends string, T>(key: K, initialState: T) {
        if (this.substores.has(key)) return
        this.substores.set(key, initialState)
    }

    update<K extends keyof S>(key: string & "root", updater: (draft: any) => void, slot?: string) {
        const sub = this.substores.get(key)
        if (!sub) return

        const newSub = produce(sub, updater)
        this.substores.set(key, newSub)

        this.store.set(key as K, newSub as S[K])
        if (slot) {
            this.invalidate(slot)
        }
    }
}