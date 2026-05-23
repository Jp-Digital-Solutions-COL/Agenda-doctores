"use client";

import { useRef, useState } from "react";
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
import { Camera, X, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  doctor: Doctor | null;
}

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

async function convertToWebP(file: File, maxWidth = 400, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Conversión fallida"));
        },
        "image/webp",
        quality
      );
    };
    img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    img.src = objectUrl;
  });
}

async function uploadToCloudinary(blob: Blob): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Cloudinary no está configurado (variables de entorno faltantes)");
  }
  const fd = new FormData();
  fd.append("file", blob, "foto.webp");
  fd.append("upload_preset", UPLOAD_PRESET);
  fd.append("folder", "agenda-medica/doctores");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: fd }
  );
  if (!res.ok) throw new Error("Error al subir la imagen");
  const data = await res.json();
  return data.secure_url as string;
}

function getInitials(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function DoctorDialog({ open, onClose, doctor }: Props) {
  const [nombre, setNombre] = useState(doctor?.nombre ?? "");
  const [especialidad, setEspecialidad] = useState(doctor?.especialidad ?? "");
  const [photoPreview, setPhotoPreview] = useState<string | null>(doctor?.foto_url ?? null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("La imagen no puede pesar más de 10 MB.");
      return;
    }
    setError("");
    try {
      const blob = await convertToWebP(file);
      setPendingBlob(blob);
      // Revoke previous blob URL if it was a local preview
      if (photoPreview && !photoPreview.startsWith("http")) {
        URL.revokeObjectURL(photoPreview);
      }
      setPhotoPreview(URL.createObjectURL(blob));
    } catch {
      setError("No se pudo procesar la imagen. Intenta con otro archivo.");
    }
    e.target.value = "";
  }

  function handleRemovePhoto() {
    if (photoPreview && !photoPreview.startsWith("http")) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(null);
    setPendingBlob(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    let fotoUrl: string | null = pendingBlob ? null : photoPreview;

    if (pendingBlob) {
      setUploading(true);
      try {
        fotoUrl = await uploadToCloudinary(pendingBlob);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo subir la foto.");
        setLoading(false);
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const result = doctor
      ? await updateDoctor(doctor.id, nombre, especialidad, fotoUrl)
      : await createDoctor(nombre, especialidad, fotoUrl);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      onClose();
    }
  }

  const initials = getInitials(nombre);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{doctor ? "Editar doctor" : "Agregar doctor"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {/* Avatar picker */}
          <div className="flex items-center gap-4">
            <div className="relative group shrink-0">
              <div
                className="w-20 h-20 rounded-full overflow-hidden bg-muted border-2 border-border flex items-center justify-center cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoPreview} alt="Foto" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-muted-foreground select-none">
                    {initials || <Camera className="h-6 w-6 opacity-40" />}
                  </span>
                )}
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <Camera className="h-5 w-5 text-white" />
                </div>
              </div>
              {photoPreview && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm"
                  title="Quitar foto"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="space-y-1 min-w-0">
              <p className="text-sm font-medium">Foto del doctor</p>
              <p className="text-xs text-muted-foreground">
                JPG, PNG o WebP · Máx 10 MB
                <br />
                Se convierte a WebP automáticamente
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-primary hover:underline"
              >
                {photoPreview ? "Cambiar foto" : "Subir foto"}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

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
              <span className="text-muted-foreground font-normal">(opcional)</span>
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
            <Button variant="outline" type="button" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !nombre.trim()}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Subiendo foto...
                </>
              ) : loading ? (
                "Guardando..."
              ) : doctor ? (
                "Guardar cambios"
              ) : (
                "Agregar doctor"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
