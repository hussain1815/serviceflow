import { useMemo, useState, type FormEvent } from "react";
import {
  Users,
  UserPlus,
  CalendarCheck,
  TrendingUp,
  Search,
  Filter,
  Star,
  Pencil,
  Trash2,
  X,
  Mail,
  Phone,
  Clock,
} from "lucide-react";

import { useAppData } from "../context/useAppData";
import type { StaffMember, StaffStatus, WorkingDay } from "../types";
import { getAppointmentStaffIds } from "../utils/appointments";

const WEEKDAYS: WorkingDay[] = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

const AVATAR_COLORS = [
  "sage",
  "peach",
  "lavender",
  "blue",
  "rose",
  "gold",
];

const STATUS_LABELS: Record<StaffStatus, string> = {
  available: "Available",
  busy: "Busy",
  off: "Off",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  role: "",
  status: "available" as StaffStatus,
  workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"] as WorkingDay[],
  startTime: "09:00",
  endTime: "17:00",
};

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getNextColor(index: number) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatRating(rating: number) {
  return rating > 0 ? `${rating.toFixed(1)}/5` : "—";
}

function formatTime(value: string) {
  if (!value) {
    return "";
  }

  const [hours, minutes] = value.split(":").map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return value;
  }

  const period = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;

  return `${hour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatWorkingDays(days: WorkingDay[] = []) {
  const ordered = WEEKDAYS.filter((day) => days.includes(day));

  if (ordered.length === 0) {
    return "No working days";
  }

  if (ordered.length === WEEKDAYS.length) {
    return "Every day";
  }

  if (
    ordered.length === 5 &&
    !ordered.includes("Sat") &&
    !ordered.includes("Sun")
  ) {
    return "Mon – Fri";
  }

  if (ordered.length === 2 && ordered[0] === "Sat" && ordered[1] === "Sun") {
    return "Weekends";
  }

  return ordered.join(", ");
}

function formatSchedule(
  member: Pick<StaffMember, "workingDays" | "startTime" | "endTime">
) {
  const days = formatWorkingDays(member.workingDays ?? []);

  if (!member.startTime || !member.endTime) {
    return days;
  }

  return `${days} · ${formatTime(member.startTime)} – ${formatTime(
    member.endTime
  )}`;
}

function Staff() {
  const { data, upsert, remove } = useAppData();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StaffStatus>("all");
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [viewingStaff, setViewingStaff] = useState<StaffMember | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [formError, setFormError] = useState("");

  const staff = data.staff;

  const filteredStaff = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return staff.filter((member) => {
      const matchesSearch =
        !search ||
        [member.name, member.email, member.role, member.phone].some((value) =>
          (value ?? "").toLowerCase().includes(search)
        );

      const matchesStatus =
        statusFilter === "all" || member.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [staff, searchTerm, statusFilter]);

  const totalBookings = staff.reduce(
    (total, member) => total + (member.bookings ?? 0),
    0
  );

  const totalRevenue = staff.reduce(
    (total, member) => total + (member.revenue ?? 0),
    0
  );

  const availableCount = staff.filter(
    (member) => member.status === "available"
  ).length;

  const stats = [
    {
      label: "Team Members",
      value: staff.length.toLocaleString(),
      note: "Across all roles",
      icon: Users,
    },
    {
      label: "Available Today",
      value: availableCount.toLocaleString(),
      note: "Ready for appointments",
      icon: UserPlus,
    },
    {
      label: "Total Bookings",
      value: totalBookings.toLocaleString(),
      note: "This month",
      icon: CalendarCheck,
    },
    {
      label: "Team Revenue",
      value: formatCurrency(totalRevenue),
      note: "This month",
      icon: TrendingUp,
    },
  ];

  const resetForm = () => {
    setFormData({
      ...emptyForm,
      workingDays: [...emptyForm.workingDays],
    });
    setFormError("");
  };

  const openAddModal = () => {
    setEditingStaff(null);
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (member: StaffMember) => {
    setEditingStaff(member);

    setFormData({
      name: member.name,
      email: member.email ?? "",
      phone: member.phone ?? "",
      role: member.role,
      status: member.status,
      workingDays: [...(member.workingDays ?? [])],
      startTime: member.startTime ?? "09:00",
      endTime: member.endTime ?? "17:00",
    });

    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingStaff(null);
    resetForm();
  };

  const closeProfile = () => {
    setViewingStaff(null);
  };

  const toggleWorkingDay = (day: WorkingDay) => {
    setFormData((current) => ({
      ...current,
      workingDays: current.workingDays.includes(day)
        ? current.workingDays.filter((item) => item !== day)
        : [...current.workingDays, day],
    }));
  };

  const handleStatusChange = (member: StaffMember, status: StaffStatus) => {
    const updatedMember: StaffMember = { ...member, status };

    upsert("staff", updatedMember);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = formData.name.trim();
    const email = formData.email.trim();
    const phone = formData.phone.trim();
    const role = formData.role.trim();

    if (!name || !email || !phone || !role) {
      setFormError("Please fill in all required fields.");
      return;
    }

    if (!EMAIL_PATTERN.test(email)) {
      setFormError("Please enter a valid email address.");
      return;
    }

    const isDuplicateEmail = staff.some(
      (member) =>
        member.id !== editingStaff?.id &&
        (member.email ?? "").trim().toLowerCase() === email.toLowerCase()
    );

    if (isDuplicateEmail) {
      setFormError("A team member with this email already exists.");
      return;
    }

    if (formData.workingDays.length === 0) {
      setFormError("Select at least one working day.");
      return;
    }

    if (!formData.startTime || !formData.endTime) {
      setFormError("Please set both start and end times.");
      return;
    }

    if (formData.startTime >= formData.endTime) {
      setFormError("End time must be after start time.");
      return;
    }

    const member: StaffMember = {
      id: editingStaff?.id ?? crypto.randomUUID(),
      name,
      email,
      phone,
      role,
      initials: getInitials(name),
      color: editingStaff?.color ?? getNextColor(staff.length),
      bookings: editingStaff?.bookings ?? 0,
      revenue: editingStaff?.revenue ?? 0,
      rating: editingStaff?.rating ?? 0,
      status: formData.status,
      workingDays: WEEKDAYS.filter((day) =>
        formData.workingDays.includes(day)
      ),
      startTime: formData.startTime,
      endTime: formData.endTime,
    };

    upsert("staff", member);
    closeModal();
  };

  const handleDelete = (member: StaffMember) => {
    const relatedAppointments = data.appointments.filter(
      (appointment) =>
        appointment.staffId === member.id ||
        getAppointmentStaffIds(appointment).includes(member.id)
    );

    if (relatedAppointments.length > 0) {
      const label =
        relatedAppointments.length === 1 ? "appointment" : "appointments";

      window.alert(
        `${member.name} has ${relatedAppointments.length} ${label} linked to their profile. Reassign or remove those appointments before deleting this team member. Appointment history has not been changed.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${member.name}? This cannot be undone.`
    );

    if (confirmed) {
      remove("staff", member.id);

      if (viewingStaff?.id === member.id) {
        setViewingStaff(null);
      }
    }
  };

  return (
    <div className="staff-page">
      <div className="staff-heading">
        <div>
          <h1>Our Team</h1>
          <p>Manage your salon professionals and track team performance.</p>
        </div>
        <button className="primary-button" onClick={openAddModal}>
          <UserPlus size={17} /> Add Team Member
        </button>
      </div>

      <div className="staff-stats">
        {stats.map(({ label, value, note, icon: Icon }) => (
          <div className="staff-stat-card" key={label}>
            <div className="staff-stat-top">
              <span>{label}</span>
              <Icon size={19} />
            </div>
            <h2>{value}</h2>
            <small>{note}</small>
          </div>
        ))}
      </div>

      <section className="staff-directory">
        <div className="staff-directory-heading">
          <div>
            <h2>Team Directory</h2>
            <p>Your salon professionals and their performance</p>
          </div>
          <div className="staff-actions">
            <div className="staff-search">
              <Search size={17} />
              <input
                placeholder="Search team members..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                aria-label="Search team members"
              />
            </div>
            <div className="staff-filter">
              <Filter size={16} />
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as "all" | StaffStatus
                  )
                }
                aria-label="Filter team members by availability"
              >
                <option value="all">All statuses</option>
                <option value="available">Available</option>
                <option value="busy">Busy</option>
                <option value="off">Off</option>
              </select>
            </div>
          </div>
        </div>

        <div className="staff-grid">
          {filteredStaff.length === 0 ? (
            <div className="staff-empty">
              <Users size={28} />
              <h3>
                {staff.length === 0
                  ? "No team members yet"
                  : "No team members found"}
              </h3>
              <p>
                {staff.length === 0
                  ? "Add your first team member to start building your salon team."
                  : "Try a different search or availability filter."}
              </p>
              {staff.length === 0 && (
                <button className="primary-button" onClick={openAddModal}>
                  <UserPlus size={17} /> Add Team Member
                </button>
              )}
            </div>
          ) : (
            filteredStaff.map((member) => (
              <article className="staff-card" key={member.id}>
                <div className="staff-card-top">
                  <div className={`staff-avatar ${member.color || "sage"}`}>
                    {member.initials}
                  </div>
                  <div className="staff-card-actions">
                    <button
                      className="icon-button"
                      aria-label={`Edit ${member.name}`}
                      title="Edit team member"
                      onClick={() => openEditModal(member)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Delete ${member.name}`}
                      title="Delete team member"
                      onClick={() => handleDelete(member)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <h3>{member.name}</h3>
                <p className="staff-role">{member.role}</p>
                <div
                  className={`staff-status staff-status-control ${member.status}`}
                >
                  <span />
                  <select
                    value={member.status}
                    onChange={(event) =>
                      handleStatusChange(
                        member,
                        event.target.value as StaffStatus
                      )
                    }
                    aria-label={`Change availability for ${member.name}`}
                  >
                    <option value="available">Available</option>
                    <option value="busy">Busy</option>
                    <option value="off">Off</option>
                  </select>
                </div>
                <p className="staff-schedule">
                  <Clock size={14} />
                  <span>{formatSchedule(member)}</span>
                </p>
                <div className="staff-card-divider" />
                <div className="staff-card-details">
                  <div>
                    <span>
                      <CalendarCheck size={15} /> Bookings
                    </span>
                    <strong>{member.bookings ?? 0}</strong>
                  </div>
                  <div>
                    <span>
                      <TrendingUp size={15} /> Revenue
                    </span>
                    <strong>{formatCurrency(member.revenue ?? 0)}</strong>
                  </div>
                  <div>
                    <span>
                      <Star size={15} /> Rating
                    </span>
                    <strong>{formatRating(member.rating ?? 0)}</strong>
                  </div>
                </div>
                <button
                  className="staff-view-button"
                  onClick={() => setViewingStaff(member)}
                >
                  View Profile <span>→</span>
                </button>
              </article>
            ))
          )}
        </div>
      </section>

      {showModal && (
        <div className="customer-modal-overlay" onClick={closeModal}>
          <div
            className="customer-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="customer-modal-header">
              <div>
                <h2>{editingStaff ? "Edit Team Member" : "Add Team Member"}</h2>
                <p>
                  {editingStaff
                    ? "Update team member details and availability."
                    : "Add a new professional to your salon team."}
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
                  Contact Information
                </h3>

                <div className="customer-form-grid">
                  <div className="customer-form-group customer-form-full">
                    <label htmlFor="staff-name">Full Name</label>
                    <input
                      id="staff-name"
                      type="text"
                      placeholder="e.g. Olivia Bennett"
                      value={formData.name}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          name: event.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="customer-form-group customer-form-full">
                    <label htmlFor="staff-email">Email Address</label>
                    <input
                      id="staff-email"
                      type="email"
                      placeholder="name@serviceflow.ai"
                      value={formData.email}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          email: event.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="customer-form-group">
                    <label htmlFor="staff-phone">Phone Number</label>
                    <input
                      id="staff-phone"
                      type="tel"
                      placeholder="+49 151 1234567"
                      value={formData.phone}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          phone: event.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="customer-form-group">
                    <label htmlFor="staff-role">Job Role</label>
                    <input
                      id="staff-role"
                      type="text"
                      placeholder="e.g. Senior Hair Stylist"
                      value={formData.role}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          role: event.target.value,
                        })
                      }
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="customer-form-section">
                <h3 className="customer-form-section-title">
                  Availability & Schedule
                </h3>

                <div className="customer-form-grid">
                  <div className="customer-form-group customer-form-full">
                    <label htmlFor="staff-status">Availability Status</label>
                    <select
                      id="staff-status"
                      value={formData.status}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          status: event.target.value as StaffStatus,
                        })
                      }
                    >
                      <option value="available">Available</option>
                      <option value="busy">Busy</option>
                      <option value="off">Off</option>
                    </select>
                  </div>

                  <div className="customer-form-group customer-form-full">
                    <label>Working Days</label>
                    <div className="staff-working-days">
                      {WEEKDAYS.map((day) => (
                        <label
                          key={day}
                          className={`staff-day-option ${
                            formData.workingDays.includes(day)
                              ? "selected"
                              : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={formData.workingDays.includes(day)}
                            onChange={() => toggleWorkingDay(day)}
                          />
                          {day}
                        </label>
                      ))}
                    </div>
                    <p className="customer-form-hint">
                      Select at least one working day.
                    </p>
                  </div>

                  <div className="customer-form-group">
                    <label htmlFor="staff-start-time">Start Time</label>
                    <input
                      id="staff-start-time"
                      type="time"
                      value={formData.startTime}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          startTime: event.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="customer-form-group">
                    <label htmlFor="staff-end-time">End Time</label>
                    <input
                      id="staff-end-time"
                      type="time"
                      value={formData.endTime}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          endTime: event.target.value,
                        })
                      }
                      required
                    />
                  </div>
                </div>
              </div>

              {formError && (
                <p className="customer-form-error" role="alert">
                  {formError}
                </p>
              )}

              <div className="customer-modal-footer">
                <button
                  type="button"
                  className="customer-cancel-button"
                  onClick={closeModal}
                >
                  Cancel
                </button>

                <button type="submit" className="primary-button">
                  {editingStaff ? "Save Changes" : "Add Team Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingStaff && (
        <div className="customer-modal-overlay" onClick={closeProfile}>
          <div
            className="customer-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="customer-modal-header">
              <div>
                <h2>{viewingStaff.name}</h2>
                <p>{viewingStaff.role}</p>
              </div>

              <button
                type="button"
                className="customer-modal-close"
                onClick={closeProfile}
                aria-label="Close profile"
              >
                <X size={20} />
              </button>
            </div>

            <div className="staff-profile-summary">
              <div className={`staff-avatar ${viewingStaff.color || "sage"}`}>
                {viewingStaff.initials}
              </div>
              <span className={`staff-status ${viewingStaff.status}`}>
                <span /> {STATUS_LABELS[viewingStaff.status]}
              </span>
            </div>

            <div className="staff-profile-details">
              <div>
                <Mail size={16} />
                <span>{viewingStaff.email || "No email added"}</span>
              </div>
              <div>
                <Phone size={16} />
                <span>{viewingStaff.phone || "No phone added"}</span>
              </div>
              <div>
                <Clock size={16} />
                <span>{formatSchedule(viewingStaff)}</span>
              </div>
              <div>
                <CalendarCheck size={16} />
                <span>{viewingStaff.bookings ?? 0} bookings</span>
              </div>
              <div>
                <TrendingUp size={16} />
                <span>{formatCurrency(viewingStaff.revenue ?? 0)} revenue</span>
              </div>
              <div>
                <Star size={16} />
                <span>{formatRating(viewingStaff.rating ?? 0)} rating</span>
              </div>
            </div>

            <div className="customer-modal-footer">
              <button
                type="button"
                className="customer-cancel-button"
                onClick={closeProfile}
              >
                Close
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  closeProfile();
                  openEditModal(viewingStaff);
                }}
              >
                Edit Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Staff;
