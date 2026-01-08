import React, { createContext, Component, ErrorInfo } from "react";
import { SlotWrapper, VirtualConfig } from "../../types/core/ui";
import { VirtualContainer } from "./plcCore";
import { SlotItemRenderer } from "./plcSlotRenderer";

export const ScopeContext = createContext<any>(undefined);

// ---------------------------------------------------------
// Error Boundary
// ---------------------------------------------------------
class SlotErrorBoundary extends Component<{ id: string, fallback?: React.ReactNode, children: React.ReactNode }, { hasError: boolean }> {
    state = { hasError: false };

    static getDerivedStateFromError(_: Error) {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error(`[PlcLayout] Error in slot item '${this.props.id}':`, error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div style={{ padding: 4, color: 'red', fontSize: '0.8em', border: '1px dashed red' }}>
                    Error: {this.props.id}
                </div>
            );
        }
        return this.props.children;
    }
}

export type SlotItem = {
    id: string;
    priority: number;
    keepAlive: boolean;
    fn: (props?: any) => React.ReactNode;
};

export class PlcLayout {
    private slots = new Map<string, SlotItem[]>();
    private virtualRegistry = new Map<string, VirtualConfig>();
    private wrappers = new Map<string, SlotWrapper[]>();

    private renderCache = new Map<string, React.ReactNode>();
    private cacheVersion = new Map<string, number>();

    // ---------------------------------------------------------
    // Virtualization
    // ---------------------------------------------------------
    markVirtual(slot: string, config?: { itemHeight?: number; overscan?: number }) {
        this.virtualRegistry.set(slot, {
            itemHeight: config?.itemHeight ?? 32,
            overscan: config?.overscan ?? 6,
            measured: !!config?.itemHeight,
            estimatedHeight: config?.itemHeight ?? 32,
        });
    }

    // ---------------------------------------------------------
    // Middleware (WRAP)
    // ---------------------------------------------------------
    wrap(slot: string, wrapper: SlotWrapper, priority: number = 0) {
        if (!this.wrappers.has(slot)) {
            this.wrappers.set(slot, []);
        }
        this.wrappers.get(slot)!.push(wrapper);
        this.invalidate(slot);
    }

    // ---------------------------------------------------------
    // Slot Manager
    // ---------------------------------------------------------
    register(slot: string, id: string, fn: (props?: any) => React.ReactNode, priority: number = 0, keepAlive: boolean = false) {
        if (!this.slots.has(slot)) {
            this.slots.set(slot, []);
            this.cacheVersion.set(slot, 0);
        }

        const list = this.slots.get(slot)!;
        const existingIdx = list.findIndex(x => x.id === id);
        const item: SlotItem = { id, priority, fn, keepAlive };

        if (existingIdx >= 0) list[existingIdx] = item;
        else list.push(item);

        list.sort((a, b) => b.priority - a.priority);
        this.invalidate(slot);
    }

    unregister(slot: string, id: string) {
        const list = this.slots.get(slot);
        if (!list) return;

        const idx = list.findIndex(x => x.id === id);
        if (idx >= 0) {
            list.splice(idx, 1);
            this.invalidate(slot);
        }
    }

    // ---------------------------------------------------------
    // Render
    // ---------------------------------------------------------
    invalidate(slot?: string) {
        if (slot) {
            this.renderCache.delete(slot);
            this.cacheVersion.set(slot, (this.cacheVersion.get(slot) || 0) + 1);
        } else {
            this.renderCache.clear();
            for (const k of this.cacheVersion.keys()) {
                this.cacheVersion.set(k, (this.cacheVersion.get(k) || 0) + 1);
            }
        }
    }

    render(slot: string, props?: any): React.ReactNode {
        let content = this.renderBase(slot, props);

        const slotWrappers = this.wrappers.get(slot);
        if (slotWrappers && slotWrappers.length > 0) {
            for (const wrapFn of slotWrappers) {
                content = wrapFn(content, props);
            }
        }
        return content;
    }

    private renderBase(slot: string, props: any): React.ReactNode {
        const list = this.slots.get(slot) || [];
        const virtualConfig = this.virtualRegistry.get(slot);

        if (virtualConfig && list.length > 0) {
            const protectedItems = list.map(item => ({
                ...item,
                fn: (p: any) => (
                    <SlotErrorBoundary id={item.id}>
                        {item.fn(p)}
                    </SlotErrorBoundary>
                )
            }));
            const content = protectedItems.map((item, i) => (
                <ScopeContext.Provider key={item.id} value={props}>
                    {item.fn(props)}
                </ScopeContext.Provider>
            ));

            return (
                <VirtualContainer
                    content={content}
                    config={virtualConfig}
                    contextData={props}
                />
            );
        }

        return list.map(item => {
            const isActive = props?.activeId ? props.activeId === item.id : true;
            if (!isActive && !item.keepAlive) return null;

            return (
                <div
                    key={item.id}
                    style={{ display: isActive ? undefined : 'none' }}
                >
                    <SlotItemRenderer item={item} props={props} />
                </div>
            );
        });
    }

    getSlotItems(slot: string) { return this.slots.get(slot) || []; }
    getPriority(slot: string, id: string): number | undefined {
        return this.slots.get(slot)?.find(x => x.id === id)?.priority;
    }
}