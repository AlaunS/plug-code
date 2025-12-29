import type { ObjectType } from "../types/general";
import type { PlcStore } from "./plcStore";
export declare class PlcAPI<S extends ObjectType> {
    private store;
    private pipeline;
    private substores;
    private transformers;
    constructor(store: PlcStore<S>);
    register(slot: string, node: () => React.ReactNode): void;
    register<K extends string>(slot: string, node: (data: any) => React.ReactNode, dependencyKey: K): void;
    scope<T = any>(key: string & "root"): {
        get: () => T;
        update: (updater: (draft: T) => void) => void;
        connect: (renderer: (data: T) => React.ReactNode) => React.FC;
        render: (slotName: string) => React.ReactNode | null;
        receive: (context?: any) => any;
        root: PlcAPI<S>;
    };
    connect<T = any>(key: string, renderer: (data: T) => React.ReactNode): React.FC;
    wrap(slot: string, fn: (next: () => React.ReactNode) => () => React.ReactNode): void;
    after(slot: string, node: () => React.ReactNode): void;
    render(slot: string): import("react").ReactNode[] | import("react/jsx-runtime").JSX.Element;
    invalidate(slot?: string): void;
    send(id: string, fn: (data: any, context: any) => any, priority: number): void;
    receive(initialData: any, context?: any): any;
    getData(key: string): any;
    subscribe(listener: () => void): () => void;
    createData<K extends string, T>(key: K, initialState: T): void;
    update<K extends keyof S>(key: string & "root", updater: (draft: any) => void, slot?: string): void;
}
