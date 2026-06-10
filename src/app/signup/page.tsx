"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, Store, Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { signupRestaurant } from "./actions";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

export default function SignupPage() {
  const [restaurantName, setRestaurantName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  function onNameChange(v: string) {
    setRestaurantName(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await signupRestaurant({
      restaurantName,
      slug,
      ownerName,
      email,
      password,
    });

    if (!res.ok) {
      toast.error(res.error);
      setLoading(false);
      return;
    }

    // Loguear al dueño recién creado y mandarlo a su admin
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (signErr) {
      // La cuenta existe; si el auto-login falla, mándalo a login
      toast.success("¡Restaurante creado! Inicia sesión para continuar");
      window.location.href = "/login";
      return;
    }
    window.location.href = `/r/${res.slug}/admin/settings`;
  }

  return (
    <main className="relative flex-1 flex items-center justify-center min-h-screen p-6 bg-background overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gold/15 rounded-full blur-3xl" />
      </div>

      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Store className="h-6 w-6" />
          </div>
          <p className="mb-1 text-[10px] tracking-[0.4em] uppercase text-gold-gradient font-semibold">
            — AuraFood —
          </p>
          <h1 className="font-display text-3xl font-medium tracking-tight text-primary">
            Crea tu restaurante
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            14 días gratis · sin tarjeta
          </p>
        </div>

        <Card className="glass-card animate-premium-in">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3 text-emerald-500" /> Menú QR
              </span>
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3 text-emerald-500" /> POS + Cocina
              </span>
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3 text-emerald-500" /> Inventario
              </span>
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3 text-emerald-500" /> Reportes
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label>Nombre del restaurante</Label>
                <Input
                  value={restaurantName}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder="Ej: Tacos El Güero"
                  required
                />
              </div>
              <div>
                <Label>Dirección web</Label>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground shrink-0">aurafood.app/r/</span>
                  <Input
                    value={slug}
                    onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
                    placeholder="tacos-el-guero"
                    required
                  />
                </div>
              </div>
              <div className="h-px bg-border my-1" />
              <div>
                <Label>Tu nombre</Label>
                <Input
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  required
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                />
              </div>
              <div>
                <Label>Contraseña</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>
              <Button type="submit" className="w-full btn-premium text-white h-11 gap-1.5" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {loading ? "Creando tu restaurante..." : "Empezar gratis"}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground mt-4">
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Inicia sesión
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
