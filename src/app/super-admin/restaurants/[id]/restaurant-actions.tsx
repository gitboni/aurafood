"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export function RestaurantActions({
  id,
  currentPlan,
  currentStatus,
}: {
  id: string;
  currentPlan: string;
  currentStatus: string;
}) {
  const [plan, setPlan] = useState(currentPlan);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const router = useRouter();

  async function savePlan() {
    if (plan === currentPlan) return;
    setSavingPlan(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("restaurants")
      .update({
        plan,
        // Si pasa a un plan pagado, quitamos trial_ends_at
        trial_ends_at: plan === "trial" ? undefined : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    setSavingPlan(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Plan cambiado a ${plan}`);
    router.refresh();
  }

  async function toggleStatus() {
    setSavingStatus(true);
    const supabase = createClient();
    const next = currentStatus === "active" ? "suspended" : "active";
    const { error } = await supabase
      .from("restaurants")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", id);
    setSavingStatus(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(next === "active" ? "Reactivado" : "Suspendido");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Cambiar plan */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label>Plan</Label>
          <Select value={plan} onValueChange={(v) => v && setPlan(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trial">🎁 Trial</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={savePlan}
          disabled={plan === currentPlan || savingPlan}
          className="gap-1.5"
        >
          {savingPlan && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar
        </Button>
      </div>

      {/* Suspender / Reactivar */}
      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
        <div>
          <p className="font-medium text-sm">
            {currentStatus === "active" ? "Suspender tenant" : "Reactivar tenant"}
          </p>
          <p className="text-xs text-muted-foreground">
            {currentStatus === "active"
              ? "Bloquea el acceso al panel y al menú QR del restaurante."
              : "Restaura el acceso completo."}
          </p>
        </div>
        <Button
          variant={currentStatus === "active" ? "destructive" : "default"}
          onClick={toggleStatus}
          disabled={savingStatus}
          className="gap-1.5"
        >
          {savingStatus ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : currentStatus === "active" ? (
            <ShieldOff className="h-4 w-4" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          {currentStatus === "active" ? "Suspender" : "Reactivar"}
        </Button>
      </div>
    </div>
  );
}
