
export type SlotWrapper = (next: React.ReactNode, props?: any) => React.ReactNode;
export type VirtualConfig = {
    itemHeight?: number;
    overscan?: number;
    initialEstimatedHeight?: number;
    measured: boolean;
    estimatedHeight: number;
    dynamicMeasurement: boolean;
    scrollTop: number;
    as?: any;
    itemAs?: any;
};