"use client";

import { useState } from "react";
import { Order } from "@/lib/types";
import { Receipt, type PaymentMethod } from "@/components/receipt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { X, Printer } from "lucide-react";

const PM_OPTIONS: { value: PaymentMethod; label: string; emoji: string }[] = [
  { value: "cash", label: "Efectivo", emoji: "💵" },
  { value: "card", label: "Tarjeta", emoji: "💳" },
  { value: "transfer", label: "Transf.", emoji: "📱" },
];

export function BillingModal({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [printing, setPrinting] = useState(false);

  const total = Number(order.total);
  const paid = parseFloat(amountPaid);

  if (printing) {
    return (
      <Receipt
        order={order}
        paymentMethod={paymentMethod}
        amountPaid={paymentMethod === "cash" && amountPaid ? paid : undefined}
        onClose={() => {
          setPrinting(false);
          onClose();
        }}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full max-h-[92vh] overflow-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-bold">
              Factura #{String(order.order_number).padStart(4, "0")}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {order.customer_table && (
                <span className="text-sm font-semibold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                  Mesa {order.customer_table}
                </span>
              )}
              {order.customer_name && (
                <span className="text-sm text-muted-foreground">
                  {order.customer_name}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(order.created_at).toLocaleTimeString("es", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
          <Button size="icon" variant="ghost" className="shrink-0" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Items */}
          <div className="space-y-2">
            {order.order_items?.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="flex-1 min-w-0">
                  <span className="font-semibold text-orange-600">{item.quantity}x</span>{" "}
                  {item.product_name}
                  {item.notes && (
                    <span className="text-xs text-muted-foreground ml-1 italic">
                      ({item.notes})
                    </span>
                  )}
                </span>
                <span className="font-medium tabular-nums ml-2">
                  ${Number(item.subtotal).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {order.notes && (
            <p className="text-xs bg-yellow-50 border border-yellow-200 text-yellow-800 p-2.5 rounded-lg">
              📝 {order.notes}
            </p>
          )}

          <Separator />

          <div className="flex justify-between items-center text-2xl font-bold">
            <span>Total</span>
            <span className="text-orange-600">${total.toFixed(2)}</span>
          </div>

          {/* Payment method */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Forma de Pago
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PM_OPTIONS.map((pm) => (
                <button
                  key={pm.value}
                  type="button"
                  onClick={() => setPaymentMethod(pm.value)}
                  className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl border-2 text-sm font-medium transition-all ${
                    paymentMethod === pm.value
                      ? "bg-orange-50 border-orange-400 text-orange-700 shadow-sm"
                      : "border-gray-200 text-muted-foreground hover:border-gray-300"
                  }`}
                >
                  <span className="text-xl">{pm.emoji}</span>
                  {pm.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cash: amount + change */}
          {paymentMethod === "cash" && (
            <div className="space-y-2">
              <Input
                type="number"
                placeholder="Monto recibido ($)"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                step="0.01"
                min={0}
                className="text-lg h-12"
              />
              {paid > 0 && paid >= total && (
                <div className="flex justify-between font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg text-lg">
                  <span>Cambio:</span>
                  <span>${(paid - total).toFixed(2)}</span>
                </div>
              )}
              {paid > 0 && paid < total && (
                <div className="flex justify-between font-medium text-destructive bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                  <span>Falta:</span>
                  <span>${(total - paid).toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          <Button
            className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 text-base font-semibold"
            onClick={() => setPrinting(true)}
          >
            <Printer className="h-5 w-5 mr-2" />
            Ver e Imprimir Factura
          </Button>
        </div>
      </div>
    </div>
  );
}
