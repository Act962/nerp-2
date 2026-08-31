"use client";

import { CheckCircle2, ExternalLink, Loader2, Unplug } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOrbitaStatus, useRevogarOrbita } from "../hooks/use-orbita";

const ORBITA =
  process.env.NEXT_PUBLIC_ORBITA_URL ?? "https://orbita.nasaex.com";

const ROTULO_DE_PERMISSAO: Record<string, string> = {
  "org:rw": "Dados da empresa",
  "products:rw": "Produtos",
  "categories:rw": "Categorias",
  "catalog-settings:rw": "Configurações do catálogo",
  "stocks:rw": "Estoque",
  "customer:rw": "Clientes",
  "sales:rw": "Vendas",
  "checkout:rw": "Checkout",
  "dashboard:r": "Painéis",
};

/**
 * Conexão com o Órbita CRM.
 *
 * A autorização começa **do lado do Órbita** e termina lá: ele manda o operador
 * para a tela de consentimento do nerp, recebe a chave de volta e volta para o
 * próprio painel. Por isso o botão abre em outra aba — esta aqui fica intacta e
 * detecta a conexão sozinha.
 */
export function OrbitaCrmPanel() {
  const [aguardando, setAguardando] = useState(false);
  const { data, isPending } = useOrbitaStatus(aguardando);
  const revogar = useRevogarOrbita();

  if (isPending || !data) {
    return (
      <div className="flex items-center gap-2 py-6 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Verificando conexão…
      </div>
    );
  }

  const { conexao, podeGerenciar } = data;

  // Conectou enquanto a gente sondava: para de sondar.
  if (conexao && aguardando) setAguardando(false);

  if (!conexao) {
    return (
      <div className="flex flex-col gap-4 py-2">
        <div className="space-y-2 text-sm">
          <p>
            Se você já usa o Órbita, conectar faz ele enxergar o que está aqui:
            produtos, estoque, clientes e vendas — sem digitar nada duas vezes.
          </p>
          <p className="text-muted-foreground">
            A autorização acontece no Órbita, em outra aba. Você escolhe o que
            liberar e volta para cá; esta tela reconhece a conexão sozinha.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={!podeGerenciar}
            onClick={() => {
              setAguardando(true);
              window.open(
                `${ORBITA}/api/integrations/nerp/start?returnUrl=/apps`,
                "_blank",
                "noopener,noreferrer",
              );
            }}
          >
            <ExternalLink className="size-4" />
            Conectar com o Órbita
          </Button>

          <Button asChild variant="ghost" size="sm">
            <a href={ORBITA} target="_blank" rel="noreferrer">
              Não tenho conta
            </a>
          </Button>
        </div>

        {aguardando ? (
          <p className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="size-4 animate-spin" />
            Esperando a autorização na outra aba…
          </p>
        ) : null}

        {!podeGerenciar ? (
          <p className="text-muted-foreground text-sm">
            Só administradores da organização podem conectar.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      <Badge className="w-fit gap-1.5">
        <CheckCircle2 className="size-3.5" />
        Conectado
      </Badge>

      <dl className="space-y-1 text-sm">
        <Linha rotulo="Autorizado por" valor={conexao.autorizadaPor ?? "—"} />
        <Linha
          rotulo="Desde"
          valor={new Date(conexao.conectadaEm).toLocaleDateString("pt-BR")}
        />
        <Linha
          rotulo="Último acesso"
          valor={
            conexao.ultimoUso
              ? new Date(conexao.ultimoUso).toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })
              : "ainda não usou"
          }
        />
      </dl>

      <div className="space-y-1.5">
        <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          O que o Órbita pode acessar
        </span>
        <div className="flex flex-wrap gap-1">
          {conexao.permissoes.map((permissao) => (
            <Badge key={permissao} variant="secondary">
              {ROTULO_DE_PERMISSAO[permissao] ?? permissao}
            </Badge>
          ))}
        </div>
      </div>

      {podeGerenciar ? (
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          disabled={revogar.isPending}
          onClick={() => revogar.mutate({})}
        >
          {revogar.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Unplug className="size-4" />
          )}
          Revogar acesso
        </Button>
      ) : null}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{rotulo}:</dt>
      <dd>{valor}</dd>
    </div>
  );
}
