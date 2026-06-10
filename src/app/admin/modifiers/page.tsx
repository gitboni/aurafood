"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ModifierGroup, Modifier, Product } from "@/lib/types";
import {
  Home, LogOut, Plus, Pencil, Trash2, Sliders, Check,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";

export default function ModifiersPage() {
  const [groups, setGroups] = useState<(ModifierGroup & { modifiers: Modifier[] })[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [linkedProducts, setLinkedProducts] = useState<Record<string, string[]>>({});

  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupRequired, setGroupRequired] = useState(false);
  const [groupMaxSelect, setGroupMaxSelect] = useState("1");

  const [addingModTo, setAddingModTo] = useState<string | null>(null);
  const [modName, setModName] = useState("");
  const [modPrice, setModPrice] = useState("");

  const [linkingGroup, setLinkingGroup] = useState<string | null>(null);

  const supabase = createClient();

  async function loadData() {
    const { data: g } = await supabase.from("modifier_groups").select("*, modifiers(*)").order("sort_order");
    if (g) setGroups(g);

    const { data: p } = await supabase.from("products").select("id, name, price").order("name");
    if (p) setProducts(p as Product[]);

    const { data: links } = await supabase.from("product_modifier_groups").select("*");
    if (links) {
      const map: Record<string, string[]> = {};
      links.forEach((l: { group_id: string; product_id: string }) => {
        if (!map[l.group_id]) map[l.group_id] = [];
        map[l.group_id].push(l.product_id);
      });
      setLinkedProducts(map);
    }
  }

  useEffect(() => { loadData(); }, []);

  function openGroupDialog(group?: ModifierGroup) {
    if (group) {
      setEditingGroup(group);
      setGroupName(group.name);
      setGroupRequired(group.required);
      setGroupMaxSelect(group.max_select.toString());
    } else {
      setEditingGroup(null);
      setGroupName("");
      setGroupRequired(false);
      setGroupMaxSelect("1");
    }
    setShowGroupDialog(true);
  }

  async function saveGroup() {
    if (!groupName.trim()) return;
    const data = { name: groupName, required: groupRequired, max_select: parseInt(groupMaxSelect) || 1 };
    if (editingGroup) {
      await supabase.from("modifier_groups").update(data).eq("id", editingGroup.id);
      toast.success("Grupo actualizado");
    } else {
      await supabase.from("modifier_groups").insert({ ...data, sort_order: groups.length });
      toast.success("Grupo creado");
    }
    setShowGroupDialog(false);
    loadData();
  }

  async function deleteGroup(id: string) {
    await supabase.from("modifier_groups").delete().eq("id", id);
    toast.success("Grupo eliminado");
    loadData();
  }

  async function addModifier() {
    if (!addingModTo || !modName.trim()) return;
    await supabase.from("modifiers").insert({
      group_id: addingModTo,
      name: modName,
      price: parseFloat(modPrice) || 0,
      sort_order: 0,
    });
    toast.success("Modificador agregado");
    setModName(""); setModPrice("");
    setAddingModTo(null);
    loadData();
  }

  async function deleteModifier(id: string) {
    await supabase.from("modifiers").delete().eq("id", id);
    toast.success("Eliminado");
    loadData();
  }

  async function toggleProductLink(groupId: string, productId: string) {
    const current = linkedProducts[groupId] || [];
    if (current.includes(productId)) {
      await supabase.from("product_modifier_groups").delete().eq("group_id", groupId).eq("product_id", productId);
    } else {
      await supabase.from("product_modifier_groups").insert({ group_id: groupId, product_id: productId });
    }
    loadData();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-6 py-4 flex items-center gap-4">
        <Link href="/"><Button variant="ghost" size="icon"><Home className="h-5 w-5" /></Button></Link>
        <Sliders className="h-5 w-5 text-teal-500" />
        <h1 className="text-xl font-bold">Modificadores de Producto</h1>
        <div className="flex-1" />
        <Button className="bg-primary hover:bg-primary/90" onClick={() => openGroupDialog()}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo Grupo
        </Button>
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={async () => {
          await supabase.auth.signOut(); window.location.href = "/login";
        }}><LogOut className="h-5 w-5" /></Button>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {groups.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Sliders className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No hay grupos de modificadores. Crea uno para empezar.</p>
            <p className="text-sm mt-1">Ejemplo: "Extras" con "Extra queso +$15", "Tocino +$20"</p>
          </div>
        )}

        {groups.map((group) => (
          <Card key={group.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle>{group.name}</CardTitle>
                  {group.required && <Badge className="bg-red-100 text-red-700">Obligatorio</Badge>}
                  <Badge variant="outline">Máx: {group.max_select}</Badge>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setLinkingGroup(linkingGroup === group.id ? null : group.id)}>
                    🔗 Productos
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openGroupDialog(group)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteGroup(group.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {group.modifiers?.map((mod) => (
                <div key={mod.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                  <span className="font-medium text-sm">{mod.name}</span>
                  <div className="flex items-center gap-2">
                    {mod.price > 0 && <Badge className="bg-green-100 text-green-700">+${mod.price.toFixed(2)}</Badge>}
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteModifier(mod.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}

              <div className="flex gap-2">
                <Input placeholder="Nombre del modificador" value={addingModTo === group.id ? modName : ""} onChange={(e) => { setAddingModTo(group.id); setModName(e.target.value); }} onFocus={() => setAddingModTo(group.id)} />
                <Input type="number" placeholder="Precio" className="w-24" value={addingModTo === group.id ? modPrice : ""} onChange={(e) => { setAddingModTo(group.id); setModPrice(e.target.value); }} onFocus={() => setAddingModTo(group.id)} />
                <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={addModifier} disabled={!modName.trim() || addingModTo !== group.id}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {linkingGroup === group.id && (
                <>
                  <Separator />
                  <p className="text-sm font-medium">Productos con este grupo:</p>
                  <div className="flex flex-wrap gap-2">
                    {products.map((p) => {
                      const linked = (linkedProducts[group.id] || []).includes(p.id);
                      return (
                        <Button
                          key={p.id}
                          variant={linked ? "default" : "outline"}
                          size="sm"
                          className={linked ? "bg-primary hover:bg-primary/90" : ""}
                          onClick={() => toggleProductLink(group.id, p.id)}
                        >
                          {linked && <Check className="h-3 w-3 mr-1" />}
                          {p.name}
                        </Button>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Editar" : "Nuevo"} Grupo de Modificadores</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nombre del grupo</Label><Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Ej: Extras, Tamaño, Sin ingrediente" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="required" checked={groupRequired} onChange={(e) => setGroupRequired(e.target.checked)} className="rounded" />
                <Label htmlFor="required">Obligatorio</Label>
              </div>
              <div><Label>Máximo selecciones</Label><Input type="number" min="1" value={groupMaxSelect} onChange={(e) => setGroupMaxSelect(e.target.value)} /></div>
            </div>
            <Button className="w-full bg-primary hover:bg-primary/90" onClick={saveGroup}>
              {editingGroup ? "Guardar Cambios" : "Crear Grupo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
