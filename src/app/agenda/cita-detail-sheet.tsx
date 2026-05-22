"use client";

import { useEffect, useState } from "react";
import { updateEstado, reagendar, deleteCita, getHorasDisponibles } from "./actions";
import type { CitaConRel, EstadoCita } from "./types";
import { ESTADO_CONFIG } from "./types";
import { durationMinutes, formatTime, toDateStr } from "./utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  CalendarDays,
  Clock,
  Stethoscope,
  MessageCircle,
  Trash2,
  User,
  ChevronDown,
} from "lucide-react";

const DURATION_OPTIONS = [15, 20, 30, 45, 60, 90, 120];

function normalizarTelefono(tel: string): string {
  const digits = tel.replace(/\D/g, "");
  return digits.startsWith("57") ? digits : "57" + digits;
}

function urlRecordatorio(tel: string, paciente: string, doctor: string, fecha: string, hora: string) {
  const msg =
    `Hola ${paciente}, le recordamos que tiene una cita con el Dr. ${doctor} ` +
    `el ${fecha} a las ${hora}. ¿Puede confirmarnos su asistencia? Gracias.`;
  return `https://wa.me/${normalizarTelefono(tel)}?text=${encodeURIComponent(msg)}`;
}

function urlChat(tel: string) {
  return `https://wa.me/${normalizarTelefono(tel)}`;
}

type Action = "" | "confirmar" | "cancelar" | "reagendar";

interface Props {
  cita: CitaConRel | null;
  onClose: () => void;
  onUpdate: () => Promise<void>;
}

export default function CitaDetailSheet({ cita, onClose, onUpdate }: Props) {
  const [estado, setEstado] = useState<EstadoCita>("programada");
  const [action, setAction] = useState<Action>("");
  const [saving, setSaving] = useState(false);

  // Reagendar form
  const [reschedFecha, setReschedFecha] = useState("");
  const [reschedHora, setReschedHora] = useState("");
  const [reschedDur, setReschedDur] = useState(30);
  const [reschedSlots, setReschedSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savingDelete, setSavingDelete] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    if (!cita) return;
    setEstado(cita.estado);
    setAction("");
    setError("");
    setConfirmDelete(false);
    setReschedFecha(toDateStr(new Date(cita.inicio)));
    setReschedHora("");
    setReschedDur(durationMinutes(cita.inicio, cita.fin));
    setReschedSlots([]);
  }, [cita?.id]);

  // Load slots when date changes in reagendar mode
  useEffect(() => {
    if (action !== "reagendar" || !cita || !reschedFecha) return;
    setLoadingSlots(true);
    setReschedHora("");
    const [y, mo, d] = reschedFecha.split("-").map(Number);
    getHorasDisponibles(cita.doctor_id, reschedFecha, new Date(y, mo - 1, d).toISOString(), cita.id).then(
      ({ slots }) => { setReschedSlots(slots); setLoadingSlots(false); }
    );
  }, [reschedFecha, action, cita?.doctor_id, cita?.id]);

  async function handleAction(val: Action) {
    setAction(val);
    setError("");
    if (val === "confirmar" || val === "cancelar") {
      const nuevoEstado: EstadoCita = val === "confirmar" ? "confirmada" : "cancelada";
      setSaving(true);
      const r = await updateEstado(cita!.id, nuevoEstado);
      setSaving(false);
      if (r.error) { setError(r.error); setAction(""); }
      else { setEstado(nuevoEstado); setAction(""); await onUpdate(); }
    }
  }

  async function handleReagendar() {
    if (!cita || !reschedFecha || !reschedHora) return;
    setSaving(true);
    setError("");
    const [ry, rm, rd] = reschedFecha.split("-").map(Number);
    const [rh, rmin] = reschedHora.split(":").map(Number);
    const newStart = new Date(ry, rm - 1, rd, rh, rmin);
    const r = await reagendar(cita.id, newStart.toISOString(), new Date(newStart.getTime() + reschedDur * 60000).toISOString());
    setSaving(false);
    if (r.error) { setError(r.error); }
    else { await onUpdate(); onClose(); }
  }

  async function handleDelete() {
    if (!cita) return;
    setSavingDelete(true);
    const r = await deleteCita(cita.id);
    if (r.error) { setError(r.error); setSavingDelete(false); }
    else { await onUpdate(); onClose(); }
  }

  if (!cita) return null;

  const dt = new Date(cita.inicio);
  const endDt = new Date(cita.fin);
  const dur = durationMinutes(cita.inicio, cita.fin);
  const ec = ESTADO_CONFIG[estado];
  const isBloqueada = cita.estado === "bloqueada";
  const tel = cita.pacientes?.telefono ?? null;

  const dateLabel = new Intl.DateTimeFormat("es-CO", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(dt);

  return (
    <Sheet open={!!cita} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0 overflow-hidden">

        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-base leading-tight">
                {isBloqueada ? "Horario bloqueado" : (cita.pacientes?.nombre ?? "Cita")}
              </SheetTitle>
              {!isBloqueada && cita.pacientes && (
                <SheetDescription className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  {cita.pacientes.cedula && (
                    <span className="text-xs">CC {cita.pacientes.cedula}</span>
                  )}
                  {tel && <span className="text-xs">{tel}</span>}
                  {cita.pacientes.email && (
                    <span className="text-xs">{cita.pacientes.email}</span>
                  )}
                </SheetDescription>
              )}
            </div>
            <Badge variant="outline" className={`${ec.bg} ${ec.text} ${ec.border} shrink-0 mt-0.5`}>
              {ec.label}
            </Badge>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Info */}
          <div className="px-6 py-4 space-y-3 border-b">
            <div className="flex items-center gap-3 text-sm">
              <Stethoscope className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium">{cita.doctores.nombre}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="capitalize">{dateLabel}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>
                {formatTime(dt)} – {formatTime(endDt)}
                <span className="text-muted-foreground ml-1.5">({dur} min)</span>
              </span>
            </div>
            {cita.motivo && (
              <p className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                {cita.motivo}
              </p>
            )}
          </div>

          {/* WhatsApp — solo citas con paciente y teléfono */}
          {!isBloqueada && (
            <div className="px-6 py-4 border-b space-y-2">
              {tel ? (
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={urlRecordatorio(tel, cita.pacientes!.nombre, cita.doctores.nombre, dateLabel, formatTime(dt))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" }) +
                      " gap-1.5 text-green-700 border-green-600/40 hover:bg-green-50 hover:text-green-800 justify-center"}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Recordatorio
                  </a>
                  <a
                    href={urlChat(tel)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" }) +
                      " gap-1.5 text-green-700 border-green-600/40 hover:bg-green-50 hover:text-green-800 justify-center"}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Escribir
                  </a>
                </div>
              ) : (
                <button disabled className={buttonVariants({ variant: "outline", size: "sm" }) + " w-full gap-2 opacity-40 cursor-not-allowed"}>
                  <MessageCircle className="h-4 w-4" />
                  Sin teléfono registrado
                </button>
              )}
            </div>
          )}

          {/* Acciones */}
          {!isBloqueada && (
            <div className="px-6 py-4 border-b space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Acción
                </Label>
                <Select
                  value={action}
                  onValueChange={(v) => v && handleAction(v as Action)}
                  disabled={saving}
                >
                  <SelectTrigger className="w-full">
                    <span data-slot="select-value" className="flex flex-1 items-center gap-2 text-left">
                      {saving ? "Guardando..." : (
                        action === "" ? <span className="text-muted-foreground">Seleccionar acción...</span>
                        : action === "confirmar" ? "Confirmar cita"
                        : action === "cancelar" ? "Cancelar cita"
                        : "Reagendar cita"
                      )}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmar">✓ Confirmar cita</SelectItem>
                    <SelectItem value="cancelar">✕ Cancelar cita</SelectItem>
                    <SelectItem value="reagendar">↻ Reagendar cita</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Formulario de reagendar */}
              {action === "reagendar" && (
                <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                  {/* Doctor y paciente (read-only) */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Doctor</Label>
                      <p className="text-sm font-medium truncate">{cita.doctores.nombre}</p>
                    </div>
                    {cita.pacientes && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Paciente</Label>
                        <p className="text-sm font-medium truncate">{cita.pacientes.nombre}</p>
                      </div>
                    )}
                  </div>

                  {/* Duración */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Duración</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {DURATION_OPTIONS.map((min) => (
                        <button
                          key={min}
                          type="button"
                          onClick={() => setReschedDur(min)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                            reschedDur === min
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background border-input hover:bg-muted"
                          }`}
                        >
                          {min >= 60 ? `${min / 60}h` : `${min}min`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fecha */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nueva fecha</Label>
                    <input
                      type="date"
                      value={reschedFecha}
                      onChange={(e) => setReschedFecha(e.target.value)}
                      className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>

                  {/* Slots */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Hora</Label>
                    {loadingSlots ? (
                      <div className="flex gap-1.5">
                        {[1,2,3,4].map(i => <div key={i} className="h-7 w-14 rounded-md bg-muted animate-pulse" />)}
                      </div>
                    ) : reschedSlots.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-1">No hay horarios disponibles para esta fecha.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {reschedSlots.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setReschedHora(s)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                              reschedHora === s
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background border-input hover:bg-muted"
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {error && <p className="text-xs text-destructive">{error}</p>}

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => { setAction(""); setError(""); }}
                      disabled={saving}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={handleReagendar}
                      disabled={!reschedFecha || !reschedHora || saving}
                    >
                      {saving ? "Guardando..." : "Confirmar"}
                    </Button>
                  </div>
                </div>
              )}

              {error && action !== "reagendar" && (
                <p className="text-xs text-destructive">{error}</p>
              )}
            </div>
          )}

          {/* Eliminar */}
          <div className="px-6 py-4">
            {!confirmDelete ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {isBloqueada ? "Eliminar bloqueo" : "Eliminar cita"}
              </Button>
            ) : (
              <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 space-y-3">
                <p className="text-sm font-medium text-destructive">
                  ¿{isBloqueada ? "Eliminar este bloqueo" : "Eliminar esta cita"}?
                </p>
                <p className="text-xs text-muted-foreground">Esta acción no se puede deshacer.</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirmDelete(false)} disabled={savingDelete}>
                    Cancelar
                  </Button>
                  <Button variant="destructive" size="sm" className="flex-1" onClick={handleDelete} disabled={savingDelete}>
                    {savingDelete ? "Eliminando..." : "Sí, eliminar"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
