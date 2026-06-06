"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Order, OrderItem } from "@/lib/types";
import {
  ChefHat,
  Clock,
  CheckCircle2,
  Home,
  RefreshCw,
  Volume2,
  VolumeX,
  LogOut,
  Loader2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CancelDialog } from "@/components/cancel-dialog";
import { LowStockAlert } from "@/components/low-stock-alert";
import { toast } from "sonner";
import { ThemeToggle } from '@/components/theme-toggle';

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1000;
      gain2.gain.value = 0.3;
      osc2.start();
      osc2.stop(ctx.currentTime + 0.2);
    }, 250);
  } catch {}
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const prevCountRef = useRef(0);
  // Ref so the realtime callback always reads the latest value without re-subscribing
  const soundEnabledRef = useRef(true);
  const supabase = createClient();

  function toggleSound() {
    const next = !soundEnabled;
    soundEnabledRef.current = next;
    setSoundEnabled(next);
  }

  // Average prep time today (created_at → updated_at on delivered orders)
  const [avgPrepMin, setAvgPrepMin] = useState<number | null>(null);

  async function loadAvgPrep() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("orders")
      .select("created_at, updated_at")
      .eq("status", "delivered")
      .gte("created_at", today.toISOString());
    if (!data || data.length === 0) { setAvgPrepMin(null); return; }
    const mins = data
      .map((o) => (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / 60000)
      .filter((m) => m > 0 && m < 24 * 60);
    if (mins.length === 0) { setAvgPrepMin(null); return; }
    setAvgPrepMin(mins.reduce((a, b) => a + b, 0) / mins.length);
  }

  async function loadOrders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .in("status", ["pending", "preparing", "ready"])
      .gte("created_at", today.toISOString())
      .order("created_at", { ascending: true });

    loadAvgPrep();

    if (data) {
      if (data.length > prevCountRef.current && prevCountRef.current > 0 && soundEnabledRef.current) {
        playNotificationSound();
        toast.info("🔔 ¡Nuevo pedido!");
      }
      prevCountRef.current = data.length;
      setOrders(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadOrders();

    const channel = supabase
      .channel("kitchen-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () =>
        loadOrders()
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
      const labels: Record<string, string> = {
        preparing: "Preparando",
        ready: "Listo",
        delivered: "Entregado",
        cancelled: "Cancelado",
      };
      toast.success(`Orden → ${labels[newStatus] || newStatus}`);
      loadOrders();
    }
  }

  async function confirmCancel(reason: string) {
    if (!cancelTarget) return;
    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled", cancel_reason: reason || "Sin motivo" })
      .eq("id", cancelTarget);
    if (error) toast.error("Error al cancelar");
    else {
      toast.success("Orden cancelada");
      loadOrders();
    }
    setCancelTarget(null);
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
    <div className="min-h-screen bg-gray-900 dark:bg-slate-950 text-white">
      <header className="bg-gray-800 dark:bg-slate-900 border-b border-gray-700 px-6 py-4 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="text-white hover:bg-gray-700">
            <Home className="h-5 w-5" />
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-gray-700"
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
        >
          <LogOut className="h-5 w-5" />
        </Button>
        <ChefHat className="h-6 w-6 text-green-400" />
        <h1 className="text-xl font-bold">Cocina — AuraFood</h1>
        <div className="flex-1" />
        <LowStockAlert />
        <ThemeToggle />
        <div className="flex gap-4 text-sm items-center">
          {avgPrepMin != null && (
            <span className="text-gray-300 bg-gray-700/50 px-2 py-0.5 rounded">
              ⌀ {Math.round(avgPrepMin)}m prep
            </span>
          )}
          <span className="text-yellow-400">● {pending.length} Pendientes</span>
          <span className="text-blue-400">● {preparing.length} Preparando</span>
          <span className="text-green-400">● {ready.length} Listos</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleSound}
          className="border-gray-600 text-white hover:bg-gray-700"
        >
          {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={loadOrders}
          className="border-gray-600 text-white hover:bg-gray-700"
        >
          <RefreshCw className="h-4 w-4 mr-1" /> Actualizar
        </Button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-[calc(100vh-73px)]">
          <Loader2 className="h-8 w-8 animate-spin text-green-400" />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 p-4 h-[calc(100vh-73px)]">
          <div className="space-y-3 overflow-y-auto">
            <h2 className="text-lg font-bold text-yellow-400 flex items-center gap-2 sticky top-0 bg-gray-900 py-1">
              <Clock className="h-5 w-5" /> Pendientes ({pending.length})
            </h2>
            {pending.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                color="border-yellow-500"
                timeSince={timeSince}
                onCancel={() => setCancelTarget(order.id)}
                actions={
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 transition-transform hover:scale-105"
                    onClick={() => updateStatus(order.id, "preparing")}
                  >
                    Empezar a Preparar
                  </Button>
                }
              />
            ))}
          </div>

          <div className="space-y-3 overflow-y-auto">
            <h2 className="text-lg font-bold text-blue-400 flex items-center gap-2 sticky top-0 bg-gray-900 py-1">
              <RefreshCw className="h-5 w-5" /> Preparando ({preparing.length})
            </h2>
            {preparing.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                color="border-blue-500"
                timeSince={timeSince}
                onCancel={() => setCancelTarget(order.id)}
                actions={
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 transition-transform hover:scale-105"
                    onClick={() => updateStatus(order.id, "ready")}
                  >
                    ¡Listo!
                  </Button>
                }
              />
            ))}
          </div>

          <div className="space-y-3 overflow-y-auto">
            <h2 className="text-lg font-bold text-green-400 flex items-center gap-2 sticky top-0 bg-gray-900 py-1">
              <CheckCircle2 className="h-5 w-5" /> Listos ({ready.length})
            </h2>
            {ready.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                color="border-green-500"
                timeSince={timeSince}
                onCancel={() => setCancelTarget(order.id)}
                actions={
                  <Button
                    className="w-full bg-gray-600 hover:bg-gray-700 transition-transform hover:scale-105"
                    onClick={() => updateStatus(order.id, "delivered")}
                  >
                    Entregado
                  </Button>
                }
              />
            ))}
          </div>
        </div>
      )}

      {cancelTarget && (
        <CancelDialog
          onConfirm={confirmCancel}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </div>
  );
}

function OrderCard({
  order,
  color,
  timeSince,
  onCancel,
  actions,
}: {
  order: Order;
  color: string;
  timeSince: (d: string) => string;
  onCancel: () => void;
  actions: React.ReactNode;
}) {
  return (
    <Card className={`bg-gray-800 border-l-4 ${color} text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20 animate-in fade-in slide-in-from-bottom-2`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold">#{order.order_number}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-gray-300 border-gray-600">
              {timeSince(order.created_at)}
            </Badge>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-900/30"
              onClick={onCancel}
              title="Cancelar orden"
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex gap-2 text-sm text-gray-400">
          {order.customer_name && <span>{order.customer_name}</span>}
          {order.customer_table && <span>Mesa {order.customer_table}</span>}
          <Badge
            variant="outline"
            className={`text-xs ${
              order.source === "qr"
                ? "border-purple-500 text-purple-400"
                : "border-orange-500 text-orange-400"
            }`}
          >
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
        <div className="pt-2 space-y-2">
          {actions}
        </div>
      </CardContent>
    </Card>
  );
}
