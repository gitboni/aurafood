"use client";

import { useState } from "react";
import { Order, RefundMethod } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Undo2 } from "lucide-react";

const REASONS = [
  "Producto defectuoso",
  "Pedido equivocado",
  "Cliente insatisfecho",
  "Producto agotado",
  "Error de cobro",
];

const METHOD_LABELS: Record<RefundMethod, string> = {
  cash: "💵 Efectivo",
  card: "💳 Tarjeta",
  transfer: "📱 Transferencia",
  store_credit: "🎟️ Crédito en tienda",
};

export function RefundDialog({
  order,
  onClose,
  onDone,
}: {
  order: Order;
  onClose: () => void;
  onDone: () => void;
}) {
  const refundedSoFar = Number((order as { refunded_amount?: number }).refunded_amount) || 0;
  const maxRefund = +(Number(order.total) - refundedSoFar).toFixed(2);

  const [amount, setAmount] = useState(maxRefund.toFixed(2));
  const [reason, setReason] = useState("");
  const [custom, setCustom] = useState("");
  const [method, setMethod] = useState<RefundMethod>(
    (order.payment_method as RefundMethod) || "cash"
  );
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const finalReason = reason === "custom" ? custom : reason;
  const parsed = parseFloat(amount);
  const invalid =
    !finalReason ||
    isNaN(parsed) ||
    parsed <= 0 ||
    parsed > maxRefund + 0.001;

  async function save() {
    if (invalid) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    let display: string | null = null;
    if (user) {
      const { data: prof } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
      display = prof?.display_name ?? user.email ?? null;
    }
    const { error } = await supabase.from("refunds").insert({
      order_id: order.id,
      amount: parsed,
      reason: finalReason,
      refund_method: method,
      refunded_by: user?.id ?? null,
      refunded_by_name: display,
      notes: notes || null,
    });
    setSaving(false);
    if (error) { toast.error("No se pudo registrar el reembolso"); return; }
    toast.success(`Reembolso de $${parsed.toFixed(2)} registrado`);
    onDone();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="h-5 w-5 text-rose-500" />
            Devolución / Reembolso
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Orden</span>
              <span className="font-bold">#{order.order_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total cobrado</span>
              <span className="tabular-nums">${Number(order.total).toFixed(2)}</span>
            </div>
            {refundedSoFar > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Ya reembolsado</span>
                <span className="tabular-nums">-${refundedSoFar.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1">
              <span>Reembolsable</span>
              <span className="tabular-nums">${maxRefund.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <Label>Motivo</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`px-2.5 py-1 rounded-full border text-xs transition-all ${
                    reason === r
                      ? "bg-rose-50 border-rose-400 text-rose-700"
                      : "border-gray-200 text-muted-foreground hover:border-gray-300"
                  }`}
                >
                  {r}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setReason("custom")}
                className={`px-2.5 py-1 rounded-full border text-xs transition-all ${
                  reason === "custom"
                    ? "bg-rose-50 border-rose-400 text-rose-700"
                    : "border-gray-200 text-muted-foreground hover:border-gray-300"
                }`}
              >
                Otro…
              </button>
            </div>
            {reason === "custom" && (
              <Input
                className="mt-2"
                placeholder="Especifica el motivo"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
            )}
          </div>

          <div>
            <Label>Monto a devolver</Label>
            <Input
              type="number" min={0} step="0.01" max={maxRefund}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 text-lg font-semibold"
            />
            <div className="flex gap-1.5 mt-1">
              <Button size="sm" variant="outline" type="button" className="h-7 text-xs"
                onClick={() => setAmount(maxRefund.toFixed(2))}>Total</Button>
              <Button size="sm" variant="outline" type="button" className="h-7 text-xs"
                onClick={() => setAmount((maxRefund / 2).toFixed(2))}>Mitad</Button>
            </div>
          </div>

          <div>
            <Label>Método de reembolso</Label>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {(Object.keys(METHOD_LABELS) as RefundMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`py-2 px-2 rounded-lg border text-xs font-medium transition-all ${
                    method === m
                      ? "bg-rose-50 border-rose-400 text-rose-700"
                      : "border-gray-200 text-muted-foreground hover:border-gray-300"
                  }`}
                >
                  {METHOD_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Notas (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-rose-500 hover:bg-rose-600 text-white" disabled={invalid || saving} onClick={save}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar reembolso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
