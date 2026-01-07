import { ObjectType } from "./general";

export type SlotRegistry = ObjectType;
export type ChannelRegistry = ObjectType;
export type CommandRegistry = Record<string, { payload?: any; result?: any }>;