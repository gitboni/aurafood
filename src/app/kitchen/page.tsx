"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Order, OrderItem } from "@/lib/types";
import { ChefHat, Clock, CheckCircle2, Home, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const STATUS_CONFIG = {
  pending: { label: "Pendiente", color: "bg-yellow-500", icon: Clock },
  preparing: { label: "Preparando", color: "bg-blue-500", icon: RefreshCw },
  ready: { label: "Listo", color: "bg-green-500", icon: CheckCircle2 },
};

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const supabase = createClient();

  async function loadOrders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .in("status", ["pending", "preparing", "ready"])
      .gte("created_at", today.toISOString())
      .order("created_at", { ascending: true });

    if (data) setOrders(data);
  }

  useEffect(() => {
    loadOrders();

    const channel = supabase
      .channel("kitchen-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          loadOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function updateStatus(orderId: string, newStatus: string) {
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) {
      toast.error("Error al actualizar");
    } else {
      toast.success(`Orden actualizada a ${STATUS_CONFIG[newStatus as keyof typeof STATUS_CONFIG]?.label || newStatus}`);
      loadOrders();
    }
  }

  function timeSince(dateStr: string) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return "Ahora";
    if (diff < 60) return `${diff}m`;
    return `${Math.floor(diff / 60)}h ${diff % 60}m`;
  }

  const pending = orders.filter((o) => o.status === "pending");
  const preparing = orders.filter((o) => o.status === "preparing");
  const ready = orders.filter((o) => o.status === "ready");

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="text-white hover:bg-gray-700">
            <Home className="h-5 w-5" />
          </Button>
        </Link>
        <ChefHat className="h-6 w-6 text-green-400" />
        <h1 className="text-xl font-bold">Cocina — AuraFood</h1>
        <div className="flex-1" />
        <div className="flex gap-4 text-sm">
          <span className="text-yellow-400">● {pending.length} Pendientes</span>
          <span className="text-blue-400">● {preparing.length} Preparando</span>
          <span className="text-green-400">● {ready.length} Listos</span>
        </div>
        <Button variant="outline" size="sm" onClick={loadOrders} className="border-gray-600 text-white hover:bg-gray-700">
          <RefreshCw className="h-4 w-4 mr-1" /> Actualizar
        </Button>
      </header>

      {/* Columns */}
      <div className="grid grid-cols-3 gap-4 p-4 h-[calc(100vh-73px)]">
        {/* Pending */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-yellow-400 flex items-center gap-2">
            <Clock className="h-5 w-5" /> Pendientes ({pending.length})
          </h2>
          {pending.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              color="border-yellow-500"
              timeSince={timeSince}
              actions={
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={() => updateStatus(order.id, "preparing")}
                >
                  Empezar a Preparar
                </Button>
              }
            />
          ))}
        </div>

        {/* Preparing */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-blue-400 flex items-center gap-2">
            <RefreshCw className="h-5 w-5" /> Preparando ({preparing.length})
          </h2>
          {preparing.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              color="border-blue-500"
              timeSince={timeSince}
              actions={
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => updateStatus(order.id, "ready")}
                >
                  ¡Listo!
                </Button>
              }
            />
          ))}
        </div>

        {/* Ready */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-green-400 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" /> Listos ({ready.length})
          </h2>
          {ready.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              color="border-green-500"
              timeSince={timeSince}
              actions={
                <Button
                  className="w-full bg-gray-600 hover:bg-gray-700"
                  onClick={() => updateStatus(order.id, "delivered")}
                >
                  Entregado
                </Button>
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function OrderCard({
  order,
  color,
  timeSince,
  actions,
}: {
  order: Order;
  color: string;
  timeSince: (d: string) => string;
  actions: React.ReactNode;
}) {
  return (
    <Card className={`bg-gray-800 border-l-4 ${color} text-white`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold">#{order.order_number}</CardTitle>
          <Badge variant="outline" className="text-gray-300 border-gray-600">
            {timeSince(order.created_at)}
          </Badge>
        </div>
        <div className="flex gap-2 text-sm text-gray-400">
          {order.customer_name && <span>{order.customer_name}</span>}
          {order.customer_table && <span>Mesa {order.customer_table}</span>}
          <Badge variant="outline" className={`text-xs ${order.source === "qr" ? "border-purple-500 text-purple-400" : "border-orange-500 text-orange-400"}`}>
            {order.source === "qr" ? "QR" : "POS"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {order.order_items?.map((item: OrderItem) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span>
              <span className="font-bold text-orange-400">{item.quantity}x</span>{" "}
              {item.product_name}
            </span>
            {item.notes && (
              <span className="text-xs text-yellow-400 italic">({item.notes})</span>
            )}
          </div>
        ))}
        {order.notes && (
          <p className="text-xs text-yellow-300 bg-yellow-900/30 p-2 rounded mt-2">
            📝 {order.notes}
          </p>
        )}
        <div className="pt-2">{actions}</div>
      </CardContent>
    </Card>
  );
}
