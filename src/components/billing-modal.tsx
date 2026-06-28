"use client";

import { useState } from "react";
import { Order, NCFType, NCF_LABELS, DocType } from "@/lib/types";
import { type PaymentMethod } from "@/components/receipt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { X, Printer, FileText } from "lucide-react";

const PM_OPTIONS: { value: PaymentMethod; label: string; emoji: string }[] = [
  { value: "cash", label: "Efectivo", emoji: "💵" },
  { value: "card", label: "Tarjeta", emoji: "💳" },
  { value: "transfer", label: "Transf.", emoji: "📱" },
];

const NCF_OPTIONS: { value: NCFType; label: string }[] = [
  { value: "B02", label: "B02 — Consumidor Final" },
  { value: "B01", label: "B01 — Crédito Fiscal" },
  { value: "B14", label: "B14 — Régimen Especial" },
  { value: "B15", label: "B15 — Gubernamental" },
];

export type NCFCheckoutData = {
  ncfType: NCFType;
  customerRnc: string;
  customerRazonSocial: string;
  customerDocType: DocType;
};

type Props = {
  order: Order;
  onClose: () => void;
  onPrint: (method: PaymentMethod, amountPaid?: number, ncfData?: NCFCheckoutData) => void;
};

export function BillingModal({ order, onClose, onPrint }: Props) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountPaid, setAmountPaid] = useState("");

  const [ncfType, setNcfType] = useState<NCFType>("B02");
  const [customerRnc, setCustomerRnc] = useState("");
  const [customerRazonSocial, setCustomerRazonSocial] = useState("");
  const [customerDocType, setCustomerDocType] = useState<DocType>("rnc");

  const total = Number(order.total);
  const paid = parseFloat(amountPaid);
  const needsCustomerData = ncfType === "B01" || ncfType === "B14" || ncfType === "B15";

  function handlePrint() {
    if (needsCustomerData && !customerRnc.trim()) return;
    onPrint(
      paymentMethod,
      paymentMethod === "cash" && amountPaid ? paid : undefined,
      { ncfType, customerRnc, customerRazonSocial, customerDocType }
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl max-w-md w-full max-h-[92vh] overflow-auto shadow-2xl"
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
                <span className="text-sm font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
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
                  <span className="font-semibold text-primary">{item.quantity}x</span>{" "}
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
              {order.notes}
            </p>
          )}

          <Separator />

          <div className="flex justify-between items-center text-2xl font-bold">
            <span>Total</span>
            <span className="text-primary">${total.toFixed(2)}</span>
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
                      ? "bg-primary/10 border-primary text-primary shadow-sm"
                      : "border-border text-muted-foreground hover:border-foreground/30"
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

          {/* NCF — Comprobante Fiscal */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Comprobante Fiscal (NCF)
            </p>
            <select
              value={ncfType}
              onChange={(e) => setNcfType(e.target.value as NCFType)}
              className="w-full h-10 rounded-xl border border-input bg-transparent px-3 text-sm"
            >
              {NCF_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {needsCustomerData && (
              <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                  Datos del cliente para {NCF_LABELS[ncfType]}
                </p>
                <div className="flex gap-2">
                  <select
                    value={customerDocType}
                    onChange={(e) => setCustomerDocType(e.target.value as DocType)}
                    className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm w-28 shrink-0"
                  >
                    <option value="rnc">RNC</option>
                    <option value="cedula">Cédula</option>
                    <option value="passport">Pasaporte</option>
                  </select>
                  <Input
                    placeholder={customerDocType === "rnc" ? "RNC (9 u 11 dígitos)" : customerDocType === "cedula" ? "Cédula (11 dígitos)" : "Pasaporte"}
                    value={customerRnc}
                    onChange={(e) => setCustomerRnc(e.target.value.replace(/[^0-9A-Za-z-]/g, ""))}
                    className="h-9"
                    maxLength={customerDocType === "passport" ? 20 : 11}
                  />
                </div>
                <Input
                  placeholder="Razón Social / Nombre"
                  value={customerRazonSocial}
                  onChange={(e) => setCustomerRazonSocial(e.target.value)}
                  className="h-9"
                />
              </div>
            )}
          </div>

          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base font-semibold"
            onClick={handlePrint}
            disabled={needsCustomerData && !customerRnc.trim()}
          >
            <Printer className="h-5 w-5 mr-2" />
            Ver e Imprimir Factura
          </Button>
        </div>
      </div>
    </div>
  );
}
