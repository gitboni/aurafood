"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTenantId } from "@/lib/tenant-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Home, LogOut, Calculator, AlertTriangle, TrendingUp, ArrowDown, ArrowUp,
  DollarSign, Percent, Loader2, Search,
} from "lucide-react";
import {
  loadProfitabilityData,
  classifyBcg,
  BCG_META,
  type ProductRow,
  type CategoryRow,
  type BcgQuadrant,
} from "./analytics";

type SortKey = "name" | "margin_pct" | "profit_30d" | "units_sold_30d" | "revenue_30d";
type FilterKey = "all" | "low_margin" | "no_cost" | "no_sales" | "stars" | "dogs";

export default function ProfitabilityPage() {
  const supabase = createClient();
  const { tenantId } = useTenantId();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);

  // Filtros UI
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("profit_30d");
  const [marginTarget, setMarginTarget] = useState<number>(65); // % objetivo (food cost ~35%)
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Simulador "qué pasaría si": multiplicador global de costo (1.0 = igual)
  const [costMultiplier, setCostMultiplier] = useState<number>(1.0);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setLoading(true);
      const { products, categories } = await loadProfitabilityData(
        supabase, tenantId
      );
      setProducts(products);
      setCategories(categories);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // Aplicar simulador: recalcular costos/márgenes/ganancia
  const simulated = useMemo<ProductRow[]>(() => {
    if (costMultiplier === 1.0) return products;
    return products.map((p) => {
      const cost = p.effective_cost * costMultiplier;
      const margin_amount = p.price - cost;
      const margin_pct = p.price > 0 ? margin_amount / p.price : 0;
      const profit_30d = p.units_sold_30d * margin_amount;
      return { ...p, effective_cost: cost, margin_amount, margin_pct, profit_30d };
    });
  }, [products, costMultiplier]);

  const bcg = useMemo(() => classifyBcg(simulated), [simulated]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return simulated
      .filter((p) => !term || p.name.toLowerCase().includes(term))
      .filter((p) => categoryFilter === "all" || p.category_id === categoryFilter)
      .filter((p) => {
        if (filter === "low_margin") return p.margin_pct * 100 < marginTarget;
        if (filter === "no_cost") return p.effective_cost <= 0;
        if (filter === "no_sales") return p.units_sold_30d === 0;
        if (filter === "stars") return bcg.get(p.id) === "star";
        if (filter === "dogs") return bcg.get(p.id) === "dog";
        return true;
      })
      .sort((a, b) => {
        if (sortKey === "name") return a.name.localeCompare(b.name);
        return (b[sortKey] as number) - (a[sortKey] as number);
      });
  }, [simulated, search, filter, sortKey, marginTarget, categoryFilter, bcg]);

  // KPIs agregados sobre simulated (no filtered, para no confundir al ver filtros)
  const kpi = useMemo(() => {
    const totalRevenue = simulated.reduce((s, p) => s + p.revenue_30d, 0);
    const totalProfit = simulated.reduce((s, p) => s + p.profit_30d, 0);
    const avgMargin = simulated.length > 0
      ? simulated.reduce((s, p) => s + p.margin_pct, 0) / simulated.length
      : 0;
    const lowMargin = simulated.filter((p) => p.margin_pct * 100 < marginTarget).length;
    return { totalRevenue, totalProfit, avgMargin, lowMargin };
  }, [simulated, marginTarget]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-6 py-4 flex items-center gap-4">
        <Link href="/"><Button variant="ghost" size="icon"><Home className="h-5 w-5" /></Button></Link>
        <Calculator className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Rentabilidad</h1>
        <div className="flex-1" />
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={async () => {
          await supabase.auth.signOut(); window.location.href = "/login";
        }}><LogOut className="h-5 w-5" /></Button>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Ingresos 30 días"
            value={`$${kpi.totalRevenue.toFixed(0)}`}
            icon={<DollarSign className="h-3.5 w-3.5" />}
            tint="primary"
          />
          <KpiCard
            label="Ganancia estimada"
            value={`$${kpi.totalProfit.toFixed(0)}`}
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            tint="emerald"
          />
          <KpiCard
            label="Margen promedio"
            value={`${(kpi.avgMargin * 100).toFixed(0)}%`}
            icon={<Percent className="h-3.5 w-3.5" />}
            tint={kpi.avgMargin * 100 >= marginTarget ? "emerald" : "amber"}
          />
          <KpiCard
            label={`Bajo del ${marginTarget}%`}
            value={`${kpi.lowMargin}`}
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            tint={kpi.lowMargin > 0 ? "red" : "muted"}
          />
        </div>

        {/* Simulador "qué pasaría si" */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" /> Simulador &quot;qué pasaría si&quot;
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Mueve el deslizador para ver cómo cambian tus márgenes si suben (o bajan) los costos de tus ingredientes.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4 flex-wrap">
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={costMultiplier}
                onChange={(e) => setCostMultiplier(parseFloat(e.target.value))}
                className="flex-1 min-w-[200px] accent-primary"
              />
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold tabular-nums ${
                  costMultiplier > 1 ? "text-red-600 dark:text-red-400"
                  : costMultiplier < 1 ? "text-emerald-600 dark:text-emerald-400"
                  : ""
                }`}>
                  {costMultiplier === 1 ? "—"
                    : costMultiplier > 1 ? `+${((costMultiplier - 1) * 100).toFixed(0)}%`
                    : `−${((1 - costMultiplier) * 100).toFixed(0)}%`}
                </span>
                <Button size="sm" variant="outline" onClick={() => setCostMultiplier(1.0)}>
                  Reset
                </Button>
              </div>
            </div>
            {costMultiplier !== 1 && (
              <p className="text-xs text-muted-foreground">
                Con un cambio del {costMultiplier > 1 ? "+" : "−"}{Math.abs((costMultiplier - 1) * 100).toFixed(0)}%
                {" "}en el costo de ingredientes, la ganancia mensual estimada sería de{" "}
                <strong className={kpi.totalProfit > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                  ${kpi.totalProfit.toFixed(0)}
                </strong>.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Matriz BCG */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Matriz de productos</CardTitle>
            <p className="text-sm text-muted-foreground">
              Cada cuadrante te dice qué hacer con esos productos. Cálculo basado en mediana de ventas y mediana de margen.
            </p>
          </CardHeader>
          <CardContent>
            <BcgGrid products={simulated} bcg={bcg} />
          </CardContent>
        </Card>

        {/* Top categorías */}
        {categories.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rentabilidad por categoría</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {categories
                .slice()
                .sort((a, b) => b.profit_30d - a.profit_30d)
                .map((c) => (
                <div key={c.id} className="flex items-center gap-3 text-sm py-1.5 border-b last:border-0">
                  <p className="font-medium flex-1 truncate">{c.name}</p>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {c.products} prod
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">
                    {(c.avg_margin_pct * 100).toFixed(0)}% mg
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums w-20 text-right">
                    ${c.revenue_30d.toFixed(0)}
                  </span>
                  <span className="font-semibold tabular-nums w-20 text-right text-emerald-600 dark:text-emerald-400">
                    ${c.profit_30d.toFixed(0)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Tabla maestra de productos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Productos — análisis completo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar producto..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={filter} onValueChange={(v) => v && setFilter(v as FilterKey)}>
                <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="low_margin">⚠️ Margen bajo</SelectItem>
                  <SelectItem value="no_cost">Sin costo definido</SelectItem>
                  <SelectItem value="no_sales">Sin ventas (30d)</SelectItem>
                  <SelectItem value="stars">⭐ Estrellas</SelectItem>
                  <SelectItem value="dogs">🐕 Perros (quitar)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={(v) => v && setCategoryFilter(v)}>
                <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortKey} onValueChange={(v) => v && setSortKey(v as SortKey)}>
                <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="profit_30d">Orden: Ganancia ↓</SelectItem>
                  <SelectItem value="revenue_30d">Orden: Ingresos ↓</SelectItem>
                  <SelectItem value="margin_pct">Orden: Margen % ↓</SelectItem>
                  <SelectItem value="units_sold_30d">Orden: Unidades ↓</SelectItem>
                  <SelectItem value="name">Orden: Nombre A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <Label className="text-xs">Margen objetivo</Label>
              <Input
                type="number" min="0" max="100" step="1"
                value={marginTarget}
                onChange={(e) => setMarginTarget(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                className="w-20 h-8"
              />
              <span className="text-muted-foreground">% — productos por debajo se marcan ⚠️</span>
            </div>

            {/* Tabla */}
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground uppercase tracking-wide border-b">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Producto</th>
                    <th className="text-right px-3 py-2 font-medium">Precio</th>
                    <th className="text-right px-3 py-2 font-medium">Costo</th>
                    <th className="text-right px-3 py-2 font-medium">Margen</th>
                    <th className="text-right px-3 py-2 font-medium">Vendidas</th>
                    <th className="text-right px-3 py-2 font-medium">Ingresos</th>
                    <th className="text-right px-3 py-2 font-medium">Ganancia</th>
                    <th className="text-center px-3 py-2 font-medium">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const cat = bcg.get(p.id);
                    const meta = cat ? BCG_META[cat] : null;
                    const low = p.margin_pct * 100 < marginTarget;
                    return (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <p className="font-medium truncate max-w-[200px]" title={p.name}>{p.name}</p>
                          <p className="text-[10px] text-muted-foreground">{p.category_name}</p>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">${p.price.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {p.effective_cost > 0 ? `$${p.effective_cost.toFixed(2)}` : "—"}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums font-semibold ${
                          low ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                        }`}>
                          {p.effective_cost > 0 ? `${(p.margin_pct * 100).toFixed(0)}%` : "—"}
                          {low && p.effective_cost > 0 && (
                            <AlertTriangle className="inline h-3 w-3 ml-1" />
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.units_sold_30d}</td>
                        <td className="px-3 py-2 text-right tabular-nums">${p.revenue_30d.toFixed(0)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">
                          ${p.profit_30d.toFixed(0)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {meta && (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full text-white ${meta.color}`}
                              title={meta.hint}
                            >
                              {meta.label}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-12 text-center text-muted-foreground">
                        Ningún producto coincide con los filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              <strong>Costo</strong> = el mayor entre el costo guardado y el calculado por receta.
              Ventas y ganancia de los últimos 30 días.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Helpers de UI ────────────────────────────────────────────

function KpiCard({
  label, value, icon, tint,
}: {
  label: string; value: string; icon: React.ReactNode;
  tint: "primary" | "emerald" | "amber" | "red" | "muted";
}) {
  const bg = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    red: "bg-red-500/10 text-red-600 dark:text-red-400",
    muted: "bg-muted text-muted-foreground",
  }[tint];
  const text = {
    primary: "", emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    red: "text-red-600 dark:text-red-400", muted: "",
  }[tint];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </CardTitle>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${bg}`}>
          {icon}
        </span>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold tabular-nums ${text}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function BcgGrid({
  products, bcg,
}: {
  products: ProductRow[];
  bcg: Map<string, BcgQuadrant>;
}) {
  const cells: Record<BcgQuadrant, ProductRow[]> = { star: [], cash_cow: [], question: [], dog: [] };
  for (const p of products) {
    const q = bcg.get(p.id);
    if (q) cells[q].push(p);
  }
  // Orden visual: arriba alto margen, abajo bajo margen; izq alto vol, der bajo vol
  // (cash_cow alto vol/bajo margen → abajo izq; question bajo vol/alto margen → arriba der)
  const layout: { quad: BcgQuadrant; row: number; col: number }[] = [
    { quad: "star",     row: 0, col: 0 },
    { quad: "question", row: 0, col: 1 },
    { quad: "cash_cow", row: 1, col: 0 },
    { quad: "dog",      row: 1, col: 1 },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        {layout.map(({ quad }) => {
          const meta = BCG_META[quad];
          const items = cells[quad];
          const arrow =
            quad === "star" ? <ArrowUp className="h-3.5 w-3.5" />
            : quad === "dog" ? <ArrowDown className="h-3.5 w-3.5" />
            : null;
          return (
            <div key={quad} className="rounded-lg border bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b">
                <span className={`h-2.5 w-2.5 rounded-full ${meta.color}`} />
                <span className="text-sm font-semibold flex-1">{meta.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
                {arrow}
              </div>
              <p className="text-[11px] text-muted-foreground px-3 py-1.5 border-b leading-tight">
                {meta.hint}
              </p>
              <div className="max-h-32 overflow-y-auto">
                {items.slice(0, 8).map((p) => (
                  <div key={p.id} className="flex items-center gap-2 px-3 py-1 text-xs hover:bg-muted/30">
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="tabular-nums text-muted-foreground">{p.units_sold_30d}</span>
                  </div>
                ))}
                {items.length > 8 && (
                  <p className="text-[10px] text-muted-foreground text-center py-1">
                    +{items.length - 8} más
                  </p>
                )}
                {items.length === 0 && (
                  <p className="text-[10px] text-muted-foreground text-center py-3">—</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>← Alto volumen</span>
        <span>Bajo volumen →</span>
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">
        ↑ Alto margen &nbsp;·&nbsp; ↓ Bajo margen
      </div>
    </div>
  );
}
