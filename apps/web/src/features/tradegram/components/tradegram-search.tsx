"use client";

import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { constructUrl } from "@/hooks/use-construct-url";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  Building2,
  Factory,
  Lock,
  MapPin,
  Search,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import Link from "next/link";
import { MarketSizeRibbon } from "./market-size-ribbon";
import { useState } from "react";
import { useTradegramSearch } from "../hooks/use-tradegram";

const COMPANY_TYPE_LABEL: Record<string, string> = {
  SUPERMERCADO: "Supermercado",
  INDUSTRIA: "Indústria",
  DISTRIBUIDOR: "Distribuidor",
};

// Ambiente decorativo do universo do trade marketing — logos das grandes
// indústrias de bens de consumo passando devagar ao fundo, em baixa opacidade.
// É pano de fundo do setor, não uma alegação de parceria/clientes.
const BRANDS = [
  { name: "Coca-Cola", src: "/brands/coca-cola.svg" },
  { name: "Pepsi", src: "/brands/pepsi.svg" },
  { name: "Lay's", src: "/brands/lays.svg" },
  { name: "Nestlé", src: "/brands/nestle.svg" },
  { name: "Unilever", src: "/brands/unilever.svg" },
  { name: "P&G", src: "/brands/pg.svg" },
  { name: "Ambev", src: "/brands/ambev.svg" },
  { name: "Danone", src: "/brands/danone.png" },
  { name: "Heinz", src: "/brands/heinz.svg" },
  { name: "Red Bull", src: "/brands/redbull.svg" },
  { name: "Guaraná Antarctica", src: "/brands/guarana.svg" },
  { name: "Colgate", src: "/brands/colgate.svg" },
];

function BrandChip({ name, src }: { name: string; src: string }) {
  return (
    // biome-ignore lint/performance/noImgElement: logo estática em public/brands
    <img
      src={src}
      alt={name}
      loading="lazy"
      className="h-8 w-auto max-w-[150px] shrink-0 object-contain"
    />
  );
}

function BrandRow({
  brands,
  animation,
}: {
  brands: { name: string; src: string }[];
  animation: string;
}) {
  // Repete o subconjunto até a "metade" superar a largura visível, senão o loop
  // de -50% deixaria um vão. Duas metades idênticas garantem a emenda contínua.
  const half = [...brands, ...brands];
  const loop = [...half, ...half];
  return (
    <div className="flex w-max items-center gap-12" style={{ animation }}>
      {loop.map((brand, index) => (
        <BrandChip
          key={`${brand.name}-${index}`}
          name={brand.name}
          src={brand.src}
        />
      ))}
    </div>
  );
}

// Faixas de marcas empilhadas, cada linha deslizando em direção alternada e com
// fade nas bordas. As 12 marcas são divididas em 3 grupos distintos (4 por
// linha) — nenhuma marca se repete entre as linhas. Pano de fundo do setor
// (indústrias de bens de consumo), não uma alegação de parceria/clientes.
function BrandStrip() {
  const perRow = Math.ceil(BRANDS.length / 3);
  const rows = [
    BRANDS.slice(0, perRow),
    BRANDS.slice(perRow, perRow * 2),
    BRANDS.slice(perRow * 2),
  ];
  return (
    <div
      aria-hidden
      className="flex w-full flex-col gap-6 overflow-hidden py-2 opacity-70 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]"
    >
      <style>{`
@keyframes tg-mq-l { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes tg-mq-r { from { transform: translateX(-50%); } to { transform: translateX(0); } }
`}</style>
      <BrandRow brands={rows[0]} animation="tg-mq-l 60s linear infinite" />
      <BrandRow brands={rows[1]} animation="tg-mq-r 78s linear infinite" />
      <BrandRow brands={rows[2]} animation="tg-mq-l 68s linear infinite" />
    </div>
  );
}

function TrustBadge() {
  return (
    <div className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border bg-background/70 px-3 py-1.5 text-muted-foreground text-xs backdrop-blur">
      <span className="inline-flex items-center gap-1">
        <ShieldCheck className="size-3.5 text-emerald-600" /> Dados
        criptografados
      </span>
      <span className="text-border">•</span>
      <span className="inline-flex items-center gap-1">
        <Lock className="size-3.5 text-emerald-600" /> Conexão segura
      </span>
      <span className="text-border">•</span>
      <span>LGPD</span>
    </div>
  );
}

function Avatar({
  logoKey,
  fallback,
}: {
  logoKey: string | null;
  fallback: React.ReactNode;
}) {
  return (
    <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
      {logoKey ? (
        // biome-ignore lint/performance/noImgElement: logo por key do R2
        <img
          src={constructUrl(logoKey)}
          alt=""
          className="size-full object-cover"
        />
      ) : (
        fallback
      )}
    </span>
  );
}

export function TradeGramSearch() {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 250);
  const { data, isFetching } = useTradegramSearch(debounced);

  const total =
    (data?.groups.length ?? 0) +
    (data?.stores.length ?? 0) +
    (data?.suppliers.length ?? 0) +
    (data?.companies.length ?? 0) +
    (data?.directoryStores?.length ?? 0);
  const hasQuery = debounced.trim().length > 0;

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-primary/[0.06] via-background to-background">
      <div className="relative z-10 mx-auto flex max-w-2xl flex-col px-4 pb-16">
        {/* Hero */}
        <div
          className={`flex flex-col items-center text-center transition-all ${hasQuery ? "gap-4 pt-6" : "gap-6 pt-16"}`}
        >
          <Link href="/tradegram/buscar" className="inline-flex items-center">
            {/* biome-ignore lint/performance/noImgElement: logo estática em public/ */}
            <img
              src="/tradegram-logo.svg"
              alt="Tradegram"
              className="h-11 w-auto"
            />
          </Link>

          {!hasQuery && (
            <div className="space-y-2">
              <h1 className="text-balance font-bold text-3xl leading-tight sm:text-4xl">
                O mapa do trade marketing do Brasil
              </h1>
              <p className="text-balance text-muted-foreground">
                Encontre grupos, supermercados e indústrias — e explore o mapa
                de cada ponto de venda.
              </p>
            </div>
          )}

          {/* Search centralizado */}
          <div className="relative w-full max-w-xl">
            <Search className="-translate-y-1/2 absolute top-1/2 left-4 size-5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Busque um grupo, loja ou indústria…"
              className="h-14 rounded-full border-2 bg-background/80 pl-12 text-base shadow-lg backdrop-blur focus-visible:ring-primary/30"
            />
          </div>

          {!hasQuery && (
            <div className="flex w-full flex-col items-center gap-6 pt-1">
              <MarketSizeRibbon variant="hero" />
              <BrandStrip />
            </div>
          )}
        </div>

        {/* Resultados */}
        <div className="space-y-6 pt-6">
          {isFetching && (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          )}

          {!isFetching && hasQuery && total === 0 && (
            <p className="py-8 text-center text-muted-foreground text-sm">
              Nada encontrado para "{debounced}".
            </p>
          )}

          {!isFetching && data && data.groups.length > 0 && (
            <section className="space-y-1">
              <h2 className="px-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                Grupos
              </h2>
              {data.groups.map((group) => (
                <Link
                  key={group.slug}
                  href={`/tradegram/${group.slug}`}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent"
                >
                  <Avatar
                    logoKey={group.logoKey}
                    fallback={
                      <Users className="size-5 text-muted-foreground" />
                    }
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-sm">{group.name}</p>
                    <p className="truncate text-muted-foreground text-xs">
                      @{group.slug}
                    </p>
                  </div>
                </Link>
              ))}
            </section>
          )}

          {!isFetching && data && data.stores.length > 0 && (
            <section className="space-y-1">
              <h2 className="px-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                Lojas
              </h2>
              {data.stores.map((store) => (
                <Link
                  key={store.storeId}
                  href={`/tradegram/${store.orgSlug}/${store.storeId}`}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent"
                >
                  <Avatar
                    logoKey={store.coverImageKey}
                    fallback={
                      <Store className="size-5 text-muted-foreground" />
                    }
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-sm">{store.name}</p>
                    <p className="truncate text-muted-foreground text-xs">
                      {[store.city, store.state].filter(Boolean).join(" / ")}
                    </p>
                  </div>
                </Link>
              ))}
            </section>
          )}

          {!isFetching && data && data.suppliers.length > 0 && (
            <section className="space-y-1">
              <h2 className="px-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                Indústrias
              </h2>
              {data.suppliers.map((supplier) => (
                <Link
                  key={supplier.supplierId}
                  href={`/tradegram/${supplier.orgSlug}`}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent"
                >
                  <Avatar
                    logoKey={supplier.logoKey}
                    fallback={
                      <Factory className="size-5 text-muted-foreground" />
                    }
                  />
                  <p className="truncate font-medium text-sm">
                    {supplier.name}
                  </p>
                </Link>
              ))}
            </section>
          )}

          {!isFetching && data && data.directoryStores?.length > 0 && (
            <section className="space-y-1">
              <h2 className="px-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                PDVs (catálogo global)
              </h2>
              {data.directoryStores.map((point) => {
                const content = (
                  <>
                    <Avatar
                      logoKey={point.logoKey}
                      fallback={
                        <MapPin className="size-5 text-muted-foreground" />
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-sm">
                        {point.name}
                      </p>
                      <p className="truncate text-muted-foreground text-xs">
                        {[point.location, point.address]
                          .filter(Boolean)
                          .join(" · ") || "Sem endereço cadastrado"}
                      </p>
                    </div>
                  </>
                );
                return point.path ? (
                  <Link
                    key={point.id}
                    href={point.path}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent"
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    key={point.id}
                    className="flex items-center gap-3 rounded-lg p-2 opacity-90"
                  >
                    {content}
                  </div>
                );
              })}
            </section>
          )}

          {!isFetching && data && data.companies.length > 0 && (
            <section className="space-y-1">
              <h2 className="px-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                Empresas (diretório)
              </h2>
              {data.companies.map((company) => (
                <Link
                  key={company.companyId}
                  href={company.href}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent"
                >
                  <Avatar
                    logoKey={company.logoKey}
                    fallback={
                      <Building2 className="size-5 text-muted-foreground" />
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">
                      {company.name}
                    </p>
                    <p className="truncate text-muted-foreground text-xs">
                      {COMPANY_TYPE_LABEL[company.companyType] ?? "Empresa"}
                      {company.location ? ` · ${company.location}` : ""}
                    </p>
                    {company.tradeName && (
                      <p className="truncate text-muted-foreground text-[11px] italic">
                        {company.tradeName}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full border px-2 py-0.5 text-muted-foreground text-xs">
                    {company.badge}
                  </span>
                </Link>
              ))}
            </section>
          )}
        </div>

        <footer className="flex justify-center pt-10">
          <TrustBadge />
        </footer>
      </div>
    </div>
  );
}
