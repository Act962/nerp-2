"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import type { SiteBlock } from "../blocks";
import { SiteImagePicker } from "./site-image-picker";

/**
 * Os campos de um bloco. Um `switch` sobre o tipo em vez de um formulário
 * genérico dirigido por metadados: são oito blocos, cada um com o seu jeito, e
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
