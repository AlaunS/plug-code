import React, { ReactNode } from "react";
import { Draft } from "immer";
import { PlcAPI } from "./core/plcAPI";
import { ObjectType } from "./types/core/general";
import { PlcProvider, useStore as useHookStore, useCommand } from "./core/hooks/plcHooks";

type RemoveFirstArg<T extends any[]> = T extends [any, ...infer Rest] ? Rest : [];
type MapToExecutable<A> = {
    [K in keyof A]: A[K] extends (...args: any) => any
    ? (...args: RemoveFirstArg<Parameters<A[K]>>) => Promise<void>
    : never
};

type ModuleActionFn<T, RootExec> = (
    draft: Draft<T>,
    payload: any,
    root: RootExec
) => void | T | Promise<void>;

// ----------------------
// Module Config Definition
// ----------------------
export type ModuleConfig<
    T extends ObjectType,
    A extends Record<string, any>,
    RootExec,
    P
> = {
    name: string;
    state: T;
    actions?: A;
    view?: (props: { state: T; actions: MapToExecutable<A> } & P) => React.ReactNode;
    slots?: Record<string, React.FC<any>>;
};

// ----------------------
// Simple Mode Factory
// ----------------------
export const createSimplePlugC = <
    T extends ObjectType,
    A extends Record<string, (draft: Draft<T>, ...args: any[]) => void | T | Promise<void>>
>(
    config: {
        initialState: T;
        actions?: A;
        options?: { debug?: boolean }
    }
) => {
    const api = new PlcAPI();
    api.createStore("__simple_root", config.initialState);

    if (config.options?.debug) console.debug("[SimplePlugC] Initialized");

    const rootActionsExecutable: any = {};

    if (config.actions) {
        Object.entries(config.actions).forEach(([actionName, actionFn]) => {
            const commandId = `simple:${actionName}`;

            api.registerCommand(commandId, async (payload?: any) => {
                if (config.options?.debug) console.debug(`[RootAction] ${actionName}`, payload);
                api.setStore("__simple_root", (draft: Draft<T>) => actionFn(draft, payload));
            });

            rootActionsExecutable[actionName] = (payload?: any) => api.execute(commandId, payload);
        });
    }

    type ExecutableRootActions = MapToExecutable<A>;

    // ---------------------------------------------------------
    // createModule (Bound Factory)
    // ---------------------------------------------------------
    const createModule = <
        FT extends ObjectType,
        FA extends Record<string, ModuleActionFn<FT, ExecutableRootActions>>,
        P = {}
    >(
        moduleConfig: ModuleConfig<FT, FA, ExecutableRootActions, P>
    ) => {
        api.createSubstore(moduleConfig.name, "__module_state", moduleConfig.state);

        const boundModuleActions: any = {};

        if (moduleConfig.actions) {
            Object.entries(moduleConfig.actions).forEach(([actionName, actionFn]) => {
                const commandId = `${moduleConfig.name}:${actionName}`;

                api.registerCommand(commandId, async (payload?: any) => {
                    if (config.options?.debug) console.debug(`[Module: ${moduleConfig.name}] Action: ${actionName}`, payload);

                    api.setSubstore(moduleConfig.name, "__module_state", (draft: any) => {
                        return actionFn(draft, payload, rootActionsExecutable);
                    });
                });

                boundModuleActions[actionName] = (payload?: any) => api.execute(commandId, payload);
            });
        }

        const useModuleState = <R,>(selector?: (state: FT) => R) => {
            return useHookStore(
                `${moduleConfig.name}:__module_state`,
                selector ? ((s: any) => selector(s as FT)) : undefined
            ) as R;
        };

        const useModuleAction = <K extends keyof FA & string>(actionName: K) => {
            const commandId = `${moduleConfig.name}:${actionName}`;
            return useCommand(commandId as any) as (
                ...args: RemoveFirstArg<Parameters<FA[K]>>
            ) => Promise<void>;
        };

        const ModuleView: React.FC<P> = React.memo((props: P) => {
            const state = useModuleState((s) => s);

            if (moduleConfig.view) {
                return moduleConfig.view({
                    state,
                    actions: boundModuleActions as any,
                    ...props
                });
            }
            return null;
        });

        return {
            name: moduleConfig.name,
            View: ModuleView,
            useModuleState,
            useModuleAction
        };
    };

    // ---------------------------------------------------------
    // Global Hooks
    // ---------------------------------------------------------
    const useStore = <R,>(selector?: (state: T) => R): R => {
        return useHookStore("__simple_root", selector || ((s: T) => s as unknown as R));
    };

    const useAction = <K extends keyof A & string>(actionName: K) => {
        const commandId = `simple:${actionName}`;
        return useCommand(commandId as any) as (
            ...args: RemoveFirstArg<Parameters<A[K]>>
        ) => Promise<void>;
    };

    return {
        api,
        Provider: ({ children }: { children: ReactNode }) => (
            <PlcProvider api={api}>{children}</PlcProvider>
        ),
        useStore,
        useAction,
        createModule,
        getState: () => api.getStore("__simple_root") as T,
    };
};