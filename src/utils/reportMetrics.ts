import type { Appointment, Service, StaffMember } from "../types";
import {
  getAppointmentServiceIds,
  getAppointmentStaffAssignments,
} from "./appointments.ts";
import {
  addDays,
  parseDateKey,
  parseTimeToMinutes,
  startOfWeek,
  toDateKey,
} from "./dates.ts";

export type ReportRange = "today" | "week" | "month";

export interface ReportBounds {
  label: string;
  startKey: string;
  endKey: string;
  previousStartKey: string;
  previousEndKey: string;
  comparisonLabel: string;
}

export interface RevenueTrend {
  labels: string[];
  values: number[];
}

export interface ServicePerformance {
  service: Service;
  bookings: number;
  revenue: number;
}

export interface StaffPerformance {
  member: StaffMember;
  appointments: number;
  completed: number;
  revenue: number;
}

export interface CustomerActivity {
  newCustomers: number;
  returningCustomers: number;
  activeCustomers: number;
}

export function getReportBounds(
  range: ReportRange,
  now: Date
): ReportBounds {
  if (range === "today") {
    const startKey = toDateKey(now);
    const previous = addDays(now, -1);
    const previousKey = toDateKey(previous);

    return {
      label: "Today",
      startKey,
      endKey: startKey,
      previousStartKey: previousKey,
      previousEndKey: previousKey,
      comparisonLabel: "previous day",
    };
  }

  if (range === "week") {
    const weekStart = startOfWeek(now);
    const previousWeekStart = addDays(weekStart, -7);

    return {
      label: "This Week",
      startKey: toDateKey(weekStart),
      endKey: toDateKey(addDays(weekStart, 6)),
      previousStartKey: toDateKey(previousWeekStart),
      previousEndKey: toDateKey(addDays(weekStart, -1)),
      comparisonLabel: "previous week",
    };
  }

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const previousMonthStart = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    1
  );
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  return {
    label: "This Month",
    startKey: toDateKey(monthStart),
    endKey: toDateKey(monthEnd),
    previousStartKey: toDateKey(previousMonthStart),
    previousEndKey: toDateKey(previousMonthEnd),
    comparisonLabel: "previous month",
  };
}

export function isDateInRange(
  date: string,
  startKey: string,
  endKey: string
) {
  return date >= startKey && date <= endKey;
}

export function getPercentChange(current: number, previous: number) {
  if (
    !Number.isFinite(current) ||
    !Number.isFinite(previous) ||
    previous <= 0
  ) {
    return null;
  }

  return ((current - previous) / previous) * 100;
}

export function sumCompletedRevenue(appointments: Appointment[]) {
  return appointments.reduce((total, appointment) => {
    if (
      appointment.status !== "completed" ||
      !Number.isFinite(appointment.price)
    ) {
      return total;
    }

    return total + appointment.price;
  }, 0);
}

export function getRevenueTrend(
  range: ReportRange,
  bounds: ReportBounds,
  completedAppointments: Appointment[]
): RevenueTrend {
  if (range === "today") {
    const values = [0, 0, 0];

    for (const appointment of completedAppointments) {
      if (
        appointment.status !== "completed" ||
        appointment.date !== bounds.startKey
      ) {
        continue;
      }

      const minutes = parseTimeToMinutes(appointment.time);

      if (minutes === null) {
        continue;
      }

      const bucket = minutes < 720 ? 0 : minutes < 1020 ? 1 : 2;
      values[bucket] += Number.isFinite(appointment.price)
        ? appointment.price
        : 0;
    }

    return { labels: ["Morning", "Afternoon", "Evening"], values };
  }

  const totalsByDate = new Map<string, number>();

  for (const appointment of completedAppointments) {
    if (
      appointment.status !== "completed" ||
      !Number.isFinite(appointment.price)
    ) {
      continue;
    }

    totalsByDate.set(
      appointment.date,
      (totalsByDate.get(appointment.date) ?? 0) + appointment.price
    );
  }

  if (range === "week") {
    const weekStart = parseDateKey(bounds.startKey);
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    return {
      labels,
      values: labels.map((_, index) =>
        weekStart
          ? totalsByDate.get(toDateKey(addDays(weekStart, index))) ?? 0
          : 0
      ),
    };
  }

  const monthStart = parseDateKey(bounds.startKey);

  if (!monthStart) {
    return { labels: [], values: [] };
  }

  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const ranges = [
    [1, 7],
    [8, 14],
    [15, 21],
    [22, 28],
    [29, daysInMonth],
  ].filter(([start, end]) => end >= start && start <= daysInMonth);

  const labels: string[] = [];
  const values: number[] = [];

  for (const [start, end] of ranges) {
    labels.push(`${start}-${end}`);

    let bucketTotal = 0;

    for (let day = start; day <= end; day += 1) {
      const key = toDateKey(new Date(year, month, day));
      bucketTotal += totalsByDate.get(key) ?? 0;
    }

    values.push(bucketTotal);
  }

  return { labels, values };
}

export function getServicePerformance(
  appointments: Appointment[],
  serviceById: Map<string, Service>
): ServicePerformance[] {
  const stats = new Map<string, { bookings: number; revenue: number }>();

  for (const appointment of appointments) {
    if (appointment.status === "cancelled") {
      continue;
    }

    for (const serviceId of getAppointmentServiceIds(appointment)) {
      const service = serviceById.get(serviceId);

      if (!service) {
        continue;
      }

      const entry = stats.get(serviceId) ?? { bookings: 0, revenue: 0 };
      entry.bookings += 1;

      if (
        appointment.status === "completed" &&
        Number.isFinite(service.price)
      ) {
        entry.revenue += service.price;
      }

      stats.set(serviceId, entry);
    }
  }

  return Array.from(stats.entries())
    .map(([serviceId, entry]) => ({
      service: serviceById.get(serviceId)!,
      bookings: entry.bookings,
      revenue: entry.revenue,
    }))
    .sort(
      (a, b) => b.bookings - a.bookings || b.revenue - a.revenue
    );
}

export function getStaffPerformance(
  appointments: Appointment[],
  staff: StaffMember[],
  serviceById: Map<string, Service>
): StaffPerformance[] {
  const staffById = new Map(staff.map((member) => [member.id, member]));
  const stats = new Map<
    string,
    { appointments: number; completed: number; revenue: number }
  >();

  for (const appointment of appointments) {
    if (appointment.status === "cancelled") {
      continue;
    }

    const servicesByStaff = new Map<string, Set<string>>();

    for (const assignment of getAppointmentStaffAssignments(appointment)) {
      if (!assignment.staffId || !staffById.has(assignment.staffId)) {
        continue;
      }

      const serviceIds =
        servicesByStaff.get(assignment.staffId) ?? new Set<string>();
      serviceIds.add(assignment.serviceId);
      servicesByStaff.set(assignment.staffId, serviceIds);
    }

    for (const [staffId, serviceIds] of servicesByStaff) {
      const entry = stats.get(staffId) ?? {
        appointments: 0,
        completed: 0,
        revenue: 0,
      };

      entry.appointments += 1;

      if (appointment.status === "completed") {
        entry.completed += 1;

        for (const serviceId of serviceIds) {
          const service = serviceById.get(serviceId);
          entry.revenue +=
            service && Number.isFinite(service.price) ? service.price : 0;
        }
      }

      stats.set(staffId, entry);
    }
  }

  return staff
    .map((member) => ({
      member,
      ...(stats.get(member.id) ?? {
        appointments: 0,
        completed: 0,
        revenue: 0,
      }),
    }))
    .sort(
      (a, b) =>
        b.appointments - a.appointments || b.revenue - a.revenue
    );
}

export function getFirstAppointmentByCustomer(
  appointments: Appointment[]
) {
  const firstByCustomer = new Map<string, string>();

  for (const appointment of appointments) {
    if (
      appointment.status === "cancelled" ||
      !appointment.customerId
    ) {
      continue;
    }

    const existing = firstByCustomer.get(appointment.customerId);

    if (!existing || appointment.date < existing) {
      firstByCustomer.set(appointment.customerId, appointment.date);
    }
  }

  return firstByCustomer;
}

export function getCustomerActivity(
  appointments: Appointment[],
  firstAppointmentByCustomer: Map<string, string>,
  knownCustomerIds: Set<string>,
  startKey: string,
  endKey: string
): CustomerActivity {
  const active = new Set<string>();
  const newCustomers = new Set<string>();
  const returningCustomers = new Set<string>();

  for (const appointment of appointments) {
    if (appointment.status === "cancelled") {
      continue;
    }

    const customerId = appointment.customerId;

    if (!customerId || !knownCustomerIds.has(customerId)) {
      continue;
    }

    active.add(customerId);

    const firstAppointment = firstAppointmentByCustomer.get(customerId);

    if (!firstAppointment) {
      continue;
    }

    if (firstAppointment >= startKey && firstAppointment <= endKey) {
      newCustomers.add(customerId);
    } else if (firstAppointment < startKey) {
      returningCustomers.add(customerId);
    }
  }

  return {
    newCustomers: newCustomers.size,
    returningCustomers: returningCustomers.size,
    activeCustomers: active.size,
  };
}
