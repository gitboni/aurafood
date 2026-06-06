import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (body.type === "payment" && body.data?.id) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) return NextResponse.json({ ok: true });

    const paymentRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${body.data.id}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const payment = await paymentRes.json();

    if (payment.status === "approved" && payment.external_reference) {
      await supabase
        .from("orders")
        .update({ status: "pending" })
        .eq("id", payment.external_reference);
    }
  }

  return NextResponse.json({ ok: true });
}
