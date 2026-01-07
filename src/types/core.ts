import { Draft } from "immer";
import { PlcAPI } from "../core/plcAPI";

export type PlcSchema = {
    store: Record<string, any>;
    commands: Record<string, any>;
    slots: Record<string, any>;
};

export type GetStore<T extends PlcSchema> = T["store"] extends Record<string, any> ? T["store"] : {};
export type GetCmds<T extends PlcSchema> = T["commands"] extends Record<string, any> ? T["commands"] : {};
export type GetSlots<T extends PlcSchema> = T["slots"] extends Record<string, any> ? T["slots"] : {};

export type TypedPlcAPI<T extends PlcSchema> = Omit<PlcAPI, 'getStore' | 'setStore' | 'createStore' | 'execute' | 'render' | 'register'> & {

    // Store Methods
    createStore<K extends keyof GetStore<T> & string>(key: K, initial: GetStore<T>[K]): void;

    getStore<K extends keyof GetStore<T> & string>(key: K): GetStore<T>[K];

    setStore<K extends keyof GetStore<T> & string>(
        key: K,
        updater: GetStore<T>[K] | ((draft: Draft<GetStore<T>[K]>) => void | GetStore<T>[K]),
        priority?: number,
        useTransition?: boolean
    ): void;

    // Command Methods
    execute<K extends keyof GetCmds<T> & string>(
        id: K,
        payload?: GetCmds<T>[K] extends { payload: infer P } ? P : void
    ): Promise<GetCmds<T>[K] extends { result: infer R } ? R : void>;

    // UI Methods
    render<K extends keyof GetSlots<T> & string>(
        slot: K,
        props?: GetSlots<T>[K]
    ): React.ReactNode;

    register<K extends keyof GetSlots<T> & string>(
        slot: K,
        id: string,
        componentFn: (props?: GetSlots<T>[K]) => React.ReactNode,
        priority?: number,
        keepAlive?: boolean
    ): void;
};

export type FeatureConfig<T, A> = {
    name: string;
    state: T;
    actions?: {
        [K in keyof A]: (state: T, payload?: any) => T | void;
    };
    view?: (props: { state: T; actions: Record<keyof A, Function> }) => React.ReactNode;
    slots?: Record<string, React.ComponentType<any>>;
};