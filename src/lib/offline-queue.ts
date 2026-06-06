"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

const KEY = "aurafood-offline-orders";
const EVT = "aurafood-offline-change";

export type OfflineOrderPayload = {
  localId: string;
  order: Record<string, unknown>;
  items: { product_id: string; product_name: string; quantity: number; unit_price: number; subtotal: number; notes: string | null }[];
  consume: { product_id: string; quantity: number }[];
};

export function getQueued(): OfflineOrderPayload[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function write(list: OfflineOrderPayload[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVT));
}

export function queueOrder(payload: OfflineOrderPayload) {
  const list = getQueued();
  list.push(payload);
  write(list);
}

export function queuedCount(): number {
  return getQueued().length;
}

export function onQueueChange(cb: () => void): () => void {
  window.addEventListener(EVT, cb);
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

// Try to push all queued orders to Supabase. Returns number synced.
export async function flushQueue(supabase: SupabaseClient): Promise<number> {
  if (typeof window === "undefined" || !navigator.onLine) return 0;
  const list = getQueued();
  if (list.length === 0) return 0;

  let synced = 0;
  const remaining: OfflineOrderPayload[] = [];

  for (const p of list) {
    try {
      const { data: order, error } = await supabase
        .from("orders")
        .insert(p.order)
        .select()
        .single();
      if (error || !order) throw error ?? new Error("no order");

      const items = p.items.map((it) => ({ ...it, order_id: order.id }));
      const { error: itemsErr } = await supabase.from("order_items").insert(items);
      if (itemsErr) throw itemsErr;

      // best-effort inventory consume
      fetch("/api/inventory/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.id, items: p.consume }),
      }).catch(() => {});

      synced++;
    } catch {
      remaining.push(p); // keep for next attempt
    }
  }

  write(remaining);
  return synced;
}
