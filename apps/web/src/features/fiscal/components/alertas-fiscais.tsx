"use client";

import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useAlertasFiscais } from "../hooks/use-notas-fiscais";

const ICONE = {
  critico: ShieldAlert,
  aviso: AlertTriangle,
  info: Info,
} as const;

const COR = {
  critico: "border-destructive/50 text-destructive",
  aviso: "border-amber-500/50 text-amber-700 dark:text-amber-400",
  info: "",
} as const;

/** O que a empresa precisa resolver para continuar emitindo. Some quando não há nada. */
export function AlertasFiscais({ className }: { className?: string }) {
  const { data: alertas } = useAlertasFiscais();
  if (!alertas?.length) return null;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {alertas.map((a) => {
        const Icone = ICONE[a.nivel];
        return (
          <Alert key={`${a.tipo}-${a.mensagem}`} className={COR[a.nivel]}>
            <Icone />
            <AlertDescription className="text-current">
              {a.mensagem}
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}
