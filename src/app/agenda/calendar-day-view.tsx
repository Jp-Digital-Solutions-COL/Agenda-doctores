"use client";

import { useEffect, useRef, useState } from "react";
import type { CitaConRel, DoctorBasic } from "./types";
import { ESTADO_CONFIG } from "./types";
import { durationMinutes, formatTime, isSameDay } from "./utils";
import { CalendarDays } from "lucide-react";

const HOUR_HEIGHT = 64;
const GRID_START = 7;
const GRID_END = 20;
const HOURS = Array.from({ length: GRID_END - GRID_START }, (_, i) => GRID_START + i);
const TOTAL_H = HOURS.length * HOUR_HEIGHT;
const SNAP_MIN = 15;
const SNAP_PX = SNAP_MIN * (HOUR_HEIGHT / 60);

function topPx(date: Date) {
  return (date.getHours() * 60 + date.getMinutes() - GRID_START * 60) * (HOUR_HEIGHT / 60);
}
function heightPx(dur: number) {
  return Math.max(dur * (HOUR_HEIGHT / 60), 28);
}
function doctorColor(index: number): string {
  return `hsl(${(index * 67) % 360} 65% 48%)`;
}
function timeFromClickY(clientY: number, rect: DOMRect): string {
  const y = clientY - rect.top;
  const totalMin = (y / HOUR_HEIGHT) * 60 + GRID_START * 60;
  const rounded = Math.round(totalMin / 30) * 30;
  const clamped = Math.max(GRID_START * 60, Math.min((GRID_END - 1) * 60, rounded));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function topToTime(top: number): { h: number; m: number } {
  const totalMin = (top / HOUR_HEIGHT) * 60 + GRID_START * 60;
  const snapped = Math.round(totalMin / SNAP_MIN) * SNAP_MIN;
  const clamped = Math.max(GRID_START * 60, Math.min(GRID_END * 60, snapped));
  return { h: Math.floor(clamped / 60), m: clamped % 60 };
}

interface DragState {
  cita: CitaConRel;
  doctorColIdx: number;
  offsetY: number;
  ghostTop: number;
  originalTop: number;
}

interface Props {
  date: Date;
  today: Date;
  doctors: DoctorBasic[];
  allDoctors: DoctorBasic[];
  citas: CitaConRel[];
  onCitaClick: (c: CitaConRel) => void;
  onSlotClick?: (day: Date, time: string) => void;
  onReschedule?: (id: string, inicioISO: string, finISO: string) => Promise<void>;
}

export default function CalendarDayView({
  date,
  today,
  doctors,
  allDoctors,
  citas,
  onCitaClick,
  onSlotClick,
  onReschedule,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (8 - GRID_START) * HOUR_HEIGHT;
    }
  }, []);

  const dayCitas = citas.filter((c) => isSameDay(new Date(c.inicio), date));
  const isToday = isSameDay(date, today);
  const now = new Date();
  const nowTop =
    isToday && now.getHours() >= GRID_START && now.getHours() < GRID_END
      ? (now.getHours() * 60 + now.getMinutes() - GRID_START * 60) * (HOUR_HEIGHT / 60)
      : null;

  const showHeaders = doctors.length > 1;

  function handleCitaPointerDown(
    e: React.PointerEvent,
    cita: CitaConRel,
    colIdx: number
  ) {
    if (e.button !== 0 || !onReschedule) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const origTop = Math.max(0, topPx(new Date(cita.inicio)));
    setDrag({ cita, doctorColIdx: colIdx, offsetY, ghostTop: origTop, originalTop: origTop });
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!drag || !scrollRef.current) return;
    const rect = scrollRef.current.getBoundingClientRect();
    const rawTop = e.clientY - rect.top + scrollRef.current.scrollTop - drag.offsetY;
    const dur = durationMinutes(drag.cita.inicio, drag.cita.fin);
    const snapped = Math.round(rawTop / SNAP_PX) * SNAP_PX;
    const clamped = Math.max(0, Math.min(TOTAL_H - heightPx(dur), snapped));
    setDrag((prev) => prev ? { ...prev, ghostTop: clamped } : null);
  }

  async function handlePointerUp() {
    if (!drag || !onReschedule) { setDrag(null); return; }
    const { cita, ghostTop, originalTop } = drag;
    setDrag(null);

    if (Math.abs(ghostTop - originalTop) < SNAP_PX / 2) return;

    const dur = durationMinutes(cita.inicio, cita.fin);
    const { h, m } = topToTime(ghostTop);
    const orig = new Date(cita.inicio);
    const newStart = new Date(orig.getFullYear(), orig.getMonth(), orig.getDate(), h, m);
    if (newStart.getTime() === orig.getTime()) return;

    await onReschedule(cita.id, newStart.toISOString(), new Date(newStart.getTime() + dur * 60000).toISOString());
  }

  if (doctors.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 text-center px-4">
        <div className="rounded-full bg-muted p-4">
          <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-foreground">Sin doctores seleccionados</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Usa el filtro de doctores en la barra superior para ver las citas del día.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {showHeaders && (
        <div className="flex border-b shrink-0 bg-background">
          <div className="w-14 shrink-0 border-r" />
          {doctors.map((doc, i) => {
            const doctorIdx = allDoctors.findIndex((d) => d.id === doc.id);
            const color = doctorColor(doctorIdx >= 0 ? doctorIdx : i);
            return (
              <div
                key={doc.id}
                className={`flex-1 px-3 py-2 text-xs font-semibold truncate min-w-[120px] flex items-center gap-1.5 ${i > 0 ? "border-l" : ""}`}
              >
                <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                {doc.nombre}
              </div>
            );
          })}
        </div>
      )}

      <div
        className="flex flex-1 overflow-y-auto select-none"
        ref={scrollRef}
        onPointerMove={drag ? handlePointerMove : undefined}
        onPointerUp={drag ? handlePointerUp : undefined}
        onPointerLeave={drag ? handlePointerUp : undefined}
        onPointerCancel={drag ? () => setDrag(null) : undefined}
        style={{ cursor: drag ? "grabbing" : undefined, touchAction: drag ? "none" : undefined }}
      >
        {/* Time gutter */}
        <div className="w-14 shrink-0 border-r bg-background">
          {HOURS.map((h) => (
            <div key={h} className="relative border-t border-border/20" style={{ height: HOUR_HEIGHT }}>
              <span className="absolute -top-2.5 right-2 text-[10px] text-muted-foreground/60 tabular-nums select-none">
                {String(h).padStart(2, "0")}:00
              </span>
            </div>
          ))}
        </div>

        {/* Grid + columns */}
        <div className="flex flex-1 relative" style={{ height: TOTAL_H }}>
          {HOURS.map((_, i) => (
            <div key={i}>
              <div className="absolute left-0 right-0 border-t border-border/25 pointer-events-none" style={{ top: i * HOUR_HEIGHT }} />
              <div className="absolute left-0 right-0 border-t border-border/10 pointer-events-none" style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
            </div>
          ))}

          {nowTop !== null && (
            <div className="absolute left-0 right-0 z-20 flex items-center pointer-events-none" style={{ top: nowTop }}>
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1 shrink-0" />
              <div className="flex-1 border-t-2 border-red-500/75" />
            </div>
          )}

          {doctors.map((doc, idx) => {
            const docCitas = dayCitas.filter((c) => c.doctor_id === doc.id);
            const doctorIdx = allDoctors.findIndex((d) => d.id === doc.id);
            const color = doctorColor(doctorIdx >= 0 ? doctorIdx : idx);

            return (
              <div
                key={doc.id}
                className={`flex-1 relative min-w-[120px] ${drag ? "" : "cursor-pointer"} ${idx > 0 ? "border-l" : ""}`}
                style={{ height: TOTAL_H }}
                onClick={(e) => {
                  if (!onSlotClick || drag) return;
                  if ((e.target as HTMLElement).closest('[data-cita-id]')) return;
                  onSlotClick(date, timeFromClickY(e.clientY, e.currentTarget.getBoundingClientRect()));
                }}
              >
                {docCitas.length === 0 && !showHeaders && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-xs text-muted-foreground/50">Sin citas</p>
                  </div>
                )}

                {/* Drag ghost for this column */}
                {drag && drag.doctorColIdx === idx && (
                  <DragGhost drag={drag} color={color} />
                )}

                {docCitas.map((cita) => {
                  const dt = new Date(cita.inicio);
                  const dur = durationMinutes(cita.inicio, cita.fin);
                  const top = topPx(dt);
                  const h = heightPx(dur);
                  if (top < -h || top > TOTAL_H) return null;
                  const isBloqueada = cita.estado === "bloqueada";
                  const ec = ESTADO_CONFIG[cita.estado];
                  const isDragging = drag?.cita.id === cita.id;

                  return (
                    <button
                      key={cita.id}
                      data-cita-id={cita.id}
                      onPointerDown={(e) => handleCitaPointerDown(e, cita, idx)}
                      onPointerUp={(e) => {
                        if (!drag || drag.cita.id !== cita.id) return;
                        if (Math.abs(drag.ghostTop - drag.originalTop) < SNAP_PX / 2) {
                          e.stopPropagation();
                          setDrag(null);
                          onCitaClick(cita);
                        }
                      }}
                      className={`absolute left-1 right-1 rounded text-left overflow-hidden transition-opacity hover:brightness-95 hover:shadow-sm ${ec.bg} ${onReschedule ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                      style={{
                        top: Math.max(0, top),
                        height: h,
                        borderLeft: isBloqueada ? `3px solid #9ca3af` : `3px solid ${color}`,
                        backgroundImage: isBloqueada
                          ? "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.04) 4px, rgba(0,0,0,0.04) 8px)"
                          : undefined,
                        opacity: isDragging ? 0.35 : 1,
                        pointerEvents: isDragging ? "none" : undefined,
                      }}
                    >
                      <div className="px-1.5 py-0.5">
                        <p className={`text-xs font-semibold leading-tight truncate ${ec.text}`}>
                          {isBloqueada ? (cita.motivo || "Bloqueado") : cita.pacientes?.nombre}
                        </p>
                        {h >= 38 && (
                          <p className={`text-[10px] leading-tight opacity-70 ${ec.text}`}>
                            {formatTime(dt)} · {dur}min
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DragGhost({ drag, color }: { drag: DragState; color: string }) {
  const isBloqueada = drag.cita.estado === "bloqueada";
  const ec = ESTADO_CONFIG[drag.cita.estado];
  const dur = durationMinutes(drag.cita.inicio, drag.cita.fin);
  const h = heightPx(dur);
  const { h: th, m: tm } = topToTime(drag.ghostTop);
  const timeLabel = `${String(th).padStart(2, "0")}:${String(tm).padStart(2, "0")}`;

  return (
    <div
      className={`absolute left-1 right-1 rounded overflow-hidden pointer-events-none z-30 ring-2 ring-primary shadow-lg ${ec.bg}`}
      style={{
        top: drag.ghostTop,
        height: h,
        borderLeft: isBloqueada ? `3px solid #9ca3af` : `3px solid ${color}`,
      }}
    >
      <div className="px-1.5 py-0.5">
        <p className={`text-xs font-semibold leading-tight truncate ${ec.text}`}>
          {isBloqueada ? (drag.cita.motivo || "Bloqueado") : drag.cita.pacientes?.nombre}
        </p>
        {h >= 38 && (
          <p className={`text-[10px] leading-tight opacity-70 ${ec.text}`}>{timeLabel}</p>
        )}
      </div>
    </div>
  );
}
