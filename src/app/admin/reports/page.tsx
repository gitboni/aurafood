"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Order, StockMovement } from "@/lib/types";
import {
  BarChart3, Home, DollarSign, ShoppingBag, TrendingUp, Clock,
  LogOut, Loader2, AlertCircle, ChevronDown, Package,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 50;

export default function ReportsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // Inventory consumption for the date
  const [movements, setMovements] = useState<StockMovement[]>([]);

  const supabase = createClient();

  async function loadOrders(d: string, reset = true) {
    if (reset) { setLoading(true); setError(false); setPage(0); }
    else setLoadingMore(true);

    const start = new Date(d); start.setHours(0, 0, 0, 0);
    const end   = new Date(d); end.setHours(23, 59, 59, 999);
    const currentPage = reset ? 0 : page + 1;
    const from = currentPage * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;

    try {
      // Count query (no join — avoids issues with embedded relations + count)
      const { count } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());

      // Data query with join + pagination
      const { data, error: dataError } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false })
        .range(from, to);

      if (dataError) throw dataError;

      if (reset) setOrders(data ?? []);
      else { setOrders((prev) => [...prev, ...(data ?? [])]); setPage(currentPage); }
      setTotalCount(count ?? 0);
    } catch {
      setError(true);
    } finally {
      setLoading(false); setLoadingMore(false);
    }
  }

  async function loadMovements(d: string) {
    const start = new Date(d); start.setHours(0, 0, 0, 0);
    const end   = new Date(d); end.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from("stock_movements")
      .select("*, ingredient:ingredients(name, unit)")
      .eq("type", "sale")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: false });

    setMovements((data ?? []) as StockMovement[]);
  }

  useEffect(() => { loadOrders(date); loadMovements(date); }, [date]);

  const delivered   = orders.filter((o) => o.status === "delivered");
  const totalRevenue = delivered.reduce((s, o) => s + Number(o.total), 0);
  const avgTicket   = delivered.length > 0 ? totalRevenue / delivered.length : 0;

  const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
  delivered.forEach((o) =>
    o.order_items?.forEach((item) => {
      if (!productSales[item.product_name])
        productSales[item.product_name] = { name: item.product_name, qty: 0, revenue: 0 };
      productSales[item.product_name].qty     += item.quantity;
      productSales[item.product_name].revenue += Number(item.subtotal);
    })
  );
  const topProducts = Object.values(productSales).sort((a, b) => b.qty - a.qty);

  // Aggregate consumption by ingredient
  const consumptionMap: Record<string, { name: string; unit: string; total: number }> = {};
  movements.forEach((m) => {
    const ing = m.ingredient as unknown as { name: string; unit: string } | undefined;
    if (!ing) return;
    const key = m.ingredient_id;
    if (!consumptionMap[key]) consumptionMap[key] = { name: ing.name, unit: ing.unit, total: 0 };
    consumptionMap[key].total += Math.abs(m.quantity);
  });
  const consumption = Object.values(consumptionMap).sort((a, b) => b.total - a.total);

  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800", preparing: "bg-blue-100 text-blue-800",
    ready: "bg-green-100 text-green-800", delivered: "bg-gray-100 text-gray-800",
    cancelled: "bg-red-100 text-red-800",
  };
  const STATUS_LABELS: Record<string, string> = {
    pending: "Pendiente", preparing: "Preparando", ready: "Listo",
    delivered: "Entregado", cancelled: "Cancelado",
  };

  const hasMore = orders.length < totalCount;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/"><Button variant="ghost" size="icon"><Home className="h-5 w-5" /></Button></Link>
        <BarChart3 className="h-5 w-5 text-rose-500" />
        <h1 className="text-xl font-bold">Reportes</h1>
        <div className="flex-1" />
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
        <Button variant="ghost" size="icon" onClick={async () => {
          await supabase.auth.signOut(); window.location.href = "/login";
        }}><LogOut className="h-5 w-5" /></Button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-[calc(100vh-73px)]">
          <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-73px)] gap-4">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="font-semibold">No se pudieron cargar los reportes</p>
          <Button onClick={() => loadOrders(date)}>Reintentar</Button>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto p-6 space-y-6">

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos</CardTitle>
                <DollarSign className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Completadas</CardTitle>
                <ShoppingBag className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{delivered.length}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Promedio</CardTitle>
                <TrendingUp className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">${avgTicket.toFixed(2)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Órdenes</CardTitle>
                <Clock className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{totalCount}</div></CardContent>
            </Card>
          </div>

          <Tabs defaultValue="orders">
            <TabsList>
              <TabsTrigger value="orders">Ventas</TabsTrigger>
              <TabsTrigger value="products">Productos</TabsTrigger>
              <TabsTrigger value="inventory">Consumo de Inventario</TabsTrigger>
            </TabsList>

            {/* ── Sales tab ── */}
            <TabsContent value="orders" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Historial de Órdenes
                    {totalCount > PAGE_SIZE && (
                      <span className="text-xs font-normal text-muted-foreground ml-2">
                        (mostrando {orders.length} de {totalCount})
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Hora</TableHead>
                        <TableHead>Cliente / Mesa</TableHead>
                        <TableHead>Origen</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="font-bold">{o.order_number}</TableCell>
                          <TableCell>
                            {new Date(o.created_at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                          </TableCell>
                          <TableCell>
                            {o.customer_name || o.customer_table
                              ? [o.customer_name, o.customer_table && `Mesa ${o.customer_table}`].filter(Boolean).join(" · ")
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{o.source === "qr" ? "QR" : "POS"}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_COLORS[o.status]}>{STATUS_LABELS[o.status]}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold">${Number(o.total).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      {orders.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No hay órdenes para esta fecha
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  {hasMore && (
                    <div className="mt-4 flex justify-center">
                      <Button variant="outline" size="sm" onClick={() => loadOrders(date, false)} disabled={loadingMore}>
                        {loadingMore ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                        Cargar más
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Products tab ── */}
            <TabsContent value="products" className="mt-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Productos más vendidos</CardTitle></CardHeader>
                <CardContent>
                  {topProducts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin ventas entregadas hoy</p>
                  ) : (
                    <div className="space-y-3">
                      {topProducts.map((p, i) => (
                        <div key={p.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-muted-foreground w-6">{i + 1}.</span>
                            <span className="text-sm">{p.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold">{p.qty}x</span>
                            <span className="text-xs text-muted-foreground ml-2">${p.revenue.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Inventory consumption tab ── */}
            <TabsContent value="inventory" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4 text-emerald-600" />
                    Consumo de Ingredientes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {consumption.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Sin consumo registrado. Las recetas de tus productos deben estar configuradas para ver el consumo.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ingrediente</TableHead>
                          <TableHead className="text-right">Consumido</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {consumption.map((c) => (
                          <TableRow key={c.name}>
                            <TableCell>{c.name}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {c.total.toLocaleString("es-MX", { maximumFractionDigits: 3 })} {c.unit}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
