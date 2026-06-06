import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const url = new URL(request.url);
  const date = url.searchParams.get("date") || new Date().toISOString().split("T")[0];
  const format = url.searchParams.get("format") || "csv";

  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const { data: orders } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())
    .order("created_at", { ascending: false });

  if (!orders || orders.length === 0) {
    return NextResponse.json({ error: "No hay órdenes para esta fecha" }, { status: 404 });
  }

  if (format === "csv") {
    const headers = ["Orden", "Hora", "Cliente", "Mesa", "Origen", "Estado", "Subtotal", "Descuento", "Propina", "Total", "Método Pago", "Productos"];
    const rows = orders.map((o) => [
      o.order_number,
      new Date(o.created_at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }),
      o.customer_name || "",
      o.customer_table || "",
      o.source === "qr" ? "QR" : "POS",
      o.status,
      o.subtotal || o.total,
      o.discount_amount || 0,
      o.tip || 0,
      o.total,
      o.payment_method || "cash",
      (o.order_items || []).map((i: { quantity: number; product_name: string }) => `${i.quantity}x ${i.product_name}`).join(" | "),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=aurafood-reporte-${date}.csv`,
      },
    });
  }

  return NextResponse.json({ orders });
}
