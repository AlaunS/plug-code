import React, { JSX } from "react";
import { ScopeContext } from "./plcLayout";

type virtualContainerType = {
    content: JSX.Element[],
    config: any,
    contextData: any
}

export function VirtualContainer({ content, config, contextData }: virtualContainerType) {
    const ref = React.useRef<HTMLDivElement>(null);
    const rowRefs = React.useRef<HTMLElement[]>([]);
    const pipeline = React.useContext(ScopeContext)?.pipeline;

    React.useLayoutEffect(() => {
        if (!ref.current) return;
        config.viewport = ref.current.clientHeight;
    }, []);

    const rowHeight = config.itemHeight ?? config.estimatedHeight;
    const total = content.length;

    const start = Math.max(
        0,
        Math.floor(config.scrollTop / rowHeight) - config.overscan
    );

    const end = Math.min(
        total,
        Math.ceil((config.scrollTop + config.viewport) / rowHeight) + config.overscan
    );

    rowRefs.current = [];
    const visible = content.slice(start, end);

    React.useLayoutEffect(() => {
        if (!config.needsMeasure || rowRefs.current.length === 0) return;

        const avg =
            rowRefs.current.reduce((s, el) => s + el.offsetHeight, 0) /
            rowRefs.current.length;

        config.estimatedHeight = avg;
        config.measured = true;
        config.needsMeasure = false;

        pipeline?.scheduleJob(() => {}, 100);
    }, [visible]);

    return (
        <div
            ref={ref}
            onScroll={e => {
                const top = e.currentTarget.scrollTop;
                config.scrollTop = top;
                pipeline?.scheduleJob(() => {}, 100);
            }}
            style={{ overflow: "auto", height: "100%" }}
        >
            <div style={{ height: total * rowHeight }}>
                <div style={{ transform: `translateY(${start * rowHeight}px)` }}>
                    {contextData ? (
                        <ScopeContext.Provider value={contextData}>
                            {visible.map((node, i) => (
                                <div
                                    key={i}
                                    ref={el => {
                                        if (el) rowRefs.current.push(el);
                                    }}
                                >
                                    {node}
                                </div>
                            ))}
                        </ScopeContext.Provider>
                    ) : (
                        visible.map((node, i) => (
                            <div
                                key={i}
                                ref={el => {
                                    if (el) rowRefs.current.push(el);
                                }}
                            >
                                {node}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
