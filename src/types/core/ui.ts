
export type SlotWrapper = (next: React.ReactNode, props?: any) => React.ReactNode;
export type VirtualConfig = {
    itemHeight: number;
    overscan: number;
    measured: boolean;
    estimatedHeight: number;
};