"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { manifestosDaCategoria, SECOES } from "../catalog";
import type { ProviderManifest } from "../catalog/types";
import { useIntegracoes } from "../hooks/use-integracoes";
import { InstallDialog } from "./install-dialog";
import { LogoUploadDialog } from "./logo-upload-dialog";
import { ProviderCard } from "./provider-card";

export function IntegracoesPage() {
  const { data, isLoading } = useIntegracoes();
  const [aberto, setAberto] = useState<ProviderManifest | null>(null);
  const [editandoLogo, setEditandoLogo] = useState<ProviderManifest | null>(
    null,
  );

  const porProvedor = new Map(
    (data?.instalacoes ?? []).map((i) => [i.providerId, i]),
  );
  const podeGerenciar = data?.podeGerenciar ?? false;
  const podeEditarLogo = data?.podeEditarLogo ?? false;
  const logos = data?.logos ?? {};

  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Integrações</h1>
        <p className="text-muted-foreground text-sm">
          Conecte bancos, adquirentes e serviços usando as credenciais da sua
          empresa. As credenciais são cifradas antes de salvar.
        </p>
        {!isLoading && !podeGerenciar && (
          <p className="mt-2 text-muted-foreground text-xs">
            Você pode ver o catálogo, mas só administradores instalam
            integrações.
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      ) : (
        SECOES.map((secao) => {
          const manifestos = manifestosDaCategoria(secao.categoria);
          // Categoria sem provedor ainda (gateways) não vira seção vazia — ela
          // aparece sozinha quando o primeiro manifesto entrar.
          if (manifestos.length === 0) return null;

          return (
            <section key={secao.categoria} className="flex flex-col gap-3">
              <div>
                <h2 className="font-semibold text-sm">{secao.titulo}</h2>
                <p className="text-muted-foreground text-xs">
                  {secao.descricao}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {manifestos.map((manifest) => (
                  <ProviderCard
                    key={manifest.id}
                    manifest={manifest}
                    instalacao={porProvedor.get(manifest.id) ?? null}
                    logoKey={logos[manifest.id] ?? null}
                    podeGerenciar={podeGerenciar}
                    podeEditarLogo={podeEditarLogo}
                    onAbrir={() => setAberto(manifest)}
                    onEditarLogo={() => setEditandoLogo(manifest)}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}

      {editandoLogo && (
        <LogoUploadDialog
          manifest={editandoLogo}
          logoKey={logos[editandoLogo.id] ?? null}
          open
          onOpenChange={(open) => {
            if (!open) setEditandoLogo(null);
          }}
        />
      )}

      {aberto && (
        <InstallDialog
          manifest={aberto}
          instalacao={porProvedor.get(aberto.id) ?? null}
          valoresSalvos={porProvedor.get(aberto.id)?.valores ?? {}}
          logoKey={logos[aberto.id] ?? null}
          open
          onOpenChange={(open) => {
            if (!open) setAberto(null);
          }}
        />
      )}
    </div>
  );
}
