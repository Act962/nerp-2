import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

/**
 * As chamadas do editor de animações do ASTRO. Componente nenhum fala com
 * `orpc` direto — a convenção do projeto é passar por aqui, onde o erro vira
 * toast e o sucesso invalida o que precisa.
 */

function invalidar(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({
    queryKey: orpc.site.astro.animacoes.list.key(),
  });
}

export function useAstroAnimacoes() {
  const { data, isPending } = useQuery(
    orpc.site.astro.animacoes.list.queryOptions({ input: {} }),
  );
  return { animacoes: data?.animacoes ?? [], isLoading: isPending };
}

export function useSalvarAstroAnimacao() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.astro.animacoes.save.mutationOptions({
      onSuccess: (resultado) => {
        toast.success("Animação salva");
        // Trocar de dono é o tipo de efeito que precisa ser dito: quem salvou
        // não estava olhando para a outra cena.
        if (resultado.momentoLiberado) {
          toast.info(`"${resultado.momentoLiberado}" voltou a ser rascunho`);
        }
        invalidar(queryClient);
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useExcluirAstroAnimacao() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.site.astro.animacoes.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Animação excluída");
        invalidar(queryClient);
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

/**
 * Abre uma cena salva. Não é `useQuery` de propósito: o editor pede a cena
 * quando alguém CLICA nela, e uma consulta por slug obrigaria a guardar o slug
 * escolhido num estado só para a consulta existir.
 */
export function useAbrirAstroAnimacao() {
  return useMutation({
    mutationFn: (slug: string) => orpc.site.astro.animacoes.get.call({ slug }),
    onError: (error: Error) => toast.error(error.message),
  });
}
