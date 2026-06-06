"use client";

import { useState } from "react";
import { Product, ModifierGroup, SelectedModifier } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export function ModifierPicker({
  product,
  groups,
  onConfirm,
  onClose,
}: {
  product: Product;
  groups: ModifierGroup[];
  onConfirm: (modifiers: SelectedModifier[]) => void;
  onClose: () => void;
}) {
  // selected[groupId] = Set of modifier ids
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  function toggle(group: ModifierGroup, modId: string) {
    setSelected((prev) => {
      const current = prev[group.id] ?? [];
      const max = group.max_select || 1;
      let next: string[];
      if (current.includes(modId)) {
        next = current.filter((id) => id !== modId);
      } else if (max === 1) {
        next = [modId]; // single choice replaces
      } else if (current.length >= max) {
        next = [...current.slice(1), modId]; // drop oldest when at limit
      } else {
        next = [...current, modId];
      }
      return { ...prev, [group.id]: next };
    });
  }

  const allModifiers: SelectedModifier[] = groups.flatMap((g) =>
    (g.modifiers ?? [])
      .filter((m) => (selected[g.id] ?? []).includes(m.id))
      .map((m) => ({ modifier_id: m.id, modifier_name: m.name, price: Number(m.price) }))
  );

  const extraPrice = allModifiers.reduce((s, m) => s + m.price, 0);
  const missingRequired = groups.filter(
    (g) => g.required && (selected[g.id] ?? []).length === 0
  );

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.id}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-sm">{g.name}</p>
                <span className="text-xs text-muted-foreground">
                  {g.required ? "Obligatorio" : "Opcional"}
                  {g.max_select > 1 ? ` · hasta ${g.max_select}` : ""}
                </span>
              </div>
              <div className="space-y-1.5">
                {(g.modifiers ?? [])
                  .filter((m) => m.available)
                  .map((m) => {
                    const isSel = (selected[g.id] ?? []).includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggle(g, m.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-all ${
                          isSel
                            ? "bg-orange-50 border-orange-400 text-orange-800"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={`h-4 w-4 rounded-${g.max_select === 1 ? "full" : "sm"} border flex items-center justify-center ${
                              isSel ? "bg-orange-500 border-orange-500" : "border-gray-300"
                            }`}
                          >
                            {isSel && <span className="h-2 w-2 bg-white rounded-full" />}
                          </span>
                          {m.name}
                        </span>
                        {Number(m.price) > 0 && (
                          <span className="text-muted-foreground">+${Number(m.price).toFixed(2)}</span>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="bg-orange-500 hover:bg-orange-600 text-white"
            disabled={missingRequired.length > 0}
            onClick={() => onConfirm(allModifiers)}
          >
            {missingRequired.length > 0
              ? `Falta: ${missingRequired[0].name}`
              : `Agregar${extraPrice > 0 ? ` (+$${extraPrice.toFixed(2)})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
