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
    private globalVersion = 0;

    // ---------------------------------------------------------
    // Virtualization
    // ---------------------------------------------------------
    markVirtual(slot: string, config?: {
        itemHeight?: number;
        overscan?: number;
        initialEstimatedHeight?: number;
        as?: any;
        itemAs?: any;
    }) {
        const itemHeight = config?.itemHeight;
        this.virtualRegistry.set(slot, {
            itemHeight,
            overscan: config?.overscan ?? 5,
            measured: !!itemHeight,
            estimatedHeight: itemHeight ?? config?.initialEstimatedHeight ?? 48,
            dynamicMeasurement: !itemHeight,
            scrollTop: 0,
            as: config?.as ?? 'div',
            itemAs: config?.itemAs ?? 'div'
        });
        this.invalidate(slot);
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
        if (list.length > 1) {
            list.sort((a, b) => b.priority - a.priority);
        }

        const existingIdx = list.findIndex(x => x.id === id);
        const item: SlotItem = { id, priority, fn, keepAlive };

        if (existingIdx >= 0) list[existingIdx] = item;
        else list.push(item);

        this.invalidate(slot);
    }

    registerMany(slot: string, items: { id: string; fn: (props?: any) => React.ReactNode; priority?: number; keepAlive?: boolean }[]) {
        if (!this.slots.has(slot)) {
            this.slots.set(slot, []);
            this.cacheVersion.set(slot, 0);
        }

        const list = this.slots.get(slot)!;

        items.forEach(item => {
            const existingIdx = list.findIndex(x => x.id === item.id);
            const newItem: SlotItem = {
                priority: 0,
                keepAlive: false,
                ...item
            };

            if (existingIdx >= 0) list[existingIdx] = newItem;
            else list.push(newItem);
        });

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
            const current = this.cacheVersion.get(slot) || 0;
            this.cacheVersion.set(slot, current + 1);
        } else {
            this.renderCache.clear();
            this.globalVersion++;
        }
    }

    getSlotVersion(slot: string): number {
        return (this.cacheVersion.get(slot) || 0) + this.globalVersion;
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
        const dataItems = props?.items;

        if (virtualConfig && Array.isArray(dataItems)) {
            const templateItem = list[0];

            if (!templateItem) return null;

            return (
                <VirtualContainer
                    data={dataItems}
                    renderItem={(item, index) => (
                        <SlotErrorBoundary id={`${templateItem.id}-idx-${index}`}>
                            {templateItem.fn(item)}
                        </SlotErrorBoundary>
                    )}
                    config={virtualConfig}
                    contextData={props}
                />
            );
        }

        if (virtualConfig && list.length > 0) {
            return (
                <VirtualContainer
                    data={list}
                    renderItem={(item: SlotItem) => (
                        <SlotErrorBoundary id={item.id}>
                            {item.fn(props)}
                        </SlotErrorBoundary>
                    )}
                    config={virtualConfig}
                    contextData={props}
                />
            );
        }

        return list.map(item => {
            const isActive = props?.activeId ? props.activeId === item.id : true;
            if (!isActive && !item.keepAlive) return null;

            const Container = (item as any).as || React.Fragment;

            return (
                <Container key={item.id}>
                    <div style={{ display: isActive ? undefined : 'none' }}>
                        <SlotErrorBoundary id={item.id}>
                            <SlotItemRenderer item={item} props={props} />
                        </SlotErrorBoundary>
                    </div>
                </Container>
            );
        });
    }

    getSlotItems(slot: string) { return this.slots.get(slot) || []; }
    getPriority(slot: string, id: string): number | undefined {
        return this.slots.get(slot)?.find(x => x.id === id)?.priority;
    }
}