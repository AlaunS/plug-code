import { Draft } from "immer";
import { PlcAPI } from "./core/plcAPI";
import { FeatureConfig, PlcSchema, TypedPlcAPI } from "./types/core";
import { ObjectType } from "./types/core/general";
import { PlcProvider, useStore as useHookStore, useCommand } from "./core/hooks/plcHooks";
import { ReactNode } from "react";

// ----------------------
// Simple Mode
// ----------------------
export const createSimplePlugC = <T extends ObjectType>(
    config: {
        initialState: T;
        actions?: {
            [K: string]: (state: Draft<T>, payload?: any) => void | T | Promise<void>
        };
    }
) => {
    const api = new PlcAPI();
    api.createStore("__simple_root", config.initialState);

    const actionCommands: Record<string, (payload?: any) => Promise<void>> = {};
    if (config.actions) {
        Object.entries(config.actions).forEach(([actionName, actionFn]) => {
            const commandId = `simple:${actionName}`;

            api.registerCommand(commandId, async (payload?: any) => {
                api.setStore("__simple_root", (draft: Draft<T>) => {
                    return actionFn(draft, payload);
                });
            });

            actionCommands[actionName] = (payload?: any) =>
                api.execute(commandId, payload) as Promise<void>;
        });
    }

    const useStore = <R,>(selector?: (state: T) => R): R => {
        return useHookStore("__simple_root", selector || ((s: T) => s as unknown as R));
    };

    const useAction = (actionName: string) => {
        const commandId = `simple:${actionName}`;
        return useCommand(commandId as any);
    };

    return {
        api,
        Provider: ({ children }: { children: ReactNode }) => (
            <PlcProvider api={api}>
                {children}
            </PlcProvider>
        ),
        useStore,
        useAction,
        useSelector: useStore,
        getState: () => api.getStore("__simple_root") as T,
        setState: (updater: Partial<T> | ((draft: Draft<T>) => void)) => {
            api.setStore("__simple_root", updater);
        }
    };
};

export const createFeature = <T extends ObjectType, A extends Record<string, Function>>(
    config: FeatureConfig<T, A>
) => {
    const api = new PlcAPI();
    api.createSubstore(config.name, "__feature_state", config.state);

    const boundActions: Record<string, Function> = {};
    if (config.actions) {
        Object.entries(config.actions).forEach(([actionName, actionFn]) => {
            const commandId = `${config.name}:${actionName}`;

            api.registerCommand(commandId, async (payload?: any) => {
                api.setSubstore(config.name, "__feature_state", (draft: any) => {
                    return actionFn(draft, payload);
                });
            });

            boundActions[actionName] = (payload?: any) =>
                api.execute(commandId, payload);
        });
    }

    const FeatureView: React.FC<any> = () => {
        const state = useHookStore(`${config.name}:__feature_state`) as T;

        if (config.view) {
            return config.view({ state, actions: boundActions as any });
        }

        return null;
    };

    const FeatureSlots: React.FC = () => {
        if (!config.slots) return null;

        return (
            <>
                {Object.entries(config.slots).map(([slotName, Component]) => (
                    <Component key={slotName} />
                ))}
            </>
        );
    };

    const useFeatureState = <R,>(selector?: (state: T) => R) => {
        return useHookStore(
            `${config.name}:__feature_state`,
            selector ? ((s: any) => selector(s as T)) : undefined
        ) as R;
    };

    const useFeatureAction = (actionName: keyof A) => {
        const commandId = `${config.name}:${String(actionName)}`;
        return useCommand(commandId as any);
    };

    return {
        name: config.name,
        api,
        View: FeatureView,
        Slots: FeatureSlots,
        useFeatureState,
        useFeatureAction
    };
};