export type EstadoCita =
  | "programada"
  | "confirmada"
  | "cancelada"
  | "atendida"
  | "no_asistio"
  | "bloqueada";

export type Cita = {
  id: string;
  consultorio_id: string;
  doctor_id: string;
  paciente_id: string;
  inicio: string;    // timestamptz — ISO 8601 con offset
  fin: string;       // timestamptz — ISO 8601 con offset
  estado: EstadoCita;
  motivo: string | null;
  creado_por: string;
  creado_en: string;
};

export type CitaConRel = Cita & {
  doctores: { id: string; nombre: string };
  pacientes: {
    id: string;
    nombre: string;
    telefono: string | null;
    cedula: string | null;
    email: string | null;
  } | null;
};

export type DoctorBasic = {
  id: string;
  nombre: string;
  especialidad: string | null;
  activo: boolean;
};

export type PacienteBasic = {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  cedula: string | null;
};

export const ESTADO_CONFIG: Record<
  EstadoCita,
  { label: string; bg: string; text: string; border: string }
> = {
  programada: {
    label: "Programada",
    bg: "bg-blue-50",
    text: "text-blue-800",
    border: "border-blue-200",
  },
  confirmada: {
    label: "Confirmada",
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-emerald-200",
  },
  cancelada: {
    label: "Cancelada",
    bg: "bg-gray-100",
    text: "text-gray-400",
    border: "border-gray-200",
  },
  atendida: {
    label: "Atendida",
    bg: "bg-purple-50",
    text: "text-purple-800",
    border: "border-purple-200",
  },
  no_asistio: {
    label: "No asistió",
    bg: "bg-red-50",
    text: "text-red-800",
    border: "border-red-200",
  },
  bloqueada: {
    label: "Bloqueado",
    bg: "bg-gray-100",
    text: "text-gray-500",
    border: "border-gray-300",
  },
};

export const TODOS_LOS_ESTADOS: EstadoCita[] = [
  "programada",
  "confirmada",
  "cancelada",
  "atendida",
  "no_asistio",
  "bloqueada",
];
