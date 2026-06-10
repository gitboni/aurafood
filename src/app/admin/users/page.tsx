"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Profile, UserRole } from "@/lib/types";
import {
  Home, LogOut, UserPlus, Shield, Users, Trash2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import { useTenantId } from "@/lib/tenant-client";

const ROLE_LABELS: Record<UserRole, string> = { admin: "Administrador", cashier: "Cajero", kitchen: "Cocina" };
const ROLE_COLORS: Record<UserRole, string> = { admin: "bg-blue-100 text-blue-800", cashier: "bg-orange-100 text-orange-800", kitchen: "bg-green-100 text-green-800" };

export default function UsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("cashier");
  const [creating, setCreating] = useState(false);

  const supabase = createClient();
  const { tenantId } = useTenantId();

  async function loadProfiles() {
    if (!tenantId) return;
    // Solo los usuarios de ESTE restaurante (excluye super_admin global
    // que tiene restaurant_id pero rol distinto, y otros tenants).
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("restaurant_id", tenantId)
      .in("role", ["admin", "cashier", "kitchen"])
      .order("created_at");
    if (data) setProfiles(data);
  }

  useEffect(() => {
    if (tenantId) loadProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function createUser() {
    if (!email || !password || !name) { toast.error("Completa todos los campos"); return; }
    if (!tenantId) { toast.error("No se pudo identificar el restaurante"); return; }
    setCreating(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    });

    if (error) { toast.error(error.message); setCreating(false); return; }

    if (data.user) {
      // Asignar rol + display_name + RESTAURANT_ID al nuevo perfil
      await supabase
        .from("profiles")
        .update({ role, display_name: name, restaurant_id: tenantId })
        .eq("id", data.user.id);
    }

    toast.success(`Usuario ${name} creado como ${ROLE_LABELS[role]}`);
    setName(""); setEmail(""); setPassword(""); setRole("cashier");
    setCreating(false);
    loadProfiles();
  }

  async function updateRole(profileId: string, newRole: string) {
    if (!tenantId) return;
    await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", profileId)
      .eq("restaurant_id", tenantId);
    toast.success("Rol actualizado");
    loadProfiles();
  }

  async function deleteUser(profileId: string) {
    if (!confirm("¿Eliminar este usuario?")) return;
    if (!tenantId) return;
    await supabase
      .from("profiles")
      .delete()
      .eq("id", profileId)
      .eq("restaurant_id", tenantId);
    toast.success("Usuario eliminado");
    loadProfiles();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-6 py-4 flex items-center gap-4">
        <Link href="/"><Button variant="ghost" size="icon"><Home className="h-5 w-5" /></Button></Link>
        <Users className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Gestión de Usuarios</h1>
        <div className="flex-1" />
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={async () => {
          await supabase.auth.signOut(); window.location.href = "/login";
        }}><LogOut className="h-5 w-5" /></Button>
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Crear Usuario</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nombre</Label><Input placeholder="Juan Pérez" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" placeholder="juan@email.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Contraseña</Label><Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <div>
                <Label>Rol</Label>
                <Select value={role} onValueChange={(v) => v && setRole(v as UserRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="cashier">Cajero</SelectItem>
                    <SelectItem value="kitchen">Cocina</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full bg-primary hover:bg-primary/90" onClick={createUser} disabled={creating}>
              {creating ? "Creando..." : "Crear Usuario"}
            </Button>
          </CardContent>
        </Card>

        <Separator />

        <div>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5" /> Usuarios Registrados ({profiles.length})
          </h2>
          <div className="grid gap-3">
            {profiles.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {(p.display_name || "U")[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{p.display_name || "Sin nombre"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("es")}</p>
                  </div>
                  <Badge className={ROLE_COLORS[p.role]}>{ROLE_LABELS[p.role]}</Badge>
                  <Select value={p.role} onValueChange={(v) => v && updateRole(p.id, v)}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="cashier">Cajero</SelectItem>
                      <SelectItem value="kitchen">Cocina</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteUser(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 text-sm text-blue-700">
            <p className="font-bold mb-1">Permisos por rol:</p>
            <ul className="space-y-1">
              <li><strong>Administrador:</strong> Acceso completo — POS, Cocina, Admin, Reportes, Usuarios</li>
              <li><strong>Cajero:</strong> POS y Cocina — puede tomar pedidos y ver estado</li>
              <li><strong>Cocina:</strong> Solo pantalla de cocina — ver y actualizar pedidos</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
