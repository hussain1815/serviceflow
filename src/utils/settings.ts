import type {
  AppLanguage,
  AppSettings,
  BusinessHoursDay,
  CurrencyCode,
  DateFormat,
  TimeFormat,
  WorkingDay,
} from "../types";
import {
  createDefaultSettings,
  defaultSettings,
  SETTINGS_STORAGE_KEY,
} from "../data/defaultSettings.ts";

export const LANGUAGE_OPTIONS: { value: AppLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "de", label: "German" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "nl", label: "Dutch" },
  { value: "it", label: "Italian" },
];

export const CURRENCY_OPTIONS: {
  value: CurrencyCode;
  label: string;
}[] = [
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "USD", label: "USD ($)" },
  { value: "CHF", label: "CHF (CHF)" },
];

export const TIMEZONE_OPTIONS = [
  "Europe/Berlin",
  "Europe/London",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Rome",
  "UTC",
];

export const COUNTRY_OPTIONS = [
  "Germany",
  "France",
  "Spain",
  "Netherlands",
  "Italy",
];

export const DATE_FORMAT_OPTIONS: {
  value: DateFormat;
  label: string;
}[] = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
];

export const TIME_FORMAT_OPTIONS: {
  value: TimeFormat;
  label: string;
}[] = [
  { value: "12h", label: "12-hour (1:30 PM)" },
  { value: "24h", label: "24-hour (13:30)" },
];

export const WEEKDAY_LABELS: Record<WorkingDay, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

export type SettingsErrors = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(
  source: Record<string, unknown>,
  key: string,
  fallback: string
) {
  const value = source[key];
  return typeof value === "string" ? value.trim() : fallback;
}

function readChoice<T extends string>(
  source: Record<string, unknown>,
  key: string,
  options: readonly T[],
  fallback: T
) {
  const value = source[key];
  return typeof value === "string" &&
    options.includes(value as T)
    ? (value as T)
    : fallback;
}

function normalizeTime(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);

  if (!match) {
    return fallback;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return fallback;
  }

  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

function normalizeBusinessHours(
  value: unknown
): BusinessHoursDay[] {
  const savedHours = Array.isArray(value) ? value : [];
  const savedByDay = new Map<string, Record<string, unknown>>();

  for (const entry of savedHours) {
    if (isRecord(entry) && typeof entry.day === "string") {
      savedByDay.set(entry.day, entry);
    }
  }

  return defaultSettings.businessHours.map((defaultDay) => {
    const saved = savedByDay.get(defaultDay.day);

    if (!saved) {
      return { ...defaultDay };
    }

    return {
      day: defaultDay.day,
      enabled:
        typeof saved.enabled === "boolean"
          ? saved.enabled
          : defaultDay.enabled,
      open: normalizeTime(saved.open, defaultDay.open),
      close: normalizeTime(saved.close, defaultDay.close),
    };
  });
}

export function normalizeSettings(value: unknown): AppSettings {
  const defaults = createDefaultSettings();

  if (!isRecord(value)) {
    return defaults;
  }

  return {
    businessName: readString(
      value,
      "businessName",
      defaults.businessName
    ),
    businessEmail: readString(
      value,
      "businessEmail",
      defaults.businessEmail
    ),
    phone: readString(value, "phone", defaults.phone),
    website: readString(value, "website", defaults.website),
    address: readString(value, "address", defaults.address),
    country: readChoice(
      value,
      "country",
      COUNTRY_OPTIONS,
      defaults.country
    ),
    currency: readChoice(
      value,
      "currency",
      CURRENCY_OPTIONS.map((option) => option.value),
      defaults.currency
    ),
    timezone: readChoice(
      value,
      "timezone",
      TIMEZONE_OPTIONS,
      defaults.timezone
    ),
    language: readChoice(
      value,
      "language",
      LANGUAGE_OPTIONS.map((option) => option.value),
      defaults.language
    ),
    dateFormat: readChoice(
      value,
      "dateFormat",
      DATE_FORMAT_OPTIONS.map((option) => option.value),
      defaults.dateFormat
    ),
    timeFormat: readChoice(
      value,
      "timeFormat",
      TIME_FORMAT_OPTIONS.map((option) => option.value),
      defaults.timeFormat
    ),
    appointmentReminders:
      typeof value.appointmentReminders === "boolean"
        ? value.appointmentReminders
        : defaults.appointmentReminders,
    emailNotifications:
      typeof value.emailNotifications === "boolean"
        ? value.emailNotifications
        : defaults.emailNotifications,
    businessHours: normalizeBusinessHours(value.businessHours),
  };
}

function timeToMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

export function validateSettings(
  settings: AppSettings
): SettingsErrors {
  const errors: SettingsErrors = {};

  if (!settings.businessName.trim()) {
    errors.businessName = "Business name is required.";
  }

  if (!settings.businessEmail.trim()) {
    errors.businessEmail = "Business email is required.";
  } else if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      settings.businessEmail.trim()
    )
  ) {
    errors.businessEmail = "Enter a valid email address.";
  }

  const phone = settings.phone.trim();

  if (!phone) {
    errors.phone = "Phone number is required.";
  } else if (
    !/^[+\d\s().-]+$/.test(phone) ||
    phone.replace(/\D/g, "").length < 6
  ) {
    errors.phone = "Enter a valid phone number.";
  }

  if (!settings.address.trim()) {
    errors.address = "Business address is required.";
  }

  if (
    !CURRENCY_OPTIONS.some(
      (option) => option.value === settings.currency
    )
  ) {
    errors.currency = "Choose a valid currency.";
  }

  if (!TIMEZONE_OPTIONS.includes(settings.timezone)) {
    errors.timezone = "Choose a valid time zone.";
  }

  if (
    !LANGUAGE_OPTIONS.some(
      (option) => option.value === settings.language
    )
  ) {
    errors.language = "Choose a valid language.";
  }

  if (
    !DATE_FORMAT_OPTIONS.some(
      (option) => option.value === settings.dateFormat
    )
  ) {
    errors.dateFormat = "Choose a valid date format.";
  }

  if (
    !TIME_FORMAT_OPTIONS.some(
      (option) => option.value === settings.timeFormat
    )
  ) {
    errors.timeFormat = "Choose a valid time format.";
  }

  for (const day of settings.businessHours) {
    if (!day.enabled) {
      continue;
    }

    const dayLabel = WEEKDAY_LABELS[day.day] ?? day.day;
    const errorKey = `hours-${day.day}`;

    if (!day.open || !day.close) {
      errors[errorKey] = `${dayLabel}: set both opening and closing times.`;
      continue;
    }

    const open = timeToMinutes(day.open);
    const close = timeToMinutes(day.close);

    if (open === null || close === null) {
      errors[errorKey] = `${dayLabel}: enter valid times.`;
      continue;
    }

    if (close <= open) {
      errors[errorKey] =
        `${dayLabel}: closing time must be after opening time.`;
    }
  }

  return errors;
}

export function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);

    if (!saved) {
      return createDefaultSettings();
    }

    return normalizeSettings(JSON.parse(saved));
  } catch (error) {
    console.error("Unable to load saved settings:", error);
    return createDefaultSettings();
  }
}

export function persistSettings(settings: AppSettings) {
  try {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(settings)
    );
    return true;
  } catch (error) {
    console.error("Unable to save settings:", error);
    return false;
  }
}
