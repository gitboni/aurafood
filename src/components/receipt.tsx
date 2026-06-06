"use client";

import { Order } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";

export type PaymentMethod = "cash" | "card" | "transfer";

const PM_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  card: "Tarjeta bancaria",
  transfer: "Transferencia",
};

const R_NAME = process.env.NEXT_PUBLIC_RESTAURANT_NAME ?? "Mi Restaurante";
const R_ADDRESS = process.env.NEXT_PUBLIC_RESTAURANT_ADDRESS ?? "";
const R_PHONE = process.env.NEXT_PUBLIC_RESTAURANT_PHONE ?? "";
const R_RFC = process.env.NEXT_PUBLIC_RESTAURANT_RFC ?? "";
const R_WEBSITE = process.env.NEXT_PUBLIC_RESTAURANT_WEBSITE ?? "";
const SHOW_TAX = process.env.NEXT_PUBLIC_SHOW_TAX === "true";
const TAX_RATE = parseFloat(process.env.NEXT_PUBLIC_TAX_RATE ?? "16") / 100;

function Line() {
  return <div className="border-t border-dashed border-gray-300 my-2" />;
}

function DoubleLine() {
  return <div className="border-t-2 border-gray-400 my-2" />;
}

function Row({
  label,
  value,
  bold = false,
  large = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
  large?: boolean;
}) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : ""} ${large ? "text-sm" : ""}`}>
      <span className="flex-1">{label}</span>
      <span className="ml-2 tabular-nums">{value}</span>
    </div>
  );
}

export function Receipt({
  order,
  paymentMethod,
  amountPaid,
  onClose,
}: {
  order: Order;
  paymentMethod?: PaymentMethod;
  amountPaid?: number;
  onClose: () => void;
}) {
  const total = Number(order.total);
  const taxAmount = SHOW_TAX ? total - total / (1 + TAX_RATE) : 0;
  const subtotalEx = SHOW_TAX ? total - taxAmount : total;
  const change = paymentMethod === "cash" && amountPaid != null ? amountPaid - total : null;

  const d = new Date(order.created_at);
  const dateStr = d.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = d.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 print:bg-transparent print:static print:p-0"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-[320px] max-h-[92vh] overflow-auto shadow-2xl print:shadow-none print:rounded-none print:max-h-none print:overflow-visible"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Controls — hidden on print */}
        <div className="flex gap-2 p-3 border-b print:hidden">
          <Button
            onClick={() => window.print()}
            className="flex-1 h-9 bg-orange-500 hover:bg-orange-600"
            size="sm"
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Imprimir
          </Button>
          <Button onClick={onClose} variant="outline" className="flex-1 h-9" size="sm">
            <X className="h-4 w-4 mr-1.5" />
            Cerrar
          </Button>
        </div>

        {/* ── Ticket ── */}
        <div className="px-5 py-4 font-mono text-xs space-y-0 leading-relaxed">

          {/* Header: restaurant info */}
          <div className="text-center space-y-0.5 mb-1">
            <p className="text-[15px] font-extrabold tracking-wide uppercase leading-tight">
              {R_NAME}
            </p>
            {R_ADDRESS && (
              <p className="text-[11px] text-gray-600 leading-tight">{R_ADDRESS}</p>
            )}
            <div className="text-[11px] text-gray-600 space-y-0.5">
              {R_PHONE && <p>Tel: {R_PHONE}</p>}
              {R_RFC && <p>RFC: {R_RFC}</p>}
            </div>
          </div>

          <DoubleLine />

          {/* Folio + fecha */}
          <div className="text-center mb-1">
            <p className="text-[11px] font-bold tracking-widest uppercase text-gray-500">
              COMPROBANTE DE VENTA
            </p>
          </div>
          <Row
            label={`Folio: #${String(order.order_number).padStart(4, "0")}`}
            value={order.source === "qr" ? "● QR" : "● POS"}
          />
          <Row label={`Fecha: ${dateStr}`} value="" />
          <Row label={`Hora:  ${timeStr}`} value="" />

          {/* Customer */}
          {(order.customer_name || order.customer_table) && (
            <>
              <Line />
              {order.customer_name && (
                <Row label="Cliente:" value={order.customer_name} />
              )}
              {order.customer_table && (
                <Row label="Mesa:" value={order.customer_table} />
              )}
            </>
          )}

          <Line />

          {/* Column headers */}
          <div className="flex justify-between text-[10px] text-gray-400 uppercase tracking-wider mb-1">
            <span>Cant. Descripción</span>
            <span>Precio</span>
          </div>

          {/* Items */}
          <div className="space-y-1.5">
            {order.order_items?.map((item) => (
              <div key={item.id}>
                <div className="flex justify-between gap-1">
                  <span className="flex-1">
                    <span className="font-bold">{item.quantity}x</span>{" "}
                    <span className="break-words">{item.product_name}</span>
                  </span>
                  <span className="tabular-nums shrink-0 ml-2">
                    ${Number(item.subtotal).toFixed(2)}
                  </span>
                </div>
                {item.unit_price !== Number(item.subtotal) / item.quantity && null}
                {item.quantity > 1 && (
                  <p className="text-[10px] text-gray-400 pl-5">
                    ${item.unit_price.toFixed(2)} c/u
                  </p>
                )}
                {item.notes && (
                  <p className="text-[10px] text-gray-500 pl-5 italic">
                    ↳ {item.notes}
                  </p>
                )}
              </div>
            ))}
          </div>

          <Line />

          {/* Totals */}
          {SHOW_TAX ? (
            <div className="space-y-0.5">
              <Row
                label={`Subtotal (sin IVA ${Math.round(TAX_RATE * 100)}%):`}
                value={`$${subtotalEx.toFixed(2)}`}
              />
              <Row
                label={`IVA ${Math.round(TAX_RATE * 100)}%:`}
                value={`$${taxAmount.toFixed(2)}`}
              />
              <Line />
              <Row label="TOTAL:" value={`$${total.toFixed(2)}`} bold large />
            </div>
          ) : (
            <Row label="TOTAL:" value={`$${total.toFixed(2)}`} bold large />
          )}

          {/* Payment */}
          {paymentMethod && (
            <>
              <Line />
              <Row label="Forma de pago:" value={PM_LABELS[paymentMethod]} />
              {paymentMethod === "cash" && amountPaid != null && (
                <>
                  <Row label="Recibido:" value={`$${amountPaid.toFixed(2)}`} />
                  {change != null && change >= 0 && (
                    <Row label="Cambio:" value={`$${change.toFixed(2)}`} bold />
                  )}
                </>
              )}
            </>
          )}

          {/* General notes */}
          {order.notes && (
            <>
              <Line />
              <p className="text-[11px] text-gray-600 italic">
                Nota: {order.notes}
              </p>
            </>
          )}

          <DoubleLine />

          {/* Footer */}
          <div className="text-center space-y-0.5">
            <p className="font-bold text-[12px]">¡Gracias por su preferencia!</p>
            <p className="text-[10px] text-gray-500">Conserve este comprobante</p>
            {R_WEBSITE && (
              <p className="text-[10px] text-gray-500">{R_WEBSITE}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
