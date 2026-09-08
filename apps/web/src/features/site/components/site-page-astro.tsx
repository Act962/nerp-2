"use client";

import type { AstroPagina } from "@nerp/site-content";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

/**
 * O que o Astro sabe e fala nesta página.
 *
 * Os balões são escritos por gente, não gerados: eles aparecem em TODA visita,
 * e pagar um modelo para inventar "essa é top hein" a cada carregamento seria
 * caro e pior. As palavras-chave e o resumo, esses vão para o prompt quando a
 * conversa começa aqui — é o que faz o Astro puxar o assunto certo em vez de
 * perguntar do zero a quem já está lendo sobre o produto.
 */
/** "funil, kanban , lead," → ["funil", "kanban", "lead"] */
function separarChaves(texto: string): string[] {
  return texto
    .split(",")
    .map((palavra) => palavra.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export function SitePageAstro({
  valor,
  onChange,
}: {
  valor: AstroPagina;
  onChange: (proximo: AstroPagina) => void;
}) {
  const alterar = (mudanca: Partial<AstroPagina>) =>
    onChange({ ...valor, ...mudanca });

  /*
    O texto das palavras-chave é estado local, e só vira lista ao sair do
    campo.

    Antes o campo era controlado direto pela lista (`join(", ")`), e aí a
    vírgula recém-digitada sumia no mesmo instante: ela criava um item vazio,
    o `filter` descartava, e o `join` devolvia o texto sem ela. Nunca dava
    para escrever a segunda palavra.
  */
  const [chaves, setChaves] = useState(valor.palavrasChave.join(", "));
  // Trocar de página recarrega o campo; digitar, não.
  const carregadoDe = useRef<string | null>(null);
  const assinatura = valor.palavrasChave.join("\u0000");
  useEffect(() => {
    if (carregadoDe.current === assinatura) return;
    carregadoDe.current = assinatura;
    setChaves(valor.palavrasChave.join(", "));
  }, [assinatura, valor.palavrasChave]);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Astro</CardTitle>
          <p className="text-sm text-muted-foreground">
            O que ele fala e o que ele sabe quando alguém chega nesta página.
          </p>
        </div>
        <Switch
          checked={valor.ativo}
          onCheckedChange={(ativo) => alterar({ ativo })}
          aria-label="Astro fala nesta página"
        />
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <Field>
          <FieldLabel>Balões</FieldLabel>
          <FieldDescription>
            Ele solta na ordem, um depois do outro, quando o visitante chega.
            Duas ou três bastam — a quarta fala de um mascote que ninguém chamou
            vira barulho.
          </FieldDescription>

          <div className="flex flex-col gap-2">
            {valor.baloes.map((fala, indice) => (
              // A chave é o índice de propósito: a fala É o conteúdo editável
              // e pode repetir, então ela não serve de identidade.
              <div key={indice} className="flex items-center gap-2">
                <Input
                  value={fala}
                  maxLength={140}
                  placeholder={
                    indice === 0 ? "Essa é top hein" : "Se quiser te explico"
                  }
                  onChange={(e) => {
                    const baloes = [...valor.baloes];
                    baloes[indice] = e.target.value;
                    alterar({ baloes });
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover o balão ${indice + 1}`}
                  onClick={() =>
                    alterar({
                      baloes: valor.baloes.filter((_, i) => i !== indice),
                    })
                  }
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}

            {valor.baloes.length < 4 && (
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => alterar({ baloes: [...valor.baloes, ""] })}
              >
                <Plus className="size-4" /> Adicionar balão
              </Button>
            )}
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor="astro-palavras">Palavras-chave</FieldLabel>
          <Input
            id="astro-palavras"
            value={chaves}
            placeholder="funil, kanban, lead, proposta"
            onChange={(e) => setChaves(e.target.value)}
            onBlur={() => alterar({ palavrasChave: separarChaves(chaves) })}
          />
          <FieldDescription>
            Separadas por vírgula. É o vocabulário desta página: o que o Astro
            usa para puxar o assunto certo com quem está lendo aqui.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="astro-resumo">Resumo para o Astro</FieldLabel>
          <Textarea
            id="astro-resumo"
            rows={3}
            maxLength={600}
            value={valor.resumo}
            placeholder="Duas ou três linhas sobre o que esta página vende, na voz da casa."
            onChange={(e) => alterar({ resumo: e.target.value })}
          />
          <FieldDescription>
            O que ele responde se perguntarem "o que é isto aqui?", sem precisar
            buscar em lugar nenhum.
          </FieldDescription>
        </Field>
      </CardContent>
    </Card>
  );
}
