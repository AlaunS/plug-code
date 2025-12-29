import { produce } from "immer";
import type { ObjectType } from "../types/general";
import { useEffect, useState } from "react";
import { PlcPipeline } from "./plcPipeline";
import type { PlcStore } from "./plcStore";
import type { transformerType } from "../types/api";

export class PlcAPI<S extends ObjectType> {
    private store: PlcStore<S>
    private pipeline: PlcPipeline<S>
    private substores = new Map<string, any>()
    private transformers: transformerType[] = []

    constructor(store: PlcStore<S>) {
        this.store = store
        this.pipeline = new PlcPipeline(store)
    }

    register(slot: string, node: () => React.ReactNode): void;
    register<K extends string>(slot: string, node: (data: any) => React.ReactNode, dependencyKey: K): void;
    register(slot: string, node: (data?: any) => React.ReactNode, dependencyKey?: string) {
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
                this.pipeline.register(slot, () => <ConnectedWrapper />);
            });
        }
        else {
            this.store.batch(() => {
                this.pipeline.register(slot, node as () => React.ReactNode);
            });
        }
    }

    scope<T = any>(key: string & "root"): {
        get: () => T;
        update: (updater: (draft: T) => void) => void;
        connect: (renderer: (data: T) => React.ReactNode) => React.FC;
        render: (slotName: string) => React.ReactNode | null;
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

            render: (slotName: string) => {
                return this.connect(key, (localData) => {
                    return this.pipeline.render(slotName, localData) as React.ReactNode;
                }) as any;
            },

            receive: (context: any = {}) => {
                const currentData = this.getData(key);
                return this.receive(currentData, context);
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

    wrap(slot: string, fn: (next: () => React.ReactNode) => () => React.ReactNode) {
        this.store.batch(() => {
            this.pipeline.wrap(slot, fn)
        })
    }

    after(slot: string, node: () => React.ReactNode) {
        this.store.batch(() => {
            this.pipeline.register(slot, node)
        })
    }

    render(slot: string) {
        return this.pipeline.render(slot)
    }

    invalidate(slot?: string) {
        this.pipeline.invalidate(slot)
    }

    send(id: string, fn: (data: any, context: any) => any, priority: number) {
        this.transformers.push({ id, priority, fn });
        this.transformers.sort((a, b) => a.priority - b.priority);
    }

    receive(initialData: any, context: any = {}) {
        let currentData = initialData;

        for (const transformer of this.transformers) {
            try {
                currentData = transformer.fn(currentData, context);
            } catch (error) {
                console.error(`[Pipeline] Error en transformador '${transformer.id}':`, error);
            }
        }

        return currentData;
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