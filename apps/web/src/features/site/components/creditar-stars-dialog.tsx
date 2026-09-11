"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  formatarEstrelas,
  lerEstrelasDigitadas,
} from "@/features/stars/lib/decimal";
import { useCreditarStars } from "../hooks/use-site-admin";

/**
 * Creditar ★ na mão, do painel do admin.
 *
 * O valor passa por `lerEstrelasDigitadas` — o mesmo leitor da tela de preços —
 * porque em pt-BR ninguém digita "0.5", e um `Number("0,5")` daria `NaN` que
 * viraria zero silencioso.
 *
 * O motivo é obrigatório de propósito: o extrato da empresa vai mostrar essa
 * linha, e "Crédito manual do admin" sem explicação é a linha que ninguém
 * consegue justificar depois.
 */

const ATALHOS = [100, 500, 1_000];

export function CreditarStarsDialog({
  empresa,
  onClose,
}: {
  empresa: { id: string; nome: string; saldo: number } | null;
  onClose: () => void;
}) {
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [tocou, setTocou] = useState(false);
  const creditar = useCreditarStars();

  const estrelas = lerEstrelasDigitadas(valor);
  const valorInvalido = tocou && (estrelas === null || estrelas <= 0);
  const motivoCurto = tocou && motivo.trim().length < 3;

  const fechar = () => {
    setValor("");
    setMotivo("");
    setTocou(false);
    onClose();
  };

  const enviar = () => {
    setTocou(true);
    if (!empresa || estrelas === null || estrelas <= 0) return;
    if (motivo.trim().length < 3) return;
    creditar.mutate(
      { organizationId: empresa.id, valor: estrelas, motivo: motivo.trim() },
      { onSuccess: fechar },
    );
  };

  return (
    <Dialog
      open={empresa !== null}
      onOpenChange={(aberto) => !aberto && fechar()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Creditar ★</DialogTitle>
          <DialogDescription>
            {empresa
              ? `${empresa.nome} tem ${formatarEstrelas(empresa.saldo)} ★ agora.`
              : null}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field data-invalid={valorInvalido || undefined}>
            <FieldLabel htmlFor="credito-valor">Quantas ★</FieldLabel>
            <Input
              id="credito-valor"
              inputMode="decimal"
              placeholder="500"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              aria-invalid={valorInvalido || undefined}
            />
            <div className="flex gap-2">
              {ATALHOS.map((atalho) => (
                <Button
                  key={atalho}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setValor(String(atalho))}
                >
                  +{atalho.toLocaleString("pt-BR")}
                </Button>
              ))}
            </div>
            {valorInvalido ? (
              <FieldError>Informe um número maior que zero.</FieldError>
            ) : (
              <FieldDescription>
                Aceita fração — 0,5 ★ é meia estrela.
                {estrelas !== null && estrelas > 0 && empresa
                  ? ` O saldo fica em ${formatarEstrelas(empresa.saldo + estrelas)} ★.`
                  : ""}
              </FieldDescription>
            )}
          </Field>

          <Field data-invalid={motivoCurto || undefined}>
            <FieldLabel htmlFor="credito-motivo">Motivo</FieldLabel>
            <Input
              id="credito-motivo"
              placeholder="Cortesia de avaliação"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              aria-invalid={motivoCurto || undefined}
            />
            {motivoCurto ? (
              <FieldError>Diga o motivo do crédito.</FieldError>
            ) : (
              <FieldDescription>
                Fica no extrato da empresa, junto com o seu nome.
              </FieldDescription>
            )}
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={fechar}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={creditar.isPending}>
            {creditar.isPending ? "Creditando…" : "Creditar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
