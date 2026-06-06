"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Order, Settings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Printer, X, ReceiptText } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { getSettings } from "@/lib/settings";
import { buildReceiptEscPos, printEscPos } from "@/lib/escpos";
import { toast } from "sonner";

export type PaymentMethod = "cash" | "card" | "transfer";

const PM_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  card: "Tarjeta bancaria",
  transfer: "Transferencia",
};

const R_WEBSITE = process.env.NEXT_PUBLIC_RESTAURANT_WEBSITE ?? "";

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
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => { getSettings().then(setSettings); }, []);

  const R_NAME = settings?.restaurant_name ?? "Mi Restaurante";
  const R_ADDRESS = settings?.address ?? "";
  const R_PHONE = settings?.phone ?? "";
  const R_RFC = settings?.rfc ?? "";
  const R_LOGO = settings?.logo_url ?? null;
  const SHOW_TAX = !!settings?.tax_enabled;
  const TAX_RATE = (settings?.tax_rate ?? 18) / 100;
  const TAX_LABEL = settings?.tax_label ?? "ITBIS";

  const total = Number(order.total);
  const taxAmount = SHOW_TAX ? total - total / (1 + TAX_RATE) : 0;
  const subtotalEx = SHOW_TAX ? total - taxAmount : total;
  const change = paymentMethod === "cash" && amountPaid != null ? amountPaid - total : null;
  const discountAmt = Number(order.discount_amount) || 0;
  const discountPct = Number(order.discount_percent) || 0;
  const tipAmt = Number(order.tip) || 0;
  const baseSubtotal = Number(order.subtotal) || total;

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
        className="bg-white rounded-xl w-full max-w-[320px] max-h-[92vh] overflow-auto shadow-2xl print:shadow-none print:rounded-none print:max-h-none print:overflow-visible print:w-[80mm]"
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
          <Button
            onClick={async () => {
              if (!settings) { toast.error("Cargando ajustes..."); return; }
              const payload = buildReceiptEscPos(order, settings, paymentMethod, amountPaid);
              const mode = await printEscPos(payload, `ticket-${order.order_number}.bin`);
              toast.success(mode === "web-usb" ? "Enviado a impresora térmica" : "Archivo .bin descargado");
            }}
            variant="outline"
            className="h-9 px-2"
            size="sm"
            title="Imprimir en térmica ESC/POS (USB) o descargar .bin"
          >
            <ReceiptText className="h-4 w-4" />
          </Button>
          <Button onClick={onClose} variant="outline" className="flex-1 h-9" size="sm">
            <X className="h-4 w-4 mr-1.5" />
            Cerrar
          </Button>
        </div>

        {/* ── Ticket ── */}
        <div id="receipt-content" className="px-5 py-4 font-mono text-xs space-y-0 leading-relaxed">

          {/* Header: restaurant info */}
          <div className="text-center space-y-0.5 mb-1">
            {R_LOGO && (
              <div className="flex justify-center mb-1">
                <Image src={R_LOGO} alt={R_NAME} width={56} height={56} className="object-contain h-14 w-14" />
              </div>
            )}
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

          {/* Discount & tip */}
          {(discountAmt > 0 || tipAmt > 0) && (
            <div className="space-y-0.5">
              <Row label="Subtotal:" value={`$${baseSubtotal.toFixed(2)}`} />
              {discountAmt > 0 && (
                <Row label={`Descuento (${discountPct}%):`} value={`-$${discountAmt.toFixed(2)}`} />
              )}
              {tipAmt > 0 && <Row label="Propina:" value={`$${tipAmt.toFixed(2)}`} />}
              <Line />
            </div>
          )}

          {/* Totals */}
          {SHOW_TAX ? (
            <div className="space-y-0.5">
              <Row
                label={`Subtotal (sin ${TAX_LABEL}):`}
                value={`$${subtotalEx.toFixed(2)}`}
              />
              <Row
                label={`${TAX_LABEL} ${Number((TAX_RATE * 100).toFixed(2))}%:`}
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

          {/* QR Code */}
          <div className="flex flex-col items-center gap-1 my-2">
            <QRCodeSVG
              value={`AURAFOOD-${String(order.order_number).padStart(4, "0")}`}
              size={80}
              level="M"
            />
            <p className="text-[9px] text-gray-400">Escanea para más info</p>
          </div>

          <Line />

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
