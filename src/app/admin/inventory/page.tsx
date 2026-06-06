"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Ingredient, StockMovement } from "@/lib/types";
import {
  Home, Plus, Pencil, Trash2, LogOut, Loader2, AlertCircle,
  Package, TrendingDown, TrendingUp, AlertTriangle, History, ShoppingCart, X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ThemeToggle } from '@/components/theme-toggle';

const UNITS = ["g", "kg", "mL", "L", "pza", "porción", "caja", "lata", "bolsa"];

export default function InventoryPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Ingredient dialog
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("g");
  const [stock, setStock] = useState("");
  const [minStock, setMinStock] = useState("");
  const [costPerUnit, setCostPerUnit] = useState("");

  // Adjustment dialog
  const [adjustTarget, setAdjustTarget] = useState<Ingredient | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustType, setAdjustType] = useState<"purchase" | "waste" | "adjustment">("purchase");
  const [adjustNotes, setAdjustNotes] = useState("");

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Ingredient | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);

  // Multi-item purchase dialog
  const [showPurchase, setShowPurchase] = useState(false);
  const [purchaseSupplier, setPurchaseSupplier] = useState("");
  const [purchaseRows, setPurchaseRows] = useState<{ ingredient_id: string; qty: string; unitCost: string }[]>([
    { ingredient_id: "", qty: "", unitCost: "" },
  ]);
  const [savingPurchase, setSavingPurchase] = useState(false);

  const supabase = createClient();

  // Request browser notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window
      && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Realtime: listen for ingredient stock updates
  useEffect(() => {
    const channel = supabase
      .channel("inventory-ingredients")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ingredients" },
        (payload) => {
          const updated = payload.new as Ingredient;
          setIngredients((prev) =>
            prev.map((i) => (i.id === updated.id ? updated : i))
          );
          // Browser push notification when stock drops below minimum
          if (
            updated.min_stock > 0 &&
            Number(updated.stock) <= Number(updated.min_stock) &&
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            new Notification("⚠️ Stock bajo — AuraFood", {
              body: `${updated.name}: quedan ${Number(updated.stock).toFixed(0)} ${updated.unit} (mínimo ${Number(updated.min_stock).toFixed(0)})`,
              icon: "/icon-192.svg",
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadData() {
    try {
      const [ingRes, movRes] = await Promise.all([
        supabase.from("ingredients").select("*").order("name"),
        supabase
          .from("stock_movements")
          .select("*, ingredient:ingredients(name, unit)")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      // 42P01 = table does not exist (tables not created yet)
      const tablesMissing =
        ingRes.error?.code === "42P01" || movRes.error?.code === "42P01";
      if (tablesMissing) { setNeedsSetup(true); setLoading(false); return; }
      if (ingRes.error) throw ingRes.error;
      if (movRes.error) throw movRes.error;
      setIngredients(ingRes.data ?? []);
      setMovements((movRes.data ?? []) as StockMovement[]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function openDialog(ing?: Ingredient) {
    if (ing) {
      setEditing(ing);
      setName(ing.name);
      setUnit(ing.unit);
      setStock(ing.stock.toString());
      setMinStock(ing.min_stock.toString());
      setCostPerUnit(ing.cost_per_unit.toString());
    } else {
      setEditing(null);
      setName(""); setUnit("g"); setStock(""); setMinStock(""); setCostPerUnit("");
    }
    setShowDialog(true);
  }

  async function saveIngredient() {
    if (!name.trim()) return;
    const data = {
      name,
      unit,
      stock: parseFloat(stock) || 0,
      min_stock: parseFloat(minStock) || 0,
      cost_per_unit: parseFloat(costPerUnit) || 0,
    };
    if (editing) {
      const { error } = await supabase.from("ingredients").update(data).eq("id", editing.id);
      if (error) { toast.error("Error al actualizar"); return; }
      toast.success("Ingrediente actualizado");
    } else {
      const { error } = await supabase.from("ingredients").insert(data);
      if (error) { toast.error("Error al crear"); return; }
      toast.success("Ingrediente creado");
    }
    setShowDialog(false);
    loadData();
  }

  async function deleteIngredient(ing: Ingredient) {
    const { error } = await supabase.from("ingredients").delete().eq("id", ing.id);
    if (error) { toast.error("Error al eliminar"); return; }
    toast.success("Ingrediente eliminado");
    setDeleteTarget(null);
    loadData();
  }

  async function saveAdjustment() {
    if (!adjustTarget || !adjustQty) return;
    const qty = parseFloat(adjustQty);
    const isAddition = adjustType === "purchase";
    const movement = {
      ingredient_id: adjustTarget.id,
      type: adjustType,
      quantity: isAddition ? qty : -Math.abs(qty),
      notes: adjustNotes || null,
      reference_id: null,
    };
    const { error: movErr } = await supabase.from("stock_movements").insert(movement);
    if (movErr) { toast.error("Error al registrar"); return; }

    const newStock = isAddition
      ? adjustTarget.stock + qty
      : Math.max(0, adjustTarget.stock - qty);

    await supabase.from("ingredients").update({ stock: newStock }).eq("id", adjustTarget.id);
    toast.success("Stock ajustado");
    setAdjustTarget(null);
    setAdjustQty(""); setAdjustNotes("");
    loadData();
  }

  // ── Multi-item purchase (receiving) ────────────────────────
  function openPurchase() {
    setPurchaseSupplier("");
    setPurchaseRows([{ ingredient_id: "", qty: "", unitCost: "" }]);
    setShowPurchase(true);
  }

  const purchaseTotal = purchaseRows.reduce(
    (s, r) => s + (parseFloat(r.qty) || 0) * (parseFloat(r.unitCost) || 0),
    0
  );

  async function savePurchase() {
    const valid = purchaseRows.filter((r) => r.ingredient_id && parseFloat(r.qty) > 0);
    if (valid.length === 0) { toast.error("Agrega al menos un ingrediente"); return; }
    setSavingPurchase(true);
    try {
      const note = purchaseSupplier ? `Compra: ${purchaseSupplier}` : "Compra";
      for (const row of valid) {
        const qty = parseFloat(row.qty);
        const unitCost = parseFloat(row.unitCost) || 0;
        const ing = ingredients.find((i) => i.id === row.ingredient_id);
        if (!ing) continue;
        await supabase.from("stock_movements").insert({
          ingredient_id: row.ingredient_id,
          type: "purchase",
          quantity: qty,
          notes: note,
          reference_id: null,
        });
        // Add stock; update cost to latest unit cost when provided
        const update: { stock: number; cost_per_unit?: number } = {
          stock: Number(ing.stock) + qty,
        };
        if (unitCost > 0) update.cost_per_unit = unitCost;
        await supabase.from("ingredients").update(update).eq("id", row.ingredient_id);
      }
      toast.success(`Compra registrada (${valid.length} ítems · $${purchaseTotal.toFixed(2)})`);
      setShowPurchase(false);
      loadData();
    } catch {
      toast.error("Error al registrar la compra");
    } finally {
      setSavingPurchase(false);
    }
  }

  const lowStock = ingredients.filter((i) => i.stock <= i.min_stock && i.min_stock > 0);
  const totalCost = ingredients.reduce((s, i) => s + i.stock * i.cost_per_unit, 0);

  const MOVE_LABELS: Record<string, string> = {
    sale: "Venta",
    purchase: "Compra",
    adjustment: "Ajuste",
    waste: "Merma",
  };
  const MOVE_COLOR: Record<string, string> = {
    sale: "text-red-600",
    waste: "text-orange-600",
    purchase: "text-green-600",
    adjustment: "text-blue-600",
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
    </div>
  );

  if (needsSetup) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-gray-50">
      <Package className="h-12 w-12 text-emerald-500" />
      <h2 className="text-xl font-bold">Configura las tablas de inventario</h2>
      <p className="text-muted-foreground text-center max-w-md">
        Las tablas de inventario aún no existen en Supabase. Ve a{" "}
        <strong>SQL Editor → New Query</strong>, pega el contenido de{" "}
        <code className="bg-muted px-1 rounded">supabase-inventory.sql</code> y ejecútalo.
      </p>
      <Button onClick={() => { setNeedsSetup(false); setLoading(true); loadData(); }}>
        Ya ejecuté el SQL — Reintentar
      </Button>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <p className="font-semibold">No se pudo cargar el inventario</p>
      <Button onClick={() => { setError(false); setLoading(true); loadData(); }}>Reintentar</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/"><Button variant="ghost" size="icon"><Home className="h-5 w-5" /></Button></Link>
        <Package className="h-5 w-5 text-emerald-600" />
        <h1 className="text-xl font-bold">Inventario</h1>
        <ThemeToggle />
        <div className="flex-1" />
        <Button variant="outline" onClick={openPurchase}>
          <ShoppingCart className="h-4 w-4 mr-2" /> Registrar Compra
        </Button>
        <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => openDialog()}>
          <Plus className="h-4 w-4 mr-2" /> Agregar Ingrediente
        </Button>
        <Button variant="ghost" size="icon" onClick={async () => {
          await supabase.auth.signOut();
          window.location.href = "/login";
        }}>
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-6">

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total ingredientes</CardTitle>
              <Package className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{ingredients.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Stock bajo</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${lowStock.length > 0 ? "text-orange-600" : ""}`}>
                {lowStock.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Valor total inventario</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">${totalCost.toFixed(2)}</div></CardContent>
          </Card>
        </div>

        <Tabs defaultValue="ingredients">
          <TabsList>
            <TabsTrigger value="ingredients">Ingredientes ({ingredients.length})</TabsTrigger>
            <TabsTrigger value="movements">
              Movimientos
              {lowStock.length > 0 && (
                <Badge className="ml-2 bg-orange-500 text-white text-[10px]">{lowStock.length} bajo</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Ingredients tab ── */}
          <TabsContent value="ingredients" className="mt-4">
            {lowStock.length > 0 && (
              <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-2 text-sm text-orange-800">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Stock bajo: <strong>{lowStock.map((i) => i.name).join(", ")}</strong></span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ingredients.map((ing) => {
                const isLow = ing.min_stock > 0 && ing.stock <= ing.min_stock;
                return (
                  <Card key={ing.id} className={isLow ? "border-orange-300" : ""}>
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate">{ing.name}</p>
                          {isLow && (
                            <Badge className="bg-orange-100 text-orange-700 border-0 text-[10px]">
                              Stock bajo
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm">
                          <span className={`font-bold ${isLow ? "text-orange-600" : "text-emerald-600"}`}>
                            {ing.stock.toLocaleString("es-MX", { maximumFractionDigits: 3 })} {ing.unit}
                          </span>
                          {ing.min_stock > 0 && (
                            <span className="text-muted-foreground">
                              mín: {ing.min_stock} {ing.unit}
                            </span>
                          )}
                          {ing.cost_per_unit > 0 && (
                            <span className="text-muted-foreground">
                              ${ing.cost_per_unit}/{ing.unit}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="outline" className="h-8 w-8"
                          title="Ajustar stock"
                          onClick={() => { setAdjustTarget(ing); setAdjustQty(""); setAdjustNotes(""); setAdjustType("purchase"); }}>
                          <TrendingUp className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8"
                          onClick={() => openDialog(ing)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteTarget(ing)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {ingredients.length === 0 && (
                <p className="text-muted-foreground col-span-2 text-center py-12">
                  No hay ingredientes. Agrega el primero.
                </p>
              )}
            </div>
          </TabsContent>

          {/* ── Movements tab ── */}
          <TabsContent value="movements" className="mt-4">
            <div className="space-y-2">
              {movements.map((m) => {
                const isPositive = m.quantity > 0;
                return (
                  <div key={m.id} className="flex items-center gap-3 p-3 bg-white border rounded-lg">
                    <div className={`shrink-0 ${isPositive ? "text-green-600" : "text-red-500"}`}>
                      {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {(m.ingredient as unknown as { name: string })?.name ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {MOVE_LABELS[m.type] ?? m.type}
                        {m.notes && ` · ${m.notes}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-bold text-sm ${MOVE_COLOR[m.type]}`}>
                        {isPositive ? "+" : ""}{m.quantity.toLocaleString("es-MX", { maximumFractionDigits: 3 })}
                        {" "}{(m.ingredient as unknown as { unit: string })?.unit ?? ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(m.created_at).toLocaleString("es-MX", {
                          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
              {movements.length === 0 && (
                <p className="text-center text-muted-foreground py-12">
                  No hay movimientos registrados aún
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Ingredient dialog ── */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar" : "Nuevo"} Ingrediente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Carne molida" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Unidad de medida</Label>
                <Select value={unit} onValueChange={(v) => v && setUnit(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Stock inicial ({unit})</Label>
                <Input type="number" min="0" step="0.001" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Stock mínimo ({unit})</Label>
                <Input type="number" min="0" step="0.001" value={minStock} onChange={(e) => setMinStock(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>Costo por {unit}</Label>
                <Input type="number" min="0" step="0.01" value={costPerUnit} onChange={(e) => setCostPerUnit(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <Button className="w-full bg-orange-500 hover:bg-orange-600" onClick={saveIngredient}>
              {editing ? "Guardar Cambios" : "Crear Ingrediente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Stock adjustment dialog ── */}
      <Dialog open={!!adjustTarget} onOpenChange={(v) => !v && setAdjustTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar Stock — {adjustTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Stock actual: <strong>{adjustTarget?.stock} {adjustTarget?.unit}</strong>
            </p>
            <div>
              <Label>Tipo de movimiento</Label>
              <Select value={adjustType} onValueChange={(v) => v && setAdjustType(v as typeof adjustType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">📦 Compra (suma stock)</SelectItem>
                  <SelectItem value="waste">🗑️ Merma (resta stock)</SelectItem>
                  <SelectItem value="adjustment">✏️ Ajuste manual (resta stock)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cantidad ({adjustTarget?.unit})</Label>
              <Input type="number" min="0.001" step="0.001" value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Notas (opcional)</Label>
              <Input value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)}
                placeholder="Ej: Compra a proveedor X" />
            </div>
            {adjustTarget && adjustQty && (
              <div className="text-sm bg-muted px-3 py-2 rounded-lg">
                Nuevo stock:{" "}
                <strong>
                  {adjustType === "purchase"
                    ? (adjustTarget.stock + parseFloat(adjustQty)).toFixed(3)
                    : Math.max(0, adjustTarget.stock - parseFloat(adjustQty)).toFixed(3)
                  } {adjustTarget.unit}
                </strong>
              </div>
            )}
            <Separator />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setAdjustTarget(null)}>
                Cancelar
              </Button>
              <Button className="flex-1 bg-orange-500 hover:bg-orange-600" onClick={saveAdjustment}>
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Multi-item purchase dialog ── */}
      <Dialog open={showPurchase} onOpenChange={setShowPurchase}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-emerald-600" /> Registrar Compra
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Proveedor (opcional)</Label>
              <Input
                value={purchaseSupplier}
                onChange={(e) => setPurchaseSupplier(e.target.value)}
                placeholder="Ej: Distribuidora La Central"
              />
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_80px_90px_28px] gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                <span>Ingrediente</span>
                <span>Cantidad</span>
                <span>Costo unit.</span>
                <span></span>
              </div>
              {purchaseRows.map((row, idx) => {
                const ing = ingredients.find((i) => i.id === row.ingredient_id);
                return (
                  <div key={idx} className="grid grid-cols-[1fr_80px_90px_28px] gap-2 items-center">
                    <select
                      value={row.ingredient_id}
                      onChange={(e) => {
                        const v = e.target.value;
                        const ingr = ingredients.find((i) => i.id === v);
                        setPurchaseRows((rows) =>
                          rows.map((r, i) =>
                            i === idx
                              ? { ...r, ingredient_id: v, unitCost: r.unitCost || (ingr ? String(ingr.cost_per_unit) : "") }
                              : r
                          )
                        );
                      }}
                      className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Seleccionar</option>
                      {ingredients.map((i) => (
                        <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                      ))}
                    </select>
                    <Input
                      type="number" min="0" step="0.001" placeholder={ing?.unit || "cant"}
                      value={row.qty}
                      onChange={(e) => setPurchaseRows((rows) => rows.map((r, i) => i === idx ? { ...r, qty: e.target.value } : r))}
                    />
                    <Input
                      type="number" min="0" step="0.01" placeholder="$"
                      value={row.unitCost}
                      onChange={(e) => setPurchaseRows((rows) => rows.map((r, i) => i === idx ? { ...r, unitCost: e.target.value } : r))}
                    />
                    <Button
                      size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                      onClick={() => setPurchaseRows((rows) => rows.length > 1 ? rows.filter((_, i) => i !== idx) : rows)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              <Button
                size="sm" variant="outline" className="w-full"
                onClick={() => setPurchaseRows((rows) => [...rows, { ingredient_id: "", qty: "", unitCost: "" }])}
              >
                <Plus className="h-4 w-4 mr-1" /> Agregar línea
              </Button>
            </div>

            <Separator />
            <div className="flex justify-between items-center font-bold text-lg">
              <span>Total compra</span>
              <span className="text-emerald-600">${purchaseTotal.toFixed(2)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowPurchase(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={savingPurchase}
                onClick={savePurchase}
              >
                {savingPurchase && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Registrar y sumar al stock
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar ingrediente"
        description={`¿Eliminar "${deleteTarget?.name}"? Se perderá el historial de movimientos vinculado.`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => deleteTarget && deleteIngredient(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
