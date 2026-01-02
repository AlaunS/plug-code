import { enableMapSet } from "immer";
import type { ObjectType } from "./types/general";
import { PlcAPI } from "./core/plcAPI";
import { useEffect, useMemo, useState } from "react";
import { PlcStore } from "./core/plcStore";

enableMapSet();

export function createPlugAndCode<S extends ObjectType>(
    setupSystem: (api: PlcAPI<S>) => void
) {
    const FeatureHost = ({ api, children }: { api: PlcAPI<any>, children?: React.ReactNode }) => (
        <>
            {api.render("root")}
            {children}
        </>
    )

    function SystemPlcRoot({ api, children }: { api: PlcAPI<any>, children?: React.ReactNode }) {
        if (!api) return null;
        return (
            <FeatureHost api={api}>
                {children}
            </FeatureHost>
        )
    }

    function useSystemPlc<T extends object>(initialProps: T) {

        const api = useMemo(() => {
            const store = new PlcStore({}, true);
            const api = new PlcAPI(store);

            api.createData("root", initialProps);

            setupSystem(api as unknown as PlcAPI<S>);

            return api;
        }, []);

        useEffect(() => {
            api.update("root", (draft: any) => {
                Object.assign(draft, initialProps);
            });
        }, [initialProps, api]);

        const useSelector = <Result,>(selector: (state: any) => Result): Result => {
            const [snap, setSnap] = useState(() => selector(api.getData("root")));

            useEffect(() => {
                return api.subscribe(() => {
                    const fullState = api.getData("root");
                    setSnap(selector(fullState));
                });
            }, [selector]);

            return snap;
        }

        return {
            api,
            useSelector
        }
    }
    return { useSystemPlc, SystemPlcRoot }
}