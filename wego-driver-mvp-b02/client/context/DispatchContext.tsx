import { createContext, useContext, type ReactNode } from "react";
import { useDispatch } from "@/hooks/useDispatch";

type DispatchContextValue = ReturnType<typeof useDispatch>;

const DispatchContext = createContext<DispatchContextValue | null>(null);

export function DispatchProvider({ children }: { children: ReactNode }) {
  const value = useDispatch();
  return <DispatchContext.Provider value={value}>{children}</DispatchContext.Provider>;
}

export function useDispatchContext(): DispatchContextValue {
  const ctx = useContext(DispatchContext);
  if (!ctx) throw new Error("useDispatchContext must be used within DispatchProvider");
  return ctx;
}
