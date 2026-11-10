
import {
  useEffect,
  useReducer,
  useState,
  type ReactNode,
} from "react";

import { AppDataContext } from "./appDataContextInstance";
import { initialData } from "../data/initialData";
import type { AppData, Appointment, AppSettings } from "../types";
import { normalizeAppointment } from "../utils/appointments";
import {
  loadSettings,
  normalizeSettings,
  persistSettings,
} from "../utils/settings";
type Collection = keyof AppData;

type Action =
  | { type: "SET_DATA"; payload: AppData }
  | { type: "UPSERT"; collection: Collection; item: { id: string } }
  | { type: "DELETE"; collection: Collection; id: string };

const STORAGE_KEY = "serviceflow-app-data";

// Load saved data from localStorage
function loadInitialData(): AppData {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);

    if (savedData) {
      const saved = JSON.parse(savedData) as Partial<AppData>;
      const savedAppointments = Array.isArray(saved.appointments)
        ? saved.appointments
        : initialData.appointments;

      return {
        ...initialData,
        ...saved,
        services: Array.isArray(saved.services)
          ? saved.services
          : initialData.services,
        appointments: savedAppointments.map((appointment) =>
          normalizeAppointment(appointment)
        ),
      };
    }
  } catch (error) {
    console.error("Unable to load saved application data:", error);
  }

  return initialData;
}

// Manage application state
function appDataReducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case "SET_DATA":
      return action.payload;

    case "UPSERT": {
      const collection = state[action.collection] as Array<{ id: string }>;

      const exists = collection.some(
        (item) => item.id === action.item.id
      );

      return {
        ...state,
        [action.collection]: exists
          ? collection.map((item) =>
              item.id === action.item.id ? action.item : item
            )
          : [...collection, action.item],
      };
    }

    case "DELETE":
      return {
        ...state,
        [action.collection]: (
          state[action.collection] as Array<{ id: string }>
        ).filter((item) => item.id !== action.id),
      };

    default:
      return state;
  }
}

// Context interface
export interface AppDataContextValue {
  data: AppData;
  settings: AppSettings;
  saveSettings: (settings: AppSettings) => boolean;
  upsert: (collection: Collection, item: { id: string }) => void;
  remove: (collection: Collection, id: string) => void;
  replaceData: (data: AppData) => void;
}

// Create context
// const AppDataContext = createContext<AppDataContextValue | undefined>(
//   undefined
// );

// Provider component
export function AppDataProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(
    appDataReducer,
    undefined,
    loadInitialData
  );
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  // Automatically save changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Unable to save application data:", error);
    }
  }, [data]);

  // Persist settings separately so business data is never overwritten
  const saveSettings = (nextSettings: AppSettings) => {
    const normalized = normalizeSettings(nextSettings);

    if (!persistSettings(normalized)) {
      return false;
    }

    setSettings(normalized);
    return true;
  };

  // Add or update records
  const upsert = (collection: Collection, item: { id: string }) => {
    const nextItem =
      collection === "appointments"
        ? normalizeAppointment(item as Appointment)
        : item;

    dispatch({ type: "UPSERT", collection, item: nextItem });
  };

  // Delete records
  const remove = (collection: Collection, id: string) => {
    dispatch({ type: "DELETE", collection, id });
  };

  // Replace all application data
  const replaceData = (newData: AppData) => {
    dispatch({
      type: "SET_DATA",
      payload: {
        ...newData,
        appointments: newData.appointments.map((appointment) =>
          normalizeAppointment(appointment)
        ),
      },
    });
  };

  return (
    <AppDataContext.Provider
      value={{
        data,
        settings,
        saveSettings,
        upsert,
        remove,
        replaceData,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}
