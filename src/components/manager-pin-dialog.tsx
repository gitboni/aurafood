"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, X } from "lucide-react";
import { toast } from "sonner";

export function ManagerPinDialog({
  action,
  onSuccess,
  onClose,
}: {
  action: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);

  async function verify() {
    if (!pin.trim()) return;
    setChecking(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("settings")
      .select("manager_pin")
      .eq("id", 1)
      .maybeSingle();
    setChecking(false);

    // If no PIN configured, allow (so the feature is non-blocking until set up)
    if (!data?.manager_pin) {
      toast.warning("PIN no configurado — acción permitida");
      onSuccess();
      return;
    }
    if (String(data.manager_pin).trim() === pin.trim()) {
      onSuccess();
    } else {
      toast.error("PIN incorrecto");
      setPin("");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl max-w-xs w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-orange-600">
            <Lock className="h-5 w-5" />
            <h3 className="font-bold text-lg">PIN del Gerente</h3>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Ingresa el PIN para autorizar: <strong>{action}</strong>
        </p>

        <Input
          type="password"
          inputMode="numeric"
          maxLength={6}
          autoFocus
          placeholder="••••"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => { if (e.key === "Enter") verify(); }}
          className="text-center text-2xl tracking-[0.5em] font-bold"
        />

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
            onClick={verify}
            disabled={checking || !pin.trim()}
          >
            {checking ? "Verificando..." : "Autorizar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
