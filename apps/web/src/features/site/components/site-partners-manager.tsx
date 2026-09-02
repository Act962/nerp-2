"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  useDeleteSiteBrand,
  useDeleteSitePartner,
  useReorderSiteBrands,
  useReorderSitePartners,
  useSaveSiteBrand,
  useSaveSitePartner,
  useSiteBrands,
  useSitePartners,
  useToggleSiteBrand,
  useToggleSitePartner,
} from "../hooks/use-site-admin";
import { SitePageHeader } from "./site-page-header";
import { SiteImagePicker } from "./site-image-picker";

/**
 * Parceiros e marcas — o conteúdo da descida à Terra.
 *
 * Duas abas porque são duas coisas, e não duas visões da mesma: o parceiro é
 * um case, com foto e história, e aparece em cartão sobre o planeta; a marca é
 * um logotipo num quadro de vidro sobre o mar.
 *
 * A ordem daqui é a ordem no site, e o desligado some. **Lista vazia faz a
 * seção inteira desaparecer da viagem** — é o comportamento certo, e o aviso
 * no topo de cada lista existe para ninguém achar que quebrou.
 */

type Aba = "parceiros" | "marcas";

type RascunhoParceiro = {
  id?: string;
  name: string;
  photo: string;
  logo: string;
  story: string;
  href: string;
  visible: boolean;
};

type RascunhoMarca = {
  id?: string;
  name: string;
  logo: string;
  href: string;
  visible: boolean;
};

const PARCEIRO_VAZIO: RascunhoParceiro = {
  name: "",
  photo: "",
  logo: "",
  story: "",
  href: "",
  visible: true,
};

const MARCA_VAZIA: RascunhoMarca = {
  name: "",
  logo: "",
  href: "",
  visible: true,
};

export function SitePartnersManager() {
  const [aba, setAba] = useState<Aba>("parceiros");
  const [parceiro, setParceiro] = useState<RascunhoParceiro | null>(null);
  const [marca, setMarca] = useState<RascunhoMarca | null>(null);

  return (
    <>
      <SitePageHeader
        title="Parceiros"
        description="Os cases que aparecem sobre o planeta e as marcas nos quadros sobre o mar. A ordem aqui é a ordem no site."
        actions={
          aba === "parceiros" ? (
            <Button onClick={() => setParceiro({ ...PARCEIRO_VAZIO })}>
              Novo parceiro
            </Button>
          ) : (
            <Button onClick={() => setMarca({ ...MARCA_VAZIA })}>
              Nova marca
            </Button>
          )
        }
      />

      <Tabs
        value={aba}
        onValueChange={(valor) => {
          setAba(valor as Aba);
          setParceiro(null);
          setMarca(null);
        }}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="parceiros">Parceiros</TabsTrigger>
          <TabsTrigger value="marcas">Marcas</TabsTrigger>
        </TabsList>
      </Tabs>

      {aba === "parceiros" ? (
        <AbaParceiros rascunho={parceiro} setRascunho={setParceiro} />
      ) : (
        <AbaMarcas rascunho={marca} setRascunho={setMarca} />
      )}
    </>
  );
}

/* --- parceiros ---------------------------------------------------------- */

function AbaParceiros({
  rascunho,
  setRascunho,
}: {
  rascunho: RascunhoParceiro | null;
  setRascunho: (valor: RascunhoParceiro | null) => void;
}) {
  const { items, isLoading } = useSitePartners();
  const salvar = useSaveSitePartner();
  const alternar = useToggleSitePartner();
  const reordenar = useReorderSitePartners();
  const excluir = useDeleteSitePartner();

  function mover(indice: number, direcao: -1 | 1) {
    const alvo = indice + direcao;
    if (alvo < 0 || alvo >= items.length) return;
    const proxima = [...items];
    [proxima[indice], proxima[alvo]] = [proxima[alvo], proxima[indice]];
    reordenar.mutate({ ids: proxima.map((item) => item.id) });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr] lg:items-start">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cases de sucesso</CardTitle>
          <p className="text-sm text-muted-foreground">
            Aparecem em cartões sobre o planeta, na descida. Foto e logotipo são
            opcionais — sem os dois, o cartão fica com o nome e a história.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 p-0 pb-2">
          {isLoading && <Skeleton className="mx-4 h-24" />}
          {!isLoading && items.length === 0 && <ListaVazia />}
          {items.map((item, indice) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0"
            >
              <Ordenar
                indice={indice}
                total={items.length}
                onMover={mover}
                nome={item.name}
              />

              <button
                type="button"
                className="min-w-40 flex-1 text-left"
                onClick={() =>
                  setRascunho({
                    id: item.id,
                    name: item.name,
                    photo: item.photo ?? "",
                    logo: item.logo ?? "",
                    story: item.story,
                    href: item.href ?? "",
                    visible: item.visible,
                  })
                }
              >
                <span className="block text-sm font-medium">{item.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.story || "sem história"}
                </span>
              </button>

              <Switch
                checked={item.visible}
                onCheckedChange={(visible) =>
                  alternar.mutate({ id: item.id, visible })
                }
                aria-label={`Mostrar ${item.name} no site`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {rascunho && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {rascunho.id ? "Parceiro" : "Novo parceiro"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              É o cartão que passa sobre o planeta.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="parceiro-nome">Nome</FieldLabel>
              <Input
                id="parceiro-nome"
                value={rascunho.name}
                onChange={(e) =>
                  setRascunho({ ...rascunho, name: e.target.value })
                }
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="parceiro-historia">História</FieldLabel>
              <Textarea
                id="parceiro-historia"
                rows={4}
                value={rascunho.story}
                onChange={(e) =>
                  setRascunho({ ...rascunho, story: e.target.value })
                }
              />
              <FieldDescription>
                Dois ou três períodos. O cartão mostra três linhas; o que passar
                disso fica cortado.
              </FieldDescription>
            </Field>

            <SiteImagePicker
              label="Foto (opcional)"
              value={rascunho.photo}
              onChange={(photo) => setRascunho({ ...rascunho, photo })}
            />

            <SiteImagePicker
              label="Logotipo (opcional)"
              value={rascunho.logo}
              onChange={(logo) => setRascunho({ ...rascunho, logo })}
            />

            <Field>
              <FieldLabel htmlFor="parceiro-href">
                Para onde o cartão leva
              </FieldLabel>
              <Input
                id="parceiro-href"
                value={rascunho.href}
                onChange={(e) =>
                  setRascunho({ ...rascunho, href: e.target.value })
                }
                placeholder="https://site-do-parceiro.com.br"
              />
              <FieldDescription>
                Vazio deixa o cartão sem link. Endereço com http abre em aba
                nova.
              </FieldDescription>
            </Field>

            <Acoes
              salvando={salvar.isPending}
              podeExcluir={Boolean(rascunho.id)}
              onSalvar={() =>
                salvar.mutate(
                  {
                    id: rascunho.id,
                    name: rascunho.name,
                    photo: rascunho.photo || null,
                    logo: rascunho.logo || null,
                    story: rascunho.story,
                    href: rascunho.href || null,
                    visible: rascunho.visible,
                  },
                  { onSuccess: () => setRascunho(null) },
                )
              }
              onCancelar={() => setRascunho(null)}
              onExcluir={() => {
                const id = rascunho.id;
                if (!id) return;
                excluir.mutate({ id }, { onSuccess: () => setRascunho(null) });
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* --- marcas ------------------------------------------------------------- */

function AbaMarcas({
  rascunho,
  setRascunho,
}: {
  rascunho: RascunhoMarca | null;
  setRascunho: (valor: RascunhoMarca | null) => void;
}) {
  const { items, isLoading } = useSiteBrands();
  const salvar = useSaveSiteBrand();
  const alternar = useToggleSiteBrand();
  const reordenar = useReorderSiteBrands();
  const excluir = useDeleteSiteBrand();

  function mover(indice: number, direcao: -1 | 1) {
    const alvo = indice + direcao;
    if (alvo < 0 || alvo >= items.length) return;
    const proxima = [...items];
    [proxima[indice], proxima[alvo]] = [proxima[alvo], proxima[indice]];
    reordenar.mutate({ ids: proxima.map((item) => item.id) });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr] lg:items-start">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Marcas</CardTitle>
          <p className="text-sm text-muted-foreground">
            Os quadros de vidro sobre o mar. Aqui o logotipo é obrigatório —
            quadro sem logo não tem o que mostrar.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 p-0 pb-2">
          {isLoading && <Skeleton className="mx-4 h-24" />}
          {!isLoading && items.length === 0 && <ListaVazia />}
          {items.map((item, indice) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0"
            >
              <Ordenar
                indice={indice}
                total={items.length}
                onMover={mover}
                nome={item.name}
              />

              <button
                type="button"
                className="min-w-40 flex-1 text-left"
                onClick={() =>
                  setRascunho({
                    id: item.id,
                    name: item.name,
                    logo: item.logo,
                    href: item.href ?? "",
                    visible: item.visible,
                  })
                }
              >
                <span className="block text-sm font-medium">{item.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.href || "sem link"}
                </span>
              </button>

              <Switch
                checked={item.visible}
                onCheckedChange={(visible) =>
                  alternar.mutate({ id: item.id, visible })
                }
                aria-label={`Mostrar ${item.name} no site`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {rascunho && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {rascunho.id ? "Marca" : "Nova marca"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              É o quadro que aparece sobre o mar.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="marca-nome">Nome</FieldLabel>
              <Input
                id="marca-nome"
                value={rascunho.name}
                onChange={(e) =>
                  setRascunho({ ...rascunho, name: e.target.value })
                }
              />
              <FieldDescription>
                Não aparece na tela — é o texto alternativo do logotipo, para
                leitor de tela e para quando a imagem não carrega.
              </FieldDescription>
            </Field>

            <SiteImagePicker
              label="Logotipo"
              value={rascunho.logo}
              onChange={(logo) => setRascunho({ ...rascunho, logo })}
            />
            <p className="-mt-2 text-xs text-muted-foreground">
              Fundo transparente e tinta escura: o quadro é de vidro sobre um
              céu claro.
            </p>

            <Field>
              <FieldLabel htmlFor="marca-href">
                Para onde o quadro leva
              </FieldLabel>
              <Input
                id="marca-href"
                value={rascunho.href}
                onChange={(e) =>
                  setRascunho({ ...rascunho, href: e.target.value })
                }
                placeholder="https://site-da-marca.com.br"
              />
            </Field>

            <Acoes
              salvando={salvar.isPending}
              podeExcluir={Boolean(rascunho.id)}
              onSalvar={() =>
                salvar.mutate(
                  {
                    id: rascunho.id,
                    name: rascunho.name,
                    logo: rascunho.logo,
                    href: rascunho.href || null,
                    visible: rascunho.visible,
                  },
                  { onSuccess: () => setRascunho(null) },
                )
              }
              onCancelar={() => setRascunho(null)}
              onExcluir={() => {
                const id = rascunho.id;
                if (!id) return;
                excluir.mutate({ id }, { onSuccess: () => setRascunho(null) });
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* --- peças comuns ------------------------------------------------------- */

function ListaVazia() {
  return (
    <p className="px-6 pb-4 text-sm text-muted-foreground">
      Nenhum item ainda. Enquanto as duas listas estiverem vazias, a seção não
      aparece no site — não é erro, é o comportamento certo: quadro de logotipo
      em branco parece site inacabado.
    </p>
  );
}

function Ordenar({
  indice,
  total,
  onMover,
  nome,
}: {
  indice: number;
  total: number;
  onMover: (indice: number, direcao: -1 | 1) => void;
  nome: string;
}) {
  return (
    <div className="flex flex-col">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6"
        aria-label={`Subir ${nome}`}
        disabled={indice === 0}
        onClick={() => onMover(indice, -1)}
      >
        <ChevronUp className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6"
        aria-label={`Descer ${nome}`}
        disabled={indice === total - 1}
        onClick={() => onMover(indice, 1)}
      >
        <ChevronDown className="size-3.5" />
      </Button>
    </div>
  );
}

function Acoes({
  salvando,
  podeExcluir,
  onSalvar,
  onCancelar,
  onExcluir,
}: {
  salvando: boolean;
  podeExcluir: boolean;
  onSalvar: () => void;
  onCancelar: () => void;
  onExcluir: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={salvando} onClick={onSalvar}>
        Salvar
      </Button>
      <Button variant="outline" onClick={onCancelar}>
        Cancelar
      </Button>
      {podeExcluir && (
        <Button
          variant="ghost"
          className="text-destructive"
          onClick={onExcluir}
        >
          <Trash2 className="size-4" />
          Excluir
        </Button>
      )}
    </div>
  );
}
