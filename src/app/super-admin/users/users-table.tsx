"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, KeyRound, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { resetUserPassword, changeUserRole, type UserRow } from "./actions";

const ROLE_STYLES: Record<string, string> = {
  super_admin: "bg-violet-500 text-white",
  admin: "bg-blue-500 text-white",
  cashier: "bg-amber-500 text-white",
  kitchen: "bg-emerald-500 text-white",
};

export function UsersTable({ initial }: { initial: UserRow[] }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ id: string; email: string; pw: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initial
      .filter((u) =>
        !q ||
        u.email?.toLowerCase().includes(q) ||
        u.display_name?.toLowerCase().includes(q) ||
        u.restaurant_name?.toLowerCase().includes(q) ||
        u.restaurant_slug?.toLowerCase().includes(q)
      )
      .filter((u) => roleFilter === "all" || u.role === roleFilter);
  }, [initial, search, roleFilter]);

  async function onReset(u: UserRow) {
    if (!confirm(`¿Resetear contraseña de ${u.email}?`)) return;
    setBusyId(u.id);
    const res = await resetUserPassword(u.id);
    setBusyId(null);
    if (!res.ok) { toast.error(res.error); return; }
    setResetResult({ id: u.id, email: u.email ?? "", pw: res.password });
    toast.success("Contraseña reseteada");
  }

  async function onRoleChange(u: UserRow, role: string) {
    if (role === u.role) return;
    setBusyId(u.id);
    const res = await changeUserRole(u.id, role as "admin" | "cashier" | "kitchen");
    setBusyId(null);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Rol actualizado");
  }

  function copyCreds() {
    if (!resetResult) return;
    navigator.clipboard.writeText(
      `Email: ${resetResult.email}\nContraseña: ${resetResult.pw}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 p-3 border-b">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por email, nombre o restaurante..."
            className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={roleFilter} onValueChange={(v) => v && setRoleFilter(v)}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            <SelectItem value="super_admin">Super admin</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="cashier">Cashier</SelectItem>
            <SelectItem value="kitchen">Kitchen</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {resetResult && (
        <div className="mx-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 space-y-2">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            ✓ Contraseña reseteada para {resetResult.email}
          </p>
          <div className="font-mono text-sm bg-card rounded-md border p-2">
            <strong>{resetResult.pw}</strong>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={copyCreds} className="gap-1.5">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setResetResult(null)}>Cerrar</Button>
          </div>
        </div>
      )}

      <p className="px-3 text-xs text-muted-foreground">
        Mostrando <strong className="tabular-nums">{filtered.length}</strong> de {initial.length} usuarios
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground uppercase tracking-wide border-b">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Usuario</th>
              <th className="text-left px-3 py-2 font-medium">Restaurante</th>
              <th className="text-left px-3 py-2 font-medium">Rol</th>
              <th className="text-left px-3 py-2 font-medium">Último login</th>
              <th className="text-right px-3 py-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2">
                  <p className="font-medium">{u.display_name || "Sin nombre"}</p>
                  <p className="text-[11px] text-muted-foreground">{u.email ?? "—"}</p>
                </td>
                <td className="px-3 py-2">
                  {u.restaurant_slug ? (
                    <Link href={`/super-admin/restaurants/${u.restaurant_id}`}
                      className="text-primary hover:underline">
                      <p>{u.restaurant_name}</p>
                      <p className="text-[11px] text-muted-foreground">/r/{u.restaurant_slug}</p>
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">— sin tenant —</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {u.role === "super_admin" ? (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ROLE_STYLES[u.role]}`}>
                      super_admin
                    </span>
                  ) : (
                    <Select
                      value={u.role}
                      onValueChange={(v) => v && onRoleChange(u, v)}
                      disabled={busyId === u.id}
                    >
                      <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="cashier">Cashier</SelectItem>
                        <SelectItem value="kitchen">Kitchen</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                  {u.last_sign_in_at
                    ? new Date(u.last_sign_in_at).toLocaleDateString("es-MX")
                    : "Nunca"}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button size="icon" variant="ghost" className="h-7 w-7"
                    onClick={() => onReset(u)} disabled={busyId === u.id}
                    title="Resetear contraseña">
                    {busyId === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-12 text-center text-muted-foreground">
                  Ningún usuario coincide con los filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
