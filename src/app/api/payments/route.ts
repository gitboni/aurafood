import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";

export async function POST(request: NextRequest) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json(
      { error: "MercadoPago no está configurado. Agrega MERCADOPAGO_ACCESS_TOKEN en las variables de entorno." },
      { status: 500 }
    );
  }

  const client = new MercadoPagoConfig({ accessToken });
  const preference = new Preference(client);

  const body = await request.json();
  const { items, orderId, orderNumber } = body;

  try {
    const result = await preference.create({
      body: {
        items: items.map((item: { name: string; quantity: number; price: number }) => ({
          title: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          currency_id: "MXN",
        })),
        external_reference: orderId,
        notification_url: `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/payments/webhook`,
        back_urls: {
          success: `${process.env.NEXT_PUBLIC_APP_URL || ""}/menu/order/${orderId}`,
          failure: `${process.env.NEXT_PUBLIC_APP_URL || ""}/menu`,
        },
        auto_return: "approved",
        statement_descriptor: "AURAFOOD",
        metadata: { order_number: orderNumber },
      },
    });

    return NextResponse.json({ init_point: result.init_point });
  } catch (error) {
    console.error("MercadoPago error:", error);
    return NextResponse.json({ error: "Error al crear preferencia de pago" }, { status: 500 });
  }
}
