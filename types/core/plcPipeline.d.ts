import React from "react";
import type { ObjectType } from "../types/general";
import type { Slot } from "../types/pipeline";
import type { PlcStore } from "./plcStore";
export declare class PlcPipeline<S extends ObjectType> {
    private slots;
    private store;
    private cache;
    private scheduleQueue;
    constructor(store: PlcStore<S>);
    register(slot: string, fn: Slot, priority?: number): void;
    wrap(slot: string, wrapper: (next: Slot) => Slot, priority?: number): void;
    render(slot: string, contextData?: any): React.ReactNode[] | import("react/jsx-runtime").JSX.Element;
    invalidate(slot?: string): void;
    private regenerateCache;
}
