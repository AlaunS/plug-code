import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { PlcAPI } from "../plcAPI";

import {
    StoreKey,
    StoreValue,
    CommandKey,
    CmdPayload,
    CmdResult,
    SlotKey,
    SlotProps,
    FeatureRegistry,
    FeatureKey
} from "../../types/registry";

type SafeFeatureValue<F, K> = F extends keyof FeatureRegistry
    ? (K extends keyof FeatureRegistry[F] ? FeatureRegistry[F][K] : any)
    : any;

const PlcContext = createContext<PlcAPI | null>(null);

export const PlcProvider: React.FC<{ api: PlcAPI; children: React.ReactNode }> = ({ api, children }) => {
    return <PlcContext.Provider value={api}>{children}</PlcContext.Provider>;
};

const usePlcApi = () => {
    const api = useContext(PlcContext);
    if (!api)
        throw new Error("usePlcApi must be used within a PlcProvider");
    return api;
}

export function useStore<K extends StoreKey, T = StoreValue<K>>(
    key: K,
    selector?: (data: StoreValue<K>) => T
): T;

export function useStore<F extends FeatureKey, K extends keyof SafeFeatureValue<F, K> & string, T = SafeFeatureValue<F, K>>(
    key: `${F}:${K}`,
    selector?: (data: SafeFeatureValue<F, K>) => T
): T;

export function useStore<T>(key: string, selector: (data: any) => T = (d) => d): T {
    const api = usePlcApi();
    const getSnapshot = useCallback(() => {
        const storeVal = key.includes(":")
            ? api.getSubstore(...(key.split(":") as [string, string]))
            : api.getStore(key as any);
        return selector(storeVal);
    }, [api, key, selector]);

    return useSyncExternalStore(
        (onStoreChange) => api.watch(key, selector, onStoreChange),
        getSnapshot
    );
}

export function useCommand<K extends CommandKey>(commandId: K) {
    const api = usePlcApi();
    return useMemo(() => {
        return (payload?: CmdPayload<K>): Promise<CmdResult<K>> =>
            api.execute(commandId, payload);
    }, [api, commandId]);
}

export function useSlot<K extends SlotKey>(slotName: K) {
    const api = usePlcApi();
    return (props?: SlotProps<K>) => api.render(slotName, props);
}

export function useTransientStore<K extends StoreKey, T>(
    key: K,
    selector: (state: StoreValue<K>) => T,
    effect: (value: T) => void,
    deps?: any[]
): void;

export function useTransientStore<F extends FeatureKey, K extends keyof SafeFeatureValue<F, K> & string, T>(
    key: `${F}:${K}`,
    selector: (state: SafeFeatureValue<F, K>) => T,
    effect: (value: T) => void,
    deps?: any[]
): void;

export function useTransientStore<T>(
    key: string,
    selector: (state: any) => T,
    effect: (value: T) => void,
    deps: any[] = []
) {
    const api = usePlcApi();

    useEffect(() => {
        const unsubscribe = api.watch(key, selector, (newValue) => {
            effect(newValue);
        });
        return unsubscribe;
    }, [api, key, ...deps]);
}