export type Doctor = {
  id: string;
  consultorio_id: string;
  nombre: string;
  titulo: string | null;
  especialidad: string | null;
  foto_url: string | null;
  activo: boolean;
  created_at: string;
};

export type Horario = {
  id: string;
  doctor_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  duracion_cita: number;
};

export type HorarioDia = {
  enabled: boolean;
  hora_inicio: string; // "HH:MM"
  hora_fin: string;
  duracion_cita: number;
};

export const DIAS_SEMANA = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
] as const;

export const DURACIONES_CITA = [15, 20, 30, 45, 60, 90] as const;

export const DEFAULT_HORARIO_DIA: HorarioDia = {
  enabled: false,
  hora_inicio: "08:00",
  hora_fin: "17:00",
  duracion_cita: 30,
};
