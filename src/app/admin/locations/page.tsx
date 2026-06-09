"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Location } from "@/lib/types";
import { Home, LogOut, Loader2, Plus, Pencil, Trash2, MapPin, Eye, EyeOff, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";

const ACTIVE_LOCATION_KEY = "aurafood-active-location";

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [name, setName] = useState(""); const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);

  const supabase = createClient();

  async function load() {
    const { data, error } = await supabase.from("locations").select("*").order("created_at");
    if (error?.code === "42P01") { setNeedsSetup(true); setLoading(false); return; }
    setLocations(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    if (typeof window !== "undefined") setActiveId(localStorage.getItem(ACTIVE_LOCATION_KEY));
  }, []);

  function selectLocation(id: string) {
    localStorage.setItem(ACTIVE_LOCATION_KEY, id);
    setActiveId(id);
    toast.success("Sucursal activa cambiada");
  }

  function openDialog(loc?: Location) {
    if (loc) { setEditing(loc); setName(loc.name); setAddress(loc.address ?? ""); setPhone(loc.phone ?? ""); }
    else { setEditing(null); setName(""); setAddress(""); setPhone(""); }
    setShowDialog(true);
  }

  async function save() {
    if (!name.trim()) return;
    const payload = { name, address: address || null, phone: phone || null };
    const op = editing
      ? supabase.from("locations").update(payload).eq("id", editing.id)
      : supabase.from("locations").insert({ ...payload, active: true });
    const { error } = await op;
    if (error) { toast.error("Error al guardar"); return; }
    toast.success(editing ? "Sucursal actualizada" : "Sucursal creada");
    setShowDialog(false); load();
  }

  async function toggleActive(loc: Location) {
    await supabase.from("locations").update({ active: !loc.active }).eq("id", loc.id);
    load();
  }

  async function remove(loc: Location) {
    const { error } = await supabase.from("locations").delete().eq("id", loc.id);
    if (error) { toast.error("No se pudo eliminar"); return; }
    toast.success("Sucursal eliminada");
    setDeleteTarget(null); load();
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (needsSetup) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-gray-50">
      <MapPin className="h-12 w-12 text-primary" />
      <h2 className="text-xl font-bold">Configura la tabla de sucursales</h2>
      <p className="text-muted-foreground text-center max-w-md">
        Ejecuta <code className="bg-muted px-1 rounded">supabase-crm-locations.sql</code> en Supabase.
      </p>
      <Button onClick={() => { setNeedsSetup(false); setLoading(true); load(); }}>Reintentar</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/"><Button variant="ghost" size="icon"><Home className="h-5 w-5" /></Button></Link>
        <MapPin className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Sucursales</h1>
        <div className="flex-1" />
        <Button className="bg-primary hover:bg-primary/90" onClick={() => openDialog()}>
          <Plus className="h-4 w-4 mr-2" /> Nueva Sucursal
        </Button>
        <Button variant="ghost" size="icon" onClick={async () => {
          await supabase.auth.signOut(); window.location.href = "/login";
        }}><LogOut className="h-5 w-5" /></Button>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        {locations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No hay sucursales. Crea la primera.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {locations.map((loc) => (
              <Card key={loc.id} className={`${!loc.active ? "opacity-50" : ""} ${activeId === loc.id ? "ring-2 ring-primary" : ""}`}>
                <CardContent className="flex items-start gap-3 p-4">
                  <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{loc.name}</p>
                      {activeId === loc.id && (
                        <Badge className="bg-primary/10 text-primary border-0 text-[10px]">Activa</Badge>
                      )}
                    </div>
                    {loc.address && <p className="text-xs text-muted-foreground truncate">{loc.address}</p>}
                    {loc.phone && <p className="text-xs text-muted-foreground">{loc.phone}</p>}
                    {loc.active && activeId !== loc.id && (
                      <Button size="sm" variant="outline" className="mt-2 h-7 text-xs"
                        onClick={() => selectLocation(loc.id)}>
                        Usar esta sucursal
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleActive(loc)}>
                      {loc.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openDialog(loc)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                      onClick={() => setDeleteTarget(loc)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar" : "Nueva"} Sucursal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Sucursal Centro" /></div>
            <div><Label>Dirección</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
            <div><Label>Teléfono</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <Button className="w-full bg-primary hover:bg-primary/90" onClick={save}>
              {editing ? "Guardar" : "Crear"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar sucursal"
        description={`¿Eliminar "${deleteTarget?.name}"? Las órdenes con esta sucursal quedarán huérfanas.`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => deleteTarget && remove(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
