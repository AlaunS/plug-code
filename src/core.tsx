import React from "react";
import { PlcAPI } from "./core/plcAPI";
import { PlcProvider, useCommand, useSlot, useStore } from "./core/hooks/plcHooks";
import { Draft } from "immer";

type PlcSchema = {
    store: Record<string, any>;
    commands: Record<string, any>;
    slots: Record<string, any>;
};

type GetStore<T extends PlcSchema> = T["store"] extends Record<string, any> ? T["store"] : {};
type GetCmds<T extends PlcSchema> = T["commands"] extends Record<string, any> ? T["commands"] : {};
type GetSlots<T extends PlcSchema> = T["slots"] extends Record<string, any> ? T["slots"] : {};

type TypedPlcAPI<T extends PlcSchema> = Omit<PlcAPI, 'getStore' | 'setStore' | 'createStore' | 'execute' | 'render' | 'register'> & {

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

export const createPlugC = <T extends PlcSchema>() => {
    const rawApi = new PlcAPI();
    const api = rawApi as unknown as TypedPlcAPI<T>;

    return {
        api,
        SystemPlcRoot: ({ children }: { children: React.ReactNode }) => (
            <PlcProvider api={rawApi}>{children}</PlcProvider>
        ),

        usePlugC: () => ({ api }),
        useStore: <K extends keyof GetStore<T> & string, R = GetStore<T>[K]>(
            key: K,
            selector?: (data: GetStore<T>[K]) => R
        ) => {
            return (useStore as any)(key, selector) as R;
        },

        useCommand: <K extends keyof GetCmds<T> & string>(id: K) => {
            const cmd = useCommand(id as any);

            type LocalPayload = GetCmds<T>[K] extends { payload: infer P } ? P : void;
            type LocalResult = GetCmds<T>[K] extends { result: infer R } ? R : void;

            return cmd as (payload?: LocalPayload) => Promise<LocalResult>;
        },

        useSlot: <K extends keyof GetSlots<T> & string>(slot: K) => {
            const renderSlot = useSlot(slot as any);
            type LocalProps = GetSlots<T>[K];

            return renderSlot as (props?: LocalProps) => React.ReactNode;
        }
    };
}