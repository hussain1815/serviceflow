import {
  LayoutDashboard,
  CalendarDays,
  Users,
  UserRound,
  Scissors,
  ChartNoAxesCombined,
  Search,
  Bell,
  Plus,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { Settings as SettingsIcon } from "lucide-react";
import {
  BrowserRouter,
  NavLink,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import "./App.css";
import Dashboard from "./pages/Dashboard";
import Appointments from "./pages/Appointments";
import Customers from "./pages/Customers";
import Staff from "./pages/Staff";
import Services from "./pages/Services";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/Settings";
import { useAppData } from "./context/useAppData";
const navigation = [
  { label: "Overview", icon: LayoutDashboard, path: "/" },
  { label: "Appointments", icon: CalendarDays, path: "/appointments" },
  { label: "Customers", icon: Users, path: "/customers" },
  { label: "Staff", icon: UserRound, path: "/staff" },
  { label: "Services", icon: Scissors, path: "/services" },
  { label: "Reports", icon: ChartNoAxesCombined, path: "/reports" },
];

function App() {
  const { settings } = useAppData();
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
    .format(new Date())
    .toUpperCase();
  const businessInitial =
    settings.businessName.trim().charAt(0).toUpperCase() || "B";

  return (
    <BrowserRouter>
      <div className="app-container">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-icon">
              <Scissors size={21} />
            </div>
            <span>ServiceFlow</span>
          </div>

          <div className="business-profile">
            <div className="business-avatar">{businessInitial}</div>
            <div>
              <strong>{settings.businessName || "Business workspace"}</strong>
              <span>Business workspace</span>
            </div>
            <ChevronDown size={16} />
          </div>

          <div className="nav-label">WORKSPACE</div>

          <nav className="navigation">
            {navigation.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  to={item.path}
                  key={item.label}
                  end={item.path === "/"}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? "active" : ""}`
                  }
                >
                  <Icon size={19} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="sidebar-bottom">
            <NavLink to="/ai-assistant" className="nav-item">
              <Sparkles size={19} />
              <span>AI Assistant</span>
            </NavLink>

            <NavLink to="/settings" className="nav-item">
              <SettingsIcon size={19} />
              <span>Settings</span>
            </NavLink>

            <div className="user-profile">
              <div className="user-avatar">HS</div>
              <div>
                <strong>Hussain Sajid</strong>
                <span>Administrator</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="main-content">
          <header className="topbar">
            <div className="breadcrumb">Workspace / Overview</div>

            <div className="topbar-actions">
              <button className="icon-button" aria-label="Search">
                <Search size={19} />
              </button>

              <button className="icon-button" aria-label="Notifications">
                <Bell size={19} />
              </button>

              <button className="add-button">
                <Plus size={18} />
                New appointment
              </button>
            </div>
          </header>

          <Routes>
            <Route
              path="/"
              element={
                <section className="dashboard-content">
                  {/* Keep your existing welcome-section here */}
                  <div className="welcome-section">
                    <div>
                      <p className="date-label">{dateLabel}</p>
                      <h1>Good morning, Hussain 👋</h1>
                      <p className="welcome-description">
                        Here's what's happening at your salon today.
                      </p>
                    </div>
                  </div>

                  <Dashboard />
                </section>
              }
            />

            <Route path="/appointments" element={<Appointments />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/services" element={<Services />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
