"use client";

import {
  ArrowLeft,
  Check,
  ChefHat,
  Clock,
  ClipboardCheck,
  CreditCard,
  MessageCircle,
  PackageCheck,
  Receipt,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import placeholder from "@/assets/background-default-image.svg";
import { Skeleton } from "@/components/ui/skeleton";
import { useAcompanharPedido } from "@/features/storefront/hooks/use-acompanhar-pedido";
import { useCatalogHref } from "@/features/storefront/lib/catalog-base";
import { constructUrl } from "@/hooks/use-construct-url";
import { cn } from "@/lib/utils";
import { currencyFormatter } from "@/utils/currency-formatter";

const ETAPAS = [
  { rotulo: "Recebido", detalhe: "A loja recebeu seu pedido", Icone: Receipt },
  {
    rotulo: "Confirmado",
    detalhe: "A loja confirmou os itens",
    Icone: ClipboardCheck,
  },
  { rotulo: "Em preparo", detalhe: "Separando o seu pedido", Icone: ChefHat },
  { rotulo: "Concluído", detalhe: "Pedido finalizado", Icone: PackageCheck },
] as const;

/** Em que etapa o status da venda está. */
function etapaDoStatus(status: string): number {
  switch (status) {
    case "CONFIRMED":
      return 1;
    case "PROCESSING":
      return 2;
    case "COMPLETED":
      return 3;
    default:
      return 0;
  }
}

function dataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AcompanharPedido({
  subdomain,
  saleId,
}: {
  subdomain: string;
  saleId: string;
}) {
  const {
    data: pedido,
    isPending,
    isError,
  } = useAcompanharPedido(subdomain, saleId);
  const homeHref = useCatalogHref("/");

  // A cor da loja já vem do servidor na `--primary` (layout da vitrine):
  // usar a variável evita o botão piscar na cor padrão enquanto carrega.
  const tema = "var(--primary)";
  const corDoTema = {
    backgroundColor: tema,
    color: "var(--primary-foreground)",
  };

  if (isPending) return <Esqueleto />;

  if (isError || !pedido) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <XCircle className="size-12 text-neutral-400" />
        <h1 className="font-bold text-2xl">Pedido não encontrado</h1>
        <p className="text-neutral-500">
          Confira o link que você recebeu ou fale com a loja.
        </p>
        <Link
          href={homeHref}
          className="rounded-full px-6 py-3 font-semibold"
          style={corDoTema}
        >
          Voltar para a loja
        </Link>
      </div>
    );
  }

  const cancelado = pedido.status === "CANCELLED";
  const etapa = etapaDoStatus(pedido.status);
  const whatsapp = pedido.whatsappDaLoja
    ? `https://wa.me/${pedido.whatsappDaLoja.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Quero saber do meu pedido #${pedido.saleNumber}.`)}`
    : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:py-10">
      <Link
        href={homeHref}
        className="flex w-fit items-center gap-2 text-sm opacity-80 hover:underline"
      >
        <ArrowLeft className="size-4" /> Continuar comprando
      </Link>

      <section className="flex flex-col gap-6 rounded-2xl border border-black/5 bg-white p-6 text-neutral-900 shadow-xs sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-neutral-500 text-sm">Pedido</span>
            <span className="font-bold text-4xl tracking-wide">
              #{pedido.saleNumber}
            </span>
          </div>
          <span className="text-neutral-500 text-sm">
            Feito em {dataHora(pedido.criadoEm)}
          </span>
        </div>

        {cancelado ? (
          <div className="flex items-start gap-3 rounded-xl bg-red-50 p-4 text-red-700">
            <XCircle className="mt-0.5 size-5 shrink-0" />
            <div className="flex flex-col gap-1">
              <span className="font-semibold">Pedido cancelado</span>
              <span className="text-sm">
                {pedido.canceladoEm
                  ? `Cancelado em ${dataHora(pedido.canceladoEm)}. `
                  : ""}
                Se tiver dúvida, fale com a loja.
              </span>
            </div>
          </div>
        ) : (
          <ol className="grid gap-4 sm:grid-cols-4 sm:gap-2">
            {ETAPAS.map(({ rotulo, detalhe, Icone }, indice) => {
              const feita = indice < etapa || (indice === 3 && etapa === 3);
              const atual = indice === etapa && etapa !== 3;
              return (
                <li
                  key={rotulo}
                  className="relative flex items-center gap-3 sm:flex-col sm:text-center"
                >
                  {indice > 0 && (
                    <span
                      aria-hidden
                      className="-translate-y-1/2 absolute top-5 right-1/2 hidden h-0.5 w-full sm:block"
                      style={{
                        backgroundColor: indice <= etapa ? tema : "#e5e5e5",
                      }}
                    />
                  )}
                  <span
                    className={cn(
                      "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2",
                      !feita &&
                        !atual &&
                        "border-neutral-200 bg-white text-neutral-400",
                      atual && "animate-pulse",
                    )}
                    style={
                      feita || atual
                        ? { ...corDoTema, borderColor: tema }
                        : undefined
                    }
                  >
                    {feita ? (
                      <Check className="size-5" />
                    ) : (
                      <Icone className="size-5" />
                    )}
                  </span>
                  <div className="flex flex-col">
                    <span
                      className={cn(
                        "font-semibold text-sm",
                        !feita && !atual && "text-neutral-400",
                      )}
                    >
                      {rotulo}
                    </span>
                    <span className="text-neutral-500 text-xs">
                      {atual ? "Agora" : detalhe}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          {pedido.portalUrl && !cancelado && !pedido.pagoEm && (
            <a
              href={pedido.portalUrl}
              className="flex h-13 flex-1 items-center justify-center gap-2 rounded-full font-semibold shadow-sm"
              style={corDoTema}
            >
              <CreditCard className="size-5" /> Pagar meu pedido
            </a>
          )}
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-13 flex-1 items-center justify-center gap-2 rounded-full border-2 border-emerald-600 font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              <MessageCircle className="size-5" /> Falar com a loja
            </a>
          )}
        </div>
        {!cancelado && etapa < 3 && (
          <p className="text-neutral-500 text-xs">
            Esta página se atualiza sozinha. Guarde o link para acompanhar
            depois.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-black/5 bg-white p-6 text-neutral-900 shadow-xs sm:p-8">
        <h2 className="font-bold text-lg">Itens do pedido</h2>
        <ul className="flex flex-col divide-y divide-neutral-100">
          {pedido.itens.map((item, indice) => (
            <li
              key={`${item.nome}-${indice}`}
              className="flex items-center gap-3 py-3"
            >
              <span className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-black/5 bg-white">
                <Image
                  src={
                    (item.thumbnail && constructUrl(item.thumbnail)) ||
                    placeholder
                  }
                  alt=""
                  fill
                  sizes="56px"
                  className="object-contain p-1"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm">{item.nome}</span>
                <span className="text-neutral-500 text-xs">
                  {item.quantidade} un.
                </span>
              </span>
              {!pedido.aguardandoValor && (
                <span className="font-semibold text-sm">
                  R$ {currencyFormatter(item.total)}
                </span>
              )}
            </li>
          ))}
        </ul>
        {pedido.aguardandoValor ? (
          <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-amber-800 text-sm">
            <Clock className="mt-0.5 size-4 shrink-0" />
            <span>
              Pedido de orçamento: a loja está conferindo os itens e vai te
              mandar o valor. Assim que combinar, ele aparece aqui.
            </span>
          </div>
        ) : (
          <dl className="flex flex-col gap-1.5 border-neutral-100 border-t pt-4 text-sm">
            <div className="flex justify-between text-neutral-600">
              <dt>Subtotal</dt>
              <dd>R$ {currencyFormatter(pedido.subtotal)}</dd>
            </div>
            {pedido.frete > 0 && (
              <div className="flex justify-between text-neutral-600">
                <dt>Entrega</dt>
                <dd>R$ {currencyFormatter(pedido.frete)}</dd>
              </div>
            )}
            {pedido.desconto > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>Desconto</dt>
                <dd>- R$ {currencyFormatter(pedido.desconto)}</dd>
              </div>
            )}
            <div className="flex justify-between pt-1 font-bold text-lg">
              <dt>Total</dt>
              <dd>R$ {currencyFormatter(pedido.total)}</dd>
            </div>
          </dl>
        )}
      </section>
    </div>
  );
}

function Esqueleto() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Skeleton className="h-56 w-full rounded-2xl bg-accent-foreground/10" />
      <Skeleton className="h-64 w-full rounded-2xl bg-accent-foreground/10" />
    </div>
  );
}
