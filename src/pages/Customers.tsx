
import { useMemo, useState, type FormEvent } from "react";
import {
  Users,
  UserPlus,
  UserCheck,
  Search,
  Plus,
  Mail,
  Phone,
  ArrowUpRight,
  Filter,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import { useAppData } from "../context/useAppData";
import type { Customer, CustomerStatus } from "../types";

const customerMetrics = [
  {
    title: "Total Customers",
    value: "1,284",
    change: "+12.5%",
    icon: Users,
  },
  {
    title: "New Customers",
    value: "86",
    change: "+8.2%",
    icon: UserPlus,
  },
  {
    title: "Returning Customers",
    value: "78%",
    change: "+5.4%",
    icon: UserCheck,
  },
];

const NO_VISIT_LABEL = "No visits yet";

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  status: "New" as CustomerStatus,
  visits: "0",
  spent: "0",
  lastVisit: "",
};

function getTodayInputValue() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${today.getFullYear()}-${month}-${day}`;
}

function parseLastVisit(value: string): Date | null {
  const trimmed = value.trim();

  if (!trimmed || trimmed === NO_VISIT_LABEL) {
    return null;
  }

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);

  if (isoMatch) {
    const date = new Date(
      Number(isoMatch[1]),
      Number(isoMatch[2]) - 1,
      Number(isoMatch[3])
    );

    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(trimmed);

  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateInputValue(value: string) {
  const date = parseLastVisit(value);

  if (!date) {
    return "";
  }

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

function formatLastVisit(value: string) {
  const trimmed = value.trim();

  if (!trimmed || trimmed === NO_VISIT_LABEL) {
    return NO_VISIT_LABEL;
  }

  const date = parseLastVisit(trimmed);

  if (!date) {
    return trimmed;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function Customers() {
  const { data, upsert, remove } = useAppData();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(
    null
  );
  const [formData, setFormData] = useState(emptyForm);
  const [formError, setFormError] = useState("");

  const customers = data.customers;

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const search = searchTerm.toLowerCase();

      const matchesSearch =
        customer.name.toLowerCase().includes(search) ||
        customer.email.toLowerCase().includes(search) ||
        customer.phone.toLowerCase().includes(search);

      const matchesStatus =
        statusFilter === "All" || customer.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [customers, searchTerm, statusFilter]);

  const openAddModal = () => {
    setEditingCustomer(null);
    setFormData(emptyForm);
    setFormError("");
    setShowModal(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);

    setFormData({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      status: customer.status,
      visits: String(customer.visits ?? 0),
      spent: String(customer.spent ?? 0),
      lastVisit: toDateInputValue(customer.lastVisit),
    });

    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
    setFormData(emptyForm);
    setFormError("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const visits =
      formData.visits.trim() === "" ? 0 : Number(formData.visits);
    const spent =
      formData.spent.trim() === "" ? 0 : Number(formData.spent);

    if (!Number.isFinite(visits) || visits < 0 || !Number.isInteger(visits)) {
      setFormError("Total visits must be a whole number of 0 or more.");
      return;
    }

    if (!Number.isFinite(spent) || spent < 0) {
      setFormError("Total spent must be 0 or a positive amount.");
      return;
    }

    if (formData.lastVisit && formData.lastVisit > getTodayInputValue()) {
      setFormError("Last visit cannot be in the future.");
      return;
    }

    const initials = formData.name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    const customer: Customer = {
      id: editingCustomer?.id ?? crypto.randomUUID(),
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      visits,
      spent,
      lastVisit: formData.lastVisit,
      initials,
      status: formData.status,
    };

    upsert("customers", customer);
    closeModal();
  };

  const handleDelete = (customer: Customer) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${customer.name}?`
    );

    if (confirmed) {
      remove("customers", customer.id);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <section className="customers-page">
      <div className="customers-heading">
        <div>
          <h1>Customers</h1>
          <p>Manage relationships and keep track of your clients.</p>
        </div>

        <button className="add-button" onClick={openAddModal}>
          <Plus size={18} />
          Add Customer
        </button>
      </div>

      {/* Customer metrics */}

      <div className="customer-metrics">
        {customerMetrics.map((metric, index) => {
          const Icon = metric.icon;

          const value =
            index === 0
              ? customers.length.toLocaleString()
              : metric.value;

          return (
            <article className="customer-metric-card" key={metric.title}>
              <div className="customer-metric-top">
                <span>{metric.title}</span>
                <div className="metric-icon">
                  <Icon size={19} />
                </div>
              </div>

              <h2>{value}</h2>

              <span className="positive-change">
                <ArrowUpRight size={14} />
                {metric.change}
                <span className="metric-caption"> this month</span>
              </span>
            </article>
          );
        })}
      </div>

      {/* Customer directory */}

      <div className="customer-directory">
        <div className="directory-heading">
          <div>
            <h3>All Customers</h3>
            <p>Manage your salon customer directory.</p>
          </div>

          <span className="customer-count">
            {customers.length} customers
          </span>
        </div>

        <div className="customer-toolbar">
          <div className="customer-search">
            <Search size={17} />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <div className="customer-filter">
            <Filter size={16} />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter customers by status"
            >
              <option value="All">All statuses</option>
              <option value="Regular">Regular</option>
              <option value="New">New</option>
              <option value="VIP">VIP</option>
            </select>
          </div>
        </div>

        <div className="customer-table-wrapper">
          <table className="customer-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact</th>
                <th>Visits</th>
                <th>Total Spent</th>
                <th>Last Visit</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <div className="customer-cell">
                        <div className="customer-avatar">
                          {customer.initials}
                        </div>
                        <strong>{customer.name}</strong>
                      </div>
                    </td>

                    <td>
                      <div className="contact-cell">
                        <span>
                          <Mail size={13} />
                          {customer.email}
                        </span>
                        <span>
                          <Phone size={13} />
                          {customer.phone}
                        </span>
                      </div>
                    </td>

                    <td>{customer.visits}</td>

                    <td>
                      <strong>{formatCurrency(customer.spent)}</strong>
                    </td>

                    <td>{formatLastVisit(customer.lastVisit)}</td>

                    <td>
                      <span
                        className={`customer-status status-${customer.status.toLowerCase()}`}
                      >
                        {customer.status}
                      </span>
                    </td>

                    <td>
                      <div className="customer-actions">
                        <button
                          className="more-button"
                          aria-label={`Edit ${customer.name}`}
                          title="Edit customer"
                          onClick={() => openEditModal(customer)}
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          className="more-button"
                          aria-label={`Delete ${customer.name}`}
                          title="Delete customer"
                          onClick={() => handleDelete(customer)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="customer-empty">
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Customer Modal */}

      {showModal && (
        <div
          className="customer-modal-overlay"
          onClick={closeModal}
        >
          <div
            className="customer-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="customer-modal-header">
              <div>
                <h2>
                  {editingCustomer ? "Edit Customer" : "Add Customer"}
                </h2>
                <p>
                  {editingCustomer
                    ? "Update customer information."
                    : "Add a new customer to your salon directory."}
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
                    <label htmlFor="customer-name">Full Name</label>
                    <input
                      id="customer-name"
                      type="text"
                      placeholder="e.g. Sophia Miller"
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
                    <label htmlFor="customer-email">Email Address</label>
                    <input
                      id="customer-email"
                      type="email"
                      placeholder="customer@email.com"
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
                    <label htmlFor="customer-phone">Phone Number</label>
                    <input
                      id="customer-phone"
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
                    <label htmlFor="customer-status">Customer Status</label>
                    <select
                      id="customer-status"
                      value={formData.status}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          status: event.target.value as CustomerStatus,
                        })
                      }
                    >
                      <option value="New">New</option>
                      <option value="Regular">Regular</option>
                      <option value="VIP">VIP</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="customer-form-section">
                <h3 className="customer-form-section-title">
                  Customer History
                </h3>

                <div className="customer-form-grid">
                  <div className="customer-form-group">
                    <label htmlFor="customer-visits">Total Visits</label>
                    <input
                      id="customer-visits"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      placeholder="0"
                      value={formData.visits}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          visits: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="customer-form-group">
                    <label htmlFor="customer-spent">Total Spent (EUR)</label>
                    <input
                      id="customer-spent"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={formData.spent}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          spent: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="customer-form-group customer-form-full">
                    <label htmlFor="customer-last-visit">Last Visit</label>
                    <input
                      id="customer-last-visit"
                      type="date"
                      max={getTodayInputValue()}
                      value={formData.lastVisit}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          lastVisit: event.target.value,
                        })
                      }
                    />
                    <p className="customer-form-hint">
                      Leave empty if the customer has not visited yet.
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

                <button type="submit" className="add-button">
                  {editingCustomer ? "Save Changes" : "Add Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

export default Customers;
