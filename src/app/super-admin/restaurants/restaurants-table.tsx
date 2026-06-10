"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Plus,
  ExternalLink,
  ShieldOff,
  ShieldCheck,
  Loader2,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { PlanBadge, StatusBadge } from "../badges";
import { impersonateTenant } from "./actions";

type Restaurant = {
  id: string;
  slug: string;
  name: string;
  plan: string;
  status: string;
  trial_ends_at: string | null;
  created_at: string;
  owner_id: string | null;
};

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

export function RestaurantsTable({ initial }: { initial: Restaurant[] }) {
  const [rows, setRows] = useState<Restaurant[]>(initial);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const router = useRouter();

  const filtered = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            !search.trim() ||
            r.name.toLowerCase().includes(search.toLowerCase()) ||
            r.slug.toLowerCase().includes(search.toLowerCase())
        )
        .filter((r) => statusFilter === "all" || r.status === statusFilter)
        .filter((r) => planFilter === "all" || r.plan === planFilter),
    [rows, search, statusFilter, planFilter]
  );

  async function toggleStatus(r: Restaurant) {
    const supabase = createClient();
    const next = r.status === "active" ? "suspended" : "active";
    const { error } = await supabase
      .from("restaurants")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, status: next } : x))
    );
    toast.success(next === "active" ? "Reactivado" : "Suspendido");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="past_due">Mora</SelectItem>
            <SelectItem value="suspended">Suspendidos</SelectItem>
            <SelectItem value="cancelled">Cancelados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={(v) => v && setPlanFilter(v)}>
          <SelectTrigger className="sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los planes</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nuevo restaurante
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Mostrando <strong className="tabular-nums">{filtered.length}</strong> de{" "}
        {rows.length} restaurantes
      </p>

      {/* Tabla */}
      <div className="rounded-xl border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground uppercase tracking-wide border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Restaurante</th>
              <th className="text-left px-4 py-3 font-medium">Plan</th>
              <th className="text-left px-4 py-3 font-medium">Estado</th>
              <th className="text-left px-4 py-3 font-medium">Alta</th>
              <th className="text-right px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="border-b last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/super-admin/restaurants/${r.id}`}
                    className="block group"
                  >
                    <p className="font-medium group-hover:text-primary transition-colors">
                      {r.name}
                    </p>
                    <p className="text-xs text-muted-foreground">/r/{r.slug}</p>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <PlanBadge plan={r.plan} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                  {new Date(r.created_at).toLocaleDateString("es-MX")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link href={`/r/${r.slug}/menu`} target="_blank">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="Abrir menú público"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                    <form
                      action={async () => {
                        await impersonateTenant(r.id, r.slug);
                      }}
                    >
                      <Button
                        size="icon"
                        variant="ghost"
                        type="submit"
                        className="h-8 w-8 text-primary hover:bg-primary/10"
                        title={`Entrar como admin de ${r.name}`}
                      >
                        <UserCog className="h-3.5 w-3.5" />
                      </Button>
                    </form>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={`h-8 w-8 ${
                        r.status === "active"
                          ? "text-red-500 hover:bg-red-500/10"
                          : "text-emerald-600 hover:bg-emerald-500/10"
                      }`}
                      title={r.status === "active" ? "Suspender" : "Reactivar"}
                      onClick={() => toggleStatus(r)}
                    >
                      {r.status === "active" ? (
                        <ShieldOff className="h-3.5 w-3.5" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  {rows.length === 0
                    ? "Aún no hay restaurantes. Crea el primero."
                    : "Ningún restaurante coincide con los filtros."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CreateDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(r) => {
          setRows((prev) => [r, ...prev]);
          setShowCreate(false);
          router.refresh();
        }}
      />
    </div>
  );
}

function CreateDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (r: Restaurant) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [plan, setPlan] = useState<string>("trial");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || !slug.trim()) {
      toast.error("Nombre y slug son obligatorios");
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
      toast.error("Slug inválido: usa letras minúsculas, números y guiones");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("restaurants")
      .insert({
        name: name.trim(),
        slug: slug.trim(),
        plan,
        status: "active",
        trial_ends_at:
          plan === "trial"
            ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
            : null,
      })
      .select()
      .single();
    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }
    // ── Seed mínimo del nuevo tenant ──────────────────────────
    // El menú / POS / admin esperan un row de `settings`. Sin esto
    // el tenant queda "muerto" al cargar — el código consulta
    // settings.eq("id", 1) o similar y no encuentra nada.
    // Pasamos restaurant_id explícito para que el trigger
    // auto_fill_restaurant_id NO lo sobrescriba con el del super_admin.
    const { error: settingsError } = await supabase
      .from("settings")
      .insert({
        restaurant_id: data.id,
        restaurant_name: data.name,
      });
    setSaving(false);
    if (settingsError) {
      // No bloqueamos: el restaurante ya existe. Avisamos para que
      // el super_admin pueda revisar a mano si algo falla.
      toast.error(
        `Tenant creado pero falló settings: ${settingsError.message}`
      );
    } else {
      toast.success(`${data.name} creado · listo para usar`);
    }
    setName("");
    setSlug("");
    setPlan("trial");
    onCreated(data as Restaurant);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo restaurante</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nombre del restaurante</Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug || slug === slugify(name)) {
                  setSlug(slugify(e.target.value));
                }
              }}
              placeholder="Ej: Sabor Mexicano"
            />
          </div>
          <div>
            <Label>Slug (URL)</Label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground shrink-0">/r/</span>
              <Input
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="sabor-mexicano"
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Solo letras minúsculas, números y guiones. 3 a 40 caracteres.
            </p>
          </div>
          <div>
            <Label>Plan</Label>
            <Select value={plan} onValueChange={(v) => v && setPlan(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trial">🎁 Trial (14 días gratis)</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="flex-1 gap-1.5"
              disabled={saving}
              onClick={save}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear restaurante
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
