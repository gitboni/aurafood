"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Order } from "@/lib/types";
import {
  BarChart3,
  Home,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Clock,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ReportsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const supabase = createClient();

  async function loadOrders(d: string) {
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: false });

    if (data) setOrders(data);
  }

  useEffect(() => {
    loadOrders(date);
  }, [date]);

  const delivered = orders.filter((o) => o.status === "delivered");
  const totalRevenue = delivered.reduce((s, o) => s + Number(o.total), 0);
  const avgTicket = delivered.length > 0 ? totalRevenue / delivered.length : 0;

  const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
  delivered.forEach((o) => {
    o.order_items?.forEach((item) => {
      if (!productSales[item.product_name]) {
        productSales[item.product_name] = { name: item.product_name, qty: 0, revenue: 0 };
      }
      productSales[item.product_name].qty += item.quantity;
      productSales[item.product_name].revenue += Number(item.subtotal);
    });
  });

  const topProducts = Object.values(productSales).sort((a, b) => b.qty - a.qty);

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    preparing: "bg-blue-100 text-blue-800",
    ready: "bg-green-100 text-green-800",
    delivered: "bg-gray-100 text-gray-800",
    cancelled: "bg-red-100 text-red-800",
  };

  const statusLabels: Record<string, string> = {
    pending: "Pendiente",
    preparing: "Preparando",
    ready: "Listo",
    delivered: "Entregado",
    cancelled: "Cancelado",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <Home className="h-5 w-5" />
          </Button>
        </Link>
        <BarChart3 className="h-5 w-5 text-rose-500" />
        <h1 className="text-xl font-bold">Reportes de Ventas</h1>
        <div className="flex-1" />
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-auto"
        />
        <Button variant="ghost" size="icon" onClick={async () => {
          const supabase = createClient();
          await supabase.auth.signOut();
          window.location.href = '/login';
        }}>
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ingresos del Día
              </CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Órdenes Completadas
              </CardTitle>
              <ShoppingBag className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{delivered.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ticket Promedio
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${avgTicket.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Órdenes
              </CardTitle>
              <Clock className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{orders.length}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Products */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Productos Más Vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              {topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin ventas hoy</p>
              ) : (
                <div className="space-y-3">
                  {topProducts.slice(0, 10).map((p, i) => (
                    <div key={p.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-muted-foreground w-5">
                          {i + 1}.
                        </span>
                        <span className="text-sm">{p.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold">{p.qty}x</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ${p.revenue.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order History */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Historial de Órdenes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Cliente</TableHead>
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
                        {new Date(o.created_at).toLocaleTimeString("es", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>{o.customer_name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {o.source === "qr" ? "QR" : "POS"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[o.status]}>
                          {statusLabels[o.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ${Number(o.total).toFixed(2)}
                      </TableCell>
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
