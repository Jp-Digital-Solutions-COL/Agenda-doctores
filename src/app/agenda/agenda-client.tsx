"use client";

import { useMemo, useState, useTransition } from "react";
import type { CitaConRel, DoctorBasic, PacienteBasic } from "./types";
import { getCitas, reagendar } from "./actions";
import {
  startOfWeek,
  endOfWeek,
  addDays,
  isSameDay,
  toDateStr,
  formatDayLabel,
  formatWeekRange,
} from "./utils";
import CalendarDayView from "./calendar-day-view";
import CalendarWeekView from "./calendar-week-view";
import NuevaCitaDialog from "./nueva-cita-dialog";
import BloquearHorasDialog from "./bloquear-horas-dialog";
import CitaDetailSheet from "./cita-detail-sheet";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, Calendar, CalendarDays, LayoutDashboard, Ban } from "lucide-react";
import Link from "next/link";

type ViewMode = "day" | "week";

interface Props {
  doctors: DoctorBasic[];
  pacientes: PacienteBasic[];
  initialCitas: CitaConRel[];
  todayStr: string; // "YYYY-MM-DD"
}

function makeNoon(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export default function AgendaClient({
  doctors,
  pacientes,
  initialCitas,
  todayStr,
}: Props) {
  const todayDate = useMemo(() => makeNoon(todayStr), [todayStr]);

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(todayDate);
  const [selectedDoctorId, setSelectedDoctorId] = useState("todos");
  const [citas, setCitas] = useState<CitaConRel[]>(initialCitas);
  const [loadedWeekStart, setLoadedWeekStart] = useState(() =>
    startOfWeek(todayDate)
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogPreset, setDialogPreset] = useState<{ fecha: string; hora: string } | null>(null);
  const [bloqueoOpen, setBloqueoOpen] = useState(false);
  const [bloqueoPreset, setBloqueoPreset] = useState<{ fecha: string; hora: string } | null>(null);
  const [detailCita, setDetailCita] = useState<CitaConRel | null>(null);
  const [, startTransition] = useTransition();

  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);

  async function refreshCitas(wStart: Date) {
    const we = endOfWeek(wStart);
    const data = await getCitas(
      new Date(wStart.getFullYear(), wStart.getMonth(), wStart.getDate()).toISOString(),
      new Date(we.getFullYear(), we.getMonth(), we.getDate(), 23, 59, 59).toISOString()
    );
    setCitas(data);
    setLoadedWeekStart(wStart);
  }

  async function handleCitaUpdated() {
    await refreshCitas(loadedWeekStart);
  }

  async function handleReschedule(id: string, inicioISO: string, finISO: string) {
    await reagendar(id, inicioISO, finISO);
    await refreshCitas(loadedWeekStart);
  }

  function handleSlotClick(day: Date, time: string) {
    setDialogPreset({ fecha: toDateStr(day), hora: time });
    setDialogOpen(true);
  }

  function navigateTo(newDate: Date) {
    setCurrentDate(newDate);
    const newWeekStart = startOfWeek(newDate);
    if (newWeekStart.getTime() !== loadedWeekStart.getTime()) {
      startTransition(async () => {
        await refreshCitas(newWeekStart);
      });
    }
  }

  function handleDayClick(day: Date) {
    setCurrentDate(day);
    setViewMode("day");
    const newWeekStart = startOfWeek(day);
    if (newWeekStart.getTime() !== loadedWeekStart.getTime()) {
      startTransition(async () => {
        await refreshCitas(newWeekStart);
      });
    }
  }

  const visibleDoctors = useMemo(
    () =>
      selectedDoctorId === "todos"
        ? doctors
        : doctors.filter((d) => d.id === selectedDoctorId),
    [doctors, selectedDoctorId]
  );

  const headerLabel =
    viewMode === "day"
      ? formatDayLabel(currentDate)
      : formatWeekRange(weekStart, weekEnd);

  const isCurrentToday =
    viewMode === "day" && isSameDay(currentDate, todayDate);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-background flex-wrap shrink-0">
        {/* Inicio */}
        <Link href="/inicio">
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Ir al inicio">
            <LayoutDashboard className="h-4 w-4" />
          </Button>
        </Link>
        <div className="h-4 w-px bg-border shrink-0" />
        {/* Navegación */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              navigateTo(addDays(currentDate, viewMode === "day" ? -1 : -7))
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={isCurrentToday}
            onClick={() => navigateTo(todayDate)}
          >
            Hoy
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              navigateTo(addDays(currentDate, viewMode === "day" ? 1 : 7))
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Etiqueta de fecha */}
        <span className="text-sm font-semibold capitalize flex-1 min-w-[160px] truncate">
          {headerLabel}
        </span>

        {/* Filtro por doctor */}
        <Select value={selectedDoctorId} onValueChange={(v) => v && setSelectedDoctorId(v)}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <span data-slot="select-value" className="flex flex-1 text-left truncate">
              {selectedDoctorId === "todos"
                ? "Todos los doctores"
                : (doctors.find((d) => d.id === selectedDoctorId)?.nombre ?? "Todos los doctores")}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los doctores</SelectItem>
            {doctors.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Toggle vista */}
        <div className="flex rounded-md border overflow-hidden">
          <Button
            variant={viewMode === "day" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 rounded-none gap-1.5"
            onClick={() => setViewMode("day")}
          >
            <Calendar className="h-3.5 w-3.5" />
            Día
          </Button>
          <Button
            variant={viewMode === "week" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 rounded-none border-l gap-1.5"
            onClick={() => setViewMode("week")}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Semana
          </Button>
        </div>

        {/* Nueva cita / Bloquear */}
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Nueva cita
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={() => setBloqueoOpen(true)}
          >
            <Ban className="h-3.5 w-3.5" />
            Bloquear
          </Button>
        </div>
      </div>

      {/* ── Cuerpo del calendario ── */}
      <div className="flex-1 overflow-hidden">
        {viewMode === "day" ? (
          <CalendarDayView
            date={currentDate}
            today={todayDate}
            doctors={visibleDoctors}
            allDoctors={doctors}
            citas={citas}
            onCitaClick={setDetailCita}
            onSlotClick={handleSlotClick}
            onReschedule={handleReschedule}
          />
        ) : (
          <CalendarWeekView
            startDate={weekStart}
            today={todayDate}
            doctors={visibleDoctors}
            allDoctors={doctors}
            citas={citas}
            onCitaClick={setDetailCita}
            onDayClick={handleDayClick}
            onSlotClick={handleSlotClick}
            onReschedule={handleReschedule}
          />
        )}
      </div>

      {/* Dialogs */}
      <NuevaCitaDialog
        key={dialogOpen ? "cita-open" : "cita-closed"}
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setDialogPreset(null); }}
        doctors={doctors}
        pacientes={pacientes}
        defaultDoctorId={selectedDoctorId !== "todos" ? selectedDoctorId : undefined}
        defaultFecha={dialogPreset?.fecha}
        defaultHora={dialogPreset?.hora}
        onCreated={handleCitaUpdated}
      />

      <BloquearHorasDialog
        key={bloqueoOpen ? "bloqueo-open" : "bloqueo-closed"}
        open={bloqueoOpen}
        onClose={() => { setBloqueoOpen(false); setBloqueoPreset(null); }}
        doctors={doctors}
        defaultDoctorId={selectedDoctorId !== "todos" ? selectedDoctorId : undefined}
        defaultFecha={bloqueoPreset?.fecha}
        defaultHoraInicio={bloqueoPreset?.hora}
        onCreated={handleCitaUpdated}
      />

      <CitaDetailSheet
        key={detailCita?.id ?? "none"}
        cita={detailCita}
        onClose={() => setDetailCita(null)}
        onUpdate={handleCitaUpdated}
      />
    </div>
  );
}
