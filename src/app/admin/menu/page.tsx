"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Category, Product, Ingredient, ProductRecipe } from "@/lib/types";
import {
  LayoutDashboard,
  Plus,
  Pencil,
  Trash2,
  Home,
  Star,
  Eye,
  EyeOff,
  QrCode,
  LogOut,
  Loader2,
  AlertCircle,
  Printer,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";
import { ThemeToggle } from '@/components/theme-toggle';

export default function AdminMenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showCatDialog, setShowCatDialog] = useState(false);
  const [showProdDialog, setShowProdDialog] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [tableCount, setTableCount] = useState(10);
  const [showTableQRs, setShowTableQRs] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editingProd, setEditingProd] = useState<Product | null>(null);

  // Delete confirmation
  const [deleteCatTarget, setDeleteCatTarget] = useState<Category | null>(null);
  const [deleteProdTarget, setDeleteProdTarget] = useState<Product | null>(null);

  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");

  const [prodName, setProdName] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodCost, setProdCost] = useState("");
  const [prodCategory, setProdCategory] = useState("");
  const [prodImage, setProdImage] = useState("");
  const [prodFeatured, setProdFeatured] = useState(false);
  const [prodTrackStock, setProdTrackStock] = useState(false);
  const [prodStock, setProdStock] = useState("");
  const [uploading, setUploading] = useState(false);

  // Recipe state
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [prodRecipes, setProdRecipes] = useState<ProductRecipe[]>([]);
  const [recipeIngId, setRecipeIngId] = useState("");
  const [recipeQty, setRecipeQty] = useState("");

  const supabase = createClient();

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fileName = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("products").upload(fileName, file);
    if (error) {
      toast.error("Error al subir imagen");
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("products").getPublicUrl(fileName);
    setProdImage(urlData.publicUrl);
    setUploading(false);
    toast.success("Imagen subida");
  }

  async function loadData() {
    try {
      const [catRes, prodRes, ingRes] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order"),
        supabase.from("products").select("*").order("sort_order"),
        supabase.from("ingredients").select("*").order("name"),
      ]);
      if (catRes.error) throw catRes.error;
      if (prodRes.error) throw prodRes.error;
      if (catRes.data) setCategories(catRes.data);
      if (prodRes.data) setProducts(prodRes.data);
      // ingredients table may not exist yet — fail silently
      if (ingRes.data) setIngredients(ingRes.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  async function loadProductRecipes(productId: string) {
    const { data } = await supabase
      .from("product_recipes")
      .select("*, ingredient:ingredients(name, unit, cost_per_unit)")
      .eq("product_id", productId);
    setProdRecipes((data ?? []) as ProductRecipe[]);
  }

  // Auto-fill product cost from the recipe (sum of ingredient costs)
  async function applyRecipeCost() {
    if (!editingProd) return;
    const cost = prodRecipes.reduce((s, r) => {
      const ing = r.ingredient as unknown as { cost_per_unit?: number } | undefined;
      return s + r.quantity * (Number(ing?.cost_per_unit) || 0);
    }, 0);
    const { error } = await supabase
      .from("products")
      .update({ cost: +cost.toFixed(2) })
      .eq("id", editingProd.id);
    if (error) { toast.error("Error al guardar costo"); return; }
    toast.success(`Costo actualizado: $${cost.toFixed(2)}`);
    loadData();
  }

  async function addRecipeItem() {
    if (!editingProd || !recipeIngId || !recipeQty) return;
    
    const qty = parseFloat(recipeQty);
    if (isNaN(qty) || qty <= 0) return;

    const existing = prodRecipes.find(r => r.ingredient_id === recipeIngId);
    let error;

    if (existing) {
      const res = await supabase.from("product_recipes")
        .update({ quantity: qty })
        .eq("id", existing.id);
      error = res.error;
    } else {
      const res = await supabase.from("product_recipes").insert({
        product_id: editingProd.id,
        ingredient_id: recipeIngId,
        quantity: qty,
      });
      error = res.error;
    }

    if (error) { 
      console.error("Error saving recipe:", error);
      toast.error("Error al guardar receta"); 
      return; 
    }
    
    setRecipeIngId(""); setRecipeQty("");
    loadProductRecipes(editingProd.id);
    toast.success("Ingrediente agregado a la receta");
  }

  async function removeRecipeItem(id: string) {
    await supabase.from("product_recipes").delete().eq("id", id);
    if (editingProd) loadProductRecipes(editingProd.id);
  }

  useEffect(() => {
    loadData();
  }, []);

  // Category CRUD
  function openCatDialog(cat?: Category) {
    if (cat) {
      setEditingCat(cat);
      setCatName(cat.name);
      setCatDesc(cat.description || "");
    } else {
      setEditingCat(null);
      setCatName("");
      setCatDesc("");
    }
    setShowCatDialog(true);
  }

  async function saveCat() {
    if (!catName.trim()) return;
    if (editingCat) {
      await supabase
        .from("categories")
        .update({ name: catName, description: catDesc || null })
        .eq("id", editingCat.id);
      toast.success("Categoría actualizada");
    } else {
      await supabase
        .from("categories")
        .insert({ name: catName, description: catDesc || null, sort_order: categories.length });
      toast.success("Categoría creada");
    }
    setShowCatDialog(false);
    loadData();
  }

  async function deleteCat(cat: Category) {
    const prods = products.filter((p) => p.category_id === cat.id);
    if (prods.length > 0) {
      toast.error("Elimina los productos de esta categoría primero");
      return;
    }
    await supabase.from("categories").delete().eq("id", cat.id);
    toast.success("Categoría eliminada");
    setDeleteCatTarget(null);
    loadData();
  }

  async function toggleCat(cat: Category) {
    await supabase.from("categories").update({ active: !cat.active }).eq("id", cat.id);
    loadData();
  }

  // Product CRUD
  function openProdDialog(prod?: Product) {
    setProdRecipes([]);
    setRecipeIngId(""); setRecipeQty("");
    if (prod) {
      setEditingProd(prod);
      loadProductRecipes(prod.id);
      setProdName(prod.name);
      setProdDesc(prod.description || "");
      setProdPrice(prod.price.toString());
      setProdCost(prod.cost ? prod.cost.toString() : "");
      setProdCategory(prod.category_id);
      setProdImage(prod.image_url || "");
      setProdFeatured(prod.featured);
      setProdTrackStock(prod.track_stock);
      setProdStock(prod.stock?.toString() ?? "");
    } else {
      setEditingProd(null);
      setProdName("");
      setProdDesc("");
      setProdPrice("");
      setProdCost("");
      setProdCategory(categories[0]?.id || "");
      setProdImage("");
      setProdFeatured(false);
      setProdTrackStock(false);
      setProdStock("");
    }
    setShowProdDialog(true);
  }

  async function saveProd() {
    if (!prodName.trim() || !prodPrice || !prodCategory) return;
    const data = {
      name: prodName,
      description: prodDesc || null,
      price: parseFloat(prodPrice),
      cost: prodCost ? parseFloat(prodCost) : 0,
      category_id: prodCategory,
      image_url: prodImage || null,
      featured: prodFeatured,
      track_stock: prodTrackStock,
      stock: prodTrackStock && prodStock ? parseInt(prodStock, 10) : null,
    };
    if (editingProd) {
      await supabase.from("products").update(data).eq("id", editingProd.id);
      toast.success("Producto actualizado");
    } else {
      await supabase
        .from("products")
        .insert({ ...data, sort_order: products.length });
      toast.success("Producto creado");
    }
    setShowProdDialog(false);
    loadData();
  }

  async function deleteProd(prod: Product) {
    await supabase.from("products").delete().eq("id", prod.id);
    toast.success("Producto eliminado");
    setDeleteProdTarget(null);
    loadData();
  }

  async function toggleProd(prod: Product) {
    await supabase.from("products").update({ available: !prod.available }).eq("id", prod.id);
    loadData();
  }

  const menuUrl =
    typeof window !== "undefined" ? `${window.location.origin}/menu` : "";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="font-semibold">No se pudo cargar el menú</p>
        <Button onClick={() => { setError(false); setLoading(true); loadData(); }}>
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <Home className="h-5 w-5" />
          </Button>
        </Link>
        <LayoutDashboard className="h-5 w-5 text-blue-500" />
        <h1 className="text-xl font-bold">Gestión de Menú</h1>
        <ThemeToggle />
        <div className="flex-1" />
        <Button variant="outline" onClick={() => setShowQR(true)}>
          <QrCode className="h-4 w-4 mr-2" /> Código QR
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      <div className="max-w-5xl mx-auto p-6">
        <Tabs defaultValue="products">
          <TabsList className="mb-6">
            <TabsTrigger value="products">Productos ({products.length})</TabsTrigger>
            <TabsTrigger value="categories">Categorías ({categories.length})</TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-muted-foreground">Administra los productos de tu menú</p>
              <Button
                className="bg-primary hover:bg-primary/90"
                onClick={() => openProdDialog()}
              >
                <Plus className="h-4 w-4 mr-2" /> Agregar Producto
              </Button>
            </div>

            {categories.map((cat) => {
              const catProds = products.filter((p) => p.category_id === cat.id);
              if (catProds.length === 0) return null;
              return (
                <div key={cat.id}>
                  <h3 className="font-semibold text-lg mb-2">{cat.name}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {catProds.map((p) => (
                      <Card key={p.id} className={`${!p.available ? "opacity-50" : ""}`}>
                        <CardContent className="flex items-center gap-3 p-4">
                          {p.image_url && (
                            <div className="relative h-14 w-14 bg-muted rounded-lg overflow-hidden shrink-0">
                              <Image
                                src={p.image_url}
                                alt={p.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{p.name}</p>
                              {p.featured && (
                                <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                              )}
                            </div>
                            <p className="text-primary font-bold">${p.price.toFixed(2)}</p>
                            {p.track_stock && (
                              <p className="text-xs text-muted-foreground">
                                Stock: {p.stock ?? "—"}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => toggleProd(p)}
                            >
                              {p.available ? (
                                <Eye className="h-4 w-4" />
                              ) : (
                                <EyeOff className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => openProdDialog(p)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                              onClick={() => setDeleteProdTarget(p)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <Separator className="my-4" />
                </div>
              );
            })}
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-muted-foreground">Organiza tu menú por categorías</p>
              <Button
                className="bg-primary hover:bg-primary/90"
                onClick={() => openCatDialog()}
              >
                <Plus className="h-4 w-4 mr-2" /> Agregar Categoría
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {categories.map((cat) => (
                <Card key={cat.id} className={`${!cat.active ? "opacity-50" : ""}`}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex-1">
                      <p className="font-medium">{cat.name}</p>
                      {cat.description && (
                        <p className="text-sm text-muted-foreground">{cat.description}</p>
                      )}
                      <Badge variant="outline" className="mt-1">
                        {products.filter((p) => p.category_id === cat.id).length} productos
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => toggleCat(cat)}
                      >
                        {cat.active ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => openCatDialog(cat)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteCatTarget(cat)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Category Dialog */}
      <Dialog open={showCatDialog} onOpenChange={setShowCatDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCat ? "Editar" : "Nueva"} Categoría</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="Ej: Hamburguesas"
              />
            </div>
            <div>
              <Label>Descripción (opcional)</Label>
              <Textarea
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                placeholder="Descripción de la categoría"
              />
            </div>
            <Button className="w-full bg-primary hover:bg-primary/90" onClick={saveCat}>
              {editingCat ? "Guardar Cambios" : "Crear Categoría"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Dialog */}
      <Dialog open={showProdDialog} onOpenChange={setShowProdDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProd ? "Editar" : "Nuevo"} Producto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                placeholder="Ej: Hamburguesa Clásica"
              />
            </div>
            <div>
              <Label>Descripción (opcional)</Label>
              <Textarea
                value={prodDesc}
                onChange={(e) => setProdDesc(e.target.value)}
                placeholder="Ingredientes o descripción"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Precio</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={prodPrice}
                  onChange={(e) => setProdPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Costo</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={prodCost}
                  onChange={(e) => setProdCost(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Categoría</Label>
                <select
                  value={prodCategory}
                  onChange={(e) => setProdCategory(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Seleccionar</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label>Imagen del producto</Label>
              {prodImage && (
                <div className="relative h-32 bg-muted rounded-lg overflow-hidden mb-2">
                  <Image src={prodImage} alt="Preview" fill className="object-cover" />
                </div>
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={uploadImage}
                disabled={uploading}
              />
              {uploading && (
                <p className="text-xs text-muted-foreground mt-1">Subiendo imagen...</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="featured"
                checked={prodFeatured}
                onChange={(e) => setProdFeatured(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="featured">Producto destacado</Label>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="trackStock"
                  checked={prodTrackStock}
                  onChange={(e) => setProdTrackStock(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="trackStock">Controlar stock</Label>
              </div>
              {prodTrackStock && (
                <div>
                  <Label>Cantidad en stock</Label>
                  <Input
                    type="number"
                    min="0"
                    value={prodStock}
                    onChange={(e) => setProdStock(e.target.value)}
                    placeholder="0"
                  />
                </div>
              )}
            </div>
            <Button className="w-full bg-primary hover:bg-primary/90" onClick={saveProd}>
              {editingProd ? "Guardar Cambios" : "Crear Producto"}
            </Button>

            {/* Recipe section — only shown when editing */}
            {editingProd && (
              <>
                <Separator />
                <div className="space-y-3">
                  <p className="text-sm font-semibold">
                    Receta — ingredientes por unidad vendida
                  </p>

                  {/* Current recipe items */}
                  {prodRecipes.length > 0 && (
                    <div className="space-y-2">
                      {prodRecipes.map((r) => {
                        const ing = r.ingredient as unknown as { name: string; unit: string } | undefined;
                        return (
                          <div key={r.id} className="flex items-center justify-between text-sm bg-muted/50 rounded-lg px-3 py-1.5">
                            <span>{ing?.name ?? "?"}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground tabular-nums">
                                {r.quantity} {ing?.unit}
                              </span>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                                onClick={() => removeRecipeItem(r.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Recipe cost summary */}
                  {prodRecipes.length > 0 && (() => {
                    const recipeCost = prodRecipes.reduce((s, r) => {
                      const ing = r.ingredient as unknown as { cost_per_unit?: number } | undefined;
                      return s + r.quantity * (Number(ing?.cost_per_unit) || 0);
                    }, 0);
                    const price = parseFloat(prodPrice) || 0;
                    const margin = price > 0 ? ((price - recipeCost) / price) * 100 : 0;
                    return (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Costo de receta</span>
                          <span className="font-semibold">${recipeCost.toFixed(2)}</span>
                        </div>
                        {price > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Margen estimado</span>
                            <span className={`font-semibold ${margin >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                              {margin.toFixed(0)}% (${(price - recipeCost).toFixed(2)})
                            </span>
                          </div>
                        )}
                        <Button size="sm" variant="outline" className="w-full mt-1 border-emerald-300"
                          onClick={applyRecipeCost}>
                          Usar como costo del producto
                        </Button>
                      </div>
                    );
                  })()}

                  {/* Add ingredient to recipe */}
                  {ingredients.length > 0 ? (
                    <div className="flex gap-2">
                      <select
                        value={recipeIngId}
                        onChange={(e) => setRecipeIngId(e.target.value)}
                        className="flex-1 h-9 rounded-lg border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">Ingrediente</option>
                        {ingredients.map((i) => (
                          <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        step="0.001"
                        min="0.001"
                        placeholder="Cant."
                        value={recipeQty}
                        onChange={(e) => setRecipeQty(e.target.value)}
                        className="w-24"
                      />
                      <Button type="button" size="sm" variant="outline" onClick={addRecipeItem}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Primero crea ingredientes en{" "}
                      <a href="/admin/inventory" className="underline text-primary">Inventario</a>
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Código QR del Menú</DialogTitle>
          </DialogHeader>

          {/* ── QR General ── */}
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="bg-white p-4 rounded-xl shadow border">
              <QRCodeSVG value={menuUrl} size={200} level="H" />
            </div>
            <p className="text-xs text-muted-foreground break-all text-center">{menuUrl}</p>
            <p className="text-sm text-center text-muted-foreground">
              QR general del menú — el cliente escribe su mesa manualmente
            </p>
          </div>

          <Separator />

          {/* ── QR por Mesa ── */}
          <div className="space-y-3">
            <button
              type="button"
              className="flex items-center justify-between w-full text-left"
              onClick={() => setShowTableQRs(!showTableQRs)}
            >
              <div>
                <p className="font-semibold text-sm">QR individuales por mesa</p>
                <p className="text-xs text-muted-foreground">
                  El número de mesa se rellena automáticamente al escanear
                </p>
              </div>
              {showTableQRs ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </button>

            {showTableQRs && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Label className="shrink-0">Número de mesas:</Label>
                  <Input
                    type="number"
                    min="1"
                    max="60"
                    value={tableCount}
                    onChange={(e) =>
                      setTableCount(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))
                    }
                    className="w-20"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.print()}
                    className="ml-auto"
                  >
                    <Printer className="h-4 w-4 mr-1.5" />
                    Imprimir todas
                  </Button>
                </div>

                {/* Grid of table QRs */}
                <div
                  className="grid gap-3 max-h-72 overflow-y-auto pr-1 print:max-h-none print:overflow-visible print:grid-cols-4"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))" }}
                >
                  {Array.from({ length: tableCount }, (_, i) => i + 1).map((n) => (
                    <div
                      key={n}
                      className="flex flex-col items-center gap-1.5 p-2.5 border rounded-xl bg-white hover:shadow-sm transition-shadow"
                    >
                      <QRCodeSVG value={`${menuUrl}?mesa=${n}`} size={84} level="M" />
                      <p className="text-xs font-bold text-center">Mesa {n}</p>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Imprime, recorta y coloca cada QR en su mesa correspondiente
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm delete product */}
      <ConfirmDialog
        open={!!deleteProdTarget}
        title="Eliminar producto"
        description={`¿Eliminar "${deleteProdTarget?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => deleteProdTarget && deleteProd(deleteProdTarget)}
        onCancel={() => setDeleteProdTarget(null)}
      />

      {/* Confirm delete category */}
      <ConfirmDialog
        open={!!deleteCatTarget}
        title="Eliminar categoría"
        description={`¿Eliminar "${deleteCatTarget?.name}"? Asegúrate de que no tenga productos asignados.`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => deleteCatTarget && deleteCat(deleteCatTarget)}
        onCancel={() => setDeleteCatTarget(null)}
      />
    </div>
  );
}
