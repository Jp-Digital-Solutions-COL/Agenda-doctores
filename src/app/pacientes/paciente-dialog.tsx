"use client";

import { useState } from "react";
import { createPaciente, updatePaciente } from "./actions";
import type { Paciente, PacienteFields } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  paciente: Paciente | null; // null = nuevo
}

const EMPTY: PacienteFields = { nombre: "", telefono: "", email: "", notas: "" };

function fromPaciente(p: Paciente): PacienteFields {
  return {
    nombre: p.nombre,
    telefono: p.telefono ?? "",
    email: p.email ?? "",
    notas: p.notas ?? "",
  };
}

// key en el padre fuerza re-mount → form limpio al cambiar paciente
export default function PacienteDialog({ open, onClose, paciente }: Props) {
  const [fields, setFields] = useState<PacienteFields>(
    paciente ? fromPaciente(paciente) : EMPTY
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(key: keyof PacienteFields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = paciente
      ? await updatePaciente(paciente.id, fields)
      : await createPaciente(fields);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {paciente ? "Editar paciente" : "Agregar paciente"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Nombre */}
          <div className="space-y-2">
            <Label htmlFor="nombre">
              Nombre completo <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nombre"
              value={fields.nombre}
              onChange={(e) => set("nombre", e.target.value)}
              placeholder="María González"
              required
              disabled={loading}
              autoFocus
            />
          </div>

          {/* Teléfono + Email en fila */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                type="tel"
                value={fields.telefono}
                onChange={(e) => set("telefono", e.target.value)}
                placeholder="555-123-4567"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                value={fields.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="paciente@ejemplo.com"
                disabled={loading}
              />
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notas">
              Notas{" "}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </Label>
            <Textarea
              id="notas"
              value={fields.notas}
              onChange={(e) => set("notas", e.target.value)}
              placeholder="Alergias, antecedentes, observaciones..."
              rows={3}
              disabled={loading}
              className="resize-none"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              type="button"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !fields.nombre.trim()}
            >
              {loading
                ? "Guardando..."
                : paciente
                  ? "Guardar cambios"
                  : "Agregar paciente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
