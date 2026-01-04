import { produce } from "immer";
import type { ObjectType } from "../types/general";
import { useEffect, useRef, useState } from "react";
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

    constructor(store: PlcStore<S>) {
        this.store = store
        this.pipeline = new PlcPipeline(store)
    }

    watch<T>(
        storeKey: string,
        selector: (data: any) => T,
        callback: (newValue: T, oldValue: T) => void
    ): () => void {
        let previousValue = selector(this.getData(storeKey));
        const unsubscribe = this.store.subscribe(storeKey as any, () => {
            const currentData = this.getData(storeKey);
            const newValue = selector(currentData);

            if (newValue !== previousValue) {
                const old = previousValue;
                previousValue = newValue;
                callback(newValue, old);
            }
        });

        return unsubscribe;
    }

    override<K extends string>(key: K & "root", data: any, slot?: string) {
        this.substores.set(key, data);
        this.store.set(key as any, data);

        if (slot) {
            this.invalidate(slot);
        }
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

    derive<K extends string>(
        outputKey: K,
        dependencies: string[],
        calculator: () => any
    ) {
        let lastValue: any
        let isComputing = false

        let scheduled = false

        const scheduleUpdate = () => {
            if (scheduled) return
            scheduled = true

            queueMicrotask(() => {
                scheduled = false
                runCompute()
            })
        }

        const runCompute = () => {
            if (isComputing) return

            isComputing = true
            try {
                const result = calculator()
                lastValue = result
                this.replace("root" as any, { [outputKey]: result })
            } finally {
                isComputing = false
            }
        }


        runCompute()

        dependencies.forEach(dep => {
            this.store.subscribe(dep as any, () => {
                if (isComputing) return
                scheduleUpdate()
            })
        })

        return () => lastValue
    }

    register(slot: SlotKey, node: (props?: any) => React.ReactNode): void;
    register<K extends string>(slot: SlotKey, node: (data: any, props?: any) => React.ReactNode, dependencyKey: K): void;
    register(slot: SlotKey, node: (data?: any, props?: any) => React.ReactNode, dependencyKey?: string) {
        if (dependencyKey) {
            const ConnectedWrapper = (props: any) => {
                const [storeData, setStoreData] = useState(() => this.substores.get(dependencyKey));

                useEffect(() => {
                    const unsubscribe = this.store.subscribe(dependencyKey as any, () => {
                        setStoreData(this.substores.get(dependencyKey));
                    });
                    return unsubscribe;
                }, []);

                return <>{node(storeData, props)}</>;
            };

            this.store.batch(() => {
                this.pipeline.register(slot as string, ConnectedWrapper);
            });
        }
        else {
            this.store.batch(() => {
                this.pipeline.register(slot as string, node);
            });
        }
    }

    scope<T = any>(key: string | "root"): {
        get: () => T;
        update: (updater: (draft: T) => void, slot?: string, triggerKey?: string) => void;
        connect: <P = {}, R = any>(
            selector: (data: T, props: P) => R
        ) => (WrappedComponent: React.ComponentType<P & R>) => React.FC<P>;

        render: (slotName: SlotKey) => React.FC;
        receive: (context?: any) => any;
        root: PlcAPI<S>;
    } {
        return {
            get: (): T => this.getData(key),

            update: (updater: (draft: T) => void, slot?: string, triggerKey?: string) => {
                this.update(key as any, updater, slot, triggerKey);
            },

            connect: <P = {}, R = any>(
                selector: (data: T, props: P) => R
            ) => {
                return this.connect(key, selector);
            },

            render: (slotName: SlotKey) => {
                const ScopedSlotRenderer = ({ _scopeData }: { _scopeData: T }) => {
                    return <>{this.pipeline.render(slotName as string, _scopeData)}</>;
                };

                return this.connect(
                    key,
                    (data: T) => ({ _scopeData: data })
                )(ScopedSlotRenderer) as any;
            },

            receive: (context: any = {}) => {
                const currentData = this.getData(key);
                return this.receive(key as any, currentData, context);
            },

            root: this
        };
    }

    connect<State = any, OwnProps = {}, ResultProps = {}>(
        key: string,
        selector: (state: State, props: OwnProps) => ResultProps
    ): (WrappedComponent: React.ComponentType<OwnProps & ResultProps>) => React.FC<OwnProps> {
        return (WrappedComponent: React.ComponentType<OwnProps & ResultProps>) => {

            const ConnectedComponent = (props: OwnProps) => {
                const propsRef = useRef(props);
                propsRef.current = props;

                const [slice, setSlice] = useState<ResultProps>(() => {
                    const data = this.substores.get(key);
                    return selector(data, props);
                });

                useEffect(() => {
                    const unsubscribe = this.store.subscribe(key as any, () => {
                        const currentData = this.substores.get(key);
                        const newSlice = selector(currentData, propsRef.current);

                        setSlice(prev => {
                            if (prev === newSlice) return prev;

                            if (typeof prev === 'object' && prev !== null && typeof newSlice === 'object' && newSlice !== null) {
                                const keysA = Object.keys(prev) as Array<keyof ResultProps>;
                                const keysB = Object.keys(newSlice) as Array<keyof ResultProps>;
                                if (keysA.length === keysB.length && keysA.every(k => prev[k] === newSlice[k])) {
                                    return prev;
                                }
                            }

                            return newSlice;
                        });
                    });
                    return unsubscribe;
                }, []);

                if (slice === undefined && this.substores.get(key) === undefined) return null;
                return <WrappedComponent {...props} {...slice} />;
            };

            const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';
            ConnectedComponent.displayName = `Connect(${displayName})`;

            return ConnectedComponent;
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

    render(slot: SlotKey, props?: any) {
        return this.pipeline.render(slot as string, props)
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

    update<K extends keyof S>(key: string & "root", updater: (draft: any) => void, slot?: string, triggerKey?: string) {
        const sub = this.substores.get(key)
        if (!sub) return

        const newSub = produce(sub, updater)
        this.substores.set(key, newSub)

        this.store.set(key as K, newSub as S[K])
        if (slot) {
            this.invalidate(slot)
        }

        if (triggerKey && triggerKey !== key) {

            const triggerData = this.substores.get(triggerKey);

            if (triggerData) {
                const newTriggerRef = { ...triggerData };
                this.substores.set(triggerKey, newTriggerRef);
                this.store.set(triggerKey as any, newTriggerRef);
            }
        }
    }
}