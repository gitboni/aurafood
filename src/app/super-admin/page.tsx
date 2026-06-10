import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Store,
  Activity,
  Clock,
  AlertOctagon,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import { PlanBadge, StatusBadge } from "./badges";

// Sin pricing real todavía (F5). Esto es solo el placeholder
// del MRR estimado por plan — útil para ver el upside.
const PLAN_PRICE: Record<string, number> = {
  trial: 0,
  free: 0,
  pro: 49,
  enterprise: 199,
};

type Restaurant = {
  id: string;
  slug: string;
  name: string;
  plan: string;
  status: string;
  trial_ends_at: string | null;
  created_at: string;
};

export default async function SuperAdminDashboard() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurants")
    .select("id, slug, name, plan, status, trial_ends_at, created_at")
    .order("created_at", { ascending: false });

  const restaurants = (data ?? []) as Restaurant[];
  const totalCount = restaurants.length;
  const active = restaurants.filter((r) => r.status === "active").length;
  const suspended = restaurants.filter(
    (r) => r.status === "suspended" || r.status === "cancelled"
  ).length;
  const onTrial = restaurants.filter(
    (r) => r.plan === "trial" && r.status === "active"
  );
  const now = Date.now();
  const trialExpiringSoon = onTrial.filter(
    (r) =>
      r.trial_ends_at &&
      new Date(r.trial_ends_at).getTime() - now < 3 * 24 * 60 * 60 * 1000
  ).length;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const newThisMonth = restaurants.filter(
    (r) => new Date(r.created_at) >= startOfMonth
  ).length;

  const mrr = restaurants
    .filter((r) => r.status === "active")
    .reduce((s, r) => s + (PLAN_PRICE[r.plan] ?? 0), 0);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium text-primary">
            Vista global
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Estado del SaaS en tiempo real
          </p>
        </div>
        <Link href="/super-admin/restaurants">
          <Button variant="outline" className="gap-1.5">
            Ver todos los restaurantes <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {error && error.code !== "42P01" && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/30">
          Error cargando restaurantes: {error.message}
        </div>
      )}

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Restaurantes
            </CardTitle>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Store className="h-3.5 w-3.5" />
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{totalCount}</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              +{newThisMonth} este mes
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Activos
            </CardTitle>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Activity className="h-3.5 w-3.5" />
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {active}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              En trial
            </CardTitle>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="h-3.5 w-3.5" />
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {onTrial.length}
            </div>
            {trialExpiringSoon > 0 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                {trialExpiringSoon} vence en &lt;3 días
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Suspendidos
            </CardTitle>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
              <AlertOctagon className="h-3.5 w-3.5" />
            </span>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold tabular-nums ${
                suspended > 0 ? "text-red-600 dark:text-red-400" : ""
              }`}
            >
              {suspended}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              MRR estimado
            </CardTitle>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="h-3.5 w-3.5" />
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              ${mrr}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Placeholder hasta F5
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trials por vencer */}
      {onTrial.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" /> Trials activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {onTrial.slice(0, 6).map((r) => {
                const days = r.trial_ends_at
                  ? Math.max(
                      0,
                      Math.ceil(
                        (new Date(r.trial_ends_at).getTime() - now) /
                          (24 * 60 * 60 * 1000)
                      )
                    )
                  : null;
                const urgent = days !== null && days <= 3;
                return (
                  <Link
                    key={r.id}
                    href={`/super-admin/restaurants/${r.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        /r/{r.slug}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-medium tabular-nums ${
                        urgent
                          ? "text-red-600 dark:text-red-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {days !== null ? `${days}d` : "—"}
                    </span>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Últimos altas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" /> Últimos restaurantes dados de alta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {restaurants.slice(0, 5).map((r) => (
              <Link
                key={r.id}
                href={`/super-admin/restaurants/${r.id}`}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{r.name}</p>
                    <PlanBadge plan={r.plan} />
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    /r/{r.slug} ·{" "}
                    {new Date(r.created_at).toLocaleDateString("es-MX")}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
            {restaurants.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Aún no hay restaurantes dados de alta.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

