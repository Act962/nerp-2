import {
  AlertTriangle,
  ArrowLeftRight,
  Building2,
  CheckCircle2,
  GalleryVerticalEnd,
  Rocket,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { auth } from "@/lib/auth";
import { ConsentForm } from "./consent-form";

type SearchParams = Record<string, string | string[] | undefined>;

function pick(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

const SCOPE_LABELS: Record<string, { title: string; description: string }> = {
  "org:read": {
    title: "Ler dados da organização",
    description: "Nome, identificador e configurações públicas da empresa.",
  },
  "products:read": {
    title: "Ler catálogo de produtos",
    description: "Listar produtos, SKUs, preços e variantes.",
  },
  "products:write": {
    title: "Gerenciar produtos",
    description: "Criar, atualizar e remover produtos do catálogo.",
  },
  "stock:read": {
    title: "Consultar estoque",
    description: "Saldos, movimentações e níveis mínimos.",
  },
  "stock:write": {
    title: "Movimentar estoque",
    description: "Lançar entradas, saídas e ajustes de inventário.",
  },
  "sales:read": {
    title: "Ler vendas",
    description: "Histórico de pedidos, status e valores.",
  },
  "sales:write": {
    title: "Criar e atualizar vendas",
    description: "Registrar pedidos e alterar status no nerp.",
  },
};

function describeScope(scope: string) {
  return (
    SCOPE_LABELS[scope] ?? {
      title: scope,
      description: "Acesso concedido à integração para este escopo.",
    }
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted relative flex min-h-svh flex-col items-center justify-center gap-6 overflow-hidden p-4 md:p-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,theme(colors.primary/0.12),transparent_55%),radial-gradient(circle_at_bottom_right,theme(colors.primary/0.08),transparent_60%)]"
      />
      <div className="relative z-10 w-full max-w-xl">{children}</div>
    </div>
  );
}

function ErrorCard({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-card text-card-foreground rounded-2xl border p-8 shadow-xl">
      <div className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full">
        <Icon className="size-6" />
      </div>
      <h1 className="mt-5 text-xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const state = pick(params.state);
  const redirectUri = pick(params.redirect_uri);
  const scopes = pick(params.scopes) ?? "";
  const clientId = pick(params.client_id);

  if (!state || !redirectUri || !clientId) {
    return (
      <PageShell>
        <ErrorCard
          icon={AlertTriangle}
          title="Parâmetros inválidos"
          description="A URL de autorização está faltando parâmetros obrigatórios (state, redirect_uri ou client_id). Volte para o NASA e tente conectar novamente."
        />
      </PageShell>
    );
  }

  if (clientId !== process.env.NASA_CLIENT_ID) {
    return (
      <PageShell>
        <ErrorCard
          icon={ShieldCheck}
          title="Cliente desconhecido"
          description="O aplicativo NASA tentando conectar não está registrado neste nerp. Verifique se as credenciais da integração estão corretas."
        />
      </PageShell>
    );
  }

  const headers = await nextHeaders();
  const session = await auth.api.getSession({ headers });

  if (!session?.user) {
    const currentPath =
      new URL(
        headers.get("x-url") ??
          `/authorize/nasa-integration?state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}&scopes=${encodeURIComponent(scopes)}&client_id=${encodeURIComponent(clientId)}`,
        "http://localhost",
      ).pathname +
      "?" +
      new URLSearchParams({
        state,
        redirect_uri: redirectUri,
        scopes,
        client_id: clientId,
      }).toString();
    redirect(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
  }

  const org = await auth.api.getFullOrganization({ headers });

  if (!org) {
    return (
      <PageShell>
        <ErrorCard
          icon={Building2}
          title="Nenhuma organização ativa"
          description="Você precisa selecionar ou criar uma organização no nerp antes de autorizar a integração com o NASA."
          action={
            <Button asChild className="w-full">
              <a href="/dashboard">Ir para o dashboard</a>
            </Button>
          }
        />
      </PageShell>
    );
  }

  const scopesList = scopes
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const orgInitials =
    org.name
      ?.split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? "?";

  let redirectHost = redirectUri;
  try {
    redirectHost = new URL(redirectUri).host;
  } catch {
    // keep raw value if not a valid URL
  }

  return (
    <PageShell>
      <div className="bg-card text-card-foreground overflow-hidden rounded-2xl border shadow-xl">
        <div className="relative overflow-hidden border-b bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-8 pt-8 pb-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-primary/10 blur-3xl"
          />
          <Badge
            variant="outline"
            className="bg-background/70 mb-5 backdrop-blur"
          >
            <Sparkles className="size-3" />
            Solicitação de autorização
          </Badge>

          <div className="flex items-center gap-4">
            <div className="bg-background ring-primary/30 flex size-14 items-center justify-center rounded-2xl shadow-sm ring-1">
              <Rocket className="text-primary size-7" />
            </div>
            <div className="bg-background/70 text-muted-foreground flex size-9 items-center justify-center rounded-full border backdrop-blur">
              <ArrowLeftRight className="size-4" />
            </div>
            <div className="bg-background ring-primary/30 flex size-14 items-center justify-center rounded-2xl shadow-sm ring-1">
              <GalleryVerticalEnd className="text-primary size-7" />
            </div>
          </div>

          <h1 className="mt-6 text-2xl font-semibold tracking-tight">
            Conectar NASA ao nerp
          </h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            O <span className="text-foreground font-medium">NASA</span> está
            pedindo permissão para acessar a sua organização no{" "}
            <span className="text-foreground font-medium">nerp</span>. Revise os
            detalhes antes de autorizar.
          </p>
        </div>

        <div className="space-y-6 px-8 py-6">
          <div className="bg-muted/40 grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Avatar className="size-10">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {orgInitials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Organização
                </p>
                <p className="truncate text-sm font-medium">{org.name}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Avatar className="size-10">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {(
                    session.user.name?.[0] ?? session.user.email[0]
                  ).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Autorizado por
                </p>
                <p className="truncate text-sm font-medium">
                  {session.user.email}
                </p>
              </div>
            </div>
          </div>

          {scopesList.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  Permissões solicitadas
                </h2>
                <Badge variant="secondary">
                  {scopesList.length}{" "}
                  {scopesList.length === 1 ? "escopo" : "escopos"}
                </Badge>
              </div>
              <ul className="space-y-2">
                {scopesList.map((scope) => {
                  const { title, description } = describeScope(scope);
                  return (
                    <li
                      key={scope}
                      className="bg-background hover:border-primary/40 flex items-start gap-3 rounded-lg border p-3 transition-colors"
                    >
                      <CheckCircle2 className="text-primary mt-0.5 size-5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{title}</p>
                        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                          {description}
                        </p>
                      </div>
                      <code className="bg-muted text-muted-foreground hidden rounded px-1.5 py-0.5 font-mono text-[10px] sm:inline-block">
                        {scope}
                      </code>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <Separator />

          <div className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed">
            <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" />
            <p>
              Você poderá revogar esta integração a qualquer momento nas
              configurações da organização. Após autorizar, você será
              redirecionado para{" "}
              <span className="text-foreground font-medium">
                {redirectHost}
              </span>
              .
            </p>
          </div>

          <ConsentForm
            state={state}
            redirectUri={redirectUri}
            scopes={scopes}
          />
        </div>
      </div>

      <p className="text-muted-foreground mt-4 text-center text-xs">
        Powered by <span className="text-foreground font-medium">nerp</span> ·
        TradeGram
      </p>
    </PageShell>
  );
}
