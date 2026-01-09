import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ScopeContext } from "./plcLayout";
import { VirtualConfig } from "types/core/ui";

type VirtualContainerProps = {
    data: any[];
    indexMap?: number[] | null;
    renderItem: (item: any, index: number, colWidthsRef?: number[]) => React.ReactNode;
    config: VirtualConfig;
    contextData: any;
};

const RowWrapper = React.memo(({ item, index, render, style, Tag }: any) => {
    return (
        <Tag style={style}>
            {render(item, index)}
        </Tag>
    );
}, (prev, next) => {
    return prev.item === next.item &&
        prev.index === next.index &&
        prev.style.height === next.style.height;
});

function computeInitialRange(itemHeight: number, estimatedHeight = 500, overscan = 5) {
    const visible = Math.ceil(estimatedHeight / itemHeight);
    return { start: 0, end: visible + overscan };
}

const VirtualContainerBase: React.FC<VirtualContainerProps> = ({
    data,
    renderItem,
    indexMap,
    config,
    contextData
}) => {
    const containerRef = useRef<HTMLElement>(null);
    const scrollParentRef = useRef<HTMLElement | null>(null);
    const scrollInfo = useRef({ top: 0, height: 0 });
    const anchorRef = useRef({ index: 0, offset: 0 });

    const Tag = config.as || 'div';
    const ItemTag = config.itemAs || 'div';
    const itemHeight = config.itemHeight ?? config.estimatedHeight;
    const overscan = config.overscan ?? 5;
    const totalItems = indexMap ? indexMap.length : data.length;

    const [error, setError] = useState<string | null>(null);
    const [hydrated, setHydrated] = useState(false);
    const [ready, setReady] = useState(false);

    const colWidthsRef = useRef<number[] | null>(null);
    const [columnsReady, setColumnsReady] = useState(false);

    const [range, setRange] = useState(() =>
        computeInitialRange(itemHeight, config.initialEstimatedHeight, overscan)
    );

    useLayoutEffect(() => {
        requestAnimationFrame(() => setHydrated(true));

        if (!containerRef.current) return;

        if (!scrollParentRef.current) {
            scrollParentRef.current = containerRef.current.closest('[data-virtual-scroll]') as HTMLElement;
            if (!scrollParentRef.current) {
                console.warn("No scroll parent with [data-virtual-scroll] found.");
                return;
            }
        }

        const scrollParent = scrollParentRef.current;

        const updateRange = (scrollTop: number, viewHeight: number) => {
            const rawStart = Math.floor(scrollTop / itemHeight);
            const rawEnd = Math.ceil((scrollTop + viewHeight) / itemHeight);

            const start = Math.max(0, rawStart - overscan);
            const end = Math.min(totalItems, rawEnd + overscan);

            setRange(prev => {
                if (
                    Math.abs(prev.start - start) < 1 &&
                    Math.abs(prev.end - end) < 1
                ) return prev;

                anchorRef.current = {
                    index: rawStart,
                    offset: scrollTop - rawStart * itemHeight
                };

                return { start, end };
            });
        };

        const handleScroll = () => {
            const scrollTop = scrollParent.scrollTop;
            scrollInfo.current.top = scrollTop;
            config.scrollTop = scrollTop;
            updateRange(scrollTop, scrollInfo.current.height);
        };

        scrollInfo.current.height = scrollParent.clientHeight;
        updateRange(scrollParent.scrollTop, scrollInfo.current.height);
        setReady(true);

        scrollParent.addEventListener('scroll', handleScroll, { passive: true });
        return () => scrollParent.removeEventListener('scroll', handleScroll);

    }, [data.length, itemHeight, overscan, totalItems]);

    useLayoutEffect(() => {
        if (colWidthsRef.current || !containerRef.current) return;

        const table = containerRef.current.closest('table');
        const headerRow = table?.querySelector('thead tr');
        if (!headerRow) return;

        const widths = Array.from(headerRow.children).map(
            cell => (cell as HTMLElement).getBoundingClientRect().width
        );

        colWidthsRef.current = widths;
        setColumnsReady(true);
    }, []);

    const { paddingTop, paddingBottom, visibleData } = useMemo(() => {
        const start = range.start;
        const end = Math.min(range.end, totalItems);

        const slice: any[] = [];

        if (indexMap) {
            for (let i = start; i < end; i++) {
                const realIndex = indexMap[i];
                slice.push(data[realIndex]);
            }
        }
        else {
            for (let i = start; i < end; i++) {
                slice.push(data[i]);
            }
        }

        return {
            paddingTop: range.start * itemHeight,
            paddingBottom: (totalItems - range.end) * itemHeight,
            visibleData: slice
        };
    }, [range, data, indexMap, itemHeight, totalItems]);

    useLayoutEffect(() => {
        if (!ready) return;
        const scrollParent = scrollParentRef.current;
        if (!scrollParent) return;

        const { index, offset } = anchorRef.current;
        const expectedScrollTop = index * itemHeight + offset;
        const delta = expectedScrollTop - scrollParent.scrollTop;

        if (Math.abs(delta) > 1) {
            scrollParent.style.scrollBehavior = 'auto';
            scrollParent.scrollTop = expectedScrollTop;
            requestAnimationFrame(() => {
                scrollParent.style.scrollBehavior = '';
            });
        }
    }, [range, ready, itemHeight]);

    const Spacer = useCallback(({ height }: { height: number }) => {
        if (height <= 0) return null;

        if (Tag === 'tbody') {
            return (
                <tr style={{ height: `${height}px`, pointerEvents: 'none' }}>
                    <td colSpan={100} style={{ height: `${height}px`, padding: 0, border: 0 }} />
                </tr>
            );
        }

        return <ItemTag style={{ height: `${height}px`, padding: 0, border: 0 }} />;
    }, [Tag, ItemTag]);

    if (error) {
        return <div style={{ color: 'red', fontSize: 12 }}>Error: {error}</div>;
    }

    if (!ready && totalItems > 0) {
        return (
            <Tag
                ref={containerRef as any}
                style={{ height: totalItems * itemHeight, contain: 'strict' }}
            />
        );
    }

    return (
        <Tag
            ref={containerRef as any}
            style={{
                display: Tag === 'tbody' ? undefined : 'block',
                contain: 'strict',
                position: 'relative'
            }}
        >
            <Spacer height={paddingTop} />

            {hydrated ? (
                <ScopeContext.Provider value={contextData}>
                    {visibleData.map((item, index) => (
                        <RowWrapper
                            key={item.id ?? (indexMap ? indexMap[range.start + index] : range.start + index)}
                            item={item}
                            index={range.start + index}
                            render={(itm: any, idx: number) => renderItem(itm, idx, colWidthsRef.current ?? [])}

                            Tag={ItemTag}
                            style={{
                                height: `${itemHeight}px`,
                                contentVisibility: "auto",
                                willChange: "transform",
                                contain: 'strict'
                            }}
                        />
                    ))}
                </ScopeContext.Provider>
            ) : (
                visibleData.map((item, index) => (
                    <RowWrapper
                        key={item.id ?? (indexMap ? indexMap[range.start + index] : range.start + index)}
                        item={item}
                        index={range.start + index}
                        render={(itm: any, idx: number) => renderItem(itm, idx, colWidthsRef.current ?? [])}
                        Tag={ItemTag}
                        style={{
                            height: `${itemHeight}px`,
                            contentVisibility: "auto",
                            willChange: "transform",
                            contain: 'strict'
                        }}
                    />
                ))
            )}

            <Spacer height={paddingBottom} />
        </Tag>
    );
};

export const VirtualContainer = React.memo(VirtualContainerBase, (prev, next) => {
    return prev.data === next.data &&
        prev.indexMap === next.indexMap &&
        prev.config === next.config &&
        prev.contextData === next.contextData;
});