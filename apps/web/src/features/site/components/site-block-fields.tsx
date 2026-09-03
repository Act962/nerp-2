"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type SiteBlock,
  VIDEO_ASPECT_LABELS,
  VIDEO_LAYOUT_LABELS,
  VIDEO_SIDE_LABELS,
} from "@nerp/site-content";
import { SiteImagePicker } from "./site-image-picker";

/**
 * Os campos de um bloco. Um `switch` sobre o tipo em vez de um formulário
 * genérico dirigido por metadados: são onze blocos, cada um com o seu jeito, e
 * o genérico só esconderia isso atrás de uma camada a mais.
 */
export function SiteBlockFields({
  block,
  onChange,
}: {
  block: SiteBlock;
  onChange: (block: SiteBlock) => void;
}) {
  switch (block.type) {
    case "hero":
      return (
        <>
          <Text
            label="Chapéu"
            value={block.eyebrow}
            onChange={(eyebrow) => onChange({ ...block, eyebrow })}
          />
          <Area
            label="Título"
            value={block.title}
            onChange={(title) => onChange({ ...block, title })}
          />
          <Area
            label="Texto"
            value={block.text}
            onChange={(text) => onChange({ ...block, text })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Text
              label="Botão 1 — texto"
              value={block.primary.label}
              onChange={(label) =>
                onChange({ ...block, primary: { ...block.primary, label } })
              }
            />
            <Text
              label="Botão 1 — link"
              value={block.primary.href}
              onChange={(href) =>
                onChange({ ...block, primary: { ...block.primary, href } })
              }
            />
            <Text
              label="Botão 2 — texto"
              value={block.secondary.label}
              onChange={(label) =>
                onChange({ ...block, secondary: { ...block.secondary, label } })
              }
            />
            <Text
              label="Botão 2 — link"
              value={block.secondary.href}
              onChange={(href) =>
                onChange({ ...block, secondary: { ...block.secondary, href } })
              }
            />
          </div>
          <SiteImagePicker
            value={block.image.key}
            onChange={(key) =>
              onChange({ ...block, image: { ...block.image, key } })
            }
          />
          <HeroFrameFields block={block} onChange={onChange} />
        </>
      );

    case "statement":
      return (
        <>
          <Area
            label="Título"
            value={block.title}
            onChange={(title) => onChange({ ...block, title })}
          />
          <Area
            label="Texto"
            value={block.text}
            onChange={(text) => onChange({ ...block, text })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Text
              label="Botão — texto"
              value={block.cta.label}
              onChange={(label) =>
                onChange({ ...block, cta: { ...block.cta, label } })
              }
            />
            <Text
              label="Botão — link"
              value={block.cta.href}
              onChange={(href) =>
                onChange({ ...block, cta: { ...block.cta, href } })
              }
            />
          </div>
        </>
      );

    case "compare":
      return (
        <>
          <Text
            label="Título da seção"
            value={block.title}
            onChange={(title) => onChange({ ...block, title })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-3">
              <Text
                label="Cartão 1 — título"
                value={block.moreTitle}
                onChange={(moreTitle) => onChange({ ...block, moreTitle })}
              />
              <StringList
                label="Itens"
                items={block.more}
                onChange={(more) => onChange({ ...block, more })}
              />
            </div>
            <div className="flex flex-col gap-3">
              <Text
                label="Cartão 2 — título"
                value={block.lessTitle}
                onChange={(lessTitle) => onChange({ ...block, lessTitle })}
              />
              <StringList
                label="Itens"
                items={block.less}
                onChange={(less) => onChange({ ...block, less })}
              />
            </div>
          </div>
        </>
      );

    case "features":
      return (
        <>
          <Text
            label="Título da seção"
            value={block.title}
            onChange={(title) => onChange({ ...block, title })}
          />
          <div className="flex flex-col gap-3">
            {block.items.map((item, index) => (
              <div
                key={index}
                className="flex flex-col gap-2 rounded-lg border p-3"
              >
                <div className="flex items-center gap-2">
                  <Input
                    value={item.title}
                    placeholder="Nome da funcionalidade"
                    onChange={(e) => {
                      const items = [...block.items];
                      items[index] = { ...item, title: e.target.value };
                      onChange({ ...block, items });
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remover"
                    onClick={() =>
                      onChange({
                        ...block,
                        items: block.items.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <Textarea
                  rows={2}
                  value={item.text}
                  placeholder="O que ela faz, em uma frase"
                  onChange={(e) => {
                    const items = [...block.items];
                    items[index] = { ...item, text: e.target.value };
                    onChange({ ...block, items });
                  }}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...block,
                  items: [...block.items, { title: "", text: "" }],
                })
              }
            >
              <Plus className="size-4" />
              Adicionar funcionalidade
            </Button>
          </div>
        </>
      );

    case "split":
      return (
        <>
          <Area
            label="Título"
            value={block.title}
            onChange={(title) => onChange({ ...block, title })}
          />
          <StringList
            label="Parágrafos"
            items={block.paragraphs}
            multiline
            onChange={(paragraphs) => onChange({ ...block, paragraphs })}
          />
          <SiteImagePicker
            value={block.image.key}
            onChange={(key) =>
              onChange({ ...block, image: { ...block.image, key } })
            }
          />
          <Field>
            <FieldLabel htmlFor={`side-${block.id}`}>Lado da imagem</FieldLabel>
            <select
              id={`side-${block.id}`}
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
              value={block.imageSide}
              onChange={(e) =>
                onChange({
                  ...block,
                  imageSide: e.target.value as "left" | "right",
                })
              }
            >
              <option value="left">Esquerda</option>
              <option value="right">Direita</option>
            </select>
          </Field>
        </>
      );

    case "checklist":
      return (
        <>
          <Area
            label="Título"
            value={block.title}
            onChange={(title) => onChange({ ...block, title })}
          />
          <Text
            label="Fecho do título (em negrito)"
            value={block.titleStrong}
            onChange={(titleStrong) => onChange({ ...block, titleStrong })}
          />
          <Field>
            <FieldLabel>Imagem ao lado do título</FieldLabel>
            <FieldDescription>
              Opcional. Fica embaixo do título, à esquerda da chamada.
            </FieldDescription>
          </Field>
          <SiteImagePicker
            value={block.image.key}
            onChange={(key) =>
              onChange({ ...block, image: { ...block.image, key } })
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Text
              label="Chamada — texto"
              value={block.cta.label}
              onChange={(label) =>
                onChange({ ...block, cta: { ...block.cta, label } })
              }
            />
            <Text
              label="Chamada — link"
              value={block.cta.href}
              onChange={(href) =>
                onChange({ ...block, cta: { ...block.cta, href } })
              }
            />
          </div>
          <FieldDescription>
            Sem link, a chamada sai como texto simples.
          </FieldDescription>
          <StringList
            label="Itens da lista"
            items={block.items}
            multiline
            onChange={(items) => onChange({ ...block, items })}
          />
        </>
      );

    case "benefits":
      return (
        <>
          <Text
            label="Título da seção"
            value={block.title}
            onChange={(title) => onChange({ ...block, title })}
          />
          <div className="flex flex-col gap-3">
            {block.items.map((item, index) => (
              <div
                key={index}
                className="flex flex-col gap-2 rounded-lg border p-3"
              >
                <div className="flex items-center gap-2">
                  <Input
                    value={item.title}
                    placeholder="Título da vantagem"
                    onChange={(e) => {
                      const items = [...block.items];
                      items[index] = { ...item, title: e.target.value };
                      onChange({ ...block, items });
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remover"
                    onClick={() =>
                      onChange({
                        ...block,
                        items: block.items.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <Textarea
                  rows={3}
                  value={item.text}
                  placeholder="Por que isso importa, em um parágrafo"
                  onChange={(e) => {
                    const items = [...block.items];
                    items[index] = { ...item, text: e.target.value };
                    onChange({ ...block, items });
                  }}
                />
                <SiteImagePicker
                  value={item.icon.key}
                  onChange={(key) => {
                    const items = [...block.items];
                    items[index] = { ...item, icon: { ...item.icon, key } };
                    onChange({ ...block, items });
                  }}
                />
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onChange({
                ...block,
                items: [
                  ...block.items,
                  { icon: { key: "", alt: "" }, title: "", text: "" },
                ],
              })
            }
          >
            <Plus className="size-4" />
            Adicionar vantagem
          </Button>
        </>
      );

    case "steps":
      return (
        <>
          <Text
            label="Título da seção"
            value={block.title}
            onChange={(title) => onChange({ ...block, title })}
          />
          <Area
            label="Texto de apoio"
            value={block.text}
            onChange={(text) => onChange({ ...block, text })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.cycle}
              onChange={(e) => onChange({ ...block, cycle: e.target.checked })}
            />
            Desenhar em círculo, como um ciclo que recomeça
          </label>
          <div className="flex flex-col gap-3">
            {block.items.map((item, index) => (
              <div
                key={index}
                className="flex flex-col gap-2 rounded-lg border p-3"
              >
                <div className="flex items-center gap-2">
                  <Input
                    className="w-16"
                    value={item.mark}
                    placeholder="N"
                    aria-label="Marca da etapa"
                    onChange={(e) => {
                      const items = [...block.items];
                      items[index] = { ...item, mark: e.target.value };
                      onChange({ ...block, items });
                    }}
                  />
                  <Input
                    value={item.title}
                    placeholder="Nome da etapa"
                    onChange={(e) => {
                      const items = [...block.items];
                      items[index] = { ...item, title: e.target.value };
                      onChange({ ...block, items });
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remover"
                    onClick={() =>
                      onChange({
                        ...block,
                        items: block.items.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <Input
                  value={item.question}
                  placeholder="A pergunta central desta etapa"
                  onChange={(e) => {
                    const items = [...block.items];
                    items[index] = { ...item, question: e.target.value };
                    onChange({ ...block, items });
                  }}
                />
                <Textarea
                  rows={3}
                  value={item.text}
                  placeholder="O que acontece nesta etapa"
                  onChange={(e) => {
                    const items = [...block.items];
                    items[index] = { ...item, text: e.target.value };
                    onChange({ ...block, items });
                  }}
                />
                <StringList
                  label="Perguntas ou itens"
                  items={item.bullets}
                  onChange={(bullets) => {
                    const items = [...block.items];
                    items[index] = { ...item, bullets };
                    onChange({ ...block, items });
                  }}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...block,
                  items: [
                    ...block.items,
                    {
                      mark: "",
                      title: "",
                      question: "",
                      text: "",
                      bullets: [],
                    },
                  ],
                })
              }
            >
              <Plus className="size-4" />
              Adicionar etapa
            </Button>
          </div>
        </>
      );

    case "image":
      return (
        <>
          <Field>
            <FieldLabel>Imagem</FieldLabel>
            <FieldDescription>
              Sem imagem, o bloco não aparece na página.
            </FieldDescription>
          </Field>
          <SiteImagePicker
            value={block.image.key}
            onChange={(key) =>
              onChange({ ...block, image: { ...block.image, key } })
            }
          />
          <Text
            label="Texto alternativo"
            value={block.image.alt}
            onChange={(alt) =>
              onChange({ ...block, image: { ...block.image, alt } })
            }
          />
          <Escolha
            label="Aparelho envolvente"
            value={block.mockup ?? "nenhum"}
            options={{ nenhum: "Sem aparelho", iphone: "iPhone (retrato)" }}
            onChange={(mockup) =>
              onChange({ ...block, mockup: mockup as "nenhum" | "iphone" })
            }
            hint="A imagem entra dentro da tela do aparelho, encaixando pela proporção."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Escolha
              label="Recorte"
              value={block.fit ?? "contain"}
              options={{
                contain: "Inteira (mostra tudo)",
                cover: "Recortada (preenche a caixa)",
              }}
              onChange={(fit) =>
                onChange({ ...block, fit: fit as "contain" | "cover" })
              }
              hint='"Recortada" preenche a caixa e corta o que sobra.'
            />
            <Escolha
              label="Alinhamento"
              value={block.align ?? "center"}
              options={{
                left: "Esquerda",
                center: "Centro",
                right: "Direita",
              }}
              onChange={(align) =>
                onChange({
                  ...block,
                  align: align as "left" | "center" | "right",
                })
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`w-${block.id}`}>Largura (px)</FieldLabel>
              <Input
                id={`w-${block.id}`}
                type="number"
                min={50}
                max={2400}
                placeholder="automática"
                value={block.width ?? ""}
                onChange={(e) =>
                  onChange({
                    ...block,
                    width:
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`h-${block.id}`}>Altura (px)</FieldLabel>
              <Input
                id={`h-${block.id}`}
                type="number"
                min={50}
                max={2400}
                placeholder="automática"
                value={block.height ?? ""}
                onChange={(e) =>
                  onChange({
                    ...block,
                    height:
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                  })
                }
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor={`r-${block.id}`}>
              Cantos arredondados (px)
            </FieldLabel>
            <Input
              id={`r-${block.id}`}
              type="number"
              min={0}
              max={9999}
              value={block.radius ?? 0}
              onChange={(e) =>
                onChange({
                  ...block,
                  radius: e.target.value === "" ? 0 : Number(e.target.value),
                })
              }
            />
            <FieldDescription>
              0 quadrado. Valor alto (ex.: 9999) vira círculo/pílula.
            </FieldDescription>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`bw-${block.id}`}>Contorno (px)</FieldLabel>
              <Input
                id={`bw-${block.id}`}
                type="number"
                min={0}
                max={20}
                value={block.border?.width ?? 0}
                onChange={(e) =>
                  onChange({
                    ...block,
                    border: {
                      color: block.border?.color ?? "#000000",
                      width: e.target.value === "" ? 0 : Number(e.target.value),
                    },
                  })
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`bc-${block.id}`}>
                Cor do contorno
              </FieldLabel>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Cor do contorno"
                  value={block.border?.color ?? "#000000"}
                  onChange={(e) =>
                    onChange({
                      ...block,
                      border: {
                        width: block.border?.width ?? 0,
                        color: e.target.value,
                      },
                    })
                  }
                  className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
                />
                <Input
                  id={`bc-${block.id}`}
                  value={block.border?.color ?? "#000000"}
                  onChange={(e) =>
                    onChange({
                      ...block,
                      border: {
                        width: block.border?.width ?? 0,
                        color: e.target.value,
                      },
                    })
                  }
                  className="font-mono"
                />
              </div>
            </Field>
          </div>
        </>
      );

    case "video":
      return (
        <>
          <Text
            label="Título"
            value={block.title}
            onChange={(title) => onChange({ ...block, title })}
          />
          <Area
            label="Texto"
            value={block.text}
            onChange={(text) => onChange({ ...block, text })}
          />
          <Field>
            <FieldLabel htmlFor={`yt-${block.id}`}>
              Endereço do YouTube
            </FieldLabel>
            <Input
              id={`yt-${block.id}`}
              value={block.youtubeUrl}
              onChange={(e) =>
                onChange({ ...block, youtubeUrl: e.target.value })
              }
              placeholder="https://youtu.be/…"
            />
            <FieldDescription>
              Vazio: a seção não aparece na página.
            </FieldDescription>
          </Field>
          <Escolha
            label="Arranjo"
            value={block.layout ?? "painel"}
            options={VIDEO_LAYOUT_LABELS}
            onChange={(layout) =>
              onChange({ ...block, layout: layout as "painel" | "lado" })
            }
            hint="No lado a lado o painel azul sai e vale o fundo do bloco."
          />
          {(block.layout ?? "painel") === "lado" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Escolha
                label="Posição do vídeo"
                value={block.videoSide ?? "left"}
                options={VIDEO_SIDE_LABELS}
                onChange={(videoSide) =>
                  onChange({
                    ...block,
                    videoSide: videoSide as "left" | "right",
                  })
                }
              />
              <Escolha
                label="Proporção"
                value={block.aspect ?? "16/9"}
                options={VIDEO_ASPECT_LABELS}
                onChange={(aspect) =>
                  onChange({
                    ...block,
                    aspect: aspect as "16/9" | "4/3" | "1/1",
                  })
                }
              />
            </div>
          )}
        </>
      );

    case "clients":
      return (
        <>
          <Text
            label="Título"
            value={block.title}
            onChange={(title) => onChange({ ...block, title })}
          />
          <div className="flex flex-col gap-3">
            {block.logos.map((logo, index) => (
              <div
                key={index}
                className="flex items-end gap-2 rounded-lg border p-3"
              >
                <div className="flex-1">
                  <SiteImagePicker
                    label={`Logo ${index + 1}`}
                    value={logo.key}
                    onChange={(key) => {
                      const logos = [...block.logos];
                      logos[index] = { ...logo, key };
                      onChange({ ...block, logos });
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remover"
                  onClick={() =>
                    onChange({
                      ...block,
                      logos: block.logos.filter((_, i) => i !== index),
                    })
                  }
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...block,
                  logos: [...block.logos, { key: "", alt: "" }],
                })
              }
            >
              <Plus className="size-4" />
              Adicionar logo
            </Button>
          </div>
        </>
      );

    case "contact":
      return (
        <>
          <Text
            label="Título"
            value={block.title}
            onChange={(title) => onChange({ ...block, title })}
          />
          <div className="flex flex-col gap-3">
            {block.options.map((option, index) => (
              <div
                key={index}
                className="flex flex-wrap items-center gap-2 rounded-lg border p-3"
              >
                <select
                  className="h-9 rounded-md border bg-transparent px-3 text-sm"
                  value={option.kind}
                  onChange={(e) => {
                    const options = [...block.options];
                    options[index] = {
                      ...option,
                      kind: e.target.value as "phone" | "whatsapp" | "callback",
                    };
                    onChange({ ...block, options });
                  }}
                >
                  <option value="phone">Telefone</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="callback">Ligamos para você</option>
                </select>
                <Input
                  className="min-w-40 flex-1"
                  value={option.label}
                  placeholder="Texto"
                  onChange={(e) => {
                    const options = [...block.options];
                    options[index] = { ...option, label: e.target.value };
                    onChange({ ...block, options });
                  }}
                />
                <Input
                  className="min-w-40 flex-1"
                  value={option.href}
                  placeholder="Link"
                  onChange={(e) => {
                    const options = [...block.options];
                    options[index] = { ...option, href: e.target.value };
                    onChange({ ...block, options });
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remover"
                  onClick={() =>
                    onChange({
                      ...block,
                      options: block.options.filter((_, i) => i !== index),
                    })
                  }
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...block,
                  options: [
                    ...block.options,
                    { kind: "whatsapp", label: "", href: "" },
                  ],
                })
              }
            >
              <Plus className="size-4" />
              Adicionar forma de contato
            </Button>
          </div>
        </>
      );
  }
}

function Text({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = `f-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function Area({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = `a-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea
        id={id}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

/** Um select simples a partir de um mapa valor → rótulo. */
function Escolha({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  options: Record<string, string>;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(options).map(([valor, rotulo]) => (
            <SelectItem key={valor} value={valor}>
              {rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  );
}

type HeroBlock = Extract<SiteBlock, { type: "hero" }>;

/**
 * A "caixa" do herói: margem externa, cantos independentes e borda.
 *
 * Fica atrás de um `<details>` porque é ajuste fino — o operador comum não
 * mexe, e aberto por padrão empurraria os campos de conteúdo para fora.
 * O helper `comFrame` completa o objeto por causa dos `default` no schema:
 * tipo lido do banco traz os campos como obrigatórios e `spread` parcial não
 * satisfaz.
 */
type HeroFrame = NonNullable<HeroBlock["frame"]>;

function comFrame(
  atual: HeroFrame | undefined,
  patch: Partial<HeroFrame>,
): HeroFrame {
  const base: HeroFrame = atual ?? {
    inset: 0,
    radius: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
    border: { width: 0, color: "#000000" },
  };
  return { ...base, ...patch };
}

function HeroFrameFields({
  block,
  onChange,
}: {
  block: HeroBlock;
  onChange: (block: HeroBlock) => void;
}) {
  const frame = block.frame;
  const setFrame = (patch: Partial<HeroFrame>) =>
    onChange({ ...block, frame: comFrame(frame, patch) });

  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Caixa do herói (margem, cantos, borda)
      </summary>
      <div className="mt-3 flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor={`inset-${block.id}`}>
            Margem externa (px)
          </FieldLabel>
          <Input
            id={`inset-${block.id}`}
            type="number"
            min={0}
            max={200}
            value={frame?.inset ?? 0}
            onChange={(e) =>
              setFrame({
                inset: e.target.value === "" ? 0 : Number(e.target.value),
              })
            }
          />
          <FieldDescription>
            Descola a caixa das bordas da faixa. 0 = colado.
          </FieldDescription>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <CantoInput
            label="Canto sup. esquerdo"
            value={frame?.radius.topLeft ?? 0}
            onChange={(v) =>
              setFrame({
                radius: {
                  ...(frame?.radius ?? {
                    topLeft: 0,
                    topRight: 0,
                    bottomRight: 0,
                    bottomLeft: 0,
                  }),
                  topLeft: v,
                },
              })
            }
          />
          <CantoInput
            label="Canto sup. direito"
            value={frame?.radius.topRight ?? 0}
            onChange={(v) =>
              setFrame({
                radius: {
                  ...(frame?.radius ?? {
                    topLeft: 0,
                    topRight: 0,
                    bottomRight: 0,
                    bottomLeft: 0,
                  }),
                  topRight: v,
                },
              })
            }
          />
          <CantoInput
            label="Canto inf. esquerdo"
            value={frame?.radius.bottomLeft ?? 0}
            onChange={(v) =>
              setFrame({
                radius: {
                  ...(frame?.radius ?? {
                    topLeft: 0,
                    topRight: 0,
                    bottomRight: 0,
                    bottomLeft: 0,
                  }),
                  bottomLeft: v,
                },
              })
            }
          />
          <CantoInput
            label="Canto inf. direito"
            value={frame?.radius.bottomRight ?? 0}
            onChange={(v) =>
              setFrame({
                radius: {
                  ...(frame?.radius ?? {
                    topLeft: 0,
                    topRight: 0,
                    bottomRight: 0,
                    bottomLeft: 0,
                  }),
                  bottomRight: v,
                },
              })
            }
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`bw-${block.id}`}>Borda (px)</FieldLabel>
            <Input
              id={`bw-${block.id}`}
              type="number"
              min={0}
              max={20}
              value={frame?.border.width ?? 0}
              onChange={(e) =>
                setFrame({
                  border: {
                    width: e.target.value === "" ? 0 : Number(e.target.value),
                    color: frame?.border.color ?? "#000000",
                  },
                })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`bc-${block.id}`}>Cor da borda</FieldLabel>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Cor da borda"
                value={frame?.border.color ?? "#000000"}
                onChange={(e) =>
                  setFrame({
                    border: {
                      width: frame?.border.width ?? 0,
                      color: e.target.value,
                    },
                  })
                }
                className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
              />
              <Input
                id={`bc-${block.id}`}
                value={frame?.border.color ?? "#000000"}
                onChange={(e) =>
                  setFrame({
                    border: {
                      width: frame?.border.width ?? 0,
                      color: e.target.value,
                    },
                  })
                }
                className="font-mono"
              />
            </div>
          </Field>
        </div>
      </div>
    </details>
  );
}

function CantoInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Field>
      <FieldLabel>{label} (px)</FieldLabel>
      <Input
        type="number"
        min={0}
        max={200}
        value={value}
        onChange={(e) =>
          onChange(e.target.value === "" ? 0 : Number(e.target.value))
        }
      />
    </Field>
  );
}

function StringList({
  label,
  items,
  onChange,
  multiline = false,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {multiline ? (
            <Textarea
              rows={2}
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[index] = e.target.value;
                onChange(next);
              }}
            />
          ) : (
            <Input
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[index] = e.target.value;
                onChange(next);
              }}
            />
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remover"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, ""])}
      >
        <Plus className="size-4" />
        Adicionar
      </Button>
    </div>
  );
}
