"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FloorTable, Order } from "@/lib/types";
import {
  Home, LogOut, MapPin, RefreshCw, Loader2, Settings,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTenantId } from "@/lib/tenant-client";

const GRID_COLS = 12;
const GRID_ROWS = 8;
const CELL = 72; // px per cell on the floor view (larger than admin)

type TableStatus = "free" | "occupied" | "ready" | "attention";

const STATUS_STYLE: Record<TableStatus, { bg: string; ring: string; label: string; dot: string }> = {
  free:      { bg: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
               ring: "ring-slate-300 dark:ring-slate-600", label: "Libre", dot: "bg-slate-400" },
  occupied:  { bg: "bg-blue-500 text-white",
               ring: "ring-blue-400", label: "Ocupada", dot: "bg-blue-300" },
  ready:     { bg: "bg-green-500 text-white animate-pulse",
               ring: "ring-green-300", label: "Lista para servir", dot: "bg-green-300" },
  attention: { bg: "bg-red-500 text-white animate-pulse",
               ring: "ring-red-300", label: "Necesita atención", dot: "bg-red-300" },
};

export default function FloorPage() {
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();
  const router = useRouter();
  const { tenantId } = useTenantId();

  async function load() {
    if (!tenantId) return;
    const [tRes, oRes] = await Promise.all([
      supabase.from("floor_tables").select("*").eq("restaurant_id", tenantId).eq("active", true).order("sort_order"),
      supabase.from("orders")
        .select("id, order_number, customer_table, status, created_at, total")
        .eq("restaurant_id", tenantId)
        .in("status", ["pending", "preparing", "ready"])
        .gte("created_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: true }),
    ]);
    if (tRes.data) setTables(tRes.data);
    if (oRes.data) setOrders(oRes.data as Order[]);
    setLoading(false);
  }

  useEffect(() => {
    if (!tenantId) return;
    load();
    const channel = supabase
      .channel(`floor-orders-${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${tenantId}`,
        },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  function statusFor(table: FloorTable): { status: TableStatus; activeOrders: Order[] } {
    const tableOrders = orders.filter((o) => o.customer_table === table.name);
    if (tableOrders.length === 0) return { status: "free", activeOrders: [] };

    const hasReady = tableOrders.some((o) => o.status === "ready");
    const oldest = Math.min(...tableOrders.map((o) => Date.now() - new Date(o.created_at).getTime()));
    const oldestMin = oldest / 60000;

    if (oldestMin > 30) return { status: "attention", activeOrders: tableOrders };
    if (hasReady) return { status: "ready", activeOrders: tableOrders };
    return { status: "occupied", activeOrders: tableOrders };
  }

  // Stats
  const free = tables.filter((t) => statusFor(t).status === "free").length;
  const occupied = tables.filter((t) => statusFor(t).status === "occupied").length;
  const ready = tables.filter((t) => statusFor(t).status === "ready").length;
  const attention = tables.filter((t) => statusFor(t).status === "attention").length;

  function openTable(t: FloorTable) {
    // Send the user to POS with the table pre-set via query param
    router.push(`/pos?mesa=${encodeURIComponent(t.name)}`);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-6 py-4 flex items-center gap-4">
        <Link href="/"><Button variant="ghost" size="icon"><Home className="h-5 w-5" /></Button></Link>
        <MapPin className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Salón</h1>
        <div className="flex-1" />
        <div className="hidden md:flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-slate-500"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> {free} Libres</span>
          <span className="flex items-center gap-1.5 text-blue-600"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> {occupied} Ocupadas</span>
          <span className="flex items-center gap-1.5 text-green-600"><span className="h-2.5 w-2.5 rounded-full bg-green-500" /> {ready} Listas</span>
          {attention > 0 && (
            <span className="flex items-center gap-1.5 text-red-600 font-bold"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> {attention} ⚠</span>
          )}
        </div>
        <Link href="/admin/tables"><Button variant="outline" size="sm"><Settings className="h-4 w-4 mr-1" /> Editar mapa</Button></Link>
        <Button variant="ghost" size="icon" onClick={load} title="Actualizar"><RefreshCw className="h-4 w-4" /></Button>
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={async () => {
          await supabase.auth.signOut(); window.location.href = "/login";
        }}><LogOut className="h-5 w-5" /></Button>
      </header>

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center h-[60vh]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : tables.length === 0 ? (
          <Card className="max-w-md mx-auto mt-12">
            <CardContent className="p-8 text-center space-y-3">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
              <p className="font-semibold">No has configurado mesas todavía</p>
              <Link href="/admin/tables">
                <Button>Configurar mesas</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Floor map */}
            <div className="flex-1 overflow-x-auto">
              <div
                className="relative bg-card rounded-xl border shadow-sm mx-auto"
                style={{
                  width: GRID_COLS * CELL,
                  height: GRID_ROWS * CELL,
                  backgroundImage:
                    "linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)",
                  backgroundSize: `${CELL}px ${CELL}px`,
                }}
              >
                {tables.map((t) => {
                  const { status, activeOrders } = statusFor(t);
                  const s = STATUS_STYLE[status];
                  const w = t.shape === "rect" ? CELL * 2 - 6 : CELL - 6;
                  const h = CELL - 6;
                  const rounded = t.shape === "round" ? "rounded-full" : "rounded-lg";
                  const totalAmt = activeOrders.reduce((s, o) => s + Number(o.total || 0), 0);
                  return (
                    <button
                      key={t.id}
                      onClick={() => openTable(t)}
                      className={`absolute ${rounded} ${s.bg} ring-2 ${s.ring} ring-offset-2 ring-offset-background flex flex-col items-center justify-center cursor-pointer shadow-sm hover:shadow-xl hover:scale-105 transition-all`}
                      style={{ left: t.x * CELL + 3, top: t.y * CELL + 3, width: w, height: h }}
                      title={`${t.name} · ${s.label}`}
                    >
                      <span className="text-sm font-bold leading-tight">{t.name}</span>
                      {activeOrders.length === 0 ? (
                        <span className="text-[10px] opacity-80">{t.seats}p</span>
                      ) : (
                        <span className="text-[10px] opacity-90">${totalAmt.toFixed(0)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Side panel with summary + legend */}
            <div className="w-full lg:w-72 shrink-0 space-y-3">
              <Card>
                <CardContent className="p-4 space-y-2">
                  <p className="font-bold text-sm">Leyenda</p>
                  {(Object.keys(STATUS_STYLE) as TableStatus[]).map((k) => (
                    <div key={k} className="flex items-center gap-2 text-sm">
                      <span className={`h-3 w-3 rounded-full ${STATUS_STYLE[k].dot}`} />
                      <span>{STATUS_STYLE[k].label}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {ready > 0 && (
                <Card className="border-green-200 bg-green-50 dark:bg-green-950/30">
                  <CardContent className="p-4">
                    <p className="font-bold text-green-700 dark:text-green-300 text-sm">🟢 Listas para servir</p>
                    <div className="mt-2 space-y-1">
                      {tables.filter(t => statusFor(t).status === "ready").map(t => (
                        <Badge key={t.id} variant="outline" className="border-green-500 text-green-700 dark:text-green-300 mr-1">
                          {t.name}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {attention > 0 && (
                <Card className="border-red-200 bg-red-50 dark:bg-red-950/30">
                  <CardContent className="p-4">
                    <p className="font-bold text-red-700 dark:text-red-300 text-sm">⚠ Llevan +30 min</p>
                    <div className="mt-2 space-y-1">
                      {tables.filter(t => statusFor(t).status === "attention").map(t => (
                        <Badge key={t.id} variant="outline" className="border-red-500 text-red-700 dark:text-red-300 mr-1">
                          {t.name}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
