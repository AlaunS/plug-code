import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { VirtualConfig } from "types/core/ui";
import { ScopeContext } from "./plcLayout";

type VirtualContainerProps = {
    data: any[];
    renderItem: (item: any, index: number) => React.ReactNode;
    config: VirtualConfig;
    contextData: any;
};

const MemoizedItem = React.memo(
    ({ Tag, style, children }: any) => <Tag style={style}>{children}</Tag>,
    (prev, next) => prev.children === next.children && prev.style.height === next.style.height
);

function computeInitialRange(itemHeight: number, estimatedHeight = 500, overscan = 5) {
    const visible = Math.ceil(estimatedHeight / itemHeight);
    return { start: 0, end: visible + overscan };
}

export const VirtualContainer: React.FC<VirtualContainerProps> = ({
    data,
    renderItem,
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
    const totalItems = data.length;

    const [hydrated, setHydrated] = useState(false);
    const [ready, setReady] = useState(false);

    const [range, setRange] = useState(() =>
        computeInitialRange(itemHeight, config.initialEstimatedHeight, overscan)
    );

    useLayoutEffect(() => {
        requestAnimationFrame(() => setHydrated(true));

        if (!containerRef.current) return;

        if (!scrollParentRef.current) {
            scrollParentRef.current =
                containerRef.current.closest('[data-virtual-scroll]') as HTMLElement
                || containerRef.current;
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

    }, [data.length, itemHeight, overscan]);

    const { paddingTop, paddingBottom, visibleData } = useMemo(() => ({
        paddingTop: range.start * itemHeight,
        paddingBottom: (totalItems - range.end) * itemHeight,
        visibleData: data.slice(range.start, range.end)
    }), [range, data, itemHeight, totalItems]);

    useLayoutEffect(() => {
        if (!ready) return;
        const scrollParent = scrollParentRef.current;
        if (!scrollParent) return;

        const { index, offset } = anchorRef.current;
        const expectedScrollTop = index * itemHeight + offset;
        const delta = expectedScrollTop - scrollParent.scrollTop;

        if (Math.abs(delta) > 0.5) {
            scrollParent.style.scrollBehavior = 'auto';
            scrollParent.scrollTop = expectedScrollTop;
            requestAnimationFrame(() => {
                scrollParent.style.scrollBehavior = '';
            });
        }
    }, [range, ready]);

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

    if (!ready) {
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
                        <MemoizedItem
                            key={item.id ?? range.start + index}
                            Tag={ItemTag}
                            style={{ height: `${itemHeight}px` }}
                        >
                            {renderItem(item, range.start + index)}
                        </MemoizedItem>
                    ))}
                </ScopeContext.Provider>
            ) : (
                visibleData.map((item, index) => (
                    <MemoizedItem
                        key={item.id ?? range.start + index}
                        Tag={ItemTag}
                        style={{ height: `${itemHeight}px` }}
                    >
                        {renderItem(item, range.start + index)}
                    </MemoizedItem>
                ))
            )}

            <Spacer height={paddingBottom} />
        </Tag>
    );
};
