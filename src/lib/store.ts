"use client";

import { create } from "zustand";
import { CartItem, Product, SelectedModifier } from "./types";

// A cart line is uniquely identified by product + the set of modifiers chosen.
export function lineKeyOf(productId: string, modifiers?: SelectedModifier[]): string {
  const mods = (modifiers ?? [])
    .map((m) => m.modifier_id)
    .sort()
    .join(",");
  return mods ? `${productId}::${mods}` : productId;
}

export function lineUnitPrice(item: CartItem): number {
  const mods = (item.modifiers ?? []).reduce((s, m) => s + m.price, 0);
  return item.product.price + mods;
}

type CartStore = {
  items: CartItem[];
  addItem: (product: Product, modifiers?: SelectedModifier[]) => void;
  removeItem: (lineKey: string) => void;
  updateQuantity: (lineKey: string, quantity: number) => void;
  updateNotes: (lineKey: string, notes: string) => void;
  clearCart: () => void;
  total: () => number;
  count: () => number;
};

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  addItem: (product, modifiers) => {
    const key = lineKeyOf(product.id, modifiers);
    const items = get().items;
    const existing = items.find((i) => lineKeyOf(i.product.id, i.modifiers) === key);
    if (existing) {
      set({
        items: items.map((i) =>
          lineKeyOf(i.product.id, i.modifiers) === key
            ? { ...i, quantity: i.quantity + 1 }
            : i
        ),
      });
    } else {
      set({ items: [...items, { product, quantity: 1, notes: "", modifiers: modifiers ?? [] }] });
    }
  },
  removeItem: (lineKey) => {
    set({ items: get().items.filter((i) => lineKeyOf(i.product.id, i.modifiers) !== lineKey) });
  },
  updateQuantity: (lineKey, quantity) => {
    if (quantity <= 0) {
      get().removeItem(lineKey);
      return;
    }
    set({
      items: get().items.map((i) =>
        lineKeyOf(i.product.id, i.modifiers) === lineKey ? { ...i, quantity } : i
      ),
    });
  },
  updateNotes: (lineKey, notes) => {
    set({
      items: get().items.map((i) =>
        lineKeyOf(i.product.id, i.modifiers) === lineKey ? { ...i, notes } : i
      ),
    });
  },
  clearCart: () => set({ items: [] }),
  total: () =>
    get().items.reduce((sum, i) => sum + lineUnitPrice(i) * i.quantity, 0),
  count: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}));
