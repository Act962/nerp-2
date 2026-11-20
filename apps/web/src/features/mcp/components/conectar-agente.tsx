"use client";

import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BotIcon, CheckIcon, CopyIcon, KeyRoundIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { CAMINHO_DO_MCP, ESCOPO_IMPORTACAO } from "../escopos";
import {
  useAlterarImportacaoDoToken,
  useCriarTokenDoMcp,
  useRevogarTokenDoMcp,
  useTokensDoMcp,
} from "../hooks/use-tokens-do-mcp";

// Liga um agente de IA (Claude Code, Claude Desktop, Cursor…) ao MCP do NERP:
// mostra o endereço, gera o token (que aparece uma vez só) e já entrega a
// configuração pronta para colar. Lista e revoga os tokens da organização.

function Copiavel({ valor, rotulo }: { valor: string; rotulo: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-md border bg-muted/40 p-2">
      <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px]">
        {valor}
      </pre>
      <Button
        size="icon"
        variant="ghost"
        className="size-7 shrink-0"
        aria-label={`Copiar ${rotulo}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(valor);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1500);
          } catch {
            toast.error("Não foi possível copiar. Selecione e copie à mão.");
          }
        }}
      >
        {copiado ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  );
}

function configuracoes(url: string, token: string) {
  return {
    claudeCode: `claude mcp add --transport http nerp ${url} --header "Authorization: Bearer ${token}"`,
    // Claude Desktop ainda não manda cabeçalho a servidor remoto: o
    // `mcp-remote` faz a ponte. O token vai por variável para não quebrar no
    // espaço do "Bearer" no Windows.
    claudeDesktop: JSON.stringify(
      {
        mcpServers: {
          nerp: {
            command: "npx",
            args: [
              "-y",
              "mcp-remote",
              url,
              "--header",
              // biome-ignore lint/suspicious/noTemplateCurlyInString: é a sintaxe de variável do mcp-remote, não template do JS
              "Authorization:${NERP_TOKEN}",
            ],
            env: { NERP_TOKEN: `Bearer ${token}` },
          },
        },
      },
      null,
      2,
    ),
    outros: JSON.stringify(
      {
        mcpServers: {
          nerp: { url, headers: { Authorization: `Bearer ${token}` } },
        },
      },
      null,
      2,
    ),
  };
}

export function ConectarAgente() {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [importar, setImportar] = useState(false);
  const [gerado, setGerado] = useState<string | null>(null);
  const tokens = useTokensDoMcp(aberto);
  const criar = useCriarTokenDoMcp();
  const revogar = useRevogarTokenDoMcp();
  const alterarImportacao = useAlterarImportacaoDoToken();

  const url =
    typeof window === "undefined"
      ? CAMINHO_DO_MCP
      : `${window.location.origin}${CAMINHO_DO_MCP}`;
  const config = gerado ? configuracoes(url, gerado) : null;

  return (
    <Dialog
      open={aberto}
      onOpenChange={(proximo) => {
        setAberto(proximo);
        // O token não pode ficar na tela depois de fechar: some de vez.
        if (!proximo) setGerado(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8">
          <BotIcon />
          <span className="max-sm:hidden">Agente de IA</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Conectar um agente de IA</DialogTitle>
          <DialogDescription>
            O MCP do NERP deixa um agente (Claude, Cursor…) mapear o banco do
            ERP com você, conversando: ele explora as tabelas, sugere, testa com
            dado real e só salva quando você confirmar. Com a importação ligada,
            ele também sobe produtos, estoque e clientes para o NERP — sempre
            simulando antes. O banco do ERP é só lido.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <p className="font-medium text-xs">Endereço do MCP</p>
            <Copiavel valor={url} rotulo="endereço" />
          </div>

          {config && gerado ? (
            <div className="flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
              <p className="flex items-center gap-2 font-medium text-xs">
                <KeyRoundIcon className="size-3.5" />
                Copie agora: o token não aparece de novo.
              </p>
              <Copiavel valor={gerado} rotulo="token" />
              <Tabs defaultValue="claudeCode" className="gap-2">
                <TabsList className="h-8">
                  <TabsTrigger value="claudeCode" className="text-xs">
                    Claude Code
                  </TabsTrigger>
                  <TabsTrigger value="claudeDesktop" className="text-xs">
                    Claude Desktop
                  </TabsTrigger>
                  <TabsTrigger value="outros" className="text-xs">
                    Cursor e outros
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="claudeCode">
                  <Copiavel valor={config.claudeCode} rotulo="comando" />
                </TabsContent>
                <TabsContent value="claudeDesktop">
                  <p className="mb-1 text-[11px] text-muted-foreground">
                    Em Configurações › Desenvolvedor › Editar configuração, no
                    claude_desktop_config.json:
                  </p>
                  <Copiavel
                    valor={config.claudeDesktop}
                    rotulo="configuração"
                  />
                </TabsContent>
                <TabsContent value="outros">
                  <Copiavel valor={config.outros} rotulo="configuração" />
                </TabsContent>
              </Tabs>
              <p className="text-[11px] text-muted-foreground">
                No agente, peça: "use o prompt mapear_banco do NERP" (ou
                importar_dados, se a importação estiver ligada).
              </p>
            </div>
          ) : (
            <form
              className="flex flex-col gap-1.5"
              onSubmit={(evento) => {
                evento.preventDefault();
                criar.mutate(
                  { nome: nome.trim() || "Agente de IA", importar },
                  {
                    onSuccess: (resposta) => {
                      setGerado(resposta.token);
                      setNome("");
                      setImportar(false);
                    },
                  },
                );
              }}
            >
              <label htmlFor="nome-do-token" className="font-medium text-xs">
                Novo token
              </label>
              <div className="flex gap-2">
                <Input
                  id="nome-do-token"
                  value={nome}
                  onChange={(evento) => setNome(evento.target.value)}
                  placeholder='Nome (ex.: "Claude do Weydson")'
                  maxLength={60}
                  className="h-8 text-xs"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-8"
                  disabled={criar.isPending}
                >
                  Gerar token
                </Button>
              </div>
              <label
                htmlFor="token-importa"
                className="flex items-center gap-2 text-[11px] text-muted-foreground"
              >
                <Checkbox
                  id="token-importa"
                  checked={importar}
                  onCheckedChange={(marcado) => setImportar(marcado === true)}
                />
                Também pode importar dados (grava produtos, estoque e clientes
                no NERP)
              </label>
            </form>
          )}

          <div className="flex flex-col gap-1.5">
            <p className="font-medium text-xs">Tokens desta organização</p>
            {tokens.isLoading ? (
              <p className="text-muted-foreground text-xs">Carregando…</p>
            ) : tokens.data?.tokens.length ? (
              <ul className="flex max-h-44 flex-col divide-y overflow-y-auto rounded-md border">
                {tokens.data.tokens.map((token) => (
                  <li
                    key={token.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-xs",
                      token.revogadoEm && "opacity-50",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{token.nome}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {token.dono ?? "—"} ·{" "}
                        {token.vistoEm
                          ? `usado ${formatDistanceToNow(new Date(token.vistoEm), { locale: ptBR, addSuffix: true })}`
                          : "nunca usado"}
                      </p>
                    </div>
                    {token.revogadoEm ? (
                      <Badge variant="outline">Revogado</Badge>
                    ) : (
                      <>
                        <label
                          htmlFor={`importa-${token.id}`}
                          className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                        >
                          <Switch
                            id={`importa-${token.id}`}
                            checked={token.escopos.includes(ESCOPO_IMPORTACAO)}
                            disabled={alterarImportacao.isPending}
                            onCheckedChange={(ligado) =>
                              alterarImportacao.mutate({
                                id: token.id,
                                importar: ligado,
                              })
                            }
                          />
                          Importar
                        </label>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-destructive text-xs hover:text-destructive"
                          disabled={revogar.isPending}
                          onClick={() => revogar.mutate({ id: token.id })}
                        >
                          Revogar
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-xs">
                Nenhum token ainda.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
