"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { LogIn, Loader2 } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else {
      window.location.href = "/pos";
    }
  }

  return (
    <main className="relative flex-1 flex items-center justify-center min-h-screen p-6 bg-background overflow-hidden">
      {/* Glassmorphism background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gold/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      </div>

      {/* Theme toggle top-right */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      {/* Login card */}
      <Card className="relative z-10 w-full max-w-sm glass-card animate-premium-in">
        {/* Gold shimmer line at top */}
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />

        <CardHeader className="text-center">
          {/* Branding */}
          <div className="flex flex-col items-center gap-3">
            <div className="bg-card/60 backdrop-blur-md p-3 rounded-2xl shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Logo" className="h-12 w-auto object-contain" />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] tracking-[0.4em] uppercase text-gold-gradient font-semibold">— Restaurante —</p>
              <h1 className="font-display text-3xl font-medium tracking-tight text-primary">
                El Buen Comer
              </h1>
            </div>
            <p className="font-display italic text-sm text-muted-foreground">
              Ingresa a tu cuenta para continuar
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full btn-premium text-white h-11 font-semibold"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4 mr-2" strokeWidth={2} />
              )}
              {loading ? "Ingresando..." : "Iniciar Sesión"}
            </Button>
          </form>
          <p className="text-center text-xs text-muted-foreground mt-4">
            ¿No tienes restaurante?{" "}
            <Link href="/signup" className="text-primary hover:underline">
              Créalo gratis
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
