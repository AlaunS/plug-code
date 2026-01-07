
export interface RootStoreRegistry { }
export interface CommandRegistry { }
export interface SlotRegistry { }
export interface FeatureRegistry { }

export type StoreKey = keyof RootStoreRegistry extends never ? string : keyof RootStoreRegistry;
export type StoreValue<K extends StoreKey> = K extends keyof RootStoreRegistry ? RootStoreRegistry[K] : any;

export type CommandKey = keyof CommandRegistry extends never ? string : keyof CommandRegistry;
export type SlotKey = keyof SlotRegistry extends never ? string : keyof SlotRegistry;
export type FeatureKey = keyof FeatureRegistry extends never ? string : keyof FeatureRegistry;

export type CmdPayload<K extends CommandKey> = K extends keyof CommandRegistry
    ? (CommandRegistry[K] extends { payload: infer P } ? P : void)
    : any;

export type CmdResult<K extends CommandKey> = K extends keyof CommandRegistry
    ? (CommandRegistry[K] extends { result: infer R } ? R : void)
    : any;

export type SlotProps<K extends SlotKey> = K extends keyof SlotRegistry ? SlotRegistry[K] : any;