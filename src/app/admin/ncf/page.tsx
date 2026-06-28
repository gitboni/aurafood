"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { NCFSequence, NCFType, NCF_LABELS } from "@/lib/types";
import { useTenantId } from "@/lib/tenant-client";
import {
  Home, LogOut, Plus, Pencil, Trash2, FileText, AlertTriangle, Calendar, CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";

const NCF_TYPES_AVAILABLE: NCFType[] = ["B01", "B02", "B14", "B15", "B03", "B04"];

export default function NCFAdminPage() {
  const { tenantId } = useTenantId();
  const supabase = createClient();

  const [sequences, setSequences] = useState<NCFSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<NCFSequence | null>(null);

  const [tipo, setTipo] = useState<NCFType>("B02");
  const [rangeStart, setRangeStart] = useState("1");
  const [rangeEnd, setRangeEnd] = useState("1000");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");

  async function load() {
    if (!tenantId) return;
    const { data } = await supabase
      .from("ncf_sequences")
      .select("*")
      .eq("restaurant_id", tenantId)
      .order("tipo")
      .order("created_at", { ascending: false });
    if (data) setSequences(data);
    setLoading(false);
  }

  useEffect(() => { if (tenantId) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tenantId]);

  function openDialog(seq?: NCFSequence) {
    if (seq) {
      setEditing(seq);
      setTipo(seq.tipo);
      setRangeStart(seq.range_start.toString());
      setRangeEnd(seq.range_end.toString());
      setExpiresAt(seq.expires_at ?? "");
      setNotes(seq.notes ?? "");
    } else {
      setEditing(null);
      setTipo("B02");
      setRangeStart("1"); setRangeEnd("1000"); setExpiresAt(""); setNotes("");
    }
    setShowDialog(true);
  }

  async function saveSequence() {
    if (!tenantId) return;
    const start = parseInt(rangeStart);
    const end = parseInt(rangeEnd);
    if (isNaN(start) || isNaN(end) || start < 1 || end <= start) {
      toast.error("Rango inválido"); return;
    }

    const payload = {
      restaurant_id: tenantId,
      tipo,
      prefix: tipo,
      range_start: start,
      range_end: end,
      expires_at: expiresAt || null,
      notes: notes || null,
      active: true,
    };

    if (editing) {
      await supabase.from("ncf_sequences").update(payload).eq("id", editing.id);
      toast.success("Secuencia actualizada");
    } else {
      await supabase.from("ncf_sequences").insert({ ...payload, current: start - 1 });
      toast.success("Secuencia creada");
    }
    setShowDialog(false);
    load();
  }

  async function toggleActive(seq: NCFSequence) {
    await supabase.from("ncf_sequences").update({ active: !seq.active }).eq("id", seq.id);
    load();
  }

  async function deleteSequence(id: string) {
    if (!confirm("¿Eliminar esta secuencia? No se puede deshacer.")) return;
    await supabase.from("ncf_sequences").delete().eq("id", id);
    toast.success("Eliminada");
    load();
  }

  function statusOf(seq: NCFSequence): { label: string; cls: string; icon: typeof CheckCircle2 } {
    if (!seq.active) return { label: "Inactiva", cls: "bg-gray-200 text-gray-700", icon: AlertTriangle };
    if (seq.expires_at && new Date(seq.expires_at) < new Date()) {
      return { label: "Vencida", cls: "bg-red-100 text-red-700", icon: AlertTriangle };
    }
    if (seq.current >= seq.range_end) {
      return { label: "Agotada", cls: "bg-red-100 text-red-700", icon: AlertTriangle };
    }
    const remaining = seq.range_end - seq.current;
    const total = seq.range_end - seq.range_start + 1;
    if (remaining / total < 0.1) {
      return { label: "Baja", cls: "bg-yellow-100 text-yellow-800", icon: AlertTriangle };
    }
    return { label: "Activa", cls: "bg-green-100 text-green-700", icon: CheckCircle2 };
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-6 py-4 flex items-center gap-4">
        <Link href="/"><Button variant="ghost" size="icon"><Home className="h-5 w-5" /></Button></Link>
        <FileText className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold">NCF — Comprobantes Fiscales</h1>
          <p className="text-xs text-muted-foreground">Secuencias autorizadas por la DGII</p>
        </div>
        <div className="flex-1" />
        <Button className="bg-primary hover:bg-primary/90" onClick={() => openDialog()}>
          <Plus className="h-4 w-4 mr-2" /> Nueva Secuencia
        </Button>
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={async () => {
          await supabase.auth.signOut(); window.location.href = "/login";
        }}><LogOut className="h-5 w-5" /></Button>
      </header>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Info card */}
        <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200">
          <CardContent className="p-4 text-sm space-y-1">
            <p className="font-bold text-blue-700 dark:text-blue-300">📋 Sobre los NCF</p>
            <p className="text-blue-700 dark:text-blue-300">
              Los <strong>Números de Comprobante Fiscal</strong> son rangos asignados por la DGII.
              Cada venta consume un NCF. Tipos comunes:
            </p>
            <ul className="list-disc pl-5 text-blue-600 dark:text-blue-400 text-xs space-y-0.5 mt-1">
              <li><strong>B01</strong> — Crédito Fiscal (cliente con RNC pide factura formal)</li>
              <li><strong>B02</strong> — Consumidor Final (la mayoría de ventas al público)</li>
              <li><strong>B14</strong> — Régimen Especial</li>
              <li><strong>B15</strong> — Gubernamental</li>
            </ul>
          </CardContent>
        </Card>

        {/* Sequences list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Secuencias ({sequences.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Cargando...</p>
            ) : sequences.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto opacity-30 mb-3" />
                <p className="font-semibold">No hay secuencias configuradas</p>
                <p className="text-xs mt-1">Solicita los NCF a la DGII y cárgalos aquí.</p>
                <Button className="mt-4 bg-primary hover:bg-primary/90" onClick={() => openDialog()}>
                  <Plus className="h-4 w-4 mr-2" /> Crear primera secuencia
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sequences.map((s) => {
                  const st = statusOf(s);
                  const used = s.current - (s.range_start - 1);
                  const total = s.range_end - s.range_start + 1;
                  const pct = Math.round((used / total) * 100);
                  const StatusIcon = st.icon;
                  return (
                    <div key={s.id} className="border rounded-lg p-4 space-y-3 bg-card">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-display text-2xl font-bold text-primary">{s.tipo}</span>
                            <Badge className={st.cls}>
                              <StatusIcon className="h-3 w-3 mr-1" /> {st.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{NCF_LABELS[s.tipo]}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openDialog(s)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteSequence(s.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between tabular">
                          <span className="text-muted-foreground">Rango:</span>
                          <span className="font-medium">
                            {s.prefix}{String(s.range_start).padStart(8, "0")} → {s.prefix}{String(s.range_end).padStart(8, "0")}
                          </span>
                        </div>
                        <div className="flex justify-between tabular">
                          <span className="text-muted-foreground">Próximo:</span>
                          <span className="font-bold text-primary">
                            {s.current < s.range_end
                              ? `${s.prefix}${String(s.current + 1).padStart(8, "0")}`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between tabular">
                          <span className="text-muted-foreground">Usados / Total:</span>
                          <span className="font-medium">{used.toLocaleString()} / {total.toLocaleString()}</span>
                        </div>
                        {s.expires_at && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> Vence:
                            </span>
                            <span className="font-medium">
                              {new Date(s.expires_at).toLocaleDateString("es-DO")}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-green-500"}`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground text-right">{pct}% consumido</p>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs"
                        onClick={() => toggleActive(s)}
                      >
                        {s.active ? "Desactivar" : "Activar"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar" : "Nueva"} Secuencia NCF</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de Comprobante</Label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as NCFType)}
                disabled={!!editing}
                className="mt-1 w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
              >
                {NCF_TYPES_AVAILABLE.map((t) => (
                  <option key={t} value={t}>{t} — {NCF_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Desde N°</Label>
                <Input type="number" min="1" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="tabular" />
              </div>
              <div>
                <Label>Hasta N°</Label>
                <Input type="number" min="1" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="tabular" />
              </div>
            </div>
            <div className="text-xs text-muted-foreground bg-muted/40 rounded-md p-2.5 tabular">
              Generará desde <strong>{tipo}{String(parseInt(rangeStart) || 0).padStart(8, "0")}</strong>
              {" "}hasta <strong>{tipo}{String(parseInt(rangeEnd) || 0).padStart(8, "0")}</strong>
              {" "}({Math.max(0, (parseInt(rangeEnd) || 0) - (parseInt(rangeStart) || 0) + 1).toLocaleString()} comprobantes)
            </div>
            <div>
              <Label>Fecha de vencimiento (DGII)</Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">Opcional. La DGII puede asignar una vigencia.</p>
            </div>
            <div>
              <Label>Notas</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" placeholder="Solicitud DGII #..." />
            </div>
            <Button className="w-full bg-primary hover:bg-primary/90" onClick={saveSequence}>
              {editing ? "Guardar Cambios" : "Crear Secuencia"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
