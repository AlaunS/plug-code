
export type Slot = (props?: any) => React.ReactNode
export type ScheduledSlot = { slot: string, fn: Slot, priority: number }