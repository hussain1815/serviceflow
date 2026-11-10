import { useMemo, useState, type FormEvent } from "react";
import {
  Plus,
  Search,
  Filter,
  Clock,
  Scissors,
  Sparkles,
  Hand,
  Heart,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import { useAppData } from "../context/useAppData";
import type { Service, ServiceStatus, StaffMember } from "../types";
import { getAppointmentServiceIds } from "../utils/appointments";

const SERVICE_CATEGORIES = [
  "Hair",
  "Nails",
  "Beauty",
  "Wellness",
  "Skincare",
];

const SERVICE_ICONS: Record<string, typeof Scissors> = {
  scissors: Scissors,
  sparkles: Sparkles,
  hand: Hand,
  heart: Heart,
};

const CATEGORY_ICONS: Record<string, string> = {
  Hair: "scissors",
  Nails: "hand",
  Beauty: "sparkles",
  Wellness: "heart",
  Skincare: "sparkles",
};

const CATEGORY_COLORS: Record<string, string> = {
  Hair: "sage",
  Nails: "lavender",
  Beauty: "blue",
  Wellness: "gold",
  Skincare: "rose",
};

const STATUS_LABELS: Record<ServiceStatus, string> = {
  active: "Active",
  inactive: "Inactive",
};

const emptyForm = {
  name: "",
  category: SERVICE_CATEGORIES[0],
  description: "",
  duration: "",
  price: "",
  status: "active" as ServiceStatus,
  staffIds: [] as string[],
};

function getIconKey(category: string) {
  return CATEGORY_ICONS[category] ?? "sparkles";
}

function getColorKey(category: string) {
  return CATEGORY_COLORS[category] ?? "sage";
}

function formatCurrency(amount: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits,
  }).format(amount);
}

function formatDuration(minutes: number) {
  return `${minutes} min`;
}

function Services() {
  const { data, upsert, remove } = useAppData();

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Services");
  const [statusFilter, setStatusFilter] = useState<"all" | ServiceStatus>(
    "all"
  );
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [formError, setFormError] = useState("");

  const services = data.services;
  const staff = data.staff;

  const categoryOptions = useMemo(() => {
    const categories = new Set([
      ...SERVICE_CATEGORIES,
      ...services.map((service) => service.category),
    ]);

    return ["All Services", ...Array.from(categories).filter(Boolean)];
  }, [services]);

  const formCategories = categoryOptions.filter(
    (category) => category !== "All Services"
  );

  const activeCategoryFilter = categoryOptions.includes(categoryFilter)
    ? categoryFilter
    : "All Services";

  const staffById = useMemo(
    () => new Map(staff.map((member) => [member.id, member])),
    [staff]
  );

  const filteredServices = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return services.filter((service) => {
      const matchesSearch =
        !search || service.name.toLowerCase().includes(search);
      const matchesCategory =
        activeCategoryFilter === "All Services" ||
        service.category === activeCategoryFilter;
      const matchesStatus =
        statusFilter === "all" || service.status === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [services, searchTerm, activeCategoryFilter, statusFilter]);

  const activeCount = services.filter(
    (service) => service.status === "active"
  ).length;

  const categoryCount = new Set(
    services.map((service) => service.category).filter(Boolean)
  ).size;

  const averagePrice =
    services.length > 0
      ? services.reduce((total, service) => total + service.price, 0) /
        services.length
      : 0;

  const mostPopular = services.reduce<Service | null>(
    (best, service) =>
      !best || service.bookings > best.bookings ? service : best,
    null
  );

  const mostPopularName =
    mostPopular && mostPopular.bookings > 0 ? mostPopular.name : "—";

  const mostPopularNote =
    mostPopular && mostPopular.bookings > 0
      ? `${mostPopular.bookings} bookings this month`
      : "No bookings yet";

  const stats = [
    {
      label: "Total Services",
      value: services.length.toLocaleString(),
      note:
        categoryCount > 0
          ? `Across ${categoryCount} ${
              categoryCount === 1 ? "category" : "categories"
            }`
          : "No categories yet",
    },
    {
      label: "Active Services",
      value: activeCount.toLocaleString(),
      note: "Currently bookable",
    },
    {
      label: "Average Price",
      value: formatCurrency(averagePrice, 0),
      note: "Per service",
    },
    {
      label: "Most Popular",
      value: mostPopularName,
      note: mostPopularNote,
    },
  ];

  const getAssignedStaff = (service: Service) =>
    (service.staffIds ?? [])
      .map((id) => staffById.get(id))
      .filter((member): member is StaffMember => Boolean(member));

  const resetForm = () => {
    setFormData({
      ...emptyForm,
      staffIds: [...emptyForm.staffIds],
    });
    setFormError("");
  };

  const openAddModal = () => {
    setEditingService(null);
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (service: Service) => {
    setEditingService(service);

    setFormData({
      name: service.name,
      category: service.category || SERVICE_CATEGORIES[0],
      description: service.description ?? "",
      duration: String(service.duration ?? ""),
      price: String(service.price ?? ""),
      status: service.status,
      staffIds: [...(service.staffIds ?? [])],
    });

    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingService(null);
    resetForm();
  };

  const toggleStaffAssignment = (id: string) => {
    setFormData((current) => ({
      ...current,
      staffIds: current.staffIds.includes(id)
        ? current.staffIds.filter((item) => item !== id)
        : [...current.staffIds, id],
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = formData.name.trim();
    const description = formData.description.trim();
    const category = formData.category.trim();
    const duration = Number(formData.duration);
    const price = Number(formData.price);

    if (!name) {
      setFormError("Please enter a service name.");
      return;
    }

    if (!category) {
      setFormError("Please select a category.");
      return;
    }

    const isDuplicateName = services.some(
      (service) =>
        service.id !== editingService?.id &&
        service.name.trim().toLowerCase() === name.toLowerCase()
    );

    if (isDuplicateName) {
      setFormError("A service with this name already exists.");
      return;
    }

    if (
      formData.duration.trim() === "" ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      !Number.isInteger(duration)
    ) {
      setFormError("Duration must be a positive whole number of minutes.");
      return;
    }

    if (
      formData.price.trim() === "" ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      setFormError("Price must be a valid non-negative amount.");
      return;
    }

    const categoryChanged = editingService?.category !== category;

    const service: Service = {
      id: editingService?.id ?? crypto.randomUUID(),
      name,
      category,
      description,
      duration,
      price,
      bookings: editingService?.bookings ?? 0,
      status: formData.status,
      icon:
        editingService && !categoryChanged
          ? editingService.icon
          : getIconKey(category),
      color:
        editingService && !categoryChanged
          ? editingService.color
          : getColorKey(category),
      staffIds: formData.staffIds.filter((id) => staffById.has(id)),
    };

    upsert("services", service);
    closeModal();
  };

  const handleDelete = (service: Service) => {
    const relatedAppointments = data.appointments.filter((appointment) =>
      getAppointmentServiceIds(appointment).includes(service.id)
    );

    if (relatedAppointments.length > 0) {
      const label =
        relatedAppointments.length === 1 ? "appointment" : "appointments";

      window.alert(
        `${service.name} is used by ${relatedAppointments.length} ${label}. Reassign or remove those appointments first, or mark this service as Inactive instead. Appointment history has not been changed.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${service.name}? This cannot be undone.`
    );

    if (confirmed) {
      remove("services", service.id);
    }
  };

  return (
    <div className="services-page">
      <div className="services-heading">
        <div>
          <h1>Services</h1>
          <p>Manage your salon treatments, pricing and service availability.</p>
        </div>
        <button className="primary-button" onClick={openAddModal}>
          <Plus size={17} /> Add Service
        </button>
      </div>

      <div className="services-stats">
        {stats.map(({ label, value, note }) => (
          <div className="service-stat-card" key={label}>
            <span>{label}</span>
            <h2>{value}</h2>
            <small>{note}</small>
          </div>
        ))}
      </div>

      <section className="services-catalog">
        <div className="services-catalog-heading">
          <div>
            <h2>Service Catalogue</h2>
            <p>All treatments offered by your salon</p>
          </div>
          <div className="services-toolbar">
            <div className="services-search">
              <Search size={17} />
              <input
                placeholder="Search services..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                aria-label="Search services"
              />
            </div>
            <div className="services-filter">
              <Filter size={16} />
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as "all" | ServiceStatus
                  )
                }
                aria-label="Filter services by status"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        <div className="service-categories">
          {categoryOptions.map((category) => (
            <button
              className={`service-category ${
                activeCategoryFilter === category ? "selected" : ""
              }`}
              key={category}
              onClick={() => setCategoryFilter(category)}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="services-table-wrapper">
          <table className="services-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Category</th>
                <th>Duration</th>
                <th>Price</th>
                <th>Bookings</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.length > 0 ? (
                filteredServices.map((service) => {
                  const Icon = SERVICE_ICONS[service.icon] ?? Scissors;
                  const assignedStaff = getAssignedStaff(service);

                  return (
                    <tr key={service.id}>
                      <td>
                        <div className="service-name-cell">
                          <div
                            className={`service-icon ${
                              service.color || getColorKey(service.category)
                            }`}
                          >
                            <Icon size={17} />
                          </div>
                          <div className="service-name-text">
                            <strong>{service.name}</strong>
                            <span className="service-assigned-staff">
                              {assignedStaff.length > 0
                                ? assignedStaff
                                    .map((member) => member.name)
                                    .join(", ")
                                : "Unassigned"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>{service.category}</td>
                      <td>
                        <span className="service-duration">
                          <Clock size={14} />{" "}
                          {formatDuration(service.duration)}
                        </span>
                      </td>
                      <td>
                        <strong className="service-price">
                          {formatCurrency(service.price)}
                        </strong>
                      </td>
                      <td>{service.bookings ?? 0}</td>
                      <td>
                        <span className={`service-status ${service.status}`}>
                          <span />
                          {STATUS_LABELS[service.status] ?? service.status}
                        </span>
                      </td>
                      <td>
                        <div className="service-actions">
                          <button
                            className="icon-button"
                            aria-label={`Edit ${service.name}`}
                            title="Edit service"
                            onClick={() => openEditModal(service)}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Delete ${service.name}`}
                            title="Delete service"
                            onClick={() => handleDelete(service)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="services-empty">
                    <div>
                      <Scissors size={26} />
                      <h3>
                        {services.length === 0
                          ? "No services yet"
                          : "No services found"}
                      </h3>
                      <p>
                        {services.length === 0
                          ? "Add your first service to start building your catalogue."
                          : "Try a different search, category or status filter."}
                      </p>
                      {services.length === 0 && (
                        <button
                          className="primary-button"
                          onClick={openAddModal}
                        >
                          <Plus size={17} /> Add Service
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
                <h2>{editingService ? "Edit Service" : "Add Service"}</h2>
                <p>
                  {editingService
                    ? "Update service details, pricing and availability."
                    : "Add a new treatment to your salon catalogue."}
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
                  Service Details
                </h3>

                <div className="customer-form-grid">
                  <div className="customer-form-group customer-form-full">
                    <label htmlFor="service-name">Service Name</label>
                    <input
                      id="service-name"
                      type="text"
                      placeholder="e.g. Women's Haircut"
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

                  <div className="customer-form-group">
                    <label htmlFor="service-category">Category</label>
                    <select
                      id="service-category"
                      value={formData.category}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          category: event.target.value,
                        })
                      }
                    >
                      {formCategories.map((category) => (
                        <option value={category} key={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="customer-form-group">
                    <label htmlFor="service-status">Status</label>
                    <select
                      id="service-status"
                      value={formData.status}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          status: event.target.value as ServiceStatus,
                        })
                      }
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  <div className="customer-form-group customer-form-full">
                    <label htmlFor="service-description">Description</label>
                    <textarea
                      id="service-description"
                      placeholder="Describe the treatment and what clients can expect."
                      value={formData.description}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          description: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="customer-form-group">
                    <label htmlFor="service-duration">
                      Duration (minutes)
                    </label>
                    <input
                      id="service-duration"
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      placeholder="e.g. 45"
                      value={formData.duration}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          duration: event.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="customer-form-group">
                    <label htmlFor="service-price">Price (EUR)</label>
                    <input
                      id="service-price"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="e.g. 45"
                      value={formData.price}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          price: event.target.value,
                        })
                      }
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="customer-form-section">
                <h3 className="customer-form-section-title">
                  Team Assignment
                </h3>

                <div className="customer-form-grid">
                  <div className="customer-form-group customer-form-full">
                    <label>Assigned Staff</label>

                    {staff.length === 0 ? (
                      <p className="customer-form-hint">
                        No team members available. Add staff members before
                        assigning them to services.
                      </p>
                    ) : (
                      <div className="service-staff-options">
                        {staff.map((member) => (
                          <label
                            key={member.id}
                            className={`service-staff-option ${
                              formData.staffIds.includes(member.id)
                                ? "selected"
                                : ""
                            }`}
                            title={`${member.name} · ${member.role}`}
                          >
                            <input
                              type="checkbox"
                              checked={formData.staffIds.includes(member.id)}
                              onChange={() =>
                                toggleStaffAssignment(member.id)
                              }
                            />
                            {member.name}
                          </label>
                        ))}
                      </div>
                    )}

                    <p className="customer-form-hint">
                      Optional. Select one or more team members.
                    </p>
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
                  {editingService ? "Save Changes" : "Add Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Services;
