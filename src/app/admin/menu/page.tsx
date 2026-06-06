"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Category, Product } from "@/lib/types";
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
} from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export default function AdminMenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showCatDialog, setShowCatDialog] = useState(false);
  const [showProdDialog, setShowProdDialog] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editingProd, setEditingProd] = useState<Product | null>(null);

  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");

  const [prodName, setProdName] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodCategory, setProdCategory] = useState("");
  const [prodImage, setProdImage] = useState("");
  const [prodFeatured, setProdFeatured] = useState(false);

  const supabase = createClient();

  async function loadData() {
    const [catRes, prodRes] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("products").select("*").order("sort_order"),
    ]);
    if (catRes.data) setCategories(catRes.data);
    if (prodRes.data) setProducts(prodRes.data);
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

  async function deleteCat(id: string) {
    const prods = products.filter((p) => p.category_id === id);
    if (prods.length > 0) {
      toast.error("Elimina los productos de esta categoría primero");
      return;
    }
    await supabase.from("categories").delete().eq("id", id);
    toast.success("Categoría eliminada");
    loadData();
  }

  async function toggleCat(cat: Category) {
    await supabase.from("categories").update({ active: !cat.active }).eq("id", cat.id);
    loadData();
  }

  // Product CRUD
  function openProdDialog(prod?: Product) {
    if (prod) {
      setEditingProd(prod);
      setProdName(prod.name);
      setProdDesc(prod.description || "");
      setProdPrice(prod.price.toString());
      setProdCategory(prod.category_id);
      setProdImage(prod.image_url || "");
      setProdFeatured(prod.featured);
    } else {
      setEditingProd(null);
      setProdName("");
      setProdDesc("");
      setProdPrice("");
      setProdCategory(categories[0]?.id || "");
      setProdImage("");
      setProdFeatured(false);
    }
    setShowProdDialog(true);
  }

  async function saveProd() {
    if (!prodName.trim() || !prodPrice || !prodCategory) return;
    const data = {
      name: prodName,
      description: prodDesc || null,
      price: parseFloat(prodPrice),
      category_id: prodCategory,
      image_url: prodImage || null,
      featured: prodFeatured,
    };
    if (editingProd) {
      await supabase.from("products").update(data).eq("id", editingProd.id);
      toast.success("Producto actualizado");
    } else {
      await supabase.from("products").insert({ ...data, sort_order: products.length });
      toast.success("Producto creado");
    }
    setShowProdDialog(false);
    loadData();
  }

  async function deleteProd(id: string) {
    await supabase.from("products").delete().eq("id", id);
    toast.success("Producto eliminado");
    loadData();
  }

  async function toggleProd(prod: Product) {
    await supabase.from("products").update({ available: !prod.available }).eq("id", prod.id);
    loadData();
  }

  const menuUrl = typeof window !== "undefined"
    ? `${window.location.origin}/menu`
    : "";

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
        <div className="flex-1" />
        <Button variant="outline" onClick={() => setShowQR(true)}>
          <QrCode className="h-4 w-4 mr-2" /> Código QR
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
              <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => openProdDialog()}>
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
                            <div className="h-14 w-14 bg-muted rounded-lg overflow-hidden shrink-0">
                              <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{p.name}</p>
                              {p.featured && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                            </div>
                            <p className="text-orange-600 font-bold">${p.price.toFixed(2)}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleProd(p)}>
                              {p.available ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openProdDialog(p)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteProd(p.id)}>
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
              <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => openCatDialog()}>
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
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleCat(cat)}>
                        {cat.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openCatDialog(cat)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteCat(cat.id)}>
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
              <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Ej: Hamburguesas" />
            </div>
            <div>
              <Label>Descripción (opcional)</Label>
              <Textarea value={catDesc} onChange={(e) => setCatDesc(e.target.value)} placeholder="Descripción de la categoría" />
            </div>
            <Button className="w-full bg-orange-500 hover:bg-orange-600" onClick={saveCat}>
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
              <Input value={prodName} onChange={(e) => setProdName(e.target.value)} placeholder="Ej: Hamburguesa Clásica" />
            </div>
            <div>
              <Label>Descripción (opcional)</Label>
              <Textarea value={prodDesc} onChange={(e) => setProdDesc(e.target.value)} placeholder="Ingredientes o descripción" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Precio</Label>
                <Input type="number" step="0.01" value={prodPrice} onChange={(e) => setProdPrice(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <Label>Categoría</Label>
                <Select value={prodCategory} onValueChange={(v) => v && setProdCategory(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>URL de Imagen (opcional)</Label>
              <Input value={prodImage} onChange={(e) => setProdImage(e.target.value)} placeholder="https://..." />
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
            <Button className="w-full bg-orange-500 hover:bg-orange-600" onClick={saveProd}>
              {editingProd ? "Guardar Cambios" : "Crear Producto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="text-center">
          <DialogHeader>
            <DialogTitle>Código QR del Menú</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-white p-4 rounded-xl shadow-lg">
              <QRCodeSVG value={menuUrl} size={250} level="H" />
            </div>
            <p className="text-sm text-muted-foreground break-all">{menuUrl}</p>
            <p className="text-sm">Imprime este QR y colócalo en las mesas</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
