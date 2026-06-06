import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = request.headers.get("x-signature") ?? "";
    const requestId = request.headers.get("x-request-id") ?? "";
    const ts = signature.split(",").find((p) => p.startsWith("ts="))?.split("=")[1];
    const v1 = signature.split(",").find((p) => p.startsWith("v1="))?.split("=")[1];

    if (!ts || !v1) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    let parsedId = "";
    try {
      parsedId = JSON.parse(rawBody)?.data?.id ?? "";
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const manifest = `id:${parsedId};request-id:${requestId};ts:${ts};`;
    const expected = createHmac("sha256", webhookSecret).update(manifest).digest("hex");

    if (expected !== v1) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let body: { type?: string; data?: { id?: string } };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

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
