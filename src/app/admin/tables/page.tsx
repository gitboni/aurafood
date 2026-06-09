"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FloorTable } from "@/lib/types";
import {
  Home, LogOut, Plus, Pencil, Trash2, MapPin, Eye, EyeOff, X, Users,
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
const CELL = 66; // px per cell
const CHAIR = 11; // chair size px
const MARGIN = 16; // band around table surface where chairs sit

// Zone color coding — makes the floor plan readable at a glance
const ZONES: Record<string, { label: string; surface: string; dot: string }> = {
  main: { label: "Salón", surface: "bg-primary text-primary-foreground", dot: "bg-primary" },
  terrace: { label: "Terraza", surface: "bg-emerald-500 text-white", dot: "bg-emerald-500" },
  bar: { label: "Barra", surface: "bg-amber-500 text-white", dot: "bg-amber-500" },
  vip: { label: "VIP", surface: "bg-violet-500 text-white", dot: "bg-violet-500" },
};
const zoneOf = (z: string) => ZONES[z] ?? ZONES.main;

// How many chairs go on each side of a (non-round) table
function seatLayout(seats: number, shape: FloorTable["shape"]) {
  if (shape === "rect") {
    const top = Math.ceil(seats / 2);
    return { top, bottom: seats - top, left: 0, right: 0 };
  }
  const base = Math.floor(seats / 4);
  const sides: Record<string, number> = { top: base, bottom: base, left: base, right: base };
  const order = ["top", "bottom", "left", "right"];
  for (let i = 0; i < seats % 4; i++) sides[order[i]]++;
  return sides;
}

// Compute chair top-left positions inside a table footprint (W×H)
function buildChairs(seats: number, shape: FloorTable["shape"], W: number, H: number) {
  const chairs: { x: number; y: number }[] = [];
  if (shape === "round") {
    const cx = W / 2, cy = H / 2;
    const r = Math.min(W, H) / 2 - CHAIR / 2 - 1;
    for (let i = 0; i < seats; i++) {
      const a = (i / seats) * Math.PI * 2 - Math.PI / 2;
      chairs.push({ x: cx + r * Math.cos(a) - CHAIR / 2, y: cy + r * Math.sin(a) - CHAIR / 2 });
    }
    return chairs;
  }
  const sides = seatLayout(seats, shape);
  const surfW = W - 2 * MARGIN, surfH = H - 2 * MARGIN;
  const topY = Math.max(2, MARGIN - CHAIR - 2);
  const add = (count: number, axis: "h" | "v", fixed: number) => {
    for (let i = 0; i < count; i++) {
      const t = (i + 1) / (count + 1);
      if (axis === "h") chairs.push({ x: MARGIN + t * surfW - CHAIR / 2, y: fixed });
      else chairs.push({ x: fixed, y: MARGIN + t * surfH - CHAIR / 2 });
    }
  };
  add(sides.top, "h", topY);
  add(sides.bottom, "h", H - MARGIN + 2);
  add(sides.left, "v", topY);
  add(sides.right, "v", W - MARGIN + 2);
  return chairs;
}

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
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-6 py-4 flex items-center gap-4">
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
            {/* Zone legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4">
              {Object.values(ZONES).map((z) => (
                <span key={z.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={`h-3 w-3 rounded-sm ${z.dot}`} /> {z.label}
                </span>
              ))}
              <span className="ml-auto text-xs text-muted-foreground">Doble clic en una mesa para editar</span>
            </div>
            <div className="overflow-x-auto">
              <FloorGrid tables={tables.filter(t => t.active)} onMove={moveTable} onEdit={openDialog} />
            </div>
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
                  <div key={t.id} className={`flex items-center gap-3 p-3 rounded-lg border ${t.active ? "bg-card" : "bg-muted/40 opacity-60"}`}>
                    <div className={`h-10 w-10 rounded-${t.shape === "round" ? "full" : "md"} ${zoneOf(t.zone).surface} flex items-center justify-center text-sm font-bold shrink-0`}>
                      {t.name.replace(/[^0-9A-Za-z]/g, "").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{zoneOf(t.zone).label} · {t.seats} pers.</p>
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
      className="relative bg-muted/40 rounded-lg border-2 border-dashed border-border shrink-0"
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
        const W = (t.shape === "rect" ? 2 : 1) * CELL;
        const H = CELL;
        const surfRounded = t.shape === "round" ? "rounded-full" : "rounded-xl";
        const chairs = buildChairs(t.seats, t.shape, W, H);
        const zone = zoneOf(t.zone);
        return (
          <div
            key={t.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
            onDoubleClick={() => onEdit(t)}
            className="absolute cursor-move select-none group transition-transform hover:scale-[1.04] hover:z-10"
            style={{ left: t.x * CELL, top: t.y * CELL, width: W, height: H }}
            title={`${t.name} · ${zone.label} · ${t.seats} personas · doble clic para editar`}
          >
            {/* Chairs */}
            {chairs.map((c, i) => (
              <span
                key={i}
                className="absolute rounded-[3px] bg-foreground/25 dark:bg-foreground/30"
                style={{ left: c.x, top: c.y, width: CHAIR, height: CHAIR }}
              />
            ))}
            {/* Table surface */}
            <div
              className={`absolute ${surfRounded} ${zone.surface} flex flex-col items-center justify-center font-bold shadow-md ring-1 ring-black/10`}
              style={{ left: MARGIN, top: MARGIN, width: W - 2 * MARGIN, height: H - 2 * MARGIN }}
            >
              <span className="leading-none text-[11px] px-1 text-center truncate max-w-full">{t.name}</span>
              <span className="mt-0.5 flex items-center gap-0.5 text-[9px] font-medium opacity-90">
                <Users className="h-2.5 w-2.5" /> {t.seats}
              </span>
            </div>
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
