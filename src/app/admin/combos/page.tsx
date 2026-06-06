"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Combo, ComboItem, Product } from "@/lib/types";
import {
  Home, LogOut, Plus, Pencil, Trash2, Package2, Star, Eye, EyeOff, X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";

type ComboFull = Combo & { combo_items: ComboItem[] };

export default function CombosPage() {
  const [combos, setCombos] = useState<ComboFull[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<ComboFull | null>(null);

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [featured, setFeatured] = useState(false);
  const [lines, setLines] = useState<{ product_id: string; product_name: string; quantity: number }[]>([]);
  const [addProdId, setAddProdId] = useState("");

  const supabase = createClient();

  async function load() {
    const [cRes, pRes] = await Promise.all([
      supabase.from("combos").select("*, combo_items(*)").order("sort_order"),
      supabase.from("products").select("id, name, price").order("name"),
    ]);
    if (cRes.data) setCombos(cRes.data as ComboFull[]);
    if (pRes.data) setProducts(pRes.data as Product[]);
  }
  useEffect(() => { load(); }, []);

  function openDialog(combo?: ComboFull) {
    if (combo) {
      setEditing(combo);
      setName(combo.name); setDesc(combo.description ?? "");
      setPrice(combo.price.toString()); setFeatured(combo.featured);
      setLines((combo.combo_items ?? []).map((i) => ({ product_id: i.product_id, product_name: i.product_name, quantity: i.quantity })));
    } else {
      setEditing(null);
      setName(""); setDesc(""); setPrice(""); setFeatured(false); setLines([]);
    }
    setAddProdId("");
    setShowDialog(true);
  }

  function addLine() {
    const p = products.find((x) => x.id === addProdId);
    if (!p) return;
    if (lines.some((l) => l.product_id === p.id)) { toast.error("Ya está en el combo"); return; }
    setLines([...lines, { product_id: p.id, product_name: p.name, quantity: 1 }]);
    setAddProdId("");
  }

  async function saveCombo() {
    if (!name.trim() || !price || lines.length === 0) {
      toast.error("Nombre, precio y al menos un producto"); return;
    }
    const payload = {
      name, description: desc || null, price: parseFloat(price), featured,
    };
    let comboId = editing?.id;
    if (editing) {
      await supabase.from("combos").update(payload).eq("id", editing.id);
      await supabase.from("combo_items").delete().eq("combo_id", editing.id);
    } else {
      const { data } = await supabase.from("combos").insert({ ...payload, sort_order: combos.length }).select("id").single();
      comboId = data?.id;
    }
    if (comboId) {
      await supabase.from("combo_items").insert(
        lines.map((l) => ({ combo_id: comboId, product_id: l.product_id, product_name: l.product_name, quantity: l.quantity }))
      );
    }
    toast.success(editing ? "Combo actualizado" : "Combo creado");
    setShowDialog(false);
    load();
  }

  async function deleteCombo(id: string) {
    await supabase.from("combos").delete().eq("id", id);
    toast.success("Combo eliminado");
    load();
  }
  async function toggleCombo(c: ComboFull) {
    await supabase.from("combos").update({ available: !c.available }).eq("id", c.id);
    load();
  }

  const regularTotal = lines.reduce((s, l) => {
    const p = products.find((x) => x.id === l.product_id);
    return s + (p ? p.price * l.quantity : 0);
  }, 0);
  const savings = regularTotal - (parseFloat(price) || 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/"><Button variant="ghost" size="icon"><Home className="h-5 w-5" /></Button></Link>
        <Package2 className="h-5 w-5 text-pink-500" />
        <h1 className="text-xl font-bold">Combos / Paquetes</h1>
        <div className="flex-1" />
        <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => openDialog()}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo Combo
        </Button>
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={async () => {
          await supabase.auth.signOut(); window.location.href = "/login";
        }}><LogOut className="h-5 w-5" /></Button>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        {combos.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Package2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No hay combos. Crea uno para empezar.</p>
            <p className="text-sm mt-1">Ej: &quot;Combo Familiar&quot; = 2 Hamburguesas + Papas grandes + 2 Refrescos</p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {combos.map((c) => (
            <Card key={c.id} className={!c.available ? "opacity-50" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold">{c.name}</p>
                      {c.featured && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                    </div>
                    {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                    <p className="text-orange-600 font-bold text-lg mt-1">${c.price.toFixed(2)}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleCombo(c)}>
                      {c.available ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openDialog(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteCombo(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.combo_items?.map((i) => (
                    <Badge key={i.id} variant="outline" className="text-xs">
                      {i.quantity}x {i.product_name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Nuevo"} Combo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Combo Familiar" /></div>
            <div><Label>Descripción (opcional)</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} /></div>
            <div>
              <Label>Productos del combo</Label>
              <div className="flex gap-2 mt-1">
                <select value={addProdId} onChange={(e) => setAddProdId(e.target.value)}
                  className="flex-1 h-9 rounded-lg border border-input bg-transparent px-3 text-sm">
                  <option value="">Agregar producto...</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} (${p.price.toFixed(2)})</option>)}
                </select>
                <Button size="sm" variant="outline" onClick={addLine} disabled={!addProdId}><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-1 mt-2">
                {lines.map((l, idx) => (
                  <div key={l.product_id} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                    <span className="flex-1 text-sm">{l.product_name}</span>
                    <Input type="number" min="1" value={l.quantity} className="w-16 h-7"
                      onChange={(e) => setLines(lines.map((x, i) => i === idx ? { ...x, quantity: parseInt(e.target.value) || 1 } : x))} />
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => setLines(lines.filter((_, i) => i !== idx))}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Precio del combo</Label><Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" /></div>
              <div className="flex items-end pb-2">
                {regularTotal > 0 && savings > 0 && (
                  <p className="text-xs text-green-600">Por separado: ${regularTotal.toFixed(2)} · Ahorro: ${savings.toFixed(2)}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="cfeat" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="rounded" />
              <Label htmlFor="cfeat">Combo destacado</Label>
            </div>
            <Button className="w-full bg-orange-500 hover:bg-orange-600" onClick={saveCombo}>
              {editing ? "Guardar Cambios" : "Crear Combo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
