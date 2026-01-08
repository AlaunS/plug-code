import { PlcAPI } from "../../core/plcAPI";
import { CommandFn } from "./api";

export type ObjectType = Record<string, any>;
export type ModuleManifest = {
    name: string;
    state?: Record<string, any>;
    commands?: Record<string, CommandFn>;
    slots?: Record<string, { id: string, component: (props?: any) => React.ReactNode, priority?: number, keepAlive?: boolean }[]>;
    onLoad?: () => void;
};