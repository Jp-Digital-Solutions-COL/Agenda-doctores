"use client";

import { useState, useCallback } from "react";
import {
  getSecretarias,
  createSecretaria,
  getDoctoresConsultorio,
  createDoctor,
  getAsignaciones,
  toggleAsignacion,
  type SecretariaItem,
  type DoctorItem,
  type AsignacionItem,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, Plus, Loader2, Users, Stethoscope } from "lucide-react";
import type { ConsultorioAdmin } from "./admin-client";

interface Props {
  consultorios: ConsultorioAdmin[];
}

function SecretariaRow({
  sec,
  doctors,
  asignadas,
  onToggle,
}: {
  sec: SecretariaItem;
  doctors: DoctorItem[];
  asignadas: Set<string>;
  onToggle: (doctorId: string, asignar: boolean) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex flex-col items-start min-w-0">
          <span className="font-medium truncate">{sec.nombre || sec.email}</span>
          {sec.nombre && <span className="text-xs text-muted-foreground truncate">{sec.email}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-xs text-muted-foreground">
            {asignadas.size} doctor{asignadas.size !== 1 ? "es" : ""}
          </span>
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t px-3 py-3 space-y-2 bg-muted/20">
          {doctors.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No hay doctores en este consultorio.
            </p>
          ) : (
            doctors.map((doc) => (
              <label
                key={doc.id}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border accent-primary cursor-pointer"
                  checked={asignadas.has(doc.id)}
                  onChange={(e) => onToggle(doc.id, e.target.checked)}
                />
                <span className="text-sm leading-none group-hover:text-foreground transition-colors">
                  {doc.nombre}
                  {doc.especialidad && (
                    <span className="text-muted-foreground ml-1 text-xs">
                      · {doc.especialidad}
                    </span>
                  )}
                </span>
                {!doc.activo && (
                  <span className="text-xs text-muted-foreground">(inactivo)</span>
                )}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function TeamManager({ consultorios }: Props) {
  const [consultorioId, setConsultorioId] = useState<string>("");
  const [secretarias, setSecretarias] = useState<SecretariaItem[]>([]);
  const [doctors, setDoctors] = useState<DoctorItem[]>([]);
  const [asignaciones, setAsignaciones] = useState<AsignacionItem[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // New secretaria form
  const [secNombre, setSecNombre] = useState("");
  const [secEmail, setSecEmail] = useState("");
  const [secPassword, setSecPassword] = useState("");
  const [secLoading, setSecLoading] = useState(false);
  const [secStep, setSecStep] = useState("");
  const [secError, setSecError] = useState("");
  const [secOpen, setSecOpen] = useState(false);

  // New doctor form
  const [docNombre, setDocNombre] = useState("");
  const [docEsp, setDocEsp] = useState("");
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState("");
  const [docOpen, setDocOpen] = useState(false);

  const loadData = useCallback(async (cid: string) => {
    setLoadingData(true);
    const [secs, docs, asigs] = await Promise.all([
      getSecretarias(cid),
      getDoctoresConsultorio(cid),
      getAsignaciones(cid),
    ]);
    setSecretarias(secs);
    setDoctors(docs);
    setAsignaciones(asigs);
    setLoadingData(false);
  }, []);

  function handleSelectConsultorio(val: string | null) {
    if (!val) return;
    setConsultorioId(val);
    setSecretarias([]);
    setDoctors([]);
    setAsignaciones([]);
    if (val) loadData(val);
  }

  async function handleToggle(secretariaId: string, doctorId: string, asignar: boolean) {
    // Optimistic
    setAsignaciones((prev) =>
      asignar
        ? [...prev, { secretaria_id: secretariaId, doctor_id: doctorId }]
        : prev.filter(
            (a) =>
              !(a.secretaria_id === secretariaId && a.doctor_id === doctorId)
          )
    );
    const r = await toggleAsignacion(secretariaId, doctorId, asignar);
    if (r.error) {
      // Revert
      setAsignaciones((prev) =>
        asignar
          ? prev.filter(
              (a) =>
                !(
                  a.secretaria_id === secretariaId &&
                  a.doctor_id === doctorId
                )
            )
          : [...prev, { secretaria_id: secretariaId, doctor_id: doctorId }]
      );
    }
  }

  async function handleCreateSecretaria(e: React.FormEvent) {
    e.preventDefault();
    if (!consultorioId) return;
    setSecLoading(true);
    setSecError("");
    setSecStep("Creando usuario...");
    const r = await createSecretaria(consultorioId, secEmail.trim(), secPassword, secNombre.trim());
    setSecLoading(false);
    setSecStep("");
    if (r.error) {
      setSecError(r.error);
      return;
    }
    setSecNombre("");
    setSecEmail("");
    setSecPassword("");
    setSecOpen(false);
    loadData(consultorioId);
  }

  async function handleCreateDoctor(e: React.FormEvent) {
    e.preventDefault();
    if (!consultorioId) return;
    setDocLoading(true);
    setDocError("");
    const r = await createDoctor(consultorioId, docNombre.trim(), docEsp.trim() || undefined);
    setDocLoading(false);
    if (r.error) {
      setDocError(r.error);
      return;
    }
    setDocNombre("");
    setDocEsp("");
    setDocOpen(false);
    loadData(consultorioId);
  }

  const asignacionesMap = new Map<string, Set<string>>();
  for (const a of asignaciones) {
    if (!asignacionesMap.has(a.secretaria_id)) {
      asignacionesMap.set(a.secretaria_id, new Set());
    }
    asignacionesMap.get(a.secretaria_id)!.add(a.doctor_id);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Gestión de equipo
        </h2>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-medium">
            Seleccionar consultorio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={consultorioId} onValueChange={handleSelectConsultorio}>
            <SelectTrigger className="w-full sm:w-72">
              <span data-slot="select-value" className="flex flex-1 text-left truncate">
                {consultorioId
                  ? (consultorios.find((c) => c.id === consultorioId)?.nombre ?? "Elige un consultorio...")
                  : "Elige un consultorio..."}
              </span>
            </SelectTrigger>
            <SelectContent>
              {consultorios.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {consultorioId && (
        <>
          {loadingData ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Cargando equipo...</span>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Secretarias */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                      <Users className="h-4 w-4" />
                      Secretarias
                      <span className="text-xs font-normal text-muted-foreground ml-1">
                        ({secretarias.length})
                      </span>
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 text-xs"
                      onClick={() => {
                        setSecOpen((v) => !v);
                        setSecError("");
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Nueva
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {secOpen && (
                    <form
                      onSubmit={handleCreateSecretaria}
                      className="border rounded-lg p-3 space-y-2.5 bg-muted/30"
                    >
                      <div className="space-y-1">
                        <Label className="text-xs">Nombre completo</Label>
                        <Input
                          required
                          placeholder="Ana López"
                          value={secNombre}
                          onChange={(e) => setSecNombre(e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Correo</Label>
                        <Input
                          type="email"
                          required
                          placeholder="secretaria@ejemplo.com"
                          value={secEmail}
                          onChange={(e) => setSecEmail(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Contraseña</Label>
                        <Input
                          type="password"
                          required
                          minLength={6}
                          placeholder="Mínimo 6 caracteres"
                          value={secPassword}
                          onChange={(e) => setSecPassword(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      {secError && (
                        <p className="text-xs text-destructive">{secError}</p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          type="submit"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={secLoading}
                        >
                          {secLoading ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              {secStep}
                            </>
                          ) : (
                            "Crear"
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => {
                            setSecOpen(false);
                            setSecNombre("");
                            setSecEmail("");
                            setSecPassword("");
                            setSecError("");
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  )}

                  {secretarias.length === 0 && !secOpen ? (
                    <p className="text-xs text-muted-foreground py-2">
                      No hay secretarias. Crea la primera.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {secretarias.map((sec) => (
                        <SecretariaRow
                          key={sec.id}
                          sec={sec}
                          doctors={doctors}
                          asignadas={asignacionesMap.get(sec.id) ?? new Set()}
                          onToggle={(doctorId, asignar) =>
                            handleToggle(sec.id, doctorId, asignar)
                          }
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Doctores */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                      <Stethoscope className="h-4 w-4" />
                      Doctores
                      <span className="text-xs font-normal text-muted-foreground ml-1">
                        ({doctors.length})
                      </span>
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 text-xs"
                      onClick={() => {
                        setDocOpen((v) => !v);
                        setDocError("");
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Nuevo
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {docOpen && (
                    <form
                      onSubmit={handleCreateDoctor}
                      className="border rounded-lg p-3 space-y-2.5 bg-muted/30"
                    >
                      <div className="space-y-1">
                        <Label className="text-xs">Nombre</Label>
                        <Input
                          required
                          placeholder="Dr. García"
                          value={docNombre}
                          onChange={(e) => setDocNombre(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Especialidad (opcional)</Label>
                        <Input
                          placeholder="Cardiología"
                          value={docEsp}
                          onChange={(e) => setDocEsp(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      {docError && (
                        <p className="text-xs text-destructive">{docError}</p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          type="submit"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={docLoading}
                        >
                          {docLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Crear"
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => {
                            setDocOpen(false);
                            setDocNombre("");
                            setDocEsp("");
                            setDocError("");
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  )}

                  {doctors.length === 0 && !docOpen ? (
                    <p className="text-xs text-muted-foreground py-2">
                      No hay doctores. Crea el primero.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {doctors.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between px-3 py-2 rounded-md border text-sm"
                        >
                          <div>
                            <span className="font-medium">{doc.nombre}</span>
                            {doc.especialidad && (
                              <span className="text-xs text-muted-foreground ml-2">
                                {doc.especialidad}
                              </span>
                            )}
                          </div>
                          {!doc.activo && (
                            <span className="text-xs text-muted-foreground">
                              Inactivo
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
