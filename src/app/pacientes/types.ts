export type Paciente = {
  id: string;
  consultorio_id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  notas: string | null;
  created_at: string;
};

export type PacienteFields = {
  nombre: string;
  telefono: string;
  email: string;
  notas: string;
};
