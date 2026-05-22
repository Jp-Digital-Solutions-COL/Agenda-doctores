"use client";

import { useEffect, useState } from "react";
import { getHorarios, saveHorarios } from "./actions";
import {
  DIAS_SEMANA,
  DURACIONES_CITA,
  DEFAULT_HORARIO_DIA,
  type Doctor,
  type HorarioDia,
} from "./types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  doctor: Doctor | null;
  onClose: () => void;
}

function buildInitialForm(
  horarios: Awaited<ReturnType<typeof getHorarios>>
): Record<number, HorarioDia> {
  const form: Record<number, HorarioDia> = {};
  for (let day = 0; day <= 6; day++) {
    const h = horarios.find((x) => x.dia_semana === day);
    form[day] = h
      ? {
          enabled: true,
          // Supabase devuelve "HH:MM:SS", el input type="time" espera "HH:MM"
          hora_inicio: h.hora_inicio.slice(0, 5),
          hora_fin: h.hora_fin.slice(0, 5),
          duracion_cita: h.duracion_cita,
        }
      : { ...DEFAULT_HORARIO_DIA };
  }
  return form;
}

export default function HorariosSheet({ doctor, onClose }: Props) {
  const [form, setForm] = useState<Record<number, HorarioDia>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!doctor) {
      setForm({});
      return;
    }
    setLoading(true);
    setError("");
    getHorarios(doctor.id)
      .then((data) => setForm(buildInitialForm(data)))
      .finally(() => setLoading(false));
  }, [doctor?.id]);

  function updateDia(day: number, patch: Partial<HorarioDia>) {
    setForm((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  }

  async function handleSave() {
    if (!doctor) return;
    setSaving(true);
    setError("");
    const result = await saveHorarios(doctor.id, form);
    if (result.error) {
      setError(result.error);
      setSaving(false);
    } else {
      onClose();
    }
  }

  return (
    <Sheet open={!!doctor} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col gap-0 overflow-hidden">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle>Horarios de atención</SheetTitle>
          <SheetDescription>{doctor?.nombre}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {loading ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              Cargando horarios...
            </p>
          ) : (
            DIAS_SEMANA.map((dia) => {
              const d = form[dia.value] ?? DEFAULT_HORARIO_DIA;
              return (
                <div
                  key={dia.value}
                  className="rounded-lg border px-4 py-3 transition-opacity"
                  style={{ opacity: d.enabled ? 1 : 0.5 }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{dia.label}</span>
                    <Switch
                      checked={d.enabled}
                      onCheckedChange={(checked) =>
                        updateDia(dia.value, { enabled: checked })
                      }
                    />
                  </div>

                  {d.enabled && (
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Hora inicio
                        </Label>
                        <input
                          type="time"
                          value={d.hora_inicio}
                          onChange={(e) =>
                            updateDia(dia.value, {
                              hora_inicio: e.target.value,
                            })
                          }
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Hora fin
                        </Label>
                        <input
                          type="time"
                          value={d.hora_fin}
                          onChange={(e) =>
                            updateDia(dia.value, { hora_fin: e.target.value })
                          }
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Duración de cita
                        </Label>
                        <Select
                          value={String(d.duracion_cita)}
                          onValueChange={(v) =>
                            updateDia(dia.value, {
                              duracion_cita: Number(v),
                            })
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DURACIONES_CITA.map((min) => (
                              <SelectItem key={min} value={String(min)}>
                                {min} min
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="border-t pt-4 space-y-3">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={saving || loading}
            >
              {saving ? "Guardando..." : "Guardar horarios"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
