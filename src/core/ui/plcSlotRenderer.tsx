import React from "react";
import { ScopeContext, SlotItem } from "./plcLayout";
import { SlotErrorBoundary } from "./plcErrorBoundary";
import { shallowEqual } from "../helpers/core";

export const SlotItemRenderer = React.memo(({
    item,
    props
}: {
    item: SlotItem,
    props: any
}) => {
    return (
        <SlotErrorBoundary id={item.id}>
            <ScopeContext.Provider value={props}>
                {item.fn(props)}
            </ScopeContext.Provider>
        </SlotErrorBoundary>
    );
}, (prev, next) => {
    return prev.item === next.item && shallowEqual(prev.props, next.props);
});