"use client";

import { useEffect, useRef, useState } from "react";
import type { CitaConRel, DoctorBasic } from "./types";
import { ESTADO_CONFIG } from "./types";
import { durationMinutes, formatTime, isSameDay, toDateStr, addDays } from "./utils";

const HOUR_HEIGHT = 64;
const GRID_START = 7;
const GRID_END = 20;
const GUTTER_W = 56; // w-14
const HOURS = Array.from({ length: GRID_END - GRID_START }, (_, i) => GRID_START + i);
const TOTAL_H = HOURS.length * HOUR_HEIGHT;
const SNAP_MIN = 15;
const SNAP_PX = SNAP_MIN * (HOUR_HEIGHT / 60);

function topPx(date: Date): number {
  return (date.getHours() * 60 + date.getMinutes() - GRID_START * 60) * (HOUR_HEIGHT / 60);
}
function heightPx(dur: number): number {
  return Math.max(dur * (HOUR_HEIGHT / 60), 24);
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
  offsetY: number;
  ghostTop: number;
  originalTop: number;
  originalDayIdx: number;
  targetDayIdx: number;
}

interface Props {
  startDate: Date;
  today: Date;
  doctors: DoctorBasic[];
  allDoctors: DoctorBasic[];
  citas: CitaConRel[];
  onCitaClick: (c: CitaConRel) => void;
  onDayClick: (d: Date) => void;
  onSlotClick?: (day: Date, time: string) => void;
  onReschedule?: (id: string, inicioISO: string, finISO: string) => Promise<void>;
}

export default function CalendarWeekView({
  startDate,
  today,
  doctors,
  allDoctors,
  citas,
  onCitaClick,
  onDayClick,
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

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
  const doctorIds = new Set(doctors.map((d) => d.id));

  const now = new Date();
  const todayInWeek = weekDays.some((d) => isSameDay(d, today));
  const nowTop =
    todayInWeek && now.getHours() >= GRID_START && now.getHours() < GRID_END
      ? (now.getHours() * 60 + now.getMinutes() - GRID_START * 60) * (HOUR_HEIGHT / 60)
      : null;

  function handleCitaPointerDown(e: React.PointerEvent, cita: CitaConRel, dayIdx: number) {
    if (e.button !== 0 || !onReschedule) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const origTop = Math.max(0, topPx(new Date(cita.inicio)));
    setDrag({ cita, offsetY, ghostTop: origTop, originalTop: origTop, originalDayIdx: dayIdx, targetDayIdx: dayIdx });
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!drag || !scrollRef.current) return;
    const rect = scrollRef.current.getBoundingClientRect();

    // Y → time
    const rawTop = e.clientY - rect.top + scrollRef.current.scrollTop - drag.offsetY;
    const dur = durationMinutes(drag.cita.inicio, drag.cita.fin);
    const snapped = Math.round(rawTop / SNAP_PX) * SNAP_PX;
    const ghostTop = Math.max(0, Math.min(TOTAL_H - heightPx(dur), snapped));

    // X → day column
    const x = e.clientX - rect.left - GUTTER_W;
    const colW = (rect.width - GUTTER_W) / 7;
    const targetDayIdx = Math.max(0, Math.min(6, Math.floor(x / colW)));

    setDrag((prev) => prev ? { ...prev, ghostTop, targetDayIdx } : null);
  }

  async function handlePointerUp() {
    if (!drag || !onReschedule) { setDrag(null); return; }
    const { cita, ghostTop, originalTop, originalDayIdx, targetDayIdx } = drag;
    setDrag(null);

    const dayChanged = targetDayIdx !== originalDayIdx;
    const timeChanged = Math.abs(ghostTop - originalTop) >= SNAP_PX / 2;
    if (!dayChanged && !timeChanged) return;

    const dur = durationMinutes(cita.inicio, cita.fin);
    const { h, m } = topToTime(ghostTop);
    const origDate = new Date(cita.inicio);
    const targetDay = weekDays[targetDayIdx];
    const newStart = new Date(targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate(), h, m);
    if (newStart.getTime() === origDate.getTime()) return;

    await onReschedule(cita.id, newStart.toISOString(), new Date(newStart.getTime() + dur * 60000).toISOString());
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Day headers */}
      <div className="flex border-b shrink-0 bg-background">
        <div className="w-14 shrink-0 border-r" />
        {weekDays.map((day) => {
          const isToday = isSameDay(day, today);
          return (
            <button
              key={toDateStr(day)}
              onClick={() => onDayClick(day)}
              aria-label={`Ver día ${day.getDate()}`}
              className={`flex-1 flex flex-col items-center py-2 transition-colors hover:bg-muted/50 border-l first:border-l-0 min-w-0 ${isToday ? "bg-primary/5" : ""}`}
            >
              <span className={`text-[10px] uppercase font-semibold tracking-wider ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                {new Intl.DateTimeFormat("es-MX", { weekday: "short" }).format(day)}
              </span>
              <span className={`text-xl font-bold leading-none mt-1 w-9 h-9 flex items-center justify-center rounded-full transition-colors ${isToday ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>
                {day.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Scrollable time grid */}
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

        {/* Columns container */}
        <div className="flex flex-1 relative" style={{ minHeight: TOTAL_H }}>
          {/* Hour + half-hour lines */}
          {HOURS.map((_, i) => (
            <div key={i}>
              <div className="absolute left-0 right-0 border-t border-border/25 pointer-events-none" style={{ top: i * HOUR_HEIGHT }} />
              <div className="absolute left-0 right-0 border-t border-border/10 pointer-events-none" style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
            </div>
          ))}

          {/* Current-time indicator */}
          {nowTop !== null && (
            <div className="absolute left-0 right-0 z-20 flex items-center pointer-events-none" style={{ top: nowTop }}>
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 -ml-1" />
              <div className="flex-1 border-t-2 border-red-500/75" />
            </div>
          )}

          {/* Day columns */}
          {weekDays.map((day, dayIdx) => {
            const isToday = isSameDay(day, today);
            const dayCitas = citas
              .filter((c) => isSameDay(new Date(c.inicio), day) && doctorIds.has(c.doctor_id))
              .sort((a, b) => a.inicio.localeCompare(b.inicio));

            return (
              <div
                key={toDateStr(day)}
                className={`flex-1 relative border-l first:border-l-0 min-w-0 ${drag ? "" : "cursor-pointer"} ${isToday ? "bg-primary/[0.025]" : ""}`}
                style={{ height: TOTAL_H }}
                onClick={(e) => {
                  if (!onSlotClick || drag) return;
                  if ((e.target as HTMLElement).closest('[data-cita-id]')) return;
                  onSlotClick(day, timeFromClickY(e.clientY, e.currentTarget.getBoundingClientRect()));
                }}
              >
                {/* Ghost in this column */}
                {drag && drag.targetDayIdx === dayIdx && (
                  <WeekDragGhost drag={drag} allDoctors={allDoctors} />
                )}

                {dayCitas.map((cita) => {
                  const dt = new Date(cita.inicio);
                  const dur = durationMinutes(cita.inicio, cita.fin);
                  const top = topPx(dt);
                  const h = heightPx(dur);
                  if (top < -h || top > TOTAL_H) return null;
                  const isBloqueada = cita.estado === "bloqueada";
                  const ec = ESTADO_CONFIG[cita.estado];
                  const doctorIdx = allDoctors.findIndex((d) => d.id === cita.doctor_id);
                  const color = doctorColor(doctorIdx >= 0 ? doctorIdx : 0);
                  const isDragging = drag?.cita.id === cita.id;

                  return (
                    <button
                      key={cita.id}
                      data-cita-id={cita.id}
                      onPointerDown={(e) => handleCitaPointerDown(e, cita, dayIdx)}
                      onPointerUp={(e) => {
                        if (!drag || drag.cita.id !== cita.id) return;
                        const dayChanged = drag.targetDayIdx !== drag.originalDayIdx;
                        const timeChanged = Math.abs(drag.ghostTop - drag.originalTop) >= SNAP_PX / 2;
                        if (!dayChanged && !timeChanged) {
                          e.stopPropagation();
                          setDrag(null);
                          onCitaClick(cita);
                        }
                      }}
                      className={`absolute left-0.5 right-0.5 rounded text-left overflow-hidden transition-opacity hover:brightness-95 hover:shadow-sm ${ec.bg} ${onReschedule ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
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
                      <div className="px-1.5 py-0.5 h-full overflow-hidden">
                        <p className={`text-[11px] font-semibold leading-tight truncate ${ec.text}`}>
                          {isBloqueada ? (cita.motivo || "Bloqueado") : cita.pacientes?.nombre}
                        </p>
                        {h >= 34 && (
                          <p className={`text-[10px] leading-tight opacity-70 ${ec.text}`}>
                            {formatTime(dt)}
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

function WeekDragGhost({ drag, allDoctors }: { drag: DragState; allDoctors: DoctorBasic[] }) {
  const isBloqueada = drag.cita.estado === "bloqueada";
  const ec = ESTADO_CONFIG[drag.cita.estado];
  const doctorIdx = allDoctors.findIndex((d) => d.id === drag.cita.doctor_id);
  const color = doctorColor(doctorIdx >= 0 ? doctorIdx : 0);
  const dur = durationMinutes(drag.cita.inicio, drag.cita.fin);
  const h = heightPx(dur);
  const { h: th, m: tm } = topToTime(drag.ghostTop);
  const timeLabel = `${String(th).padStart(2, "0")}:${String(tm).padStart(2, "0")}`;

  return (
    <div
      className={`absolute left-0.5 right-0.5 rounded overflow-hidden pointer-events-none z-30 ring-2 ring-primary shadow-lg ${ec.bg}`}
      style={{
        top: drag.ghostTop,
        height: h,
        borderLeft: isBloqueada ? `3px solid #9ca3af` : `3px solid ${color}`,
      }}
    >
      <div className="px-1.5 py-0.5 h-full overflow-hidden">
        <p className={`text-[11px] font-semibold leading-tight truncate ${ec.text}`}>
          {isBloqueada ? (drag.cita.motivo || "Bloqueado") : drag.cita.pacientes?.nombre}
        </p>
        {h >= 34 && (
          <p className={`text-[10px] leading-tight opacity-70 ${ec.text}`}>{timeLabel}</p>
        )}
      </div>
    </div>
  );
}
