"use client";

import { Order, Settings } from "@/lib/types";

// ESC/POS command bytes
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

function bytes(...arr: number[]) { return new Uint8Array(arr); }

function concat(parts: (Uint8Array | string)[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks = parts.map((p) => (typeof p === "string" ? enc.encode(p) : p));
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

const INIT = bytes(ESC, 0x40);
const ALIGN_LEFT = bytes(ESC, 0x61, 0);
const ALIGN_CENTER = bytes(ESC, 0x61, 1);
const ALIGN_RIGHT = bytes(ESC, 0x61, 2);
const BOLD_ON = bytes(ESC, 0x45, 1);
const BOLD_OFF = bytes(ESC, 0x45, 0);
const SIZE_DOUBLE = bytes(GS, 0x21, 0x11); // double width + height
const SIZE_NORMAL = bytes(GS, 0x21, 0x00);
const CUT = bytes(GS, 0x56, 0x42, 0x00);
const FEED = (n: number) => bytes(ESC, 0x64, n);

const WIDTH = 32; // 58mm paper, font A

function pad(s: string, n: number, char = " ") { return s.length >= n ? s.slice(0, n) : s + char.repeat(n - s.length); }
function padR(s: string, n: number) { return s.length >= n ? s.slice(0, n) : " ".repeat(n - s.length) + s; }
function row(left: string, right: string) {
  const r = padR(right, 12);
  const lWidth = WIDTH - r.length;
  return pad(left, lWidth) + r + "\n";
}
function line(char = "-") { return char.repeat(WIDTH) + "\n"; }

export function buildReceiptEscPos(order: Order, settings: Settings, paymentMethod?: "cash" | "card" | "transfer", amountPaid?: number): Uint8Array {
  const d = new Date(order.created_at);
  const dateStr = d.toLocaleDateString("es-MX");
  const timeStr = d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  const total = Number(order.total);
  const subtotal = Number(order.subtotal) || total;
  const discountAmt = Number(order.discount_amount) || 0;
  const tipAmt = Number(order.tip) || 0;
  const change = paymentMethod === "cash" && amountPaid != null ? amountPaid - total : null;
  const pmLabel = paymentMethod === "cash" ? "Efectivo" : paymentMethod === "card" ? "Tarjeta" : paymentMethod === "transfer" ? "Transferencia" : "";

  const parts: (Uint8Array | string)[] = [];
  parts.push(INIT);

  // Header
  parts.push(ALIGN_CENTER, BOLD_ON, SIZE_DOUBLE);
  parts.push(`${settings.restaurant_name}\n`);
  parts.push(SIZE_NORMAL, BOLD_OFF);
  if (settings.address) parts.push(`${settings.address}\n`);
  if (settings.phone) parts.push(`Tel: ${settings.phone}\n`);
  if (settings.rfc) parts.push(`RFC: ${settings.rfc}\n`);
  parts.push(line("="));

  // Folio + date
  parts.push(ALIGN_LEFT);
  parts.push(BOLD_ON, `Folio #${String(order.order_number).padStart(4, "0")}\n`, BOLD_OFF);
  parts.push(`${dateStr}  ${timeStr}\n`);
  if (order.customer_name) parts.push(`Cliente: ${order.customer_name}\n`);
  if (order.customer_table) parts.push(`Mesa: ${order.customer_table}\n`);
  parts.push(line("-"));

  // Items
  for (const it of order.order_items ?? []) {
    parts.push(row(`${it.quantity}x ${it.product_name}`, `$${Number(it.subtotal).toFixed(2)}`));
    if (it.notes) parts.push(`   ${it.notes}\n`);
  }
  parts.push(line("-"));

  // Totals
  if (discountAmt > 0 || tipAmt > 0) {
    parts.push(row("Subtotal:", `$${subtotal.toFixed(2)}`));
    if (discountAmt > 0) parts.push(row(`Desc. ${Number(order.discount_percent) || 0}%:`, `-$${discountAmt.toFixed(2)}`));
    if (tipAmt > 0) parts.push(row("Propina:", `$${tipAmt.toFixed(2)}`));
  }
  parts.push(BOLD_ON, SIZE_DOUBLE);
  parts.push(row("TOTAL", `$${total.toFixed(2)}`));
  parts.push(SIZE_NORMAL, BOLD_OFF);

  if (paymentMethod) {
    parts.push(line("-"));
    parts.push(row("Forma de pago:", pmLabel));
    if (paymentMethod === "cash" && amountPaid != null) {
      parts.push(row("Recibido:", `$${amountPaid.toFixed(2)}`));
      if (change != null && change >= 0) parts.push(BOLD_ON, row("Cambio:", `$${change.toFixed(2)}`), BOLD_OFF);
    }
  }

  if (order.notes) {
    parts.push(line("-"));
    parts.push(`Nota: ${order.notes}\n`);
  }

  parts.push(line("="));
  parts.push(ALIGN_CENTER);
  parts.push("Gracias por su preferencia\n");
  parts.push(FEED(3));
  parts.push(CUT);

  return concat(parts);
}

// Try Web USB → fallback to download .bin
export async function printEscPos(payload: Uint8Array, filename = "ticket.bin"): Promise<"web-usb" | "download"> {
  const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { usb?: { requestDevice: (opts: object) => Promise<unknown> } }) : null;
  if (nav?.usb) {
    try {
      // Many thermal printers identify as USB class 7 (printer)
      const device = await nav.usb.requestDevice({ filters: [{ classCode: 7 }] }) as {
        open: () => Promise<void>;
        selectConfiguration: (n: number) => Promise<void>;
        claimInterface: (n: number) => Promise<void>;
        configuration: { interfaces: { interfaceNumber: number; alternate: { endpoints: { direction: string; endpointNumber: number }[] } }[] };
        transferOut: (n: number, data: Uint8Array) => Promise<unknown>;
        close: () => Promise<void>;
      };
      await device.open();
      if (!device.configuration) await device.selectConfiguration(1);
      const iface = device.configuration.interfaces[0];
      await device.claimInterface(iface.interfaceNumber);
      const ep = iface.alternate.endpoints.find((e) => e.direction === "out");
      if (!ep) throw new Error("no OUT endpoint");
      await device.transferOut(ep.endpointNumber, payload);
      await device.close();
      return "web-usb";
    } catch {
      // fall through to download
    }
  }
  // Download as .bin so the user can pipe to printer
  const blob = new Blob([new Uint8Array(payload)], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  return "download";
}
