
export type AppointmentStatus =
  | "confirmed"
  | "pending"
  | "completed"
  | "cancelled";


export type StaffStatus = "available" | "busy" | "off";

export type WorkingDay =
  | "Mon"
  | "Tue"
  | "Wed"
  | "Thu"
  | "Fri"
  | "Sat"
  | "Sun";

export type ServiceStatus = "active" | "inactive";


export type CustomerStatus = "Regular" | "New" | "VIP";

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  visits: number;
  spent: number;
  lastVisit: string;
  initials: string;
  status: CustomerStatus;
}


export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  initials: string;
  color: string;
  bookings: number;
  revenue: number;
  rating: number;
  status: StaffStatus;
  workingDays: WorkingDay[];
  startTime: string;
  endTime: string;
}

export interface Service {
  id: string;
  name: string;
  category: string;
  description: string;
  duration: number;
  price: number;
  bookings: number;
  status: ServiceStatus;
  icon: string;
  color: string;
  staffIds: string[];
}

export interface AppointmentStaffAssignment {
  serviceId: string;
  staffId: string;
}

export interface Appointment {
  id: string;
  date: string;
  time: string;
  customerId: string;
  staffId: string;
  serviceIds: string[];
  serviceId?: string;
  staffAssignments?: AppointmentStaffAssignment[];
  price: number;
  status: AppointmentStatus;
  notes?: string;
}

export type AppLanguage = "en" | "de" | "fr" | "es" | "nl" | "it";

export type CurrencyCode = "EUR" | "GBP" | "USD" | "CHF";

export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";

export type TimeFormat = "12h" | "24h";

export interface BusinessHoursDay {
  day: WorkingDay;
  enabled: boolean;
  open: string;
  close: string;
}

export interface AppSettings {
  businessName: string;
  businessEmail: string;
  phone: string;
  website: string;
  address: string;
  country: string;
  currency: CurrencyCode;
  timezone: string;
  language: AppLanguage;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  appointmentReminders: boolean;
  emailNotifications: boolean;
  businessHours: BusinessHoursDay[];
}

export interface AppData {
  customers: Customer[];
  staff: StaffMember[];
  services: Service[];
  appointments: Appointment[];
}
