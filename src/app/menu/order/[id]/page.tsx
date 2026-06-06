"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Order } from "@/lib/types";
import { Clock, ChefHat, CheckCircle2, PackageCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STATUS_MAP = {
  pending: {
    label: "Pedido Recibido",
    description: "Tu pedido fue recibido y está en cola",
    icon: Clock,
    color: "text-yellow-500",
    bg: "bg-yellow-50 dark:bg-yellow-950",
    pulse: true,
  },
  preparing: {
    label: "Preparando tu pedido",
    description: "El chef está trabajando en tu orden",
    icon: ChefHat,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950",
    pulse: false,
  },
  ready: {
    label: "¡Tu pedido está listo!",
    description: "Pasa a recogerlo",
    icon: CheckCircle2,
    color: "text-green-500",
    bg: "bg-green-50 dark:bg-green-950",
    pulse: false,
  },
  delivered: {
    label: "Entregado",
    description: "¡Gracias por tu compra!",
    icon: PackageCheck,
    color: "text-gray-500",
    bg: "bg-gray-50 dark:bg-gray-900",
    pulse: false,
  },
  cancelled: {
    label: "Cancelado",
    description: "Este pedido fue cancelado",
    icon: Clock,
    color: "text-red-500",
    bg: "bg-red-50 dark:bg-red-950",
    pulse: false,
  },
};

export default function OrderTrackingPage() {
  const params = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  async function loadOrder() {
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", params.id)
      .single();

    if (data) setOrder(data);
    setLoading(false);
  }

  useEffect(() => {
    loadOrder();

    const channel = supabase
      .channel(`order-${params.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${params.id}`,
        },
        (payload) => {
          setOrder((prev) => (prev ? { ...prev, ...payload.new } : prev));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [params.id]);

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </main>
    );
  }

  if (!order) {
    return (
      <main className="flex-1 flex items-center justify-center min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center space-y-4">
          <p className="text-xl font-semibold">Pedido no encontrado</p>
          <Link href="/menu">
            <Button className="bg-orange-500 hover:bg-orange-600">Volver al menú</Button>
          </Link>
        </div>
      </main>
    );
  }

  const status = STATUS_MAP[order.status] || STATUS_MAP.pending;
  const StatusIcon = status.icon;

  return (
    <main className="flex-1 flex flex-col items-center min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold">🍽️ AuraFood</h1>
          <p className="text-sm text-muted-foreground">Seguimiento de pedido</p>
        </div>

        {/* Status Card */}
        <Card className={`${status.bg} border-none`}>
          <CardContent className="flex flex-col items-center py-8 space-y-4">
            <div className={`${status.color} ${status.pulse ? "animate-pulse" : ""}`}>
              <StatusIcon className="h-16 w-16" />
            </div>
            <div className="text-center">
              <h2 className={`text-2xl font-bold ${status.color}`}>{status.label}</h2>
              <p className="text-muted-foreground mt-1">{status.description}</p>
            </div>
            <div className="text-4xl font-bold">#{order.order_number}</div>
          </CardContent>
        </Card>

        {/* Progress Steps */}
        <div className="flex justify-between px-4">
          {(["pending", "preparing", "ready", "delivered"] as const).map((step, i) => {
            const steps = ["pending", "preparing", "ready", "delivered"];
            const currentIdx = steps.indexOf(order.status);
            const isActive = i <= currentIdx;
            return (
              <div key={step} className="flex flex-col items-center gap-1">
                <div
                  className={`h-3 w-3 rounded-full ${
                    isActive ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                />
                <span className={`text-xs ${isActive ? "text-orange-600 font-medium" : "text-muted-foreground"}`}>
                  {step === "pending" && "Recibido"}
                  {step === "preparing" && "Preparando"}
                  {step === "ready" && "Listo"}
                  {step === "delivered" && "Entregado"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Order Items */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold">Tu pedido</h3>
            {order.order_items?.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>
                  <span className="font-medium text-orange-600">{item.quantity}x</span>{" "}
                  {item.product_name}
                </span>
                <span className="font-medium">${item.subtotal.toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-bold">
              <span>Total</span>
              <span className="text-orange-600">${Number(order.total).toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Link href="/menu">
            <Button variant="outline">Volver al menú</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
