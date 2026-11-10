import { createContext } from "react";
import type { AppDataContextValue } from "./AppDataContext";

export const AppDataContext =
  createContext<AppDataContextValue | undefined>(undefined);