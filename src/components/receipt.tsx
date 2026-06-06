"use client";

import { Order } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";

export function Receipt({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-sm w-full">
        {/* Controls (hidden on print) */}
        <div className="flex justify-between p-4 border-b print:hidden">
          <Button onClick={() => window.print()} className="bg-orange-500 hover:bg-orange-600">
            <Printer className="h-4 w-4 mr-2" /> Imprimir
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Receipt content */}
        <div id="receipt-content" className="p-6 font-mono text-sm space-y-3">
          <div className="text-center space-y-1">
            <h2 className="text-lg font-bold">AuraFood</h2>
            <p className="text-xs text-gray-500">Sistema POS</p>
            <div className="border-t border-dashed border-gray-300 my-2" />
          </div>

          <div className="flex justify-between text-xs text-gray-500">
            <span>Orden #{order.order_number}</span>
            <span>
              {new Date(order.created_at).toLocaleDateString("es", {
                day: "2-digit",
                month: "2-digit",
                year: "2-digit",
              })}{" "}
              {new Date(order.created_at).toLocaleTimeString("es", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          {order.customer_name && (
            <p className="text-xs">Cliente: {order.customer_name}</p>
          )}
          {order.customer_table && (
            <p className="text-xs">Mesa: {order.customer_table}</p>
          )}

          <div className="border-t border-dashed border-gray-300" />

          <div className="space-y-1">
            {order.order_items?.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>
                  {item.quantity}x {item.product_name}
                </span>
                <span>${item.subtotal.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-gray-300" />

          <div className="flex justify-between font-bold text-base">
            <span>TOTAL</span>
            <span>${Number(order.total).toFixed(2)}</span>
          </div>

          {order.notes && (
            <>
              <div className="border-t border-dashed border-gray-300" />
              <p className="text-xs">Notas: {order.notes}</p>
            </>
          )}

          <div className="border-t border-dashed border-gray-300" />
          <p className="text-center text-xs text-gray-500">
            ¡Gracias por tu compra!
          </p>
        </div>
      </div>
    </div>
  );
}
