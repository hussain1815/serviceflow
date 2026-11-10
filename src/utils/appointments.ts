import type {
  Appointment,
  AppointmentStaffAssignment,
  Service,
} from "../types";

export type AppointmentWithOptionalServices = Omit<
  Appointment,
  "serviceIds"
> & {
  serviceIds?: string[];
  serviceId?: string;
};

export interface AppointmentServiceSlot {
  serviceId: string;
  staffId: string;
  startOffset: number;
  duration: number;
}

type AppointmentStaffShape = {
  serviceIds?: string[];
  serviceId?: string;
  staffId?: string;
  staffAssignments?: AppointmentStaffAssignment[];
};

export function getAppointmentServiceIds(appointment: {
  serviceIds?: string[];
  serviceId?: string;
}): string[] {
  const serviceIds = Array.isArray(appointment.serviceIds)
    ? appointment.serviceIds.filter(
        (id): id is string =>
          typeof id === "string" && id.trim().length > 0
      )
    : [];

  if (serviceIds.length > 0) {
    return Array.from(new Set(serviceIds));
  }

  return appointment.serviceId ? [appointment.serviceId] : [];
}

export function getAppointmentStaffAssignments(
  appointment: AppointmentStaffShape
): AppointmentStaffAssignment[] {
  const serviceIds = getAppointmentServiceIds(appointment);
  const assignmentByService = new Map<string, string>();

  if (Array.isArray(appointment.staffAssignments)) {
    for (const entry of appointment.staffAssignments) {
      if (
        entry &&
        typeof entry.serviceId === "string" &&
        typeof entry.staffId === "string" &&
        entry.staffId.trim().length > 0 &&
        !assignmentByService.has(entry.serviceId)
      ) {
        assignmentByService.set(entry.serviceId, entry.staffId);
      }
    }
  }

  const fallbackStaffId =
    typeof appointment.staffId === "string" ? appointment.staffId : "";

  return serviceIds.map((serviceId) => ({
    serviceId,
    staffId: assignmentByService.get(serviceId) ?? fallbackStaffId,
  }));
}

export function getAppointmentStaffIds(
  appointment: AppointmentStaffShape
): string[] {
  return Array.from(
    new Set(
      getAppointmentStaffAssignments(appointment)
        .map((assignment) => assignment.staffId)
        .filter((staffId) => staffId.length > 0)
    )
  );
}

export function normalizeAppointment(
  appointment: AppointmentWithOptionalServices
): Appointment {
  const serviceIds = getAppointmentServiceIds(appointment);
  const staffAssignments = getAppointmentStaffAssignments({
    ...appointment,
    serviceIds,
  });
  const primaryStaffId =
    (typeof appointment.staffId === "string" && appointment.staffId) ||
    staffAssignments.find((assignment) => assignment.staffId)?.staffId ||
    "";

  return {
    ...appointment,
    serviceIds,
    serviceId: serviceIds[0],
    staffId: primaryStaffId,
    staffAssignments,
  };
}

export function getAppointmentServices(
  appointment: Appointment,
  serviceById: Map<string, Service>
): Service[] {
  return getAppointmentServiceIds(appointment)
    .map((serviceId) => serviceById.get(serviceId))
    .filter((service): service is Service => Boolean(service));
}

export function getAppointmentServiceSlots(
  appointment: Appointment,
  serviceById: Map<string, Service>
): AppointmentServiceSlot[] {
  const staffByService = new Map(
    getAppointmentStaffAssignments(appointment).map((assignment) => [
      assignment.serviceId,
      assignment.staffId,
    ])
  );
  const slots: AppointmentServiceSlot[] = [];
  let startOffset = 0;

  for (const serviceId of getAppointmentServiceIds(appointment)) {
    const service = serviceById.get(serviceId);
    const duration = service ? service.duration : 0;

    if (
      !Number.isFinite(duration) ||
      !Number.isInteger(duration) ||
      duration <= 0
    ) {
      continue;
    }

    slots.push({
      serviceId,
      staffId: staffByService.get(serviceId) ?? appointment.staffId,
      startOffset,
      duration,
    });
    startOffset += duration;
  }

  return slots;
}

export function getAppointmentDuration(
  appointment: Appointment,
  serviceById: Map<string, Service>
): number {
  return getAppointmentServiceSlots(appointment, serviceById).reduce(
    (total, slot) => total + slot.duration,
    0
  );
}
