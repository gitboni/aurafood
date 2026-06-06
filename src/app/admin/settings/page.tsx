"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Settings } from "@/lib/types";
import { Home, LogOut, Loader2, Save, Upload, Store, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingFav, setUploadingFav] = useState(false);

  const supabase = createClient();

  async function load() {
    const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
    if (error?.code === "42P01") { setNeedsSetup(true); setLoading(false); return; }
    setSettings(
      data ?? {
        id: 1, restaurant_name: "Mi Restaurante", logo_url: null, favicon_url: null,
        address: null, phone: null, rfc: null, tax_enabled: false, tax_rate: 16,
        updated_at: new Date().toISOString(),
      }
    );
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
  }

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fileName = `logo-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("branding").upload(fileName, file, { upsert: true });
    if (error) { toast.error("Error al subir el logo"); setUploading(false); return; }
    const { data } = supabase.storage.from("branding").getPublicUrl(fileName);
    set("logo_url", data.publicUrl);
    setUploading(false);
    toast.success("Logo subido — recuerda guardar");
  }

  async function uploadFavicon(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFav(true);
    const fileName = `favicon-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("branding").upload(fileName, file, { upsert: true });
    if (error) { toast.error("Error al subir el favicon"); setUploadingFav(false); return; }
    const { data } = supabase.storage.from("branding").getPublicUrl(fileName);
    set("favicon_url", data.publicUrl);
    setUploadingFav(false);
    toast.success("Favicon subido — recuerda guardar");
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase.from("settings").upsert({
      id: 1,
      restaurant_name: settings.restaurant_name,
      logo_url: settings.logo_url,
      favicon_url: settings.favicon_url,
      address: settings.address,
      phone: settings.phone,
      rfc: settings.rfc,
      tax_enabled: settings.tax_enabled,
      tax_rate: settings.tax_rate,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) { toast.error("Error al guardar"); return; }
    toast.success("Ajustes guardados");
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
    </div>
  );

  if (needsSetup) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-gray-50">
      <Store className="h-12 w-12 text-orange-500" />
      <h2 className="text-xl font-bold">Configura la tabla de ajustes</h2>
      <p className="text-muted-foreground text-center max-w-md">
        Ejecuta <code className="bg-muted px-1 rounded">supabase-settings.sql</code> en
        Supabase (SQL Editor), luego reintenta.
      </p>
      <Button onClick={() => { setNeedsSetup(false); setLoading(true); load(); }}>Reintentar</Button>
    </div>
  );

  if (!settings) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <p className="font-semibold">No se pudieron cargar los ajustes</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/"><Button variant="ghost" size="icon"><Home className="h-5 w-5" /></Button></Link>
        <Store className="h-5 w-5 text-orange-500" />
        <h1 className="text-xl font-bold">Ajustes del Restaurante</h1>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" onClick={async () => {
          await supabase.auth.signOut(); window.location.href = "/login";
        }}><LogOut className="h-5 w-5" /></Button>
      </header>

      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Marca</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Logo</Label>
              <div className="flex items-center gap-4 mt-1">
                <div className="relative h-20 w-20 rounded-xl bg-muted overflow-hidden border shrink-0">
                  {settings.logo_url ? (
                    <Image src={settings.logo_url} alt="Logo" fill className="object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-3xl">🍽️</div>
                  )}
                </div>
                <div>
                  <Input type="file" accept="image/*" onChange={uploadLogo} disabled={uploading} />
                  {uploading && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Subiendo...</p>}
                  <p className="text-xs text-muted-foreground mt-1">PNG o JPG, cuadrado de preferencia</p>
                </div>
              </div>
            </div>
            <div>
              <Label>Favicon (ícono de la pestaña)</Label>
              <div className="flex items-center gap-4 mt-1">
                <div className="relative h-12 w-12 rounded-lg bg-muted overflow-hidden border shrink-0">
                  {settings.favicon_url ? (
                    <Image src={settings.favicon_url} alt="Favicon" fill className="object-contain p-1" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-xl">🍽️</div>
                  )}
                </div>
                <div>
                  <Input type="file" accept="image/png,image/x-icon,image/svg+xml,image/jpeg" onChange={uploadFavicon} disabled={uploadingFav} />
                  {uploadingFav && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Subiendo...</p>}
                  <p className="text-xs text-muted-foreground mt-1">PNG o ICO, 32×32 o 64×64 px</p>
                </div>
              </div>
            </div>
            <div>
              <Label>Nombre del restaurante</Label>
              <Input value={settings.restaurant_name}
                onChange={(e) => set("restaurant_name", e.target.value)} className="mt-1" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Datos para el ticket</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Dirección</Label>
              <Input value={settings.address ?? ""} onChange={(e) => set("address", e.target.value)} className="mt-1" placeholder="Av. Principal 123" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Teléfono</Label>
                <Input value={settings.phone ?? ""} onChange={(e) => set("phone", e.target.value)} className="mt-1" placeholder="+52 555 123 4567" />
              </div>
              <div>
                <Label>RFC (opcional)</Label>
                <Input value={settings.rfc ?? ""} onChange={(e) => set("rfc", e.target.value)} className="mt-1" />
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <input type="checkbox" id="tax" checked={settings.tax_enabled}
                onChange={(e) => set("tax_enabled", e.target.checked)} className="rounded" />
              <Label htmlFor="tax">Desglosar IVA en el ticket</Label>
              {settings.tax_enabled && (
                <div className="flex items-center gap-1 ml-auto">
                  <Input type="number" min="0" max="100" value={settings.tax_rate}
                    onChange={(e) => set("tax_rate", parseFloat(e.target.value) || 0)} className="w-20" />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white" size="lg" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Guardar Ajustes
        </Button>
      </div>
    </div>
  );
}
