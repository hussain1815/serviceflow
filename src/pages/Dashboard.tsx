import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarCheck,
  CircleDollarSign,
  Clock3,
  Scissors,
  Star,
  Users,
  UserCheck,
} from "lucide-react";

import { useAppData } from "../context/useAppData";
import type { Appointment } from "../types";
import {
  getAppointmentServiceIds,
  getAppointmentStaffAssignments,
  getAppointmentStaffIds,
} from "../utils/appointments";
import {
  addDays,
  formatTime,
  parseDateKey,
  parseTimeToMinutes,
  startOfWeek,
  toDateKey,
} from "../utils/dates";

type RevenueRange = "today" | "week" | "month";

const revenueRanges: { value: RevenueRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

function formatCurrency(amount: number) {
  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0);
}

function formatAppointmentDate(value: string) {
  const date = parseDateKey(value);

  if (!date) {
    return value || "—";
  }

  return shortDateFormatter.format(date);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getTimeSortValue(value: string) {
  return parseTimeToMinutes(value) ?? Number.MAX_SAFE_INTEGER;
}

function Dashboard() {
  const { data } = useAppData();
  const navigate = useNavigate();

  const [revenueRange, setRevenueRange] = useState<RevenueRange>("week");

  const now = useMemo(() => new Date(), []);
  const todayKey = toDateKey(now);

  const customerById = useMemo(
    () => new Map(data.customers.map((customer) => [customer.id, customer])),
    [data.customers]
  );
  const staffById = useMemo(
    () => new Map(data.staff.map((member) => [member.id, member])),
    [data.staff]
  );
  const serviceById = useMemo(
    () => new Map(data.services.map((service) => [service.id, service])),
    [data.services]
  );

  const completedByDate = useMemo(() => {
    const totals = new Map<string, number>();

    for (const appointment of data.appointments) {
      if (appointment.status !== "completed") {
        continue;
      }

      totals.set(
        appointment.date,
        (totals.get(appointment.date) ?? 0) + appointment.price
      );
    }

    return totals;
  }, [data.appointments]);

  const completedAppointments = useMemo(
    () =>
      data.appointments.filter(
        (appointment) => appointment.status === "completed"
      ),
    [data.appointments]
  );

  const totalRevenue = completedAppointments.reduce(
    (total, appointment) => total + appointment.price,
    0
  );

  const todayAppointments = useMemo(
    () => data.appointments.filter((appointment) => appointment.date === todayKey),
    [data.appointments, todayKey]
  );

  const todayScheduled = todayAppointments.filter(
    (appointment) => appointment.status !== "cancelled"
  );

  const completedToday = todayAppointments.filter(
    (appointment) => appointment.status === "completed"
  ).length;
  const pendingToday = todayAppointments.filter(
    (appointment) => appointment.status === "pending"
  ).length;

  const activeStaff = data.staff.filter((member) => member.status !== "off");
  const availableStaff = data.staff.filter(
    (member) => member.status === "available"
  ).length;
  const busyStaff = data.staff.filter(
    (member) => member.status === "busy"
  ).length;

  const newCustomers = data.customers.filter(
    (customer) => customer.status === "New"
  ).length;
  const returningCustomers = data.customers.length - newCustomers;

  const revenue = useMemo(() => {
    if (revenueRange === "today") {
      const values = [0, 0, 0];

      for (const appointment of completedAppointments) {
        if (appointment.date !== todayKey) {
          continue;
        }

        const minutes = parseTimeToMinutes(appointment.time);

        if (minutes === null) {
          continue;
        }

        const bucket = minutes < 720 ? 0 : minutes < 1020 ? 1 : 2;
        values[bucket] += appointment.price;
      }

      return {
        labels: ["Morning", "Afternoon", "Evening"],
        values,
        total: values.reduce((sum, value) => sum + value, 0),
      };
    }

    if (revenueRange === "week") {
      const weekStart = startOfWeek(now);
      const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const values = labels.map((_, index) =>
        completedByDate.get(toDateKey(addDays(weekStart, index))) ?? 0
      );

      return {
        labels,
        values,
        total: values.reduce((sum, value) => sum + value, 0),
      };
    }

    const year = now.getFullYear();
    const month = now.getMonth();
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
        bucketTotal += completedByDate.get(key) ?? 0;
      }

      values.push(bucketTotal);
    }

    return {
      labels,
      values,
      total: values.reduce((sum, value) => sum + value, 0),
    };
  }, [
    completedAppointments,
    completedByDate,
    now,
    revenueRange,
    todayKey,
  ]);

  const chartMax = Math.max(...revenue.values, 0);

  const todaySummary = useMemo(() => {
    const counts = {
      confirmed: 0,
      pending: 0,
      completed: 0,
      cancelled: 0,
    };

    for (const appointment of data.appointments) {
      if (appointment.date !== todayKey) {
        continue;
      }

      counts[appointment.status] += 1;
    }

    const total =
      counts.confirmed + counts.pending + counts.completed + counts.cancelled;

    return { counts, total };
  }, [data.appointments, todayKey]);

  const topServices = useMemo(() => {
    const stats = new Map<string, { bookings: number; revenue: number }>();

    for (const appointment of data.appointments) {
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

        if (appointment.status === "completed") {
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
      )
      .slice(0, 5);
  }, [data.appointments, serviceById]);

  const staffPerformance = useMemo(() => {
    const stats = new Map<
      string,
      { appointments: number; completed: number; revenue: number }
    >();

    for (const appointment of data.appointments) {
      if (appointment.status === "cancelled") {
        continue;
      }

      const servicesByStaff = new Map<string, Set<string>>();

      for (const assignment of getAppointmentStaffAssignments(appointment)) {
        if (!assignment.staffId) {
          continue;
        }

        const serviceIds = servicesByStaff.get(assignment.staffId) ?? new Set();
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
            entry.revenue += serviceById.get(serviceId)?.price ?? 0;
          }
        }

        stats.set(staffId, entry);
      }
    }

    return data.staff
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
      )
      .slice(0, 5);
  }, [data.appointments, data.staff, serviceById]);

  const todayAppointmentRows = useMemo(
    () =>
      data.appointments
        .filter(
          (appointment) =>
            appointment.date === todayKey &&
            appointment.status !== "cancelled"
        )
        .sort(
          (a, b) => getTimeSortValue(a.time) - getTimeSortValue(b.time)
        ),
    [data.appointments, todayKey]
  );

  const upcomingAppointments = useMemo(() => {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    return data.appointments
      .filter((appointment) => {
        if (
          appointment.status !== "pending" &&
          appointment.status !== "confirmed"
        ) {
          return false;
        }

        if (appointment.date > todayKey) {
          return true;
        }

        if (appointment.date !== todayKey) {
          return false;
        }

        const minutes = parseTimeToMinutes(appointment.time);

        return minutes !== null && minutes >= nowMinutes;
      })
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          getTimeSortValue(a.time) - getTimeSortValue(b.time)
      )
      .slice(0, 5);
  }, [data.appointments, now, todayKey]);

  const getCustomer = (appointment: Appointment) =>
    customerById.get(appointment.customerId);

  const getCustomerName = (appointment: Appointment) =>
    getCustomer(appointment)?.name ?? "Unknown customer";

  const getCustomerInitials = (appointment: Appointment) => {
    const customer = getCustomer(appointment);

    if (customer?.initials) {
      return customer.initials;
    }

    if (!customer?.name) {
      return "—";
    }

    return customer.name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const getServiceNames = (appointment: Appointment) => {
    const names = getAppointmentServiceIds(appointment)
      .map((serviceId) => serviceById.get(serviceId)?.name)
      .filter((name): name is string => Boolean(name));

    return names.length > 0 ? names.join(", ") : "—";
  };

  const getStaffNames = (appointment: Appointment) => {
    const names = getAppointmentStaffIds(appointment)
      .map((staffId) => staffById.get(staffId)?.name)
      .filter((name): name is string => Boolean(name));

    return names.length > 0 ? names.join(", ") : "—";
  };

  const metrics = [
    {
      title: "Total Revenue",
      value: formatCurrency(totalRevenue),
      description: `${completedAppointments.length} completed appointment${
        completedAppointments.length === 1 ? "" : "s"
      }`,
      icon: CircleDollarSign,
    },
    {
      title: "Today's Appointments",
      value: todayScheduled.length.toLocaleString(),
      description: `${pendingToday} pending · ${completedToday} completed`,
      icon: CalendarCheck,
    },
    {
      title: "Total Customers",
      value: data.customers.length.toLocaleString(),
      description: `${newCustomers} new · ${returningCustomers} returning`,
      icon: Users,
    },
    {
      title: "Active Staff",
      value: activeStaff.length.toLocaleString(),
      description: `${availableStaff} available · ${busyStaff} busy`,
      icon: UserCheck,
    },
  ];

  const revenueRangeDescription =
    revenueRange === "today"
      ? "Completed revenue by time of day"
      : revenueRange === "week"
      ? "Completed revenue for this week"
      : "Completed revenue for this month";

  return (
    <div className="dashboard-page">
      {/* Metrics */}

      <section className="metrics-grid">
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <article className="metric-card" key={metric.title}>
              <div className="metric-top">
                <span>{metric.title}</span>
                <div className="metric-icon">
                  <Icon size={19} />
                </div>
              </div>

              <h2>{metric.value}</h2>

              <div className="metric-footer">
                <span>{metric.description}</span>
              </div>
            </article>
          );
        })}
      </section>

      {/* Revenue and appointments summary */}

      <section className="dashboard-grid">
        <article className="dashboard-card revenue-card">
          <div className="card-heading">
            <div>
              <h3>Revenue Overview</h3>
              <p>{revenueRangeDescription}</p>
            </div>

            <div className="dashboard-range-toggle">
              {revenueRanges.map((range) => (
                <button
                  key={range.value}
                  type="button"
                  className={`filter-button ${
                    revenueRange === range.value ? "active" : ""
                  }`}
                  onClick={() => setRevenueRange(range.value)}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          <div className="revenue-total">
            <h2>{formatCurrency(revenue.total)}</h2>
          </div>

          <div className="chart">
            {revenue.labels.map((label, index) => {
              const value = revenue.values[index] ?? 0;
              const height =
                chartMax > 0 ? Math.round((value / chartMax) * 100) : 0;

              return (
                <div className="chart-column" key={label}>
                  <div className="chart-bar-wrapper">
                    <div
                      className="chart-bar"
                      style={{
                        height: `${height}%`,
                        minHeight: value > 0 ? undefined : 0,
                      }}
                      title={`${label}: ${formatCurrency(value)}`}
                    />
                  </div>
                  <span>{label}</span>
                </div>
              );
            })}
          </div>

          <p className="dashboard-footnote">
            Uses the saved price of completed appointments.
          </p>
        </article>

        <article className="dashboard-card summary-card">
          <div className="card-heading">
            <div>
              <h3>Appointments</h3>
              <p>Today's booking summary</p>
            </div>
            <CalendarCheck size={20} />
          </div>

          <div className="appointment-summary-total">
            <h2>{todaySummary.total}</h2>
            <span>Booked today</span>
          </div>

          <div className="summary-row">
            <span>Confirmed</span>
            <strong>{todaySummary.counts.confirmed}</strong>
          </div>

          <div className="summary-progress">
            <div
              style={{
                width: `${
                  todaySummary.total > 0
                    ? Math.round(
                        (todaySummary.counts.confirmed / todaySummary.total) * 100
                      )
                    : 0
                }%`,
              }}
            />
          </div>

          <div className="summary-row">
            <span>Pending</span>
            <strong>{todaySummary.counts.pending}</strong>
          </div>

          <div className="summary-progress pending-progress">
            <div
              style={{
                width: `${
                  todaySummary.total > 0
                    ? Math.round(
                        (todaySummary.counts.pending / todaySummary.total) * 100
                      )
                    : 0
                }%`,
              }}
            />
          </div>

          <div className="summary-row">
            <span>Completed</span>
            <strong>{todaySummary.counts.completed}</strong>
          </div>

          <div className="summary-progress completed-progress">
            <div
              style={{
                width: `${
                  todaySummary.total > 0
                    ? Math.round(
                        (todaySummary.counts.completed / todaySummary.total) *
                          100
                      )
                    : 0
                }%`,
              }}
            />
          </div>

          <div className="summary-row">
            <span>Cancelled</span>
            <strong>{todaySummary.counts.cancelled}</strong>
          </div>

          <div className="summary-progress cancelled-progress">
            <div
              style={{
                width: `${
                  todaySummary.total > 0
                    ? Math.round(
                        (todaySummary.counts.cancelled / todaySummary.total) *
                          100
                      )
                    : 0
                }%`,
              }}
            />
          </div>
        </article>
      </section>

      {/* Top services and staff performance */}

      <section className="dashboard-grid">
        <article className="dashboard-card">
          <div className="card-heading">
            <div>
              <h3>Top Services</h3>
              <p>Most booked services across all appointments</p>
            </div>
            <Scissors size={20} />
          </div>

          {topServices.length > 0 ? (
            <div className="dashboard-performance-list">
              {topServices.map(({ service, bookings, revenue: serviceRevenue }) => (
                <div className="dashboard-performance-item" key={service.id}>
                  <div className="dashboard-performance-info">
                    <strong>{service.name}</strong>
                    <span>{service.category}</span>
                  </div>

                  <div className="dashboard-performance-metrics">
                    <span>
                      {bookings} booking{bookings === 1 ? "" : "s"}
                    </span>
                    <strong>{formatCurrency(serviceRevenue)}</strong>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="dashboard-empty-note">No service bookings yet.</p>
          )}

          <p className="dashboard-footnote">
            Revenue is estimated from completed bookings using current service
            prices.
          </p>
        </article>

        <article className="dashboard-card">
          <div className="card-heading">
            <div>
              <h3>Staff Performance</h3>
              <p>Bookings and estimated revenue by team member</p>
            </div>
            <UserCheck size={20} />
          </div>

          {staffPerformance.length > 0 ? (
            <div className="dashboard-performance-list">
              {staffPerformance.map(
                ({ member, appointments, completed, revenue: staffRevenue }) => (
                  <div className="dashboard-performance-item" key={member.id}>
                    <div className="dashboard-performance-info">
                      <strong>{member.name}</strong>
                      <span>{member.role}</span>
                    </div>

                    <div className="dashboard-performance-metrics">
                      <span>
                        {appointments} booking{appointments === 1 ? "" : "s"} ·{" "}
                        {completed} completed
                      </span>
                      <strong>{formatCurrency(staffRevenue)}</strong>
                    </div>

                    <span className="dashboard-performance-rating">
                      <Star size={12} />
                      {member.rating > 0 ? member.rating.toFixed(1) : "—"}
                    </span>
                  </div>
                )
              )}
            </div>
          ) : (
            <p className="dashboard-empty-note">No staff members yet.</p>
          )}

          <p className="dashboard-footnote">
            Revenue is estimated from completed bookings using current service
            prices.
          </p>
        </article>
      </section>

      {/* Today's appointments */}

      <section className="dashboard-card appointments-card">
        <div className="card-heading">
          <div>
            <h3>Today's Appointments</h3>
            <p>Manage your upcoming customer bookings</p>
          </div>

          <Link className="view-all-button" to="/appointments">
            View all
            <ArrowUpRight size={15} />
          </Link>
        </div>

        <div className="appointments-table-wrapper">
          <table className="appointments-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Services</th>
                <th>Time</th>
                <th>Staff</th>
                <th>Price</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {todayAppointmentRows.length > 0 ? (
                todayAppointmentRows.map((appointment) => (
                  <tr
                    key={appointment.id}
                    className="dashboard-appointment-row"
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate("/appointments")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        navigate("/appointments");
                      }
                    }}
                  >
                    <td>
                      <div className="customer-cell">
                        <div className="customer-avatar">
                          {getCustomerInitials(appointment)}
                        </div>
                        <strong>{getCustomerName(appointment)}</strong>
                      </div>
                    </td>

                    <td className="dashboard-services-cell">
                      {getServiceNames(appointment)}
                    </td>

                    <td>
                      <span className="time-cell">
                        <Clock3 size={14} />
                        {formatTime(appointment.time)}
                      </span>
                    </td>

                    <td className="dashboard-staff-cell">
                      {getStaffNames(appointment)}
                    </td>

                    <td>
                      <strong>{formatCurrency(appointment.price)}</strong>
                    </td>

                    <td>
                      <span
                        className={`status-badge status-${appointment.status}`}
                      >
                        {capitalize(appointment.status)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="dashboard-table-empty">
                    No appointments scheduled for today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Upcoming appointments */}

      <section className="dashboard-card appointments-card">
        <div className="card-heading">
          <div>
            <h3>Upcoming Appointments</h3>
            <p>Pending and confirmed bookings coming up</p>
          </div>

          <Link className="view-all-button" to="/appointments">
            View all
            <ArrowUpRight size={15} />
          </Link>
        </div>

        <div className="appointments-table-wrapper">
          <table className="appointments-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Customer</th>
                <th>Services</th>
                <th>Staff</th>
                <th>Price</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {upcomingAppointments.length > 0 ? (
                upcomingAppointments.map((appointment) => (
                  <tr
                    key={appointment.id}
                    className="dashboard-appointment-row"
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate("/appointments")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        navigate("/appointments");
                      }
                    }}
                  >
                    <td>
                      <strong>{formatAppointmentDate(appointment.date)}</strong>
                    </td>

                    <td>
                      <span className="time-cell">
                        <Clock3 size={14} />
                        {formatTime(appointment.time)}
                      </span>
                    </td>

                    <td>
                      <div className="customer-cell">
                        <div className="customer-avatar">
                          {getCustomerInitials(appointment)}
                        </div>
                        <strong>{getCustomerName(appointment)}</strong>
                      </div>
                    </td>

                    <td className="dashboard-services-cell">
                      {getServiceNames(appointment)}
                    </td>

                    <td className="dashboard-staff-cell">
                      {getStaffNames(appointment)}
                    </td>

                    <td>
                      <strong>{formatCurrency(appointment.price)}</strong>
                    </td>

                    <td>
                      <span
                        className={`status-badge status-${appointment.status}`}
                      >
                        {capitalize(appointment.status)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="dashboard-table-empty">
                    No upcoming appointments.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
