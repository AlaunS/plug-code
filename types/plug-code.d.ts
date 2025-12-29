import type { ObjectType } from "./types/general";
import type { FeatureType } from "./types/features";
import { PlcAPI } from "./core/plcAPI";
export declare function createPlugAndCode<S extends ObjectType>(features: FeatureType<S>[]): {
    useSystemPlc: <T extends object>(initialProps: T) => {
        api: PlcAPI<{}>;
        useSelector: <Result>(selector: (state: any) => Result) => Result;
    };
    SystemPlcRoot: ({ api, children }: {
        api: PlcAPI<any>;
        children?: React.ReactNode;
    }) => import("react/jsx-runtime").JSX.Element;
};
