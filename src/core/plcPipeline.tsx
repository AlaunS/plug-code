import React, { useContext } from "react";
import { ScopeContext } from "../contexts/pipeline";
import type { ObjectType } from "../types/general";
import type { ScheduledSlot, Slot } from "../types/pipeline";
import type { PlcStore } from "./plcStore";

export class PlcPipeline<S extends ObjectType> {
    private slots = new Map<string, Slot[]>()
    private store: PlcStore<S>
    private cache = new Map<string, React.ReactNode[]>()
    private scheduleQueue: ScheduledSlot[] = []

    constructor(store: PlcStore<S>) {
        this.store = store
    }

    register(slot: string, fn: Slot, priority: number = 0) {
        if (!this.slots.has(slot)) this.slots.set(slot, [])
        this.slots.get(slot)!.push(fn)

        this.scheduleQueue.push({ slot, fn, priority })
        this.store.set(`slot:${slot}`, Math.random() as any)
    }

    wrap(slot: string, wrapper: (next: Slot) => Slot, priority: number = 0) {
        const current = this.slots.get(slot) || []
        this.slots.set(
            slot,
            current.map(fn => wrapper(fn))
        )

        current.forEach(fn => this.scheduleQueue.push({ slot, fn, priority }))
        this.store.set(`slot:${slot}`, Math.random() as any)
    }

    render(slot: string, contextData?: any) {
        if (this.scheduleQueue.length > 0) {
            this.scheduleQueue.sort((a, b) => b.priority - a.priority);

            const slotsToUpdate = new Set<string>();
            this.scheduleQueue.forEach(item => slotsToUpdate.add(item.slot));

            slotsToUpdate.forEach(slotName => {
                this.regenerateCache(slotName);
            });

            this.scheduleQueue = [];
        }

        if (!this.cache.has(slot) && this.slots.has(slot)) {
            this.regenerateCache(slot);
        }

        const content = this.cache.get(slot);

        if (contextData !== undefined) {
            return (
                <ScopeContext.Provider value={contextData}>
                    {content}
                </ScopeContext.Provider>
            );
        }

        return content;
    }

    invalidate(slot?: string) {
        if (slot) {
            this.cache.delete(slot)
        } else {
            this.cache.clear()
        }
    }

    private regenerateCache(slot: string) {
        const nodes = this.slots.get(slot)?.map((fn, i) => {
            const SlotBridge = () => {
                const dynamicProps = useContext(ScopeContext);
                return <React.Fragment>{fn(dynamicProps)}</React.Fragment>;
            };

            return <SlotBridge key={i} />;
        }) || [];

        this.cache.set(slot, nodes);
    }
}