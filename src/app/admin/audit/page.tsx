"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuditEntry } from "@/lib/types";
import { Home, LogOut, Loader2, History, Search, Filter } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-800 border-green-200",
  update: "bg-blue-100 text-blue-800 border-blue-200",
  delete: "bg-red-100 text-red-800 border-red-200",
  refund: "bg-rose-100 text-rose-800 border-rose-200",
  cancel: "bg-orange-100 text-orange-800 border-orange-200",
};

const ENTITY_LABELS: Record<string, string> = {
  products: "Producto",
  ingredients: "Ingrediente",
  orders: "Orden",
  settings: "Ajustes",
  profiles: "Usuario",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Creó",
  update: "Editó",
  delete: "Eliminó",
};

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("");

  const supabase = createClient();

  async function load() {
    let q = supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(500);
    if (entityFilter) q = q.eq("entity", entityFilter);
    if (actionFilter) q = q.eq("action", actionFilter);
    const { data, error } = await q;
    if (error?.code === "42P01") { setNeedsSetup(true); setLoading(false); return; }
    setEntries(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [entityFilter, actionFilter]);

  const filtered = search.trim()
    ? entries.filter((e) => {
        const q = search.toLowerCase();
        return (
          (e.user_name ?? "").toLowerCase().includes(q) ||
          (e.entity_id ?? "").toLowerCase().includes(q) ||
          JSON.stringify(e.changes ?? {}).toLowerCase().includes(q)
        );
      })
    : entries;

  function summarize(e: AuditEntry): string {
    const changes = e.changes;
    if (!changes) return "—";
    // Update format: { field: {from, to} }
    if (e.action === "update") {
      const keys = Object.keys(changes).filter((k) => k !== "updated_at" && k !== "created_at");
      if (keys.length === 0) return "Sin cambios visibles";
      return keys
        .slice(0, 3)
        .map((k) => {
          const v = changes[k] as { from?: unknown; to?: unknown };
          const f = v?.from === null || v?.from === undefined ? "∅" : String(v?.from);
          const t = v?.to === null || v?.to === undefined ? "∅" : String(v?.to);
          return `${k}: ${truncate(f)} → ${truncate(t)}`;
        })
        .join(" · ") + (keys.length > 3 ? ` (+${keys.length - 3})` : "");
    }
    // Create/delete: show name if there is one
    const o = changes as Record<string, unknown>;
    return String(o.name ?? o.display_name ?? o.restaurant_name ?? "—");
  }

  function truncate(s: string, n = 30) {
    return s.length > n ? s.slice(0, n) + "…" : s;
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
    </div>
  );

  if (needsSetup) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-gray-50">
      <History className="h-12 w-12 text-orange-500" />
      <h2 className="text-xl font-bold">Configura la tabla de auditoría</h2>
      <p className="text-muted-foreground text-center max-w-md">
        Ejecuta <code className="bg-muted px-1 rounded">supabase-ops.sql</code> en Supabase.
      </p>
      <Button onClick={() => { setNeedsSetup(false); setLoading(true); load(); }}>Reintentar</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/"><Button variant="ghost" size="icon"><Home className="h-5 w-5" /></Button></Link>
        <History className="h-5 w-5 text-orange-500" />
        <h1 className="text-xl font-bold">Auditoría</h1>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" onClick={async () => {
          await supabase.auth.signOut(); window.location.href = "/login";
        }}><LogOut className="h-5 w-5" /></Button>
      </header>

      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar usuario, ID o cambio..."
                  className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select className="h-9 rounded-md border px-2 text-sm"
                  value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
                  <option value="">Todas las entidades</option>
                  {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <select className="h-9 rounded-md border px-2 text-sm"
                value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
                <option value="">Todas las acciones</option>
                <option value="create">Crear</option>
                <option value="update">Editar</option>
                <option value="delete">Eliminar</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">Sin registros</p>
            ) : (
              <div className="divide-y">
                {filtered.map((e) => (
                  <div key={e.id} className="p-3 hover:bg-muted/30 flex items-start gap-3">
                    <div className="text-xs text-muted-foreground w-20 shrink-0 pt-0.5 tabular-nums">
                      {new Date(e.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                      <div className="text-[10px]">
                        {new Date(e.created_at).toLocaleDateString("es-MX")}
                      </div>
                    </div>
                    <Badge variant="outline" className={`shrink-0 mt-0.5 ${ACTION_COLORS[e.action] ?? ""}`}>
                      {ACTION_LABELS[e.action] ?? e.action}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-semibold">{e.user_name ?? "Sistema"}</span>{" "}
                        <span className="text-muted-foreground">
                          {ACTION_LABELS[e.action]?.toLowerCase() ?? e.action} {ENTITY_LABELS[e.entity] ?? e.entity}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 break-words">
                        {summarize(e)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
