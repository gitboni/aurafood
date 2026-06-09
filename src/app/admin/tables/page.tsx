"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FloorTable } from "@/lib/types";
import {
  Home, LogOut, Plus, Pencil, Trash2, MapPin, Eye, EyeOff, X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";

const GRID_COLS = 12;
const GRID_ROWS = 8;
const CELL = 56; // px per cell

export default function TablesAdminPage() {
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<FloorTable | null>(null);

  const [name, setName] = useState("");
  const [zone, setZone] = useState("main");
  const [seats, setSeats] = useState("4");
  const [shape, setShape] = useState<FloorTable["shape"]>("square");
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);

  const supabase = createClient();

  async function load() {
    const { data } = await supabase.from("floor_tables").select("*").order("sort_order");
    if (data) setTables(data);
  }
  useEffect(() => { load(); }, []);

  function openDialog(t?: FloorTable) {
    if (t) {
      setEditing(t);
      setName(t.name); setZone(t.zone); setSeats(t.seats.toString());
      setShape(t.shape); setX(t.x); setY(t.y);
    } else {
      setEditing(null);
      setName(""); setZone("main"); setSeats("4"); setShape("square"); setX(0); setY(0);
    }
    setShowDialog(true);
  }

  async function saveTable() {
    if (!name.trim()) { toast.error("Pon un nombre"); return; }
    const payload = {
      name, zone, seats: parseInt(seats) || 4, shape, x, y,
    };
    if (editing) {
      await supabase.from("floor_tables").update(payload).eq("id", editing.id);
      toast.success("Mesa actualizada");
    } else {
      await supabase.from("floor_tables").insert({ ...payload, sort_order: tables.length });
      toast.success("Mesa creada");
    }
    setShowDialog(false);
    load();
  }

  async function deleteTable(id: string) {
    if (!confirm("¿Eliminar mesa?")) return;
    await supabase.from("floor_tables").delete().eq("id", id);
    toast.success("Mesa eliminada");
    load();
  }

  async function toggleTable(t: FloorTable) {
    await supabase.from("floor_tables").update({ active: !t.active }).eq("id", t.id);
    load();
  }

  // Drag-to-position on the grid preview
  async function moveTable(id: string, nx: number, ny: number) {
    nx = Math.max(0, Math.min(GRID_COLS - 1, nx));
    ny = Math.max(0, Math.min(GRID_ROWS - 1, ny));
    setTables((prev) => prev.map((t) => t.id === id ? { ...t, x: nx, y: ny } : t));
    await supabase.from("floor_tables").update({ x: nx, y: ny }).eq("id", id);
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b px-6 py-4 flex items-center gap-4">
        <Link href="/"><Button variant="ghost" size="icon"><Home className="h-5 w-5" /></Button></Link>
        <MapPin className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Mapa de Mesas</h1>
        <div className="flex-1" />
        <Link href="/floor"><Button variant="outline" size="sm"><Eye className="h-4 w-4 mr-1" /> Ver Salón</Button></Link>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => openDialog()}>
          <Plus className="h-4 w-4 mr-2" /> Nueva Mesa
        </Button>
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={async () => {
          await supabase.auth.signOut(); window.location.href = "/login";
        }}><LogOut className="h-5 w-5" /></Button>
      </header>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribución del salón</CardTitle>
            <p className="text-xs text-muted-foreground">
              Arrastra las mesas para reposicionarlas. {GRID_COLS}×{GRID_ROWS} cuadrícula.
            </p>
          </CardHeader>
          <CardContent>
            <FloorGrid tables={tables.filter(t => t.active)} onMove={moveTable} onEdit={openDialog} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Mesas ({tables.length})</CardTitle></CardHeader>
          <CardContent>
            {tables.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hay mesas. Crea una para empezar.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {tables.map((t) => (
                  <div key={t.id} className={`flex items-center gap-3 p-3 rounded-lg border ${t.active ? "bg-white dark:bg-slate-900" : "bg-muted/40 opacity-60"}`}>
                    <div className={`h-10 w-10 rounded-${t.shape === "round" ? "full" : "md"} bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0`}>
                      {t.name.replace(/[^0-9A-Za-z]/g, "").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.zone} · {t.seats} pers.</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleTable(t)} title={t.active ? "Ocultar" : "Mostrar"}>
                        {t.active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openDialog(t)} title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteTable(t.id)} title="Eliminar">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Nueva"} Mesa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nombre</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mesa 1" />
              </div>
              <div>
                <Label>Zona</Label>
                <select value={zone} onChange={(e) => setZone(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm">
                  <option value="main">Salón principal</option>
                  <option value="terrace">Terraza</option>
                  <option value="bar">Barra</option>
                  <option value="vip">VIP</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Asientos</Label>
                <Input type="number" min="1" value={seats} onChange={(e) => setSeats(e.target.value)} />
              </div>
              <div>
                <Label>Forma</Label>
                <select value={shape} onChange={(e) => setShape(e.target.value as FloorTable["shape"])}
                  className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm">
                  <option value="square">Cuadrada</option>
                  <option value="round">Redonda</option>
                  <option value="rect">Rectangular</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Posición X (col 0-{GRID_COLS - 1})</Label>
                <Input type="number" min="0" max={GRID_COLS - 1} value={x} onChange={(e) => setX(parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Posición Y (fila 0-{GRID_ROWS - 1})</Label>
                <Input type="number" min="0" max={GRID_ROWS - 1} value={y} onChange={(e) => setY(parseInt(e.target.value) || 0)} />
              </div>
            </div>
            <Button className="w-full bg-primary hover:bg-primary/90 text-white" onClick={saveTable}>
              {editing ? "Guardar Cambios" : "Crear Mesa"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FloorGrid({
  tables, onMove, onEdit,
}: {
  tables: FloorTable[];
  onMove: (id: string, x: number, y: number) => void;
  onEdit: (t: FloorTable) => void;
}) {
  return (
    <div
      className="relative bg-gray-100 dark:bg-slate-800/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-700"
      style={{
        width: GRID_COLS * CELL,
        height: GRID_ROWS * CELL,
        backgroundImage:
          "linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)",
        backgroundSize: `${CELL}px ${CELL}px`,
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const id = e.dataTransfer.getData("text/plain");
        const rect = e.currentTarget.getBoundingClientRect();
        const nx = Math.floor((e.clientX - rect.left) / CELL);
        const ny = Math.floor((e.clientY - rect.top) / CELL);
        if (id) onMove(id, nx, ny);
      }}
    >
      {tables.map((t) => {
        const w = t.shape === "rect" ? CELL * 2 - 4 : CELL - 4;
        const h = CELL - 4;
        const rounded = t.shape === "round" ? "rounded-full" : "rounded-md";
        return (
          <div
            key={t.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
            onDoubleClick={() => onEdit(t)}
            className={`absolute ${rounded} bg-primary text-primary-foreground flex flex-col items-center justify-center text-xs font-bold cursor-move select-none shadow-md hover:shadow-lg hover:scale-105 transition-all`}
            style={{ left: t.x * CELL + 2, top: t.y * CELL + 2, width: w, height: h }}
            title={`${t.name} · ${t.seats} pers · doble click para editar`}
          >
            <span className="leading-tight">{t.name}</span>
            <span className="text-[9px] opacity-80">{t.seats}p</span>
          </div>
        );
      })}
      {tables.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
          No hay mesas activas
        </div>
      )}
    </div>
  );
}
