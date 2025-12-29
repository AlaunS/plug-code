export type Slot = () => React.ReactNode;
export type ScheduledSlot = {
    slot: string;
    fn: Slot;
    priority: number;
};
