"use client";

import { useState } from "react";
import { createDoctor, updateDoctor } from "./actions";
import type { Doctor } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  doctor: Doctor | null; // null = nuevo doctor
}

// La key en el padre resetea el estado cuando cambia el doctor
export default function DoctorDialog({ open, onClose, doctor }: Props) {
  const [nombre, setNombre] = useState(doctor?.nombre ?? "");
  const [especialidad, setEspecialidad] = useState(
    doctor?.especialidad ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = doctor
      ? await updateDoctor(doctor.id, nombre, especialidad)
      : await createDoctor(nombre, especialidad);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {doctor ? "Editar doctor" : "Agregar doctor"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre completo</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Dr. Juan García"
              required
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="especialidad">
              Especialidad{" "}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </Label>
            <Input
              id="especialidad"
              value={especialidad}
              onChange={(e) => setEspecialidad(e.target.value)}
              placeholder="Medicina general"
              disabled={loading}
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
            <Button type="submit" disabled={loading || !nombre.trim()}>
              {loading
                ? "Guardando..."
                : doctor
                  ? "Guardar cambios"
                  : "Agregar doctor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
