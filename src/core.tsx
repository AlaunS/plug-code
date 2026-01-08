import React from "react";
import { PlcAPI } from "./core/plcAPI";
import { PlcProvider, useCommand, useSlot, useStore } from "./core/hooks/plcHooks";
import { GetCmds, GetSlots, GetStore, PlcSchema, TypedPlcAPI } from "./types/core";

// ----------------------
// Advanced Mode
// ----------------------
export const createPlugC = <T extends PlcSchema>(
    config?: {
        initialState: GetStore<T>
    }
) => {
    const rawApi = new PlcAPI();
    const api = rawApi as unknown as TypedPlcAPI<T>;

    if (config?.initialState) {
        Object.entries(config.initialState).forEach(([key, value]) => {
            rawApi.createStore(key as any, value);
        });
    }

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