"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Loader2,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { useSearchOracleImages } from "../hooks/use-image-import";

// Extrai o nome do arquivo de um caminho Windows OU Unix — o Winthor grava
// "P:\img_prod\3133.JPG", mas ser tolerante a "/" não custa nada.
function basenameFromPath(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

// Auditor de fotos do Winthor: consulta PCPRODUT.DIRFOTOPROD (o Oracle SÓ tem
// o CAMINHO da foto, nunca o arquivo — ver comentário no backend) e cruza com
// o catálogo do NERP pelo SKU = CODPROD. Não sobe nada sozinho: gera a lista
// exata de arquivos que faltam, para quem tem acesso à rede/RDP do Winthor ir
// buscar — depois é só soltar na "Importar imagens em massa" logo acima.
export function OracleImageSearch() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 500);
  // Página 0-indexed. Reseta pra 0 sempre que o texto de busca muda —
  // ficar na página 7 após trocar o filtro devolveria "sem resultados" sem
  // pista de por quê. `pending` no filtro anterior também vira 0.
  const [page, setPage] = useState(0);
  const searchMutation = useSearchOracleImages();

  // searchMutation muda de identidade a cada render — só filtro e página
  // devem disparar uma nova consulta.
  // biome-ignore lint/correctness/useExhaustiveDependencies: ver comentário acima
  useEffect(() => {
    searchMutation.mutate({ search: debouncedSearch || undefined, page });
  }, [debouncedSearch, page]);

  // Reset de página quando o filtro muda (é a única forma segura — o
  // usuário pode ir pra página 3, pesquisar de novo, e queremos voltar pro
  // topo). Fica separado do effect acima pra não disparar duas mutations.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só reage ao filtro
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const data = searchMutation.data;

  // Nunca respondeu ainda (primeira carga) ou a org não tem Oracle
  // configurado — não faz sentido mostrar um buscador que nunca vai achar
  // nada. Mesmo padrão silencioso usado nas outras telas com recurso
  // condicionado ao ERP.
  if (!searchMutation.isPending && data?.connected === false) return null;

  const rows = data?.rows ?? [];
  const missing = rows.filter(
    (row) => row.product && !row.product.hasThumbnail,
  );

  const copyMissingFilenames = async () => {
    const names = missing.map((row) => basenameFromPath(row.caminhoWinthor));
    await navigator.clipboard.writeText(names.join("\n"));
    toast.success(`${names.length} nome(s) de arquivo copiado(s)`);
  };

  return (
    <Card>
      <CardHeader className="gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-5" />
            Buscar no Winthor (Oracle)
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Consulta o cadastro do Winthor e mostra quais produtos já têm foto
            registrada lá (campo <code>DIRFOTOPROD</code>) e se ela já chegou no
            NERP. O Oracle só guarda o <strong>caminho</strong> do arquivo (ex.:{" "}
            <code>P:\img_prod\3133.JPG</code>), não a imagem — para os que
            faltam, use o nome do arquivo pra buscar na rede/RDP do Winthor e
            suba pelo importador acima.
          </p>
        </div>
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Código ou descrição do produto..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {searchMutation.isPending ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Consultando o Winthor…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {search
              ? "Nenhum produto encontrado com esse termo."
              : "Nenhum produto com foto registrada no Winthor."}
          </p>
        ) : (
          <>
            {missing.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={copyMissingFilenames}
              >
                <Copy className="mr-2 size-4" />
                Copiar nomes dos arquivos que faltam ({missing.length})
              </Button>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Arquivo no Winthor</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.codprod}>
                    <TableCell className="font-mono text-xs">
                      {row.codprod}
                    </TableCell>
                    <TableCell
                      className="max-w-56 truncate"
                      title={row.descricao}
                    >
                      {row.descricao}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {basenameFromPath(row.caminhoWinthor)}
                    </TableCell>
                    <TableCell className="text-right">
                      {!row.product ? (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground"
                        >
                          Sem produto no NERP
                        </Badge>
                      ) : row.product.hasThumbnail ? (
                        <Badge
                          variant="secondary"
                          className="gap-1 text-emerald-700 dark:text-emerald-400"
                        >
                          <CheckCircle2 className="size-3.5" />
                          Já tem imagem
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600">
                          Falta imagem
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {/* Paginação: só aparece quando faz diferença — sem "1 de 1"
                em fila curta. `hasMore` vem do backend (truque pageSize+1,
                sem COUNT(*) caro). */}
            {(page > 0 || data?.hasMore) && (
              <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                <span>
                  Página {page + 1}
                  {data?.pageSize ? ` • ${rows.length} nesta página` : null}
                </span>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page === 0 || searchMutation.isPending}
                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                  >
                    <ChevronLeft className="mr-1 size-3.5" />
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!data?.hasMore || searchMutation.isPending}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Próxima
                    <ChevronRight className="ml-1 size-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
