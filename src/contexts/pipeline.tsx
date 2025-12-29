import { createContext, useContext } from "react";

export const ScopeContext = createContext<any>(null);
export const useScopeData = <T,>() => useContext(ScopeContext) as T;