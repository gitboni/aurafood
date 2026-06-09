"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Order } from "@/lib/types";
import { getSettings } from "@/lib/settings";
import { ChefHat, CheckCircle2, Clock } from "lucide-react";

// Public display: pickup screen for customers. No login required.
export default function DisplayPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [restaurantName, setRestaurantName] = useState("Cocina");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const supabase = createClient();

  async function load() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, status, customer_name, customer_table, created_at, updated_at")
      .in("status", ["preparing", "ready"])
      .gte("created_at", today.toISOString())
      .order("created_at", { ascending: true });
    setOrders((data as Order[]) ?? []);
  }

  useEffect(() => {
    getSettings().then((s) => {
      setRestaurantName(s.restaurant_name);
      if (s.logo_url) setLogoUrl(s.logo_url);
    });
    load();
    const ch = supabase
      .channel("display-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { supabase.removeChannel(ch); clearInterval(tick); };
  }, []);

  const preparing = orders.filter((o) => o.status === "preparing");
  const ready = orders.filter((o) => o.status === "ready");

  function minsAgo(d: string) {
    const m = Math.floor((now - new Date(d).getTime()) / 60000);
    if (m < 1) return "ahora";
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-black text-white p-6 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
          ) : (
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-2xl">🍽️</div>
          )}
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">{restaurantName}</h1>
            <p className="text-sm text-gray-400">Estado de pedidos en tiempo real</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold tabular-nums">
            {new Date(now).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <p className="text-xs text-gray-400">{new Date(now).toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "long" })}</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-6 flex-1">
        {/* Preparing */}
        <section className="bg-blue-950/40 border border-blue-500/30 rounded-3xl p-6 overflow-hidden">
          <div className="flex items-center gap-3 mb-5">
            <ChefHat className="h-8 w-8 text-blue-400" />
            <h2 className="text-3xl font-bold">Preparando</h2>
            <span className="ml-auto bg-blue-500/20 text-blue-200 px-4 py-1 rounded-full text-2xl font-bold tabular-nums">
              {preparing.length}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {preparing.map((o) => (
              <div key={o.id} className="bg-blue-900/30 border border-blue-500/20 rounded-2xl p-4 flex flex-col items-center">
                <span className="text-5xl font-extrabold tabular-nums">#{o.order_number}</span>
                {o.customer_table && (
                  <span className="mt-1 text-blue-300 font-medium">Mesa {o.customer_table}</span>
                )}
                <span className="mt-2 text-xs text-blue-300/70 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {minsAgo(o.created_at)}
                </span>
              </div>
            ))}
            {preparing.length === 0 && (
              <p className="col-span-3 text-center text-blue-300/60 py-8 italic">Sin pedidos en preparación</p>
            )}
          </div>
        </section>

        {/* Ready */}
        <section className="bg-emerald-950/40 border border-emerald-500/30 rounded-3xl p-6 overflow-hidden">
          <div className="flex items-center gap-3 mb-5">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            <h2 className="text-3xl font-bold">¡Listos para recoger!</h2>
            <span className="ml-auto bg-emerald-500/20 text-emerald-200 px-4 py-1 rounded-full text-2xl font-bold tabular-nums">
              {ready.length}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {ready.map((o) => (
              <div key={o.id}
                className="bg-emerald-900/40 border-2 border-emerald-400/50 rounded-2xl p-4 flex flex-col items-center animate-pulse">
                <span className="text-6xl font-extrabold tabular-nums text-emerald-200">#{o.order_number}</span>
                {o.customer_name && (
                  <span className="mt-1 text-emerald-300 font-semibold truncate max-w-full">{o.customer_name}</span>
                )}
                {o.customer_table && (
                  <span className="mt-0.5 text-emerald-300/80 text-sm">Mesa {o.customer_table}</span>
                )}
              </div>
            ))}
            {ready.length === 0 && (
              <p className="col-span-3 text-center text-emerald-300/60 py-8 italic">Nada listo todavía</p>
            )}
          </div>
        </section>
      </div>

      <footer className="text-center text-xs text-gray-500 mt-6">
        Sigue tu pedido escaneando el código QR de tu mesa
      </footer>
    </div>
  );
}
