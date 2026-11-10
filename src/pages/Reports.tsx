import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  CalendarDays,
  Download,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useAppData } from "../context/useAppData";
import {
  getCustomerActivity,
  getFirstAppointmentByCustomer,
  getPercentChange,
  getReportBounds,
  getRevenueTrend,
  getServicePerformance,
  getStaffPerformance,
  isDateInRange,
  sumCompletedRevenue,
  type ReportRange,
} from "../utils/reportMetrics.ts";

const REPORT_RANGES: { value: ReportRange; label: string }[] = [
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

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatPercentChange(value: number) {
  return `${percentFormatter.format(Math.abs(value))}%`;
}

function getChangeClass(change: number | null) {
  if (change === null || change === 0) {
    return "neutral";
  }

  return change > 0 ? "positive" : "negative";
}

export default function Reports() {
  const { data } = useAppData();
  const [reportRange, setReportRange] = useState<ReportRange>("month");
  const now = useMemo(() => new Date(), []);
  const bounds = useMemo(
    () => getReportBounds(reportRange, now),
    [reportRange, now]
  );

  const serviceById = useMemo(
    () => new Map(data.services.map((service) => [service.id, service])),
    [data.services]
  );
  const knownCustomerIds = useMemo(
    () => new Set(data.customers.map((customer) => customer.id)),
    [data.customers]
  );

  const appointmentsInRange = useMemo(
    () =>
      data.appointments.filter((appointment) =>
        isDateInRange(appointment.date, bounds.startKey, bounds.endKey)
      ),
    [data.appointments, bounds.startKey, bounds.endKey]
  );
  const previousAppointments = useMemo(
    () =>
      data.appointments.filter((appointment) =>
        isDateInRange(
          appointment.date,
          bounds.previousStartKey,
          bounds.previousEndKey
        )
      ),
    [
      data.appointments,
      bounds.previousStartKey,
      bounds.previousEndKey,
    ]
  );

  const completedInRange = useMemo(
    () =>
      appointmentsInRange.filter(
        (appointment) => appointment.status === "completed"
      ),
    [appointmentsInRange]
  );
  const previousCompleted = useMemo(
    () =>
      previousAppointments.filter(
        (appointment) => appointment.status === "completed"
      ),
    [previousAppointments]
  );

  const totalRevenue = useMemo(
    () => sumCompletedRevenue(completedInRange),
    [completedInRange]
  );
  const previousRevenue = useMemo(
    () => sumCompletedRevenue(previousCompleted),
    [previousCompleted]
  );
  const totalAppointments = appointmentsInRange.length;
  const completedCount = completedInRange.length;
  const cancelledCount = appointmentsInRange.filter(
    (appointment) => appointment.status === "cancelled"
  ).length;
  const pendingCount = appointmentsInRange.filter(
    (appointment) => appointment.status === "pending"
  ).length;
  const confirmedCount = appointmentsInRange.filter(
    (appointment) => appointment.status === "confirmed"
  ).length;
  const averageValue =
    completedCount > 0 ? totalRevenue / completedCount : 0;
  const previousAverageValue =
    previousCompleted.length > 0
      ? previousRevenue / previousCompleted.length
      : 0;

  const revenueChange = getPercentChange(totalRevenue, previousRevenue);
  const appointmentsChange = getPercentChange(
    totalAppointments,
    previousAppointments.length
  );
  const averageChange = getPercentChange(
    averageValue,
    previousAverageValue
  );

  const firstAppointmentByCustomer = useMemo(
    () => getFirstAppointmentByCustomer(data.appointments),
    [data.appointments]
  );
  const customerActivity = useMemo(
    () =>
      getCustomerActivity(
        appointmentsInRange,
        firstAppointmentByCustomer,
        knownCustomerIds,
        bounds.startKey,
        bounds.endKey
      ),
    [
      appointmentsInRange,
      firstAppointmentByCustomer,
      knownCustomerIds,
      bounds.startKey,
      bounds.endKey,
    ]
  );
  const previousCustomerActivity = useMemo(
    () =>
      getCustomerActivity(
        previousAppointments,
        firstAppointmentByCustomer,
        knownCustomerIds,
        bounds.previousStartKey,
        bounds.previousEndKey
      ),
    [
      previousAppointments,
      firstAppointmentByCustomer,
      knownCustomerIds,
      bounds.previousStartKey,
      bounds.previousEndKey,
    ]
  );
  const newCustomersChange = getPercentChange(
    customerActivity.newCustomers,
    previousCustomerActivity.newCustomers
  );

  const servicePerformance = useMemo(
    () => getServicePerformance(appointmentsInRange, serviceById).slice(0, 4),
    [appointmentsInRange, serviceById]
  );
  const peakServiceBookings = Math.max(
    ...servicePerformance.map((service) => service.bookings),
    0
  );

  const staffPerformance = useMemo(
    () => getStaffPerformance(appointmentsInRange, data.staff, serviceById),
    [appointmentsInRange, data.staff, serviceById]
  );

  const revenueTrend = useMemo(
    () => getRevenueTrend(reportRange, bounds, completedInRange),
    [reportRange, bounds, completedInRange]
  );
  const peakRevenue = Math.max(...revenueTrend.values, 0);
  const peakRevenueIndex =
    peakRevenue > 0 ? revenueTrend.values.indexOf(peakRevenue) : -1;
  const axisMax = peakRevenue > 0 ? Math.ceil(peakRevenue / 4) * 4 : 0;
  const axisLabels =
    axisMax > 0
      ? [1, 0.75, 0.5, 0.25, 0].map((ratio) =>
          formatCurrency(axisMax * ratio)
        )
      : ["", "", "", "", formatCurrency(0)];

  const metricCards = [
    {
      label: "Total Revenue",
      value: formatCurrency(totalRevenue),
      change: revenueChange,
      icon: Wallet,
    },
    {
      label: "Total Appointments",
      value: totalAppointments.toLocaleString(),
      change: appointmentsChange,
      icon: CalendarCheck,
    },
    {
      label: "New Customers",
      value: customerActivity.newCustomers.toLocaleString(),
      change: newCustomersChange,
      icon: Users,
    },
    {
      label: "Avg. Appointment Value",
      value: formatCurrency(averageValue),
      change: averageChange,
      icon: TrendingUp,
    },
  ];

  const getBookingShare = (count: number) =>
    totalAppointments > 0
      ? `${(count / totalAppointments) * 100}%`
      : "0%";

  const revenueSubtitle =
    reportRange === "today"
      ? "Your revenue performance by time of day"
      : reportRange === "week"
        ? "Your revenue performance by day"
        : "Your revenue performance by week";

  return (
    <div className="reports-page">
      <div className="reports-heading">
        <div>
          <h1>Reports & Analytics</h1>
          <p>
            Track your salon performance and understand your business growth.
          </p>
        </div>
        <div className="reports-heading-actions">
          <div className="reports-range-toggle">
            <CalendarDays size={16} />
            {REPORT_RANGES.map((range) => (
              <button
                className={`secondary-button ${
                  reportRange === range.value ? "active" : ""
                }`}
                key={range.value}
                onClick={() => setReportRange(range.value)}
                type="button"
                aria-pressed={reportRange === range.value}
              >
                {range.label}
              </button>
            ))}
          </div>
          <button className="primary-button" type="button">
            <Download size={16} /> Export Report
          </button>
        </div>
      </div>

      <div className="reports-metrics">
        {metricCards.map(({ label, value, change, icon: Icon }) => (
          <div className="report-metric-card" key={label}>
            <div className="report-metric-top">
              <span>{label}</span>
              <Icon size={19} />
            </div>
            <h2>{value}</h2>
            <div className={`report-change ${getChangeClass(change)}`}>
              {change === null ? (
                <span>No prior period data</span>
              ) : (
                <>
                  {change > 0 ? (
                    <ArrowUpRight size={14} />
                  ) : change < 0 ? (
                    <ArrowDownRight size={14} />
                  ) : null}
                  {formatPercentChange(change)}{" "}
                  <span>vs {bounds.comparisonLabel}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="reports-main-grid">
        <section className="report-panel revenue-panel">
          <div className="report-panel-heading">
            <div>
              <h2>Revenue Overview</h2>
              <p>{revenueSubtitle}</p>
            </div>
            <span className="report-period">{bounds.label}</span>
          </div>
          <div className="revenue-summary">
            <h3>{formatCurrency(totalRevenue)}</h3>
            <span
              className={
                revenueChange === null || revenueChange === 0
                  ? "report-no-change"
                  : revenueChange < 0
                    ? "negative"
                    : ""
              }
            >
              {revenueChange === null ? (
                "No prior period revenue"
              ) : (
                <>
                  {revenueChange > 0 ? (
                    <ArrowUpRight size={14} />
                  ) : revenueChange < 0 ? (
                    <ArrowDownRight size={14} />
                  ) : null}
                  {formatPercentChange(revenueChange)}
                </>
              )}
            </span>
          </div>
          <div className="revenue-chart">
            <div className="chart-y-labels">
              {axisLabels.map((label, index) => (
                <span key={`${label}-${index}`}>{label}</span>
              ))}
            </div>
            <div className="chart-content">
              <div className="chart-grid-lines">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="chart-bars">
                {revenueTrend.labels.map((label, index) => {
                  const value = revenueTrend.values[index] ?? 0;

                  return (
                    <div className="chart-bar-column" key={label}>
                      <div className="chart-bar-track">
                        <div
                          className={`chart-bar ${
                            index === peakRevenueIndex ? "peak" : ""
                          }`}
                          style={{
                            height:
                              axisMax > 0
                                ? `${(value / axisMax) * 100}%`
                                : "0%",
                          }}
                          title={formatCurrency(value)}
                        />
                      </div>
                      <span>{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="report-panel">
          <div className="report-panel-heading">
            <div>
              <h2>Booking Summary</h2>
              <p>Appointment breakdown</p>
            </div>
            <CalendarCheck size={19} />
          </div>
          <div className="booking-total">
            <strong>{totalAppointments}</strong>
            <span>Total appointments</span>
          </div>
          <div className="booking-breakdown">
            <div>
              <span>
                <i className="booking-dot completed" /> Completed
              </span>
              <strong>{completedCount}</strong>
            </div>
            <div>
              <span>
                <i className="booking-dot cancelled" /> Cancelled
              </span>
              <strong>{cancelledCount}</strong>
            </div>
            <div>
              <span>
                <i className="booking-dot pending" /> Pending
              </span>
              <strong>{pendingCount}</strong>
            </div>
            <div>
              <span>
                <i className="booking-dot confirmed" /> Confirmed
              </span>
              <strong>{confirmedCount}</strong>
            </div>
          </div>
          <div className="booking-progress">
            <span style={{ width: getBookingShare(completedCount) }} />
            <span style={{ width: getBookingShare(cancelledCount) }} />
            <span style={{ width: getBookingShare(pendingCount) }} />
            <span style={{ width: getBookingShare(confirmedCount) }} />
          </div>
          <p className="report-footnote">
            Only completed appointments contribute to revenue.
          </p>
        </section>
      </div>

      <div className="reports-bottom-grid">
        <section className="report-panel">
          <div className="report-panel-heading">
            <div>
              <h2>Top Performing Services</h2>
              <p>Based on bookings and revenue</p>
            </div>
          </div>
          {servicePerformance.length > 0 ? (
            <div className="top-services-list">
              {servicePerformance.map((service, index) => (
                <div className="top-service" key={service.service.id}>
                  <div className="top-service-info">
                    <div>
                      <span className="service-rank">{index + 1}</span>
                      <strong>{service.service.name}</strong>
                    </div>
                    <span>
                      {service.bookings}{" "}
                      {service.bookings === 1 ? "booking" : "bookings"} · est.{" "}
                      {formatCurrency(service.revenue)}
                    </span>
                  </div>
                  <div className="top-service-track">
                    <span
                      style={{
                        width: `${
                          peakServiceBookings > 0
                            ? (service.bookings / peakServiceBookings) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="report-empty">
              No service bookings in this period.
            </p>
          )}
          <p className="report-footnote">
            Service revenue is estimated from completed bookings using current
            prices.
          </p>
        </section>

        <section className="report-panel">
          <div className="report-panel-heading">
            <div>
              <h2>Customer Analytics</h2>
              <p>Directory totals and activity in the selected period</p>
            </div>
            <Users size={19} />
          </div>
          <div className="business-insights">
            <div>
              <span>Total customers</span>
              <strong>{data.customers.length}</strong>
            </div>
            <div>
              <span>New customers</span>
              <strong>{customerActivity.newCustomers}</strong>
            </div>
            <div>
              <span>Returning customers</span>
              <strong>{customerActivity.returningCustomers}</strong>
            </div>
            <div>
              <span>Customers booked</span>
              <strong>{customerActivity.activeCustomers}</strong>
            </div>
          </div>
          <p className="report-footnote">
            New and returning customers are based on each customer's first
            non-cancelled appointment.
          </p>
        </section>
      </div>

      <section className="report-panel">
        <div className="report-panel-heading">
          <div>
            <h2>Staff Performance</h2>
            <p>Appointments and completed revenue by team member</p>
          </div>
        </div>
        {staffPerformance.length > 0 ? (
          <div className="staff-report-list">
            {staffPerformance.map(
              ({ member, appointments, completed, revenue }) => (
                <div className="staff-report-row" key={member.id}>
                  <div className="staff-report-info">
                    <span
                      className={`staff-avatar staff-report-avatar ${member.color}`}
                    >
                      {member.initials}
                    </span>
                    <div>
                      <strong>{member.name}</strong>
                      <span>{member.role}</span>
                    </div>
                  </div>
                  <div className="staff-report-stats">
                    <div>
                      <span>Appointments</span>
                      <strong>{appointments}</strong>
                    </div>
                    <div>
                      <span>Completed</span>
                      <strong>{completed}</strong>
                    </div>
                    <div>
                      <span>Est. revenue</span>
                      <strong>{formatCurrency(revenue)}</strong>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        ) : (
          <p className="report-empty">No staff records.</p>
        )}
        <p className="report-footnote">
          Revenue is estimated from completed bookings using current service
          prices.
        </p>
      </section>
    </div>
  );
}
