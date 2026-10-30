"use client";

import {
  CFOPS_VAREJO,
  CSOSN,
  CST_ICMS,
  CST_PIS_COFINS,
  type RegimeTributario,
  padroesSugeridos,
  usaCsosn,
} from "@nerp/fiscal";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CodigoFiscalSelect } from "@/features/fiscal/components/codigo-fiscal-select";
import { ListChecks, Sparkles } from "lucide-react";

export type CampoPadrao = "cfop" | "cstIcms" | "cstPis" | "cstCofins";

interface PadroesTributacaoProps {
  regime: RegimeTributario;
  valores: Record<CampoPadrao, string | null>;
  onChange: (campo: CampoPadrao, valor: string | null) => void;
}

// Os padrões só são gravados ao salvar o painel — a sugestão preenche o form,
// não escreve no banco, para o dono conferir antes.
export function PadroesTributacao({
  regime,
  valores,
  onChange,
}: PadroesTributacaoProps) {
  const simples = usaCsosn(regime);
  const sugestao = padroesSugeridos(regime);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Padrões de tributação</CardTitle>
        <p className="text-sm text-muted-foreground">
          Produto sem tributação própria usa estes códigos na nota. Confirme com
          o seu contador; as exceções (ex.: bebidas com substituição tributária)
          ficam no cadastro de cada produto.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="padrao-cfop">CFOP</Label>
            <CodigoFiscalSelect
              id="padrao-cfop"
              tabela={CFOPS_VAREJO}
              value={valores.cfop}
              onChange={(v) => onChange("cfop", v)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="padrao-icms">
              {simples ? "CSOSN (ICMS no Simples)" : "CST do ICMS"}
            </Label>
            <CodigoFiscalSelect
              id="padrao-icms"
              tabela={simples ? CSOSN : CST_ICMS}
              value={valores.cstIcms}
              onChange={(v) => onChange("cstIcms", v)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="padrao-pis">CST do PIS</Label>
            <CodigoFiscalSelect
              id="padrao-pis"
              tabela={CST_PIS_COFINS}
              value={valores.cstPis}
              onChange={(v) => onChange("cstPis", v)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="padrao-cofins">CST do COFINS</Label>
            <CodigoFiscalSelect
              id="padrao-cofins"
              tabela={CST_PIS_COFINS}
              value={valores.cstCofins}
              onChange={(v) => onChange("cstCofins", v)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {sugestao && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onChange("cfop", sugestao.cfop ?? null);
                onChange("cstIcms", sugestao.cstIcms ?? null);
                onChange("cstPis", sugestao.cstPis ?? null);
                onChange("cstCofins", sugestao.cstCofins ?? null);
              }}
            >
              <Sparkles className="size-4" />
              Usar sugestão do Simples (5102 · 102 · 49 · 49)
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href="/produtos/fiscal">
              <ListChecks className="size-4" />
              Ver produtos prontos para nota
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
