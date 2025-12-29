import type { PlcAPI } from "../core/plcAPI";
import type { ObjectType } from "./general";
export type FeatureType<S extends ObjectType> = {
    name: string;
    setup?: (api: PlcAPI<S>) => void | (() => void);
};
