import { useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  Bell,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Globe,
  LockKeyhole,
  Save,
  ShieldCheck,
  Store,
  User,
} from "lucide-react";
import { useAppData } from "../context/useAppData";
import type {
  AppSettings,
  BusinessHoursDay,
  WorkingDay,
} from "../types";
import {
  COUNTRY_OPTIONS,
  CURRENCY_OPTIONS,
  DATE_FORMAT_OPTIONS,
  LANGUAGE_OPTIONS,
  TIME_FORMAT_OPTIONS,
  TIMEZONE_OPTIONS,
  WEEKDAY_LABELS,
  normalizeSettings,
  validateSettings,
  type SettingsErrors,
} from "../utils/settings.ts";

const settingsSections = [
  {
    icon: Store,
    title: "Business Information",
    description: "Salon name, contact details and address",
    targetId: "settings-business",
  },
  {
    icon: User,
    title: "Profile Settings",
    description: "Manage your personal account information",
  },
  {
    icon: Bell,
    title: "Notifications",
    description: "Control email and appointment notifications",
    targetId: "settings-notifications",
  },
  {
    icon: Globe,
    title: "Language & Region",
    description: "Language, currency and regional preferences",
    targetId: "settings-preferences",
  },
  {
    icon: Clock,
    title: "Business Hours",
    description: "Set your salon's opening and closing hours",
    targetId: "settings-hours",
  },
  {
    icon: ShieldCheck,
    title: "Security",
    description: "Password and account security settings",
  },
  {
    icon: CreditCard,
    title: "Billing & Subscription",
    description: "Manage your plan and payment details",
  },
];

type Feedback = {
  type: "success" | "error";
  message: string;
} | null;

export default function SettingsPage() {
  const { settings, saveSettings } = useAppData();
  const [draft, setDraft] = useState<AppSettings>(() =>
    normalizeSettings(settings)
  );
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [activeSection, setActiveSection] = useState(
    "Business Information"
  );

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(settings),
    [draft, settings]
  );
  const businessInitial =
    draft.businessName.trim().charAt(0).toUpperCase() || "B";

  function clearFieldError(field: string) {
    setErrors((current) => {
      if (!(field in current)) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateField<K extends keyof AppSettings>(
    field: K,
    value: AppSettings[K]
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
    setFeedback(null);
    clearFieldError(String(field));
  }

  function updateBusinessDay(
    day: WorkingDay,
    patch: Partial<BusinessHoursDay>
  ) {
    setDraft((current) => ({
      ...current,
      businessHours: current.businessHours.map((item) =>
        item.day === day ? { ...item, ...patch } : item
      ),
    }));
    setFeedback(null);
    clearFieldError(`hours-${day}`);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateSettings(draft);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setFeedback({
        type: "error",
        message:
          "Please review the highlighted settings before saving.",
      });
      return;
    }

    const normalized = normalizeSettings(draft);

    if (!saveSettings(normalized)) {
      setFeedback({
        type: "error",
        message:
          "Your settings could not be saved in this browser. Please check storage permissions.",
      });
      return;
    }

    setDraft(normalized);
    setErrors({});
    setFeedback({
      type: "success",
      message: "Settings saved successfully.",
    });
  }

  function handleCancel() {
    setDraft(normalizeSettings(settings));
    setErrors({});
    setFeedback(null);
  }

  function handleSectionClick(title: string, targetId?: string) {
    if (!targetId) {
      return;
    }

    setActiveSection(title);
    document
      .getElementById(targetId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="settings-page">
      <div className="settings-heading">
        <div>
          <h1>Settings</h1>
          <p>Manage your salon preferences and account configuration.</p>
        </div>
      </div>

      <div className="settings-layout">
        <aside className="settings-sidebar">
          <h3>GENERAL SETTINGS</h3>
          {settingsSections.map(
            ({ icon: Icon, title, description, targetId }) => (
              <button
                className={`settings-nav-item ${
                  activeSection === title ? "active" : ""
                }`}
                key={title}
                onClick={() => handleSectionClick(title, targetId)}
                type="button"
                disabled={!targetId}
                title={
                  targetId
                    ? undefined
                    : "This section is not available in this demo."
                }
              >
                <Icon size={18} />
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
                <ChevronRight size={16} />
              </button>
            )
          )}
        </aside>

        <section className="settings-content">
          <div className="settings-section-heading">
            <div>
              <h2>Workspace Settings</h2>
              <p>
                Manage your business details, opening hours and platform
                preferences.
              </p>
            </div>
            <span
              className={
                isDirty
                  ? "settings-unsaved-indicator"
                  : "settings-saved-indicator"
              }
            >
              ● {isDirty ? "Unsaved changes" : "All changes saved"}
            </span>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div
              className="settings-form-section"
              id="settings-business"
            >
              <h3>Business Profile</h3>
              <p className="settings-section-description">
                These details represent your salon across the platform.
              </p>

              <div className="business-logo-upload">
                <div className="business-logo">{businessInitial}</div>
                <div>
                  <strong>Business Logo</strong>
                  <p>Logo upload is not available in this demo.</p>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  disabled
                  title="Logo upload is not available in this demo."
                >
                  <Camera size={15} /> Change Logo
                </button>
              </div>

              <div className="settings-form-grid">
                <label
                  className={`settings-field ${
                    errors.businessName ? "invalid" : ""
                  }`}
                >
                  <span>Business Name</span>
                  <input
                    id="settings-business-name"
                    value={draft.businessName}
                    onChange={(event) =>
                      updateField("businessName", event.target.value)
                    }
                    aria-invalid={Boolean(errors.businessName)}
                  />
                  {errors.businessName && (
                    <small className="settings-field-error">
                      {errors.businessName}
                    </small>
                  )}
                </label>

                <label
                  className={`settings-field ${
                    errors.businessEmail ? "invalid" : ""
                  }`}
                >
                  <span>Business Email</span>
                  <input
                    type="email"
                    value={draft.businessEmail}
                    onChange={(event) =>
                      updateField("businessEmail", event.target.value)
                    }
                    aria-invalid={Boolean(errors.businessEmail)}
                  />
                  {errors.businessEmail && (
                    <small className="settings-field-error">
                      {errors.businessEmail}
                    </small>
                  )}
                </label>

                <label
                  className={`settings-field ${
                    errors.phone ? "invalid" : ""
                  }`}
                >
                  <span>Phone Number</span>
                  <input
                    type="tel"
                    value={draft.phone}
                    onChange={(event) =>
                      updateField("phone", event.target.value)
                    }
                    aria-invalid={Boolean(errors.phone)}
                  />
                  {errors.phone && (
                    <small className="settings-field-error">
                      {errors.phone}
                    </small>
                  )}
                </label>

                <label className="settings-field">
                  <span>Website</span>
                  <input
                    value={draft.website}
                    onChange={(event) =>
                      updateField("website", event.target.value)
                    }
                  />
                </label>

                <label
                  className={`settings-field full-width ${
                    errors.address ? "invalid" : ""
                  }`}
                >
                  <span>Business Address</span>
                  <input
                    value={draft.address}
                    onChange={(event) =>
                      updateField("address", event.target.value)
                    }
                    aria-invalid={Boolean(errors.address)}
                  />
                  {errors.address && (
                    <small className="settings-field-error">
                      {errors.address}
                    </small>
                  )}
                </label>

                <label className="settings-field">
                  <span>Country</span>
                  <select
                    value={draft.country}
                    onChange={(event) =>
                      updateField("country", event.target.value)
                    }
                  >
                    {COUNTRY_OPTIONS.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </label>

                <label
                  className={`settings-field ${
                    errors.currency ? "invalid" : ""
                  }`}
                >
                  <span>Currency</span>
                  <select
                    value={draft.currency}
                    onChange={(event) =>
                      updateField(
                        "currency",
                        event.target.value as AppSettings["currency"]
                      )
                    }
                    aria-invalid={Boolean(errors.currency)}
                  >
                    {CURRENCY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {errors.currency && (
                    <small className="settings-field-error">
                      {errors.currency}
                    </small>
                  )}
                </label>
              </div>
            </div>

            <div
              className="settings-form-section preferences-section"
              id="settings-preferences"
            >
              <h3>Preferences</h3>
              <p className="settings-section-description">
                Set your default language, regional formats and
                notifications.
              </p>

              <div className="settings-preference-row">
                <div>
                  <strong>Default Language</strong>
                  <p>
                    Saves your preferred language. The interface
                    remains in English in this demo.
                  </p>
                </div>
                <select
                  value={draft.language}
                  onChange={(event) =>
                    updateField(
                      "language",
                      event.target.value as AppSettings["language"]
                    )
                  }
                  aria-label="Default language"
                >
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="settings-preference-row">
                <div>
                  <strong>Time Zone</strong>
                  <p>Preferred time zone for your business.</p>
                </div>
                <select
                  value={draft.timezone}
                  onChange={(event) =>
                    updateField("timezone", event.target.value)
                  }
                  aria-label="Time zone"
                >
                  {TIMEZONE_OPTIONS.map((timezone) => (
                    <option key={timezone} value={timezone}>
                      {timezone}
                    </option>
                  ))}
                </select>
              </div>

              <div className="settings-preference-row">
                <div>
                  <strong>Date Format</strong>
                  <p>Stored as your preferred date format.</p>
                </div>
                <select
                  value={draft.dateFormat}
                  onChange={(event) =>
                    updateField(
                      "dateFormat",
                      event.target.value as AppSettings["dateFormat"]
                    )
                  }
                  aria-label="Date format"
                >
                  {DATE_FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="settings-preference-row">
                <div>
                  <strong>Time Format</strong>
                  <p>Stored as your preferred time format.</p>
                </div>
                <select
                  value={draft.timeFormat}
                  onChange={(event) =>
                    updateField(
                      "timeFormat",
                      event.target.value as AppSettings["timeFormat"]
                    )
                  }
                  aria-label="Time format"
                >
                  {TIME_FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div
                className="settings-preference-row"
                id="settings-notifications"
              >
                <div>
                  <strong>Appointment Reminders</strong>
                  <p>
                    Send reminders to customers before appointments.
                  </p>
                </div>
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={draft.appointmentReminders}
                    onChange={(event) =>
                      updateField(
                        "appointmentReminders",
                        event.target.checked
                      )
                    }
                    aria-label="Enable appointment reminders"
                  />
                  <span />
                </label>
              </div>

              <div className="settings-preference-row">
                <div>
                  <strong>Email Notifications</strong>
                  <p>
                    Receive updates about bookings and business
                    activity.
                  </p>
                </div>
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={draft.emailNotifications}
                    onChange={(event) =>
                      updateField(
                        "emailNotifications",
                        event.target.checked
                      )
                    }
                    aria-label="Enable email notifications"
                  />
                  <span />
                </label>
              </div>
            </div>

            <div
              className="settings-form-section"
              id="settings-hours"
            >
              <h3>Business Hours</h3>
              <p className="settings-section-description">
                Set the days and hours your salon is open.
              </p>

              <div className="settings-hours-list">
                {draft.businessHours.map((day) => {
                  const error = errors[`hours-${day.day}`];

                  return (
                    <div
                      className={`settings-hours-row ${
                        day.enabled ? "" : "closed"
                      } ${error ? "invalid" : ""}`}
                      key={day.day}
                    >
                      <div className="settings-hours-day">
                        <label className="settings-toggle">
                          <input
                            type="checkbox"
                            checked={day.enabled}
                            onChange={(event) =>
                              updateBusinessDay(day.day, {
                                enabled: event.target.checked,
                              })
                            }
                            aria-label={`Toggle ${
                              WEEKDAY_LABELS[day.day]
                            }`}
                          />
                          <span />
                        </label>
                        <strong>{WEEKDAY_LABELS[day.day]}</strong>
                        {!day.enabled && <small>Closed</small>}
                      </div>

                      <div className="settings-hours-times">
                        <label>
                          <span>Opens</span>
                          <input
                            type="time"
                            step={900}
                            value={day.open}
                            disabled={!day.enabled}
                            aria-label={`${
                              WEEKDAY_LABELS[day.day]
                            } opening time`}
                            aria-invalid={Boolean(error)}
                            onChange={(event) =>
                              updateBusinessDay(day.day, {
                                open: event.target.value,
                              })
                            }
                          />
                        </label>
                        <span className="settings-hours-separator">
                          to
                        </span>
                        <label>
                          <span>Closes</span>
                          <input
                            type="time"
                            step={900}
                            value={day.close}
                            disabled={!day.enabled}
                            aria-label={`${
                              WEEKDAY_LABELS[day.day]
                            } closing time`}
                            aria-invalid={Boolean(error)}
                            onChange={(event) =>
                              updateBusinessDay(day.day, {
                                close: event.target.value,
                              })
                            }
                          />
                        </label>
                      </div>

                      {error && (
                        <small className="settings-field-error settings-hours-error">
                          {error}
                        </small>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {feedback && (
              <div
                className={`settings-feedback ${feedback.type}`}
                role={feedback.type === "error" ? "alert" : "status"}
              >
                {feedback.type === "success" ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <AlertCircle size={16} />
                )}
                <span>{feedback.message}</span>
              </div>
            )}

            <div className="settings-footer">
              <span>
                <LockKeyhole size={14} /> Your business information is
                kept secure.
              </span>
              <div className="settings-footer-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={handleCancel}
                  disabled={!isDirty}
                >
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  <Save size={16} /> Save Changes
                </button>
              </div>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
