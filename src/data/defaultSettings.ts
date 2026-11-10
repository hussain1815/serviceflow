import type { AppSettings } from "../types";

export const SETTINGS_STORAGE_KEY = "serviceflow-settings";

export const defaultSettings: AppSettings = {
  businessName: "Luna Beauty Studio",
  businessEmail: "hello@lunabeauty.com",
  phone: "+49 30 12345678",
  website: "www.lunabeauty.com",
  address: "Friedrichstraße 120, Berlin, Germany",
  country: "Germany",
  currency: "EUR",
  timezone: "Europe/Berlin",
  language: "en",
  dateFormat: "DD/MM/YYYY",
  timeFormat: "24h",
  appointmentReminders: true,
  emailNotifications: true,
  businessHours: [
    { day: "Mon", enabled: true, open: "09:00", close: "18:00" },
    { day: "Tue", enabled: true, open: "09:00", close: "18:00" },
    { day: "Wed", enabled: true, open: "09:00", close: "18:00" },
    { day: "Thu", enabled: true, open: "09:00", close: "18:00" },
    { day: "Fri", enabled: true, open: "09:00", close: "18:00" },
    { day: "Sat", enabled: true, open: "10:00", close: "16:00" },
    { day: "Sun", enabled: false, open: "10:00", close: "16:00" },
  ],
};

export function createDefaultSettings(): AppSettings {
  return {
    ...defaultSettings,
    businessHours: defaultSettings.businessHours.map((day) => ({ ...day })),
  };
}
