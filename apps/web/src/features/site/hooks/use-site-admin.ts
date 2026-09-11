import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";
import type { SiteBlock } from "@nerp/site-content";
import type { SiteLeadStatus } from "@/generated/prisma/enums";

/**
 * Todas as chamadas do admin do site. Componente nenhum fala com `orpc`
 * direto — a convenção do projeto é passar por aqui, onde o erro vira toast e
 * o sucesso invalida o que precisa.
 */

type Panel = "SOLUCOES" | "SEGMENTOS" | "SOBRE";

export function useSiteOverview() {
  const { data, isPending } = useQuery(
    orpc.site.overview.queryOptions({ input: {} }),
  );
  return { overview: data, isLoading: isPending };
}

export function useSiteMenu(panel: Panel) {
  const { data, isPending } = useQuery(
    orpc.site.menu.list.queryOptions({ input: { panel } }),
  );
  return { items: data?.items ?? [], isLoading: isPending };
}

function invalidateMenu(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: orpc.site.menu.list.key() });
  queryClient.invalidateQueries({ queryKey: orpc.site.overview.key() });
}

export function useSaveMenuItem() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.menu.save.mutationOptions({
      onSuccess: () => {
        toast.success("Item salvo");
        invalidateMenu(queryClient);
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useToggleMenuItem() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.menu.toggle.mutationOptions({
      onSuccess: () => invalidateMenu(queryClient),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useReorderMenu() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.menu.reorder.mutationOptions({
      onSuccess: () => invalidateMenu(queryClient),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteMenuItem() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.menu.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Item excluído");
        invalidateMenu(queryClient);
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useSitePages(search?: string) {
  const { data, isPending } = useQuery(
    orpc.site.pages.list.queryOptions({ input: { search } }),
  );
  return { pages: data?.pages ?? [], isLoading: isPending };
}

export function useSitePage(id: string) {
  const { data, isPending } = useQuery({
    ...orpc.site.pages.get.queryOptions({ input: { id } }),
    enabled: Boolean(id),
  });
  return { page: data, isLoading: isPending };
}

export function useCreatePage() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.pages.create.mutationOptions({
      onSuccess: () => {
        toast.success("Página criada");
        queryClient.invalidateQueries({ queryKey: orpc.site.pages.list.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useSavePage() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.pages.save.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.published ? "Página publicada" : "Rascunho salvo");
        queryClient.invalidateQueries({ queryKey: orpc.site.pages.get.key() });
        queryClient.invalidateQueries({ queryKey: orpc.site.pages.list.key() });
        queryClient.invalidateQueries({ queryKey: orpc.site.overview.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function usePublishPage() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.pages.publish.mutationOptions({
      onSuccess: () => {
        toast.success("Publicado");
        queryClient.invalidateQueries({ queryKey: orpc.site.pages.list.key() });
        queryClient.invalidateQueries({ queryKey: orpc.site.overview.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useSiteMedia() {
  const { data, isPending } = useQuery(
    orpc.site.media.list.queryOptions({ input: { limit: 60 } }),
  );
  return { media: data?.media ?? [], isLoading: isPending };
}

export function useRegisterMedia() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.media.register.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: orpc.site.media.list.key() }),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useRemoveMedia() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.media.remove.mutationOptions({
      onSuccess: () => {
        toast.success("Imagem removida da lista");
        queryClient.invalidateQueries({ queryKey: orpc.site.media.list.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useSiteAccess() {
  const { data, isPending } = useQuery(
    orpc.site.access.list.queryOptions({ input: {} }),
  );
  return {
    admins: data?.admins ?? [],
    superAdminEmail: data?.superAdminEmail ?? "",
    isLoading: isPending,
  };
}

export function useInviteAccess() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.access.invite.mutationOptions({
      onSuccess: () => {
        toast.success("Acesso liberado");
        queryClient.invalidateQueries({
          queryKey: orpc.site.access.list.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useRemoveAccess() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.access.remove.mutationOptions({
      onSuccess: () => {
        toast.success("Acesso removido");
        queryClient.invalidateQueries({
          queryKey: orpc.site.access.list.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

/** Só para deixar o tipo explícito onde o editor monta o payload. */
export type SavePageInput = {
  id: string;
  title: string;
  blocks: SiteBlock[];
  seoTitle: string;
  seoDescription: string;
  ogImage: string;
  publish: boolean;
};

/* --- parceiros e marcas -------------------------------------------------- */

/*
  As duas listas invalidam juntas.

  Elas alimentam a mesma resposta pública (`/api/site/partners`) e a mesma
  seção da viagem: mexer numa e deixar a outra em cache mostraria metade do
  trecho atualizado.
*/
function invalidatePartners(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: orpc.site.partners.list.key() });
  queryClient.invalidateQueries({ queryKey: orpc.site.brands.list.key() });
  queryClient.invalidateQueries({ queryKey: orpc.site.overview.key() });
}

export function useSitePartners() {
  const { data, isPending } = useQuery(
    orpc.site.partners.list.queryOptions({ input: {} }),
  );
  return { items: data?.items ?? [], isLoading: isPending };
}

export function useSaveSitePartner() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.partners.save.mutationOptions({
      onSuccess: () => {
        toast.success("Parceiro salvo");
        invalidatePartners(queryClient);
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useToggleSitePartner() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.partners.toggle.mutationOptions({
      onSuccess: () => invalidatePartners(queryClient),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useReorderSitePartners() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.partners.reorder.mutationOptions({
      onSuccess: () => invalidatePartners(queryClient),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteSitePartner() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.partners.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Parceiro excluído");
        invalidatePartners(queryClient);
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useSiteBrands() {
  const { data, isPending } = useQuery(
    orpc.site.brands.list.queryOptions({ input: {} }),
  );
  return { items: data?.items ?? [], isLoading: isPending };
}

export function useSaveSiteBrand() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.brands.save.mutationOptions({
      onSuccess: () => {
        toast.success("Marca salva");
        invalidatePartners(queryClient);
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useToggleSiteBrand() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.brands.toggle.mutationOptions({
      onSuccess: () => invalidatePartners(queryClient),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useReorderSiteBrands() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.brands.reorder.mutationOptions({
      onSuccess: () => invalidatePartners(queryClient),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteSiteBrand() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.brands.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Marca excluída");
        invalidatePartners(queryClient);
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// ─── Astro consultor ──────────────────────────────────────────────────────────

export function useAstroPricing() {
  const { data, isPending } = useQuery(
    orpc.site.astro.getPricing.queryOptions({ input: {} }),
  );
  return { pricing: data?.pricing, config: data?.config, isLoading: isPending };
}

function invalidateAstro(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: orpc.site.astro.getPricing.key() });
}

export function useSaveAstroPricing() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.astro.savePricing.mutationOptions({
      onSuccess: () => {
        toast.success("Faixas salvas");
        invalidateAstro(queryClient);
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useSaveAstroConfig() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.astro.saveConfig.mutationOptions({
      onSuccess: () => {
        toast.success("Consultor atualizado");
        invalidateAstro(queryClient);
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

/** A simulação não invalida nada: é conferência, não gravação. */
export function useSimularPreco() {
  return useMutation(
    orpc.site.astro.simular.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );
}

// ─── Leads do site ────────────────────────────────────────────────────────────

export function useSiteLeads(input: {
  status?: SiteLeadStatus;
  cursor?: string;
}) {
  const { data, isPending } = useQuery(
    orpc.site.leads.list.queryOptions({ input }),
  );
  return {
    leads: data?.leads ?? [],
    nextCursor: data?.nextCursor ?? null,
    novos: data?.novos ?? 0,
    isLoading: isPending,
  };
}

export function useSiteLead(id: string | null) {
  const { data, isPending } = useQuery({
    ...orpc.site.leads.get.queryOptions({ input: { id: id ?? "" } }),
    enabled: !!id,
  });
  return { lead: data?.lead, isLoading: isPending };
}

function invalidateLeads(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: orpc.site.leads.list.key() });
  queryClient.invalidateQueries({ queryKey: orpc.site.leads.get.key() });
}

export function useUpdateSiteLead() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.leads.update.mutationOptions({
      onSuccess: () => {
        toast.success("Lead atualizado");
        invalidateLeads(queryClient);
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteSiteLead() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.leads.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Lead excluído");
        invalidateLeads(queryClient);
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

/**
 * O painel do dono da plataforma. Duas consultas separadas de propósito: o
 * resumo é leve e abre a tela, a lista por empresa é a parte cara — e assim
 * trocar o período não segura os números de cima esperando a tabela.
 */
export function usePlataformaResumo(dias: number) {
  const { data, isPending } = useQuery(
    orpc.site.plataforma.resumo.queryOptions({ input: { dias } }),
  );
  return { resumo: data, isLoading: isPending };
}

export function usePlataformaEmpresas(dias: number) {
  const { data, isPending } = useQuery(
    orpc.site.plataforma.empresas.queryOptions({ input: { dias } }),
  );
  return {
    empresas: data?.empresas ?? [],
    dolar: data?.dolar ?? 0,
    isLoading: isPending,
  };
}

/**
 * Crédito manual de ★. Invalida os dois painéis: o saldo aparece na tabela de
 * Stars e entra no "★ em circulação" do resumo.
 */
export function useCreditarStars() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.plataforma.creditarStars.mutationOptions({
      onSuccess: (resultado) => {
        toast.success(
          `${resultado.nome} agora tem ${resultado.saldo.toLocaleString("pt-BR")} ★`,
        );
        queryClient.invalidateQueries({
          queryKey: orpc.site.plataforma.empresas.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.site.plataforma.resumo.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

/**
 * Por que o Astro não responde numa empresa. Só consulta quando há empresa
 * escolhida — o diagnóstico chama as travas de verdade (saldo, teto) e não é
 * consulta para rodar em toda linha da tabela.
 */
export function useDiagnosticoDoAstro(organizationId: string | null) {
  const { data, isPending } = useQuery({
    ...orpc.site.plataforma.diagnosticoDoAstro.queryOptions({
      input: { organizationId: organizationId ?? "" },
    }),
    enabled: organizationId !== null,
  });
  return { diagnostico: data, isLoading: isPending };
}

export function useReiniciarAstro() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.plataforma.reiniciarAstro.mutationOptions({
      onSuccess: () => {
        toast.success("Astro reiniciado nesta empresa");
        queryClient.invalidateQueries({
          queryKey: orpc.site.plataforma.diagnosticoDoAstro.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.site.plataforma.empresas.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

/**
 * Testa a chave de IA contra o provedor. Mutation, e não query, porque é uma
 * chamada paga: só acontece quando alguém clica.
 */
export function useTestarChaveDoAstro() {
  return useMutation(
    orpc.site.plataforma.testarChaveDoAstro.mutationOptions({
      onSuccess: ({ modelos }) => {
        const quebrados = modelos.filter((m) => !m.ok);
        if (quebrados.length === 0) {
          toast.success(`Os ${modelos.length} modelos responderam`);
        } else {
          toast.error(
            `${quebrados.length} de ${modelos.length} modelos recusaram`,
          );
        }
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

/** Preço das ações de uma empresa — a tela que liga a cobrança. */
export function usePrecosDaEmpresa(organizationId: string | null) {
  const { data, isPending } = useQuery({
    ...orpc.site.plataforma.precos.queryOptions({
      input: { organizationId: organizationId ?? "" },
    }),
    enabled: organizationId !== null,
  });
  return { precos: data, isLoading: isPending };
}

export function useDefinirPrecoDaEmpresa() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.plataforma.definirPreco.mutationOptions({
      onSuccess: (resultado) => {
        toast.success(
          resultado.stars === 0
            ? "Cobrança desta ação desligada"
            : `Passou a custar ${resultado.stars} ★`,
        );
        queryClient.invalidateQueries({
          queryKey: orpc.site.plataforma.precos.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
