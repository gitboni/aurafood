"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { inviteTenantAdmin } from "../actions";

type ExistingAdmin = {
  id: string;
  display_name: string | null;
  role: string;
};

export function InviteAdmin({
  restaurantId,
  existing,
}: {
  restaurantId: string;
  existing: ExistingAdmin[];
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ email: string; pw: string } | null>(
    null
  );
  const [copied, setCopied] = useState(false);

  async function invite() {
    if (!email.trim()) {
      toast.error("Ingresa un email");
      return;
    }
    setSending(true);
    const res = await inviteTenantAdmin(restaurantId, email, name);
    setSending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setResult({ email: email.trim().toLowerCase(), pw: res.tempPassword });
    setEmail("");
    setName("");
    toast.success("Admin creado");
  }

  function copyCreds() {
    if (!result) return;
    navigator.clipboard.writeText(
      `Email: ${result.email}\nContraseña temporal: ${result.pw}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      {existing.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Admins actuales ({existing.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {existing.map((a) => (
              <span
                key={a.id}
                className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground"
              >
                {a.display_name || "Sin nombre"}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label>Nombre del dueño</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Juan Pérez"
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="dueno@restaurante.com"
          />
        </div>
      </div>
      <Button onClick={invite} disabled={sending} className="gap-1.5">
        {sending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
        Crear admin del restaurante
      </Button>

      {result && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4 space-y-2">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            ✓ Admin creado — comparte estas credenciales con el dueño
          </p>
          <div className="font-mono text-sm bg-card rounded-md border p-3 space-y-1">
            <div>
              <span className="text-muted-foreground">Email: </span>
              {result.email}
            </div>
            <div>
              <span className="text-muted-foreground">Contraseña: </span>
              <strong>{result.pw}</strong>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={copyCreds} className="gap-1.5">
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copiado" : "Copiar"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Esta contraseña no se vuelve a mostrar. El dueño la puede cambiar al entrar.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
