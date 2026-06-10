import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  ExternalLink,
  Store,
  ShoppingBag,
  Package,
  Users,
  UserPlus,
} from "lucide-react";
import { PlanBadge, StatusBadge } from "../../badges";
import { RestaurantActions } from "./restaurant-actions";
import { InviteAdmin } from "./invite-admin";

export const dynamic = "force-dynamic";

export default async function RestaurantDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: r } = await supabase
    .from("restaurants")
    .select(
      "id, slug, name, plan, status, trial_ends_at, created_at, updated_at, owner_id"
    )
    .eq("id", id)
    .maybeSingle();

  if (!r) notFound();

  // Métricas del tenant — usamos count para no traer filas reales
  const [products, orders, customers, admins] = await Promise.all([
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", r.id),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", r.id),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", r.id),
    supabase
      .from("profiles")
      .select("id, display_name, role")
      .eq("restaurant_id", r.id)
      .eq("role", "admin"),
  ]);

  const trialDaysLeft = r.trial_ends_at
    ? Math.max(
        0,
        Math.ceil(
          (new Date(r.trial_ends_at).getTime() - Date.now()) /
            (24 * 60 * 60 * 1000)
        )
      )
    : null;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <Link
          href="/super-admin/restaurants"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" /> Restaurantes
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-medium text-primary">
              {r.name}
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-sm text-muted-foreground">/r/{r.slug}</span>
              <PlanBadge plan={r.plan} />
              <StatusBadge status={r.status} />
              {trialDaysLeft !== null && (
                <span className="text-xs text-amber-600 dark:text-amber-400 tabular-nums">
                  Trial: {trialDaysLeft}d
                </span>
              )}
            </div>
          </div>
          <Link href={`/r/${r.slug}/menu`} target="_blank">
            <Button variant="outline" className="gap-1.5">
              <ExternalLink className="h-4 w-4" /> Ver menú público
            </Button>
          </Link>
        </div>
      </div>

      {/* KPIs del tenant */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Productos
            </CardTitle>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Package className="h-3.5 w-3.5" />
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {products.count ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Órdenes
            </CardTitle>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <ShoppingBag className="h-3.5 w-3.5" />
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {orders.count ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Clientes
            </CardTitle>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {customers.count ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Acciones */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" /> Acciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RestaurantActions
            id={r.id}
            currentPlan={r.plan}
            currentStatus={r.status}
          />
        </CardContent>
      </Card>

      {/* Invitar admin del tenant */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" /> Admin del restaurante
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Crea la cuenta del dueño para que opere su restaurante sin necesidad de impersonar.
          </p>
        </CardHeader>
        <CardContent>
          <InviteAdmin restaurantId={r.id} existing={admins.data ?? []} />
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
            <dt className="text-muted-foreground">ID</dt>
            <dd className="font-mono text-xs break-all">{r.id}</dd>

            <dt className="text-muted-foreground">Slug</dt>
            <dd className="font-mono">{r.slug}</dd>

            <dt className="text-muted-foreground">Plan</dt>
            <dd><PlanBadge plan={r.plan} /></dd>

            <dt className="text-muted-foreground">Estado</dt>
            <dd><StatusBadge status={r.status} /></dd>

            <dt className="text-muted-foreground">Alta</dt>
            <dd className="tabular-nums">
              {new Date(r.created_at).toLocaleString("es-MX")}
            </dd>

            <dt className="text-muted-foreground">Trial vence</dt>
            <dd className="tabular-nums">
              {r.trial_ends_at
                ? new Date(r.trial_ends_at).toLocaleDateString("es-MX")
                : "—"}
            </dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
