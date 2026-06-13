import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, Users, DollarSign, AlertOctagon } from "lucide-react";
import { lastNMonths, bucketByMonth } from "../health";
import { Sparkline } from "./sparkline";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const supabase = await createClient();
  const months = lastNMonths(6);
  const sinceISO = months[0].start.toISOString();

  // 1. Restaurants creados (todos)
  const { data: rests } = await supabase
    .from("restaurants")
    .select("id, slug, name, plan, status, created_at, trial_ends_at")
    .order("created_at", { ascending: true });

  // 2. Órdenes delivered + total para GMV mensual (super_admin bypasa RLS)
  const { data: orders } = await supabase
    .from("orders")
    .select("created_at, total, status, restaurant_id")
    .eq("status", "delivered")
    .gte("created_at", sinceISO);

  // Series mensuales
  const signupsByMonth = bucketByMonth(rests ?? [], months);
  const gmvByMonth = bucketByMonth(
    (orders ?? []) as { created_at: string; total: number }[],
    months,
    (o) => Number(o.total) || 0
  );
  const ordersByMonth = bucketByMonth(
    (orders ?? []) as { created_at: string }[],
    months
  );

  // Tasa de churn mensual aproximada:
  //   churned(M) = restaurantes que tenían actividad antes de M y no en M
  // Para un cálculo rápido usamos status='cancelled' creado en cada mes.
  const cancelledByMonth = bucketByMonth(
    ((rests ?? []) as { created_at: string; status: string }[])
      .filter((r) => r.status === "cancelled" || r.status === "suspended"),
    months
  );

  const totalRest = (rests ?? []).length;
  const totalSignups6m = signupsByMonth.reduce((s, n) => s + n, 0);
  const totalGmv6m = gmvByMonth.reduce((s, n) => s + n, 0);
  const monthLabels = months.map((m) => m.label);

  // Top 5 restaurantes por GMV (últimos 6 meses)
  const gmvByRest = new Map<string, number>();
  for (const o of (orders ?? []) as { restaurant_id: string; total: number }[]) {
    gmvByRest.set(
      o.restaurant_id,
      (gmvByRest.get(o.restaurant_id) ?? 0) + (Number(o.total) || 0)
    );
  }
  const topRests = (rests ?? [])
    .map((r) => ({ ...r, gmv: gmvByRest.get(r.id) ?? 0 }))
    .filter((r) => r.gmv > 0)
    .sort((a, b) => b.gmv - a.gmv)
    .slice(0, 5);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <Link href="/super-admin"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <h1 className="font-display text-3xl font-medium text-primary flex items-center gap-2">
          <TrendingUp className="h-6 w-6" /> Insights
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tendencias de los últimos 6 meses — basado en datos reales de todos los tenants.
        </p>
      </div>

      {/* KPIs 6 meses */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total tenants</CardTitle>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><Users className="h-3.5 w-3.5" /></span>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold tabular-nums">{totalRest}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Signups 6m</CardTitle>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><Users className="h-3.5 w-3.5" /></span>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold tabular-nums">{totalSignups6m}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">GMV 6m</CardTitle>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><DollarSign className="h-3.5 w-3.5" /></span>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            ${totalGmv6m.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
          </div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bajas 6m</CardTitle>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400"><AlertOctagon className="h-3.5 w-3.5" /></span>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
            {cancelledByMonth.reduce((s, n) => s + n, 0)}
          </div></CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nuevos restaurantes por mes</CardTitle>
          </CardHeader>
          <CardContent>
            <Sparkline values={signupsByMonth} labels={monthLabels}
              stroke="hsl(207, 65%, 50%)" fill="hsl(207, 65%, 50%)" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">GMV mensual</CardTitle>
          </CardHeader>
          <CardContent>
            <Sparkline values={gmvByMonth} labels={monthLabels} prefix="$"
              stroke="hsl(160, 65%, 40%)" fill="hsl(160, 65%, 40%)" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Órdenes mensuales</CardTitle>
          </CardHeader>
          <CardContent>
            <Sparkline values={ordersByMonth} labels={monthLabels}
              stroke="hsl(25, 75%, 55%)" fill="hsl(25, 75%, 55%)" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bajas / suspendidos por mes</CardTitle>
          </CardHeader>
          <CardContent>
            <Sparkline values={cancelledByMonth} labels={monthLabels}
              stroke="hsl(0, 70%, 55%)" fill="hsl(0, 70%, 55%)" />
          </CardContent>
        </Card>
      </div>

      {/* Top 5 por GMV */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 5 restaurantes por GMV (6 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topRests.map((r, i) => (
              <Link key={r.id} href={`/super-admin/restaurants/${r.id}`}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                <span className="text-xs font-mono w-5 text-muted-foreground">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground truncate">/r/{r.slug}</p>
                </div>
                <span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                  ${r.gmv.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                </span>
              </Link>
            ))}
            {topRests.length === 0 && (
              <p className="text-center text-muted-foreground py-6 text-sm">Aún sin GMV registrado.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
