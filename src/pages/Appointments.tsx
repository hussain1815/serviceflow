import {
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type FormEvent,
} from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  UserRound,
  X,
} from "lucide-react";

import { useAppData } from "../context/useAppData";
import type {
  Appointment,
  AppointmentStaffAssignment,
  AppointmentStatus,
  Service,
  StaffMember,
  WorkingDay,
} from "../types";
import {
  getAppointmentDuration,
  getAppointmentServiceIds,
  getAppointmentServiceSlots,
  getAppointmentServices,
  getAppointmentStaffAssignments,
} from "../utils/appointments";

type CalendarView = "day" | "week" | "month";

type AppointmentFormData = {
  customerId: string;
  serviceIds: string[];
  staffAssignments: Record<string, string>;
  date: string;
  time: string;
  status: AppointmentStatus;
  notes: string;
};

type StaffScheduleInfo = {
  error?: string;
  warning?: string;
  summary?: string;
  startMinutes?: number;
  endMinutes?: number;
};

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_OPTIONS: AppointmentStatus[] = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
];

const CALENDAR_VIEWS: Array<{ value: CalendarView; label: string }> = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const WORKING_DAY_BY_JS_DAY: WorkingDay[] = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

const WEEKDAY_LONG_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
});

const WEEKDAY_SHORT_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
});

const FULL_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const SHORT_MONTH_DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const SHORT_DATE_WITH_YEAR_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function addMonths(date: Date, amount: number) {
  const target = new Date(
    date.getFullYear(),
    date.getMonth() + amount,
    1
  );
  const lastDay = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0
  ).getDate();

  target.setDate(Math.min(date.getDate(), lastDay));

  return target;
}

function startOfWeek(date: Date) {
  const dayIndex = date.getDay();
  const offset = (dayIndex + 6) % 7;

  return addDays(startOfDay(date), -offset);
}

function toDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

function parseDateKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());

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

function formatMinutes(minutes: number) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const period = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;

  return `${hour}:${String(mins).padStart(2, "0")} ${period}`;
}

function formatTime(value: string) {
  const minutes = parseTimeToMinutes(value);

  return minutes === null ? value || "—" : formatMinutes(minutes);
}

function getServiceDuration(service: Service | undefined): number | null {
  if (
    !service ||
    !Number.isFinite(service.duration) ||
    service.duration <= 0 ||
    !Number.isInteger(service.duration)
  ) {
    return null;
  }

  return service.duration;
}

function formatAppointmentEnd(
  appointment: Appointment,
  serviceById: Map<string, Service>
) {
  const startMinutes = parseTimeToMinutes(appointment.time);
  const duration = getAppointmentDuration(appointment, serviceById);

  if (startMinutes === null || duration <= 0) {
    return "—";
  }

  const endMinutes = startMinutes + duration;

  return endMinutes >= 1440
    ? `${formatMinutes(endMinutes)} (+1 day)`
    : formatMinutes(endMinutes);
}

function formatCurrency(amount: number) {
  return CURRENCY_FORMATTER.format(Number.isFinite(amount) ? amount : 0);
}

function getServicesDuration(services: Service[]): number | null {
  if (services.length === 0) {
    return null;
  }

  let total = 0;

  for (const service of services) {
    const duration = getServiceDuration(service);

    if (duration === null) {
      return null;
    }

    total += duration;
  }

  return total;
}

function getServicesPrice(services: Service[]) {
  return services.reduce(
    (total, service) =>
      total + (Number.isFinite(service.price) ? service.price : 0),
    0
  );
}

function getFormServiceSlots(
  serviceIds: string[],
  serviceById: Map<string, Service>,
  startMinutes: number | null
) {
  const slots = new Map<string, { startMinutes: number; endMinutes: number }>();

  if (startMinutes === null) {
    return slots;
  }

  let cursor = startMinutes;

  for (const serviceId of serviceIds) {
    const duration = getServiceDuration(serviceById.get(serviceId));

    if (duration === null) {
      continue;
    }

    slots.set(serviceId, {
      startMinutes: cursor,
      endMinutes: cursor + duration,
    });
    cursor += duration;
  }

  return slots;
}

function getServiceNames(
  appointment: Appointment,
  serviceById: Map<string, Service>
) {
  return getAppointmentServiceIds(appointment).map(
    (serviceId) => serviceById.get(serviceId)?.name ?? "Deleted service"
  );
}

function getServiceSummary(
  appointment: Appointment,
  serviceById: Map<string, Service>,
  maxVisible = 2
) {
  const names = getServiceNames(appointment, serviceById);

  if (names.length === 0) {
    return "No service";
  }

  if (names.length <= maxVisible) {
    return names.join(" + ");
  }

  return `${names.slice(0, maxVisible).join(" + ")} +${
    names.length - maxVisible
  }`;
}

function getFullServiceSummary(
  appointment: Appointment,
  serviceById: Map<string, Service>
) {
  const names = getServiceNames(appointment, serviceById);

  return names.length > 0 ? names.join(" + ") : "No service";
}

function haveSameServiceIds(first: string[], second: string[]) {
  if (first.length !== second.length) {
    return false;
  }

  const firstIds = [...new Set(first)].sort();
  const secondIds = [...new Set(second)].sort();

  return firstIds.every((id, index) => id === secondIds[index]);
}

function haveSameStaffAssignments(
  first: AppointmentStaffAssignment[],
  second: AppointmentStaffAssignment[]
) {
  if (first.length !== second.length) {
    return false;
  }

  const firstByService = new Map(
    first.map((assignment) => [assignment.serviceId, assignment.staffId])
  );

  return second.every(
    (assignment) =>
      firstByService.get(assignment.serviceId) === assignment.staffId
  );
}

function getStaffNames(
  appointment: Appointment,
  staffById: Map<string, StaffMember>
) {
  const staffIds = Array.from(
    new Set(
      getAppointmentStaffAssignments(appointment)
        .map((assignment) => assignment.staffId)
        .filter((staffId) => staffId.length > 0)
    )
  );

  return staffIds.map(
    (staffId) => staffById.get(staffId)?.name ?? "Deleted staff"
  );
}

function getStaffSummary(
  appointment: Appointment,
  staffById: Map<string, StaffMember>,
  maxVisible = 1
) {
  const names = getStaffNames(appointment, staffById);

  if (names.length === 0) {
    return "Unassigned";
  }

  if (names.length <= maxVisible) {
    return names.join(" + ");
  }

  return `${names.slice(0, maxVisible).join(" + ")} +${
    names.length - maxVisible
  }`;
}

function getFullStaffSummary(
  appointment: Appointment,
  staffById: Map<string, StaffMember>
) {
  const names = getStaffNames(appointment, staffById);

  return names.length > 0 ? names.join(" + ") : "Unassigned";
}

type ServiceMultiSelectProps = {
  services: Service[];
  selectedIds: string[];
  onAdd: (serviceId: string) => void;
  onRemove: (serviceId: string) => void;
};

function ServiceMultiSelect({
  services,
  selectedIds,
  onAdd,
  onRemove,
}: ServiceMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectedSet = new Set(selectedIds);
  const search = searchTerm.trim().toLowerCase();
  const options = services.filter(
    (service) =>
      service.status === "active" &&
      !selectedSet.has(service.id) &&
      (!search ||
        [service.name, service.category].some((value) =>
          value.toLowerCase().includes(search)
        ))
  );
  const selectedEntries = selectedIds.map((serviceId) => ({
    serviceId,
    service: services.find((item) => item.id === serviceId),
  }));

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;

    if (
      !nextTarget ||
      !event.currentTarget.contains(nextTarget as Node)
    ) {
      setIsOpen(false);
    }
  };

  return (
    <div
      className="service-multiselect"
      onBlur={handleBlur}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setIsOpen(false);
        }
      }}
    >
      <div className="service-multiselect-chips">
        {selectedEntries.length > 0 ? (
          selectedEntries.map(({ serviceId, service }) => (
            <span
              className={`service-chip ${
                service && service.status !== "active" ? "inactive" : ""
              }`}
              key={serviceId}
            >
              <span className="service-chip-info">
                <strong>{service?.name ?? "Deleted service"}</strong>
                <small>
                  {service
                    ? `${service.duration} min · ${formatCurrency(
                        service.price
                      )}`
                    : "Unavailable"}
                </small>
              </span>
              <button
                type="button"
                className="service-chip-remove"
                onClick={() => onRemove(serviceId)}
                aria-label={`Remove ${
                  service?.name ?? "deleted service"
                }`}
              >
                <X size={13} />
              </button>
            </span>
          ))
        ) : (
          <span className="service-multiselect-placeholder">
            No services selected
          </span>
        )}
      </div>

      <div className="service-multiselect-search">
        <Search size={16} />
        <input
          ref={searchInputRef}
          type="text"
          value={searchTerm}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setSearchTerm(event.target.value);
            setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();

              if (options[0]) {
                onAdd(options[0].id);
                setSearchTerm("");
              }
            }
          }}
          placeholder="Search active services..."
          aria-label="Search services to add"
          aria-expanded={isOpen}
          aria-controls="appointment-service-options"
          role="combobox"
        />
        <ChevronDown size={16} />
      </div>

      {isOpen && (
        <div
          className="service-multiselect-options"
          id="appointment-service-options"
          role="listbox"
          aria-multiselectable="true"
        >
          {options.length > 0 ? (
            options.map((service) => (
              <button
                type="button"
                className="service-multiselect-option"
                key={service.id}
                role="option"
                aria-selected={false}
                onClick={() => {
                  onAdd(service.id);
                  setSearchTerm("");
                  setIsOpen(true);
                  searchInputRef.current?.focus();
                }}
              >
                <span>
                  <strong>{service.name}</strong>
                  <small>{service.category}</small>
                </span>
                <span>
                  {service.duration} min · {formatCurrency(service.price)}
                </span>
              </button>
            ))
          ) : (
            <p className="service-multiselect-empty">
              {search
                ? "No active services match your search."
                : "All active services are already selected."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function getMonthDays(date: Date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const gridStart = addDays(firstDay, -offset);

  return Array.from({ length: 42 }, (_, index) =>
    addDays(gridStart, index)
  );
}

function getWeekTitle(start: Date) {
  const end = addDays(start, 6);

  if (start.getFullYear() !== end.getFullYear()) {
    return `${SHORT_DATE_WITH_YEAR_FORMATTER.format(
      start
    )} – ${SHORT_DATE_WITH_YEAR_FORMATTER.format(end)}`;
  }

  if (start.getMonth() !== end.getMonth()) {
    return `${SHORT_MONTH_DAY_FORMATTER.format(
      start
    )} – ${SHORT_DATE_WITH_YEAR_FORMATTER.format(end)}`;
  }

  return `${SHORT_MONTH_DAY_FORMATTER.format(
    start
  )} – ${end.getDate()}, ${end.getFullYear()}`;
}

function getViewTitle(view: CalendarView, date: Date) {
  if (view === "week") {
    return getWeekTitle(startOfWeek(date));
  }

  if (view === "month") {
    return MONTH_YEAR_FORMATTER.format(date);
  }

  return FULL_DATE_FORMATTER.format(date);
}

function sortAppointments(appointments: Appointment[]) {
  return [...appointments].sort((first, second) => {
    if (first.date !== second.date) {
      return first.date.localeCompare(second.date);
    }

    return (first.time ?? "").localeCompare(second.time ?? "");
  });
}

function isPastDateTime(dateValue: string, timeValue: string) {
  const date = parseDateKey(dateValue);
  const minutes = parseTimeToMinutes(timeValue);

  if (!date || minutes === null) {
    return false;
  }

  const value = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    Math.floor(minutes / 60),
    minutes % 60
  );

  return value.getTime() < Date.now();
}

function getStaffScheduleInfo(
  staff: StaffMember,
  date: Date
): StaffScheduleInfo {
  const workingDays = Array.isArray(staff.workingDays)
    ? staff.workingDays
    : [];

  if (workingDays.length === 0) {
    return {
      warning: `${staff.name} has no working days set, so day availability could not be checked.`,
    };
  }

  const workingDay = WORKING_DAY_BY_JS_DAY[date.getDay()];

  if (!workingDays.includes(workingDay)) {
    return {
      error: `${staff.name} does not work on ${WEEKDAY_LONG_FORMATTER.format(
        date
      )}.`,
    };
  }

  const startMinutes = parseTimeToMinutes(staff.startTime ?? "");
  const endMinutes = parseTimeToMinutes(staff.endTime ?? "");

  if (
    startMinutes === null ||
    endMinutes === null ||
    startMinutes >= endMinutes
  ) {
    return {
      warning: `${staff.name}'s working hours are incomplete, so hourly availability could not be checked.`,
    };
  }

  return {
    startMinutes,
    endMinutes,
    summary: `${staff.name} works ${formatMinutes(
      startMinutes
    )} – ${formatMinutes(endMinutes)} on ${WEEKDAY_LONG_FORMATTER.format(
      date
    )}.`,
  };
}

function getAssignmentScheduleMessage(
  service: Service | undefined,
  staff: StaffMember | undefined,
  date: Date | null
): { tone: string; text: string } | null {
  if (!service || !staff) {
    return null;
  }

  if (staff.status === "off") {
    return {
      tone: "error",
      text: `${staff.name} is currently marked Off and cannot be booked for new appointments.`,
    };
  }

  if (!date) {
    return {
      tone: "info",
      text: "Select a date to check this team member's working schedule.",
    };
  }

  const scheduleInfo = getStaffScheduleInfo(staff, date);

  if (scheduleInfo.error) {
    return { tone: "error", text: scheduleInfo.error };
  }

  if (
    (service.staffIds ?? []).length > 0 &&
    !service.staffIds.includes(staff.id)
  ) {
    return {
      tone: "warning",
      text: `${staff.name} is not assigned to ${service.name}. You can still book, but confirm they can perform this service.`,
    };
  }

  if (scheduleInfo.warning) {
    return { tone: "warning", text: scheduleInfo.warning };
  }

  if (scheduleInfo.summary) {
    return { tone: "info", text: scheduleInfo.summary };
  }

  return null;
}

function findStaffConflict(
  appointments: Appointment[],
  serviceById: Map<string, Service>,
  staffId: string,
  date: string,
  startMinutes: number,
  duration: number,
  excludeId?: string
) {
  const endMinutes = startMinutes + duration;

  for (const appointment of appointments) {
    if (
      appointment.id === excludeId ||
      appointment.date !== date ||
      appointment.status === "cancelled"
    ) {
      continue;
    }

    const existingStart = parseTimeToMinutes(appointment.time);

    if (existingStart === null) {
      continue;
    }

    const slots = getAppointmentServiceSlots(appointment, serviceById);

    if (slots.length === 0) {
      if (appointment.staffId === staffId && existingStart === startMinutes) {
        return appointment;
      }

      continue;
    }

    for (const slot of slots) {
      if (slot.staffId !== staffId) {
        continue;
      }

      const existingSlotStart = existingStart + slot.startOffset;
      const existingSlotEnd = existingSlotStart + slot.duration;

      if (
        startMinutes < existingSlotEnd &&
        endMinutes > existingSlotStart
      ) {
        return appointment;
      }
    }
  }

  return null;
}

function createEmptyForm(date: string): AppointmentFormData {
  return {
    customerId: "",
    serviceIds: [],
    staffAssignments: {},
    date,
    time: "",
    status: "pending",
    notes: "",
  };
}

function Appointments() {
  const { data, upsert } = useAppData();
  const appointments = data.appointments;
  const customers = data.customers;
  const staff = data.staff;
  const services = data.services;

  const [view, setView] = useState<CalendarView>("day");
  const [selectedDate, setSelectedDate] = useState(() =>
    startOfDay(new Date())
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | AppointmentStatus
  >("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingAppointment, setEditingAppointment] =
    useState<Appointment | null>(null);
  const [formData, setFormData] = useState<AppointmentFormData>(() =>
    createEmptyForm(toDateKey(new Date()))
  );
  const [formError, setFormError] = useState("");

  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers]
  );

  const staffById = useMemo(
    () => new Map(staff.map((member) => [member.id, member])),
    [staff]
  );

  const serviceById = useMemo(
    () => new Map(services.map((service) => [service.id, service])),
    [services]
  );

  const effectiveStaffFilter =
    staffFilter !== "all" && staffById.has(staffFilter)
      ? staffFilter
      : "all";

  const filteredAppointments = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    const filtered = appointments.filter((appointment) => {
      const customer = customerById.get(appointment.customerId);
      const serviceNames = getAppointmentServices(
        appointment,
        serviceById
      ).map((service) => service.name);
      const assignedStaff = getAppointmentStaffAssignments(appointment);
      const staffNames = assignedStaff
        .map((assignment) => staffById.get(assignment.staffId)?.name ?? "")
        .filter(Boolean);

      const matchesSearch =
        !search ||
        [
          customer?.name ?? "",
          ...serviceNames,
          ...staffNames,
        ].some((value) => value.toLowerCase().includes(search));

      const matchesStatus =
        statusFilter === "all" || appointment.status === statusFilter;

      const matchesStaff =
        effectiveStaffFilter === "all" ||
        appointment.staffId === effectiveStaffFilter ||
        assignedStaff.some(
          (assignment) => assignment.staffId === effectiveStaffFilter
        );

      return matchesSearch && matchesStatus && matchesStaff;
    });

    return sortAppointments(filtered);
  }, [
    appointments,
    customerById,
    serviceById,
    staffById,
    searchTerm,
    statusFilter,
    effectiveStaffFilter,
  ]);

  const appointmentsByDate = useMemo(() => {
    const grouped = new Map<string, Appointment[]>();

    for (const appointment of filteredAppointments) {
      const existing = grouped.get(appointment.date);

      if (existing) {
        existing.push(appointment);
      } else {
        grouped.set(appointment.date, [appointment]);
      }
    }

    return grouped;
  }, [filteredAppointments]);

  const today = startOfDay(new Date());
  const todayKey = toDateKey(today);
  const selectedDateKey = toDateKey(selectedDate);
  const dayAppointments = appointmentsByDate.get(selectedDateKey) ?? [];

  const weekStart = startOfWeek(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index)
  );
  const weekAppointments = weekDays.flatMap(
    (date) => appointmentsByDate.get(toDateKey(date)) ?? []
  );
  const monthDays = getMonthDays(selectedDate);
  const monthAppointments = filteredAppointments.filter((appointment) => {
    const date = parseDateKey(appointment.date);

    return (
      Boolean(date) &&
      date?.getFullYear() === selectedDate.getFullYear() &&
      date?.getMonth() === selectedDate.getMonth()
    );
  });

  const selectedCustomer = customerById.get(formData.customerId);
  const selectedServices = formData.serviceIds
    .map((serviceId) => serviceById.get(serviceId))
    .filter((service): service is Service => Boolean(service));
  const formDate = parseDateKey(formData.date);
  const formDuration = getServicesDuration(selectedServices);
  const formTotalPrice = getServicesPrice(selectedServices);
  const formStartMinutes = parseTimeToMinutes(formData.time);
  const formEndMinutes =
    formStartMinutes !== null && formDuration !== null
      ? formStartMinutes + formDuration
      : null;
  const formServiceSlots = getFormServiceSlots(
    formData.serviceIds,
    serviceById,
    formStartMinutes
  );
  const selectedServiceAssignments = formData.serviceIds.map(
    (serviceId) => {
      const staffId = formData.staffAssignments[serviceId] ?? "";

      return {
        serviceId,
        service: serviceById.get(serviceId),
        staffId,
        member: staffById.get(staffId),
      };
    }
  );
  const unassignedServiceCount = selectedServiceAssignments.filter(
    (assignment) => !assignment.staffId
  ).length;

  const hasActiveFilters =
    Boolean(searchTerm.trim()) ||
    statusFilter !== "all" ||
    effectiveStaffFilter !== "all";

  const resetForm = () => {
    const baseDate =
      startOfDay(selectedDate) >= today ? selectedDate : today;

    setFormData(createEmptyForm(toDateKey(baseDate)));
    setFormError("");
  };

  const openAddModal = () => {
    setEditingAppointment(null);
    resetForm();
    setShowModal(true);
  };

  const openAddModalForDate = (date: Date) => {
    const baseDate = startOfDay(date) >= today ? date : today;

    setEditingAppointment(null);
    setFormData(createEmptyForm(toDateKey(baseDate)));
    setFormError("");
    setShowModal(true);
  };

  const openEditModal = (appointment: Appointment) => {
    const staffAssignments = getAppointmentStaffAssignments(
      appointment
    ).reduce<Record<string, string>>((assignments, assignment) => {
      assignments[assignment.serviceId] = assignment.staffId;
      return assignments;
    }, {});

    setEditingAppointment(appointment);
    setFormData({
      customerId: customerById.has(appointment.customerId)
        ? appointment.customerId
        : "",
      serviceIds: getAppointmentServiceIds(appointment),
      staffAssignments,
      date: parseDateKey(appointment.date)
        ? appointment.date
        : todayKey,
      time: appointment.time ?? "",
      status: appointment.status,
      notes: appointment.notes ?? "",
    });
    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAppointment(null);
    resetForm();
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setStaffFilter("all");
  };

  const addService = (serviceId: string) => {
    const service = serviceById.get(serviceId);

    if (!service || service.status !== "active") {
      return;
    }

    setFormData((current) => {
      if (current.serviceIds.includes(serviceId)) {
        return current;
      }

      const existingStaffId = current.serviceIds
        .map((id) => current.staffAssignments[id])
        .find((id): id is string => Boolean(id));
      const capableStaffIds = (service.staffIds ?? []).filter((id) =>
        staffById.has(id)
      );
      const activeCapableStaffIds = capableStaffIds.filter(
        (id) => staffById.get(id)?.status !== "off"
      );
      const preferredStaffId =
        existingStaffId &&
        (capableStaffIds.length === 0 ||
          capableStaffIds.includes(existingStaffId))
          ? existingStaffId
          : activeCapableStaffIds.length === 1
            ? activeCapableStaffIds[0]
            : "";

      return {
        ...current,
        serviceIds: [...current.serviceIds, serviceId],
        staffAssignments: {
          ...current.staffAssignments,
          [serviceId]:
            current.staffAssignments[serviceId] ?? preferredStaffId,
        },
      };
    });
    setFormError("");
  };

  const removeService = (serviceId: string) => {
    setFormData((current) => {
      const staffAssignments = { ...current.staffAssignments };

      delete staffAssignments[serviceId];

      return {
        ...current,
        serviceIds: current.serviceIds.filter((id) => id !== serviceId),
        staffAssignments,
      };
    });
    setFormError("");
  };

  const setServiceStaff = (serviceId: string, staffId: string) => {
    setFormData((current) => ({
      ...current,
      staffAssignments: {
        ...current.staffAssignments,
        [serviceId]: staffId,
      },
    }));
    setFormError("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const customer = customerById.get(formData.customerId);
    const selectedServiceIds = formData.serviceIds;
    const servicesForAppointment = selectedServiceIds
      .map((serviceId) => serviceById.get(serviceId))
      .filter((service): service is Service => Boolean(service));
    const staffAssignments: AppointmentStaffAssignment[] =
      selectedServiceIds.map((serviceId) => ({
        serviceId,
        staffId: formData.staffAssignments[serviceId] ?? "",
      }));
    const date = parseDateKey(formData.date);
    const startMinutes = parseTimeToMinutes(formData.time);
    const duration = getServicesDuration(servicesForAppointment);
    const totalPrice = getServicesPrice(servicesForAppointment);

    if (!customer) {
      setFormError("Please select an existing customer.");
      return;
    }

    if (selectedServiceIds.length === 0) {
      setFormError("Please select at least one service.");
      return;
    }

    if (servicesForAppointment.length !== selectedServiceIds.length) {
      setFormError(
        "One or more selected services no longer exist. Remove them and choose available services."
      );
      return;
    }

    if (staffAssignments.some((assignment) => !assignment.staffId)) {
      setFormError("Please assign a staff member to every selected service.");
      return;
    }

    if (
      staffAssignments.some(
        (assignment) => !staffById.has(assignment.staffId)
      )
    ) {
      setFormError(
        "One or more assigned staff members no longer exist. Choose available team members."
      );
      return;
    }

    if (!date) {
      setFormError("Please select a valid appointment date.");
      return;
    }

    if (startMinutes === null) {
      setFormError("Please select a valid start time.");
      return;
    }

    if (duration === null) {
      setFormError("One or more selected services have an invalid duration.");
      return;
    }

    if (
      servicesForAppointment.some(
        (service) => !Number.isFinite(service.price) || service.price < 0
      ) ||
      !Number.isFinite(totalPrice) ||
      totalPrice < 0
    ) {
      setFormError("One or more selected services have an invalid price.");
      return;
    }

    const endMinutes = startMinutes + duration;

    if (endMinutes >= 1440) {
      setFormError(
        "This appointment would end after midnight. Choose an earlier time."
      );
      return;
    }

    const scheduleFieldsUnchanged = Boolean(
      editingAppointment &&
        editingAppointment.date === formData.date &&
        editingAppointment.time === formData.time &&
        haveSameStaffAssignments(
          getAppointmentStaffAssignments(editingAppointment),
          staffAssignments
        ) &&
        haveSameServiceIds(
          getAppointmentServiceIds(editingAppointment),
          formData.serviceIds
        )
    );
    const isReactivating =
      editingAppointment?.status === "cancelled" &&
      formData.status !== "cancelled";
    const mustValidateSchedule =
      !scheduleFieldsUnchanged || isReactivating;

    if (mustValidateSchedule) {
      if (isPastDateTime(formData.date, formData.time)) {
        setFormError("Appointments cannot be scheduled in the past.");
        return;
      }

      const inactiveServices = servicesForAppointment.filter(
        (service) => service.status !== "active"
      );

      if (inactiveServices.length > 0) {
        setFormError(
          `Inactive services cannot be booked: ${inactiveServices
            .map((service) => service.name)
            .join(
              ", "
            )}. Remove them and choose active services.`
        );
        return;
      }

      let serviceStart = startMinutes;
      const staffSlots = new Map<
        string,
        Array<{
          member: StaffMember;
          serviceName: string;
          startMinutes: number;
          endMinutes: number;
        }>
      >();

      for (const assignment of staffAssignments) {
        const service = serviceById.get(assignment.serviceId);
        const assignedStaff = staffById.get(assignment.staffId);

        if (!service || !assignedStaff) {
          setFormError(
            "One or more selected services or staff members no longer exist."
          );
          return;
        }

        const serviceDuration = getServiceDuration(service);

        if (serviceDuration === null) {
          setFormError(
            "One or more selected services have an invalid duration."
          );
          return;
        }

        const serviceEnd = serviceStart + serviceDuration;
        const existingSlots = staffSlots.get(assignedStaff.id) ?? [];

        existingSlots.push({
          member: assignedStaff,
          serviceName: service.name,
          startMinutes: serviceStart,
          endMinutes: serviceEnd,
        });
        staffSlots.set(assignedStaff.id, existingSlots);

        serviceStart = serviceEnd;
      }

      for (const slots of staffSlots.values()) {
        const firstSlot = slots[0];

        if (!firstSlot) {
          continue;
        }

        const assignedStaff = firstSlot.member;
        const serviceLabel = slots
          .map((slot) => slot.serviceName)
          .join(", ");

        if (assignedStaff.status === "off") {
          setFormError(
            `${assignedStaff.name} is marked Off and cannot be booked. Choose another staff member for ${serviceLabel}.`
          );
          return;
        }

        const scheduleInfo = getStaffScheduleInfo(assignedStaff, date);

        if (scheduleInfo.error) {
          setFormError(`${serviceLabel}: ${scheduleInfo.error}`);
          return;
        }

        for (const slot of slots) {
          if (
            scheduleInfo.startMinutes !== undefined &&
            scheduleInfo.endMinutes !== undefined &&
            (slot.startMinutes < scheduleInfo.startMinutes ||
              slot.endMinutes > scheduleInfo.endMinutes)
          ) {
            setFormError(
              `${assignedStaff.name} works from ${formatMinutes(
                scheduleInfo.startMinutes
              )} to ${formatMinutes(
                scheduleInfo.endMinutes
              )} on ${WEEKDAY_LONG_FORMATTER.format(date)}, but ${
                slot.serviceName
              } is scheduled from ${formatMinutes(
                slot.startMinutes
              )} to ${formatMinutes(
                slot.endMinutes
              )}. Choose another time or staff member.`
            );
            return;
          }

          const conflict = findStaffConflict(
            appointments,
            serviceById,
            assignedStaff.id,
            formData.date,
            slot.startMinutes,
            slot.endMinutes - slot.startMinutes,
            editingAppointment?.id
          );

          if (conflict) {
            const conflictCustomer = customerById.get(conflict.customerId);
            const conflictStart = parseTimeToMinutes(conflict.time);
            const conflictDuration = getAppointmentDuration(
              conflict,
              serviceById
            );
            const conflictEnd =
              conflictStart !== null && conflictDuration > 0
                ? conflictStart + conflictDuration
                : null;
            const conflictTime =
              conflictStart !== null && conflictEnd !== null
                ? `${formatMinutes(conflictStart)} – ${formatMinutes(
                    conflictEnd
                  )}`
                : formatTime(conflict.time);
            const conflictServiceLabel = getServiceSummary(
              conflict,
              serviceById
            );

            setFormError(
              `${assignedStaff.name} is already booked${
                conflictCustomer ? ` for ${conflictCustomer.name}` : ""
              } at ${conflictTime}${
                conflictServiceLabel !== "No service"
                  ? ` (${conflictServiceLabel})`
                  : ""
              }. ${slot.serviceName} cannot be scheduled from ${formatMinutes(
                slot.startMinutes
              )} to ${formatMinutes(
                slot.endMinutes
              )}. Choose another time or staff member.`
            );
            return;
          }
        }
      }
    }

    if (
      editingAppointment &&
      formData.status === "cancelled" &&
      editingAppointment.status !== "cancelled"
    ) {
      const confirmed = window.confirm(
        `Cancel the appointment for ${customer.name} on ${FULL_DATE_FORMATTER.format(
          date
        )} at ${formatTime(
          formData.time
        )}? The appointment will remain in history.`
      );

      if (!confirmed) {
        return;
      }
    }

    const appointment: Appointment = {
      id: editingAppointment?.id ?? crypto.randomUUID(),
      date: formData.date,
      time: formData.time,
      customerId: customer.id,
      staffId: staffAssignments.find((assignment) => assignment.staffId)
        ?.staffId ?? "",
      serviceIds: selectedServiceIds,
      serviceId: selectedServiceIds[0],
      staffAssignments,
      price: totalPrice,
      status: formData.status,
      notes: formData.notes.trim() || undefined,
    };

    upsert("appointments", appointment);
    setSelectedDate(date);
    closeModal();
  };

  const handleCancelAppointment = () => {
    if (!editingAppointment || editingAppointment.status === "cancelled") {
      return;
    }

    const customer = customerById.get(editingAppointment.customerId);
    const date = parseDateKey(editingAppointment.date);
    const dateLabel = date
      ? FULL_DATE_FORMATTER.format(date)
      : editingAppointment.date;

    const confirmed = window.confirm(
      `Cancel the appointment${
        customer ? ` for ${customer.name}` : ""
      } on ${dateLabel} at ${formatTime(
        editingAppointment.time
      )}? The appointment will remain in history.`
    );

    if (!confirmed) {
      return;
    }

    const cancelledAppointment: Appointment = {
      ...editingAppointment,
      status: "cancelled",
    };

    upsert("appointments", cancelledAppointment);
    closeModal();
  };

  const goToPrevious = () => {
    if (view === "day") {
      setSelectedDate((current) => addDays(current, -1));
      return;
    }

    if (view === "week") {
      setSelectedDate((current) => addDays(current, -7));
      return;
    }

    setSelectedDate((current) => addMonths(current, -1));
  };

  const goToNext = () => {
    if (view === "day") {
      setSelectedDate((current) => addDays(current, 1));
      return;
    }

    if (view === "week") {
      setSelectedDate((current) => addDays(current, 7));
      return;
    }

    setSelectedDate((current) => addMonths(current, 1));
  };

  const goToToday = () => {
    setSelectedDate(startOfDay(new Date()));
  };

  const getCustomer = (appointment: Appointment) =>
    customerById.get(appointment.customerId);

  const getCustomerName = (appointment: Appointment) =>
    getCustomer(appointment)?.name ?? "Deleted customer";

  const getServiceSummaryForAppointment = (appointment: Appointment) =>
    getServiceSummary(appointment, serviceById);

  const getFullServiceSummaryForAppointment = (appointment: Appointment) =>
    getFullServiceSummary(appointment, serviceById);

  const getStaffSummaryForAppointment = (appointment: Appointment) =>
    getStaffSummary(appointment, staffById);

  const getFullStaffSummaryForAppointment = (appointment: Appointment) =>
    getFullStaffSummary(appointment, staffById);

  const viewTitle = getViewTitle(view, selectedDate);
  const previousLabel =
    view === "day"
      ? "Previous day"
      : view === "week"
        ? "Previous week"
        : "Previous month";
  const nextLabel =
    view === "day" ? "Next day" : view === "week" ? "Next week" : "Next month";
  const appointmentCountLabel = (count: number) =>
    `${count} ${count === 1 ? "appointment" : "appointments"}`;

  const emptyState = (
    <div className="appointment-empty">
      <CalendarDays size={29} />
      <h3>
        {appointments.length === 0
          ? "No appointments yet"
          : "No appointments found"}
      </h3>
      <p>
        {appointments.length === 0
          ? "Book your first appointment to start building your salon schedule."
          : hasActiveFilters
            ? "Try a different search, status, staff member, or date."
            : "There are no appointments in this period. Create one to get started."}
      </p>
      {hasActiveFilters && appointments.length > 0 ? (
        <button
          type="button"
          className="secondary-button"
          onClick={clearFilters}
        >
          Clear filters
        </button>
      ) : (
        <button
          type="button"
          className="add-button"
          onClick={openAddModal}
        >
          <Plus size={17} /> New appointment
        </button>
      )}
    </div>
  );

  return (
    <section className="appointments-page">
      <div className="appointments-heading">
        <div>
          <h1>Appointments</h1>
          <p>Manage your salon bookings and schedule.</p>
        </div>

        <button className="add-button" onClick={openAddModal}>
          <Plus size={18} />
          New appointment
        </button>
      </div>

      <div className="appointment-toolbar">
        <div className="date-navigation">
          <button
            type="button"
            aria-label={previousLabel}
            onClick={goToPrevious}
          >
            <ChevronLeft size={18} />
          </button>

          <strong>{viewTitle}</strong>

          <button
            type="button"
            aria-label={nextLabel}
            onClick={goToNext}
          >
            <ChevronRight size={18} />
          </button>

          <button
            type="button"
            className="today-button"
            onClick={goToToday}
          >
            Today
          </button>
        </div>

        <div
          className="appointment-actions"
          role="group"
          aria-label="Calendar view"
        >
          {CALENDAR_VIEWS.map((calendarView) => (
            <button
              type="button"
              className={`filter-button ${
                view === calendarView.value ? "active" : ""
              }`}
              key={calendarView.value}
              aria-pressed={view === calendarView.value}
              onClick={() => setView(calendarView.value)}
            >
              {calendarView.value === "day" && (
                <CalendarDays size={16} />
              )}
              {calendarView.label}
            </button>
          ))}
        </div>
      </div>

      <div className="appointments-filters">
        <div className="appointment-search">
          <Search size={18} />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by customer, service, or staff..."
            aria-label="Search appointments"
          />
        </div>

        <div className="appointment-filter">
          <Filter size={16} />
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as "all" | AppointmentStatus
              )
            }
            aria-label="Filter appointments by status"
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option value={status} key={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div className="appointment-filter">
          <UserRound size={16} />
          <select
            value={effectiveStaffFilter}
            onChange={(event) => setStaffFilter(event.target.value)}
            aria-label="Filter appointments by staff member"
          >
            <option value="all">All staff</option>
            {staff.map((member) => (
              <option value={member.id} key={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {view === "day" && (
        <div className="appointment-list-card">
          <div className="appointment-list-heading">
            <div>
              <h3>
                {WEEKDAY_LONG_FORMATTER.format(selectedDate)}'s Schedule
              </h3>
              <p>
                {FULL_DATE_FORMATTER.format(selectedDate)} ·{" "}
                {appointmentCountLabel(dayAppointments.length)} scheduled
              </p>
            </div>
          </div>

          {dayAppointments.length > 0
              ? dayAppointments.map((appointment) => {
                const customer = getCustomer(appointment);
                const serviceSummary = getServiceSummaryForAppointment(
                  appointment
                );
                const fullServiceSummary =
                  getFullServiceSummaryForAppointment(appointment);
                const staffSummary = getStaffSummaryForAppointment(
                  appointment
                );
                const fullStaffSummary =
                  getFullStaffSummaryForAppointment(appointment);

                return (
                  <div
                    className="booking-row appointment-booking-row"
                    key={appointment.id}
                    role="button"
                    tabIndex={0}
                    title={`${fullServiceSummary} · ${fullStaffSummary}`}
                    onClick={() => openEditModal(appointment)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openEditModal(appointment);
                      }
                    }}
                  >
                    <div className="booking-time">
                      <Clock size={15} />
                      <div className="appointment-row-time">
                        <strong>{formatTime(appointment.time)}</strong>
                        <span>
                          {formatAppointmentEnd(appointment, serviceById)}
                        </span>
                      </div>
                    </div>

                    <div className="booking-details">
                      <strong>
                        {customer?.name ?? "Deleted customer"}
                      </strong>
                      <span>{serviceSummary}</span>
                    </div>

                    <div
                      className="booking-staff"
                      title={fullStaffSummary}
                    >
                      <span>Staff</span>
                      <strong>{staffSummary}</strong>
                    </div>

                    <strong className="booking-price">
                      {formatCurrency(appointment.price ?? 0)}
                    </strong>

                    <span
                      className={`status-badge status-${appointment.status}`}
                    >
                      {STATUS_LABELS[appointment.status] ??
                        appointment.status}
                    </span>
                  </div>
                );
              })
            : emptyState}
        </div>
      )}

      {view === "week" && (
        <div className="appointment-list-card">
          <div className="appointment-list-heading">
            <div>
              <h3>Week Schedule</h3>
              <p>
                {getWeekTitle(weekStart)} ·{" "}
                {appointmentCountLabel(weekAppointments.length)}
              </p>
            </div>
          </div>

          {filteredAppointments.length > 0 ? (
            <div className="appointments-calendar-scroll">
              <div className="appointments-week-grid">
                {weekDays.map((date) => {
                  const dateKey = toDateKey(date);
                  const dateAppointments =
                    appointmentsByDate.get(dateKey) ?? [];
                  const isToday = dateKey === todayKey;

                  return (
                    <div
                      className={`appointments-week-column ${
                        isToday ? "today" : ""
                      }`}
                      key={dateKey}
                    >
                      <button
                        type="button"
                        className={`appointments-week-day ${
                          isToday ? "today" : ""
                        }`}
                        onClick={() => {
                          setSelectedDate(date);
                          setView("day");
                        }}
                        aria-label={`View ${FULL_DATE_FORMATTER.format(
                          date
                        )}`}
                      >
                        <span>
                          {WEEKDAY_SHORT_FORMATTER.format(date)}
                        </span>
                        <strong>{date.getDate()}</strong>
                      </button>

                      <div className="appointments-week-list">
                        {dateAppointments.map((appointment) => {
                          const customer = getCustomer(appointment);
                          const serviceSummary =
                            getServiceSummaryForAppointment(appointment);
                          const fullServiceSummary =
                            getFullServiceSummaryForAppointment(appointment);
                          const staffSummary =
                            getStaffSummaryForAppointment(appointment);
                          const fullStaffSummary =
                            getFullStaffSummaryForAppointment(appointment);

                          return (
                            <button
                              type="button"
                              className="appointment-mini-card"
                              key={appointment.id}
                              onClick={() => openEditModal(appointment)}
                              title={`${getCustomerName(
                                appointment
                              )} · ${fullServiceSummary} · ${fullStaffSummary}`}
                            >
                              <span className="appointment-mini-time">
                                <span
                                  className={`appointment-mini-dot ${appointment.status}`}
                                />
                                {formatTime(appointment.time)}
                              </span>
                              <strong>
                                {customer?.name ?? "Deleted customer"}
                              </strong>
                              <span>{serviceSummary}</span>
                              <span className="appointment-mini-staff">
                                {staffSummary}
                              </span>
                            </button>
                          );
                        })}

                        {dateAppointments.length === 0 && (
                          <span className="appointments-week-empty">
                            No bookings
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            emptyState
          )}
        </div>
      )}

      {view === "month" && (
        <div className="appointment-list-card">
          <div className="appointment-list-heading">
            <div>
              <h3>{MONTH_YEAR_FORMATTER.format(selectedDate)}</h3>
              <p>{appointmentCountLabel(monthAppointments.length)}</p>
            </div>
          </div>

          <div className="appointments-calendar-scroll">
            <div className="appointments-month-weekdays">
              {WEEKDAY_SHORT.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="appointments-month-grid">
              {monthDays.map((date) => {
                const dateKey = toDateKey(date);
                const dateAppointments =
                  appointmentsByDate.get(dateKey) ?? [];
                const isOutsideMonth =
                  date.getMonth() !== selectedDate.getMonth() ||
                  date.getFullYear() !== selectedDate.getFullYear();
                const isToday = dateKey === todayKey;
                const isSelected = dateKey === selectedDateKey;
                const isPastDate = date < today;

                return (
                  <div
                    className={`appointments-month-day-wrapper ${
                      isPastDate ? "past" : ""
                    }`}
                    key={dateKey}
                  >
                    <button
                      type="button"
                      className={`appointments-month-day ${
                        isOutsideMonth ? "outside" : ""
                      } ${isToday ? "today" : ""} ${
                        isSelected ? "selected" : ""
                      }`}
                      disabled={isPastDate}
                      onClick={() => {
                        setSelectedDate(date);
                        setView("day");
                      }}
                      aria-label={`${FULL_DATE_FORMATTER.format(
                        date
                      )}, ${appointmentCountLabel(
                        dateAppointments.length
                      )}`}
                    >
                      <div className="appointments-month-day-header">
                        <span>{date.getDate()}</span>
                        {dateAppointments.length > 0 && (
                          <span className="appointments-month-count">
                            {dateAppointments.length}
                          </span>
                        )}
                      </div>

                      <div className="appointments-month-items">
                        {dateAppointments
                          .slice(0, 2)
                          .map((appointment) => {
                            const customer = getCustomer(appointment);

                            return (
                              <span
                                className="appointments-month-item"
                                key={appointment.id}
                                title={getFullServiceSummaryForAppointment(
                                  appointment
                                )}
                              >
                                <span
                                  className={`appointment-mini-dot ${appointment.status}`}
                                />
                                {formatTime(appointment.time)}{" "}
                                {customer?.name.split(" ")[0] || "Deleted"}
                              </span>
                            );
                          })}

                        {dateAppointments.length > 2 && (
                          <span className="appointments-month-more">
                            +{dateAppointments.length - 2} more
                          </span>
                        )}
                      </div>
                    </button>

                    {!isPastDate && (
                      <button
                        type="button"
                        className="appointments-month-add"
                        onClick={(event) => {
                          event.stopPropagation();
                          openAddModalForDate(date);
                        }}
                        title={`Add appointment on ${FULL_DATE_FORMATTER.format(
                          date
                        )}`}
                        aria-label={`Add appointment on ${FULL_DATE_FORMATTER.format(
                          date
                        )}`}
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {monthAppointments.length === 0 && emptyState}
        </div>
      )}

      {showModal && (
        <div className="customer-modal-overlay" onClick={closeModal}>
          <div
            className="customer-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="customer-modal-header">
              <div>
                <h2>
                  {editingAppointment
                    ? "Edit Appointment"
                    : "New Appointment"}
                </h2>
                <p>
                  {editingAppointment
                    ? "Update booking details, staff, and status."
                    : "Book a customer with the right service and team member."}
                </p>
              </div>

              <button
                type="button"
                className="customer-modal-close"
                onClick={closeModal}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="customer-form-section">
                <h3 className="customer-form-section-title">
                  Customer and Service
                </h3>

                <div className="customer-form-grid">
                  <div className="customer-form-group customer-form-full">
                    <label htmlFor="appointment-customer">Customer</label>
                    <select
                      id="appointment-customer"
                      value={formData.customerId}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          customerId: event.target.value,
                        })
                      }
                      required
                    >
                      <option value="">Select a customer</option>
                      {customers.map((customer) => (
                        <option value={customer.id} key={customer.id}>
                          {customer.name} · {customer.phone}
                        </option>
                      ))}
                    </select>

                    {selectedCustomer ? (
                      <div className="appointment-selected-card">
                        <strong>{selectedCustomer.name}</strong>
                        <span>
                          <Mail size={13} />
                          {selectedCustomer.email || "No email added"}
                        </span>
                        <span>
                          <Phone size={13} />
                          {selectedCustomer.phone || "No phone added"}
                        </span>
                      </div>
                    ) : (
                      <p className="customer-form-hint">
                        Choose an existing customer from your directory.
                      </p>
                    )}
                  </div>

                  <div className="customer-form-group customer-form-full">
                    <label>Services</label>
                    <ServiceMultiSelect
                      services={services}
                      selectedIds={formData.serviceIds}
                      onAdd={addService}
                      onRemove={removeService}
                    />
                    <p className="customer-form-hint">
                      Search and select one or more active services. Use
                      the chips above to remove a service.
                    </p>
                  </div>

                  <div className="customer-form-group customer-form-full">
                    <div className="appointment-price-breakdown">
                      <div className="appointment-price-breakdown-header">
                        <span>Price Breakdown</span>
                        <small>
                          {selectedServices.length}{" "}
                          {selectedServices.length === 1
                            ? "service"
                            : "services"}
                        </small>
                      </div>

                      {selectedServices.length > 0 ? (
                        <div className="appointment-price-lines">
                          {selectedServices.map((service) => (
                            <div
                              className="appointment-price-line"
                              key={service.id}
                            >
                              <span>
                                {service.name}
                                <small>{service.duration} min</small>
                              </span>
                              <strong>
                                {formatCurrency(service.price)}
                              </strong>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="customer-form-hint">
                          Select services to see the itemized total.
                        </p>
                      )}

                      <div className="appointment-price-total">
                        <span>Total</span>
                        <strong>{formatCurrency(formTotalPrice)}</strong>
                      </div>
                    </div>

                    {selectedServices.length !==
                      formData.serviceIds.length && (
                      <p className="customer-form-hint">
                        Some selected services are no longer available.
                        Remove them before saving.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="customer-form-section">
                <h3 className="customer-form-section-title">
                  Staff and Schedule
                </h3>

                <div className="customer-form-grid">
                  <div className="customer-form-group customer-form-full">
                    <label>Staff per Service</label>

                    {selectedServiceAssignments.length > 0 ? (
                      <div className="appointment-staff-assignments">
                        {selectedServiceAssignments.map(
                          ({ serviceId, service, staffId, member }) => {
                            const scheduleNote =
                              getAssignmentScheduleMessage(
                                service,
                                member,
                                formDate
                              );
                            const slot = formServiceSlots.get(serviceId);

                            return (
                              <div
                                className="appointment-staff-assignment"
                                key={serviceId}
                              >
                                <div className="appointment-staff-assignment-service">
                                  <strong>
                                    {service?.name ??
                                      "Deleted service"}
                                  </strong>
                                  <small>
                                    {service
                                      ? `${service.duration} min${
                                          slot
                                            ? ` · ${formatMinutes(
                                                slot.startMinutes
                                              )} – ${formatMinutes(
                                                slot.endMinutes
                                              )}`
                                            : ""
                                        }`
                                      : "Unavailable"}
                                  </small>
                                </div>

                                <select
                                  value={staffId}
                                  onChange={(event) =>
                                    setServiceStaff(
                                      serviceId,
                                      event.target.value
                                    )
                                  }
                                  aria-label={`Staff member for ${
                                    service?.name ?? "service"
                                  }`}
                                  required
                                >
                                  <option value="">
                                    Select a staff member
                                  </option>
                                  {staff.map((teamMember) => (
                                    <option
                                      value={teamMember.id}
                                      key={teamMember.id}
                                      disabled={
                                        teamMember.status === "off"
                                      }
                                    >
                                      {teamMember.name} ·{" "}
                                      {teamMember.role}
                                      {teamMember.status === "off"
                                        ? " (Off)"
                                        : ""}
                                    </option>
                                  ))}
                                </select>

                                {scheduleNote && (
                                  <p
                                    className={`appointment-schedule-note ${scheduleNote.tone}`}
                                  >
                                    {scheduleNote.text}
                                  </p>
                                )}
                              </div>
                            );
                          }
                        )}
                      </div>
                    ) : (
                      <p className="customer-form-hint">
                        Select one or more services to assign a staff
                        member to each.
                      </p>
                    )}

                    <p className="customer-form-hint">
                      Each service can be handled by a different team
                      member. Services run sequentially in the order
                      selected.
                    </p>

                    {unassignedServiceCount > 0 && (
                      <p className="appointment-schedule-note warning">
                        {unassignedServiceCount} selected{" "}
                        {unassignedServiceCount === 1
                          ? "service needs"
                          : "services need"}{" "}
                        a staff member.
                      </p>
                    )}
                  </div>

                  <div className="customer-form-group">
                    <label htmlFor="appointment-date">Date</label>
                    <input
                      id="appointment-date"
                      type="date"
                      min={editingAppointment ? undefined : todayKey}
                      value={formData.date}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          date: event.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="customer-form-group">
                    <label htmlFor="appointment-time">Start Time</label>
                    <input
                      id="appointment-time"
                      type="time"
                      value={formData.time}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          time: event.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="appointment-time-summary customer-form-full">
                    <div>
                      <span>Start</span>
                      <strong>
                        {formStartMinutes !== null
                          ? formatMinutes(formStartMinutes)
                          : "—"}
                      </strong>
                    </div>
                    <div>
                      <span>Duration</span>
                      <strong>
                        {formDuration !== null
                          ? `${formDuration} min`
                          : "—"}
                      </strong>
                    </div>
                    <div>
                      <span>End</span>
                      <strong>
                        {formEndMinutes !== null
                          ? `${formatMinutes(formEndMinutes)}${
                              formEndMinutes >= 1440
                                ? " (+1 day)"
                                : ""
                            }`
                          : "—"}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="customer-form-section">
                <h3 className="customer-form-section-title">
                  Additional Notes and Status
                </h3>

                <div className="customer-form-grid">
                  <div className="customer-form-group customer-form-full">
                    <label htmlFor="appointment-notes">Notes</label>
                    <textarea
                      id="appointment-notes"
                      placeholder="Add preferences, preparation notes, or other details."
                      value={formData.notes}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          notes: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="customer-form-group customer-form-full">
                    <label htmlFor="appointment-status">Status</label>
                    <select
                      id="appointment-status"
                      value={formData.status}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          status: event.target.value as AppointmentStatus,
                        })
                      }
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option value={status} key={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                    <p className="customer-form-hint">
                      Status changes are saved only when you submit the
                      form.
                    </p>
                  </div>
                </div>
              </div>

              {formError && (
                <p className="customer-form-error" role="alert">
                  {formError}
                </p>
              )}

              <div className="customer-modal-footer appointment-modal-footer">
                {editingAppointment &&
                  editingAppointment.status !== "cancelled" && (
                    <button
                      type="button"
                      className="appointment-cancel-link"
                      onClick={handleCancelAppointment}
                    >
                      Cancel appointment
                    </button>
                  )}

                <button
                  type="button"
                  className="customer-cancel-button"
                  onClick={closeModal}
                >
                  Close
                </button>

                <button type="submit" className="add-button">
                  {editingAppointment
                    ? "Save Changes"
                    : "Book Appointment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

export default Appointments;
