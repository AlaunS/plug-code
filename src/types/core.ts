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

type GetCmdPayload<T, K extends keyof T> = T[K] extends { payload: infer P } ? P : void;
type GetCmdResult<T, K extends keyof T> = T[K] extends { result: infer R } ? R : void;

export type TypedPlcAPI<T extends PlcSchema> = Omit<PlcAPI, 'getStore' | 'setStore' | 'createStore' | 'execute' | 'render' | 'register' | 'getSubstore' | 'setSubstore' | 'createSubstore' | 'execute' | 'registerCommand'> & {

    // Store Methods
    createStore<K extends keyof GetStore<T> & string>(key: K, initial: GetStore<T>[K]): void;

    getSubstore<S extends string, K extends string>(substore: S, key: K): any;
    setSubstore<S extends string, K extends string>(substore: S, key: K, updater: any, priority?: number): void;

    getStore<K extends keyof GetStore<T> & string>(key: K): GetStore<T>[K];
    setStore<K extends keyof GetStore<T> & string>(
        key: K,
        updater: GetStore<T>[K] | ((draft: Draft<GetStore<T>[K]>) => void | GetStore<T>[K]),
        priority?: number,
        useTransition?: boolean
    ): void;

    // Command Methods
    registerCommand<K extends keyof T["commands"] & string>(
        id: K,
        fn: (payload: GetCmdPayload<T["commands"], K>) =>
            | GetCmdResult<T["commands"], K>
            | Promise<GetCmdResult<T["commands"], K>>
    ): void;

    // 2. execute tipado
    execute<K extends keyof T["commands"] & string>(
        id: K,
        payload: GetCmdPayload<T["commands"], K>
    ): Promise<GetCmdResult<T["commands"], K>>;

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

export type ModuleConfig<T, A> = {
    name: string;
    state: T;
    actions?: {
        [K in keyof A]: (state: T, payload?: any) => T | void;
    };
    view?: (props: { state: T; actions: Record<keyof A, Function> }) => React.ReactNode;
    slots?: Record<string, React.ComponentType<any>>;
};

export type ModuleScopedAPI<GlobalSchema extends PlcSchema, FName extends string, FState> = TypedPlcAPI<GlobalSchema> & {
    getSubstore<K extends keyof FState & string>(
        substore: FName,
        key: K
    ): FState[K];

    setSubstore<K extends keyof FState & string>(
        substore: FName,
        key: K,
        updater: FState[K] | ((draft: Draft<FState[K]>) => void | FState[K]),
        priority?: number
    ): void;
};