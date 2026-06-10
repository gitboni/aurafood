"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Order } from "@/lib/types";
import { Clock, ChefHat, CheckCircle2, PackageCheck, Loader2, Timer } from "lucide-react";
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
    color: "text-muted-foreground",
    bg: "bg-muted",
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
  const [avgPrepMin, setAvgPrepMin] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
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

  // Average prep time from the last 20 delivered orders
  async function loadAvgPrep() {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("orders")
      .select("created_at, updated_at")
      .eq("status", "delivered")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!data || data.length === 0) { setAvgPrepMin(15); return; } // default 15 min
    const mins = data
      .map((o) => (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / 60000)
      .filter((m) => m > 0 && m < 120);
    if (mins.length === 0) { setAvgPrepMin(15); return; }
    setAvgPrepMin(mins.reduce((a, b) => a + b, 0) / mins.length);
  }

  useEffect(() => {
    loadOrder();
    loadAvgPrep();
    // Re-render every 30s to update remaining ETA
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {

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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  if (!order) {
    return (
      <main className="flex-1 flex items-center justify-center min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center space-y-4">
          <p className="text-xl font-semibold">Pedido no encontrado</p>
          <Link href="/menu">
            <Button className="bg-primary hover:bg-primary/90">Volver al menú</Button>
          </Link>
        </div>
      </main>
    );
  }

  const status = STATUS_MAP[order.status] || STATUS_MAP.pending;
  const StatusIcon = status.icon;

  // ETA: avg prep − elapsed since order created
  void tick;
  const elapsedMin = (Date.now() - new Date(order.created_at).getTime()) / 60000;
  const remaining = avgPrepMin != null ? Math.max(0, Math.round(avgPrepMin - elapsedMin)) : null;
  const showEta = (order.status === "pending" || order.status === "preparing") && remaining != null;

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

        {/* ETA */}
        {showEta && (
          <Card className="bg-white/70 dark:bg-slate-900/70 backdrop-blur border-orange-200 dark:border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Timer className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Tiempo estimado</p>
                <p className="text-lg font-bold">
                  {remaining === 0
                    ? "¡Cualquier momento!"
                    : remaining! <= 1
                      ? "Aprox. 1 minuto"
                      : `Aprox. ${remaining} minutos`}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

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
                    isActive ? "bg-primary" : "bg-muted"
                  }`}
                />
                <span className={`text-xs ${isActive ? "text-primary font-medium" : "text-muted-foreground"}`}>
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
                  <span className="font-medium text-primary">{item.quantity}x</span>{" "}
                  {item.product_name}
                </span>
                <span className="font-medium">${item.subtotal.toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-bold">
              <span>Total</span>
              <span className="text-primary">${Number(order.total).toFixed(2)}</span>
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
