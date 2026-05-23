"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateConsultorio, createConsultorio } from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, TrendingUp, Building2, LayoutDashboard, Check, LogOut, Plus, X } from "lucide-react";
import Link from "next/link";
import TeamManager from "./team-manager";
import { signOut } from "./actions";

type EstadoSuscripcion = "prueba" | "activo" | "suspendido";

export type ConsultorioAdmin = {
  id: string;
  nombre: string;
  estado_suscripcion: EstadoSuscripcion;
  doctores_activos: number;
  cobro_mensual: number;
  precio_por_doctor: number;
  notas_admin: string | null;
};

const ESTADO_CONFIG: Record<
  EstadoSuscripcion,
  { label: string; bg: string; text: string; border: string }
> = {
  prueba: {
    label: "Prueba",
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
  },
  activo: {
    label: "Activo",
    bg: "bg-green-50",
    text: "text-green-800",
    border: "border-green-200",
  },
  suspendido: {
    label: "Suspendido",
    bg: "bg-red-50",
    text: "text-red-800",
    border: "border-red-200",
  },
};

function formatPrecio(n: number): string {
  return n.toLocaleString("es-CO");
}

function ConsultorioCard({ c }: { c: ConsultorioAdmin }) {
  const [estado, setEstado] = useState<EstadoSuscripcion>(c.estado_suscripcion);
  const [precio, setPrecio] = useState(String(c.precio_por_doctor ?? 0));
  const [notas, setNotas] = useState(c.notas_admin ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const hasChanges =
    estado !== c.estado_suscripcion ||
    precio !== String(c.precio_por_doctor ?? 0) ||
    notas !== (c.notas_admin ?? "");

  const cobroMensual = (Number(precio) || 0) * (c.doctores_activos ?? 0);
  const ec = ESTADO_CONFIG[estado];

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);
    const r = await updateConsultorio(c.id, {
      estado_suscripcion: estado,
      precio_por_doctor: Number(precio) || 0,
      notas_admin: notas,
    });
    setSaving(false);
    if (r.error) {
      setError(r.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base font-semibold leading-tight">
            {c.nombre}
          </CardTitle>
          <Badge
            variant="outline"
            className={`${ec.bg} ${ec.text} ${ec.border} shrink-0`}
          >
            {ec.label}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {c.doctores_activos ?? 0} doctor
            {(c.doctores_activos ?? 0) !== 1 ? "es activos" : " activo"}
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" />
            ${formatPrecio(cobroMensual)}/mes
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Estado suscripción</Label>
            <Select
              value={estado}
              onValueChange={(v) => setEstado(v as EstadoSuscripcion)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prueba">Prueba</SelectItem>
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="suspendido">Suspendido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Precio por doctor (COP)
            </Label>
            <Input
              type="number"
              min={0}
              step={1000}
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className="h-9"
              placeholder="0"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Notas internas</Label>
          <Textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Apuntes sobre esta clienta, acuerdos de pago, fechas de activación, etc."
            className="min-h-0 resize-none text-sm"
            rows={2}
          />
        </div>

        <div className="flex items-center gap-3">
          {error && <p className="text-xs text-destructive flex-1">{error}</p>}
          {saved && (
            <span className="flex items-center gap-1 text-xs text-green-700 flex-1">
              <Check className="h-3.5 w-3.5" />
              Guardado
            </span>
          )}
          {!error && !saved && <span className="flex-1" />}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminClient({
  consultorios,
}: {
  consultorios: ConsultorioAdmin[];
}) {
  const router = useRouter();
  const [newConsultorioOpen, setNewConsultorioOpen] = useState(false);
  const [newNombre, setNewNombre] = useState("");
  const [newLoading, setNewLoading] = useState(false);
  const [newError, setNewError] = useState("");

  async function handleCreateConsultorio(e: React.FormEvent) {
    e.preventDefault();
    setNewLoading(true);
    setNewError("");
    const r = await createConsultorio(newNombre);
    setNewLoading(false);
    if (r.error) {
      setNewError(r.error);
    } else {
      setNewNombre("");
      setNewConsultorioOpen(false);
      router.refresh();
    }
  }

  const activos = consultorios.filter(
    (c) => c.estado_suscripcion === "activo"
  ).length;
  const prueba = consultorios.filter(
    (c) => c.estado_suscripcion === "prueba"
  ).length;
  const suspendidos = consultorios.filter(
    (c) => c.estado_suscripcion === "suspendido"
  ).length;
  const cobroTotal = consultorios
    .filter((c) => c.estado_suscripcion === "activo")
    .reduce(
      (sum, c) => sum + (c.precio_por_doctor ?? 0) * (c.doctores_activos ?? 0),
      0
    );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Panel de administración</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {consultorios.length} consultorio
            {consultorios.length !== 1 ? "s" : ""} registrado
            {consultorios.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link href="/inicio">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <LayoutDashboard className="h-4 w-4" />
              Inicio
            </Button>
          </Link>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm" className="gap-1.5">
              <LogOut className="h-4 w-4" />
              Salir
            </Button>
          </form>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Activos</p>
          <p className="text-2xl font-bold text-green-700">{activos}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">En prueba</p>
          <p className="text-2xl font-bold text-amber-600">{prueba}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Suspendidos</p>
          <p className="text-2xl font-bold text-red-600">{suspendidos}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Cobro mensual total</p>
          <p className="text-base font-bold leading-tight mt-0.5">
            ${formatPrecio(cobroTotal)}
          </p>
        </Card>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Consultorios
          </h2>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs"
            onClick={() => { setNewConsultorioOpen((v) => !v); setNewError(""); }}
          >
            {newConsultorioOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {newConsultorioOpen ? "Cancelar" : "Nuevo consultorio"}
          </Button>
        </div>

        {newConsultorioOpen && (
          <form
            onSubmit={handleCreateConsultorio}
            className="border rounded-lg p-3 space-y-2.5 bg-muted/30"
          >
            <div className="space-y-1">
              <Label className="text-xs">Nombre del consultorio</Label>
              <Input
                required
                autoFocus
                placeholder="Clínica San Rafael"
                value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
                className="h-8 text-sm"
                disabled={newLoading}
              />
            </div>
            {newError && <p className="text-xs text-destructive">{newError}</p>}
            <Button type="submit" size="sm" className="h-7 text-xs" disabled={newLoading || !newNombre.trim()}>
              {newLoading ? "Creando..." : "Crear consultorio"}
            </Button>
          </form>
        )}

        {consultorios.length === 0 ? (
          <Card className="p-10 text-center">
            <Building2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No hay consultorios registrados.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {consultorios.map((c) => (
              <ConsultorioCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </div>

      {/* Equipo */}
      <TeamManager consultorios={consultorios} />
    </div>
  );
}
