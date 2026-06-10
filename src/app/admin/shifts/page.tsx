"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Shift, CashMovement } from "@/lib/types";
import {
  Home, LogOut, DollarSign, Clock, TrendingUp, AlertTriangle,
  ArrowDownCircle, ArrowUpCircle, Plus,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";

export default function ShiftsPage() {
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [history, setHistory] = useState<Shift[]>([]);
  const [openingCash, setOpeningCash] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [shiftStats, setShiftStats] = useState({ sales: 0, orders: 0, cashSales: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [cashType, setCashType] = useState<"in" | "out">("out");
  const [cashAmount, setCashAmount] = useState("");
  const [cashReason, setCashReason] = useState("");

  const supabase = createClient();

  async function loadData() {
    const { data: open } = await supabase
      .from("shifts")
      .select("*")
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setCurrentShift(open);

    if (open) {
      const { data: orders } = await supabase
        .from("orders")
        .select("total, status, payment_method")
        .eq("shift_id", open.id);

      if (orders) {
        const delivered = orders.filter((o) => o.status === "delivered");
        setShiftStats({
          sales: delivered.reduce((s, o) => s + Number(o.total), 0),
          orders: delivered.length,
          cashSales: delivered.filter((o) => o.payment_method === "cash").reduce((s, o) => s + Number(o.total), 0),
          cancelled: orders.filter((o) => o.status === "cancelled").length,
        });
      }

      const { data: movs } = await supabase
        .from("cash_movements")
        .select("*")
        .eq("shift_id", open.id)
        .order("created_at", { ascending: false });
      if (movs) setMovements(movs);
    } else {
      setMovements([]);
    }

    const { data: past } = await supabase
      .from("shifts")
      .select("*")
      .eq("status", "closed")
      .order("closed_at", { ascending: false })
      .limit(30);

    if (past) setHistory(past);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function openShift() {
    const cash = parseFloat(openingCash);
    if (isNaN(cash) || cash < 0) { toast.error("Ingresa un monto válido"); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();

    const { error } = await supabase.from("shifts").insert({
      user_id: user.id,
      user_name: profile?.display_name || user.email,
      opening_cash: cash,
      status: "open",
    });

    if (error) { toast.error("Error al abrir turno"); return; }
    toast.success("Turno abierto");
    setOpeningCash("");
    loadData();
  }

  async function addMovement() {
    if (!currentShift) return;
    const amount = parseFloat(cashAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Ingresa un monto válido"); return; }
    if (!cashReason.trim()) { toast.error("Indica el motivo"); return; }

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("profiles").select("display_name").eq("id", user.id).single()
      : { data: null };

    const { error } = await supabase.from("cash_movements").insert({
      shift_id: currentShift.id,
      type: cashType,
      amount,
      reason: cashReason,
      created_by: user?.id ?? null,
      created_by_name: profile?.display_name || user?.email || null,
    });

    if (error) { toast.error("Error al registrar"); return; }
    toast.success(cashType === "in" ? "Entrada registrada" : "Salida registrada");
    setCashAmount("");
    setCashReason("");
    loadData();
  }

  const cashIn = movements.filter((m) => m.type === "in").reduce((s, m) => s + Number(m.amount), 0);
  const cashOut = movements.filter((m) => m.type === "out").reduce((s, m) => s + Number(m.amount), 0);

  async function closeShift() {
    if (!currentShift) return;
    const cash = parseFloat(closingCash);
    if (isNaN(cash) || cash < 0) { toast.error("Ingresa el efectivo en caja"); return; }

    const expected = currentShift.opening_cash + shiftStats.cashSales + cashIn - cashOut;
    const diff = cash - expected;

    const { error } = await supabase
      .from("shifts")
      .update({
        closing_cash: cash,
        expected_cash: expected,
        cash_difference: diff,
        total_sales: shiftStats.sales,
        total_orders: shiftStats.orders,
        total_cancelled: shiftStats.cancelled,
        notes: closeNotes || null,
        closed_at: new Date().toISOString(),
        status: "closed",
      })
      .eq("id", currentShift.id);

    if (error) { toast.error("Error al cerrar turno"); return; }
    toast.success("Turno cerrado");
    setClosingCash("");
    setCloseNotes("");
    loadData();
  }

  const expected = currentShift ? currentShift.opening_cash + shiftStats.cashSales + cashIn - cashOut : 0;
  const closingVal = parseFloat(closingCash);
  const diff = !isNaN(closingVal) ? closingVal - expected : null;

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Clock className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-6 py-4 flex items-center gap-4">
        <Link href="/"><Button variant="ghost" size="icon"><Home className="h-5 w-5" /></Button></Link>
        <Clock className="h-5 w-5 text-amber-500" />
        <h1 className="text-xl font-bold">Corte de Caja</h1>
        <div className="flex-1" />
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={async () => {
          await supabase.auth.signOut(); window.location.href = "/login";
        }}><LogOut className="h-5 w-5" /></Button>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {!currentShift ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-green-500" /> Abrir Turno</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Efectivo inicial en caja</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} />
              </div>
              <Button className="w-full bg-primary hover:bg-primary/90" onClick={openShift}>Abrir Turno</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-green-700">
                    <Clock className="h-5 w-5" /> Turno Activo
                  </CardTitle>
                  <Badge className="bg-green-500">Abierto</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><p className="text-muted-foreground">Abierto por</p><p className="font-bold">{currentShift.user_name}</p></div>
                  <div><p className="text-muted-foreground">Hora apertura</p><p className="font-bold">{new Date(currentShift.opened_at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}</p></div>
                  <div><p className="text-muted-foreground">Efectivo inicial</p><p className="font-bold">${currentShift.opening_cash.toFixed(2)}</p></div>
                  <div><p className="text-muted-foreground">Ventas del turno</p><p className="font-bold text-green-600">${shiftStats.sales.toFixed(2)}</p></div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Órdenes</p><p className="text-2xl font-bold">{shiftStats.orders}</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Ventas Efectivo</p><p className="text-2xl font-bold text-green-600">${shiftStats.cashSales.toFixed(2)}</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Esperado en caja</p><p className="text-2xl font-bold">${expected.toFixed(2)}</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Canceladas</p><p className="text-2xl font-bold text-red-500">{shiftStats.cancelled}</p></CardContent></Card>
            </div>

            {/* Cash movements (entradas/salidas) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-amber-500" /> Entradas / Salidas de Efectivo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex gap-1">
                    <Button type="button" size="sm" variant={cashType === "out" ? "default" : "outline"}
                      className={cashType === "out" ? "bg-red-500 hover:bg-red-600" : ""}
                      onClick={() => setCashType("out")}>
                      <ArrowUpCircle className="h-4 w-4 mr-1" /> Salida
                    </Button>
                    <Button type="button" size="sm" variant={cashType === "in" ? "default" : "outline"}
                      className={cashType === "in" ? "bg-green-500 hover:bg-green-600" : ""}
                      onClick={() => setCashType("in")}>
                      <ArrowDownCircle className="h-4 w-4 mr-1" /> Entrada
                    </Button>
                  </div>
                  <div className="w-28">
                    <Input type="number" step="0.01" placeholder="Monto" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} />
                  </div>
                  <div className="flex-1 min-w-[160px]">
                    <Input placeholder="Motivo (ej: compra de servilletas)" value={cashReason} onChange={(e) => setCashReason(e.target.value)} />
                  </div>
                  <Button className="bg-primary hover:bg-primary/90" onClick={addMovement}>
                    <Plus className="h-4 w-4 mr-1" /> Registrar
                  </Button>
                </div>

                {movements.length > 0 && (
                  <div className="space-y-1">
                    {movements.map((m) => (
                      <div key={m.id} className="flex items-center justify-between text-sm p-2 bg-muted/40 rounded">
                        <div className="flex items-center gap-2">
                          {m.type === "in"
                            ? <ArrowDownCircle className="h-4 w-4 text-green-500" />
                            : <ArrowUpCircle className="h-4 w-4 text-red-500" />}
                          <span>{m.reason}</span>
                          <span className="text-xs text-muted-foreground">· {m.created_by_name}</span>
                        </div>
                        <span className={`font-bold ${m.type === "in" ? "text-green-600" : "text-red-600"}`}>
                          {m.type === "in" ? "+" : "−"}${Number(m.amount).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm pt-1 border-t">
                      <span className="text-muted-foreground">Entradas: <span className="text-green-600 font-bold">+${cashIn.toFixed(2)}</span></span>
                      <span className="text-muted-foreground">Salidas: <span className="text-red-600 font-bold">−${cashOut.toFixed(2)}</span></span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Cerrar Turno</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Efectivo contado en caja</Label>
                  <Input type="number" step="0.01" placeholder="0.00" value={closingCash} onChange={(e) => setClosingCash(e.target.value)} />
                </div>
                {diff !== null && (
                  <div className={`p-3 rounded-lg flex items-center gap-2 ${diff === 0 ? "bg-green-100 text-green-700" : diff > 0 ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>
                    {diff !== 0 && <AlertTriangle className="h-4 w-4" />}
                    <span className="font-bold">
                      Diferencia: {diff > 0 ? "+" : ""}${diff.toFixed(2)}
                      {diff === 0 ? " ✓ Cuadra" : diff > 0 ? " (sobrante)" : " (faltante)"}
                    </span>
                  </div>
                )}
                <Textarea placeholder="Notas del cierre (opcional)" value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} rows={2} />
                <Button className="w-full bg-red-500 hover:bg-red-600 text-white" onClick={closeShift}>Cerrar Turno</Button>
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Historial de Turnos</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Apertura</TableHead>
                  <TableHead>Cierre</TableHead>
                  <TableHead>Diferencia</TableHead>
                  <TableHead>Ventas</TableHead>
                  <TableHead>Órdenes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{new Date(s.opened_at).toLocaleDateString("es", { day: "2-digit", month: "2-digit" })}</TableCell>
                    <TableCell>{s.user_name}</TableCell>
                    <TableCell>${s.opening_cash.toFixed(2)}</TableCell>
                    <TableCell>${s.closing_cash?.toFixed(2) || "—"}</TableCell>
                    <TableCell>
                      {s.cash_difference != null ? (
                        <span className={s.cash_difference === 0 ? "text-green-600" : s.cash_difference > 0 ? "text-blue-600" : "text-red-600"}>
                          {s.cash_difference > 0 ? "+" : ""}${s.cash_difference.toFixed(2)}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="font-bold">${s.total_sales.toFixed(2)}</TableCell>
                    <TableCell>{s.total_orders}</TableCell>
                  </TableRow>
                ))}
                {history.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin turnos cerrados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
