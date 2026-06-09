"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { XCircle } from "lucide-react";

const REASONS = [
  "Cliente canceló",
  "Producto agotado",
  "Tiempo de espera excesivo",
  "Error en el pedido",
  "Duplicado",
];

export function CancelDialog({
  onConfirm,
  onClose,
}: {
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [custom, setCustom] = useState("");

  const finalReason = reason === "custom" ? custom : reason;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-lg max-w-sm w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 text-destructive">
          <XCircle className="h-5 w-5" />
          <h3 className="font-bold text-lg">Cancelar Orden</h3>
        </div>

        <div className="space-y-2">
          <Label>Motivo de cancelación</Label>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <Button
                key={r}
                variant={reason === r ? "default" : "outline"}
                size="sm"
                className={reason === r ? "bg-primary hover:bg-primary/90" : ""}
                onClick={() => { setReason(r); setCustom(""); }}
              >
                {r}
              </Button>
            ))}
            <Button
              variant={reason === "custom" ? "default" : "outline"}
              size="sm"
              className={reason === "custom" ? "bg-primary hover:bg-primary/90" : ""}
              onClick={() => setReason("custom")}
            >
              Otro...
            </Button>
          </div>

          {reason === "custom" && (
            <Textarea
              placeholder="Escribe el motivo..."
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              rows={2}
            />
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Volver
          </Button>
          <Button
            className="flex-1 bg-destructive hover:bg-destructive/90 text-white"
            disabled={!finalReason.trim()}
            onClick={() => onConfirm(finalReason)}
          >
            Confirmar Cancelación
          </Button>
        </div>
      </div>
    </div>
  );
}
