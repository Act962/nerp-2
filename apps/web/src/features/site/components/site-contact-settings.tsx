"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { SiteSettings } from "@/app/router/site/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSaveSiteSettings, useSiteSettings } from "../hooks/use-site-admin";

type Social = { label: string; href: string };

/**
 * O contato do rodapé do site.
 *
 * Mora junto do painel "Sobre nós" porque é a mesma conversa: quem edita quem
 * somos edita também como falar com a gente. Grava em `site.settings`, que é
 * de onde o rodapé lê — campo vazio aqui devolve o valor que vem no código.
 */
export function SiteContactSettings() {
  const { settings, isLoading } = useSiteSettings();
  const save = useSaveSiteSettings();

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [social, setSocial] = useState<Social[]>([]);

  // O formulário só nasce quando o `get` responde: antes disso não há o resto
  // dos ajustes (números, WhatsApp) para mandar junto no save.
  useEffect(() => {
    if (!settings) return;
    setEmail(settings.contact.email);
    setPhone(settings.contact.phone);
    setSocial(settings.contact.social);
  }, [settings]);

  function updateSocial(index: number, patch: Partial<Social>) {
    setSocial(social.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contato</CardTitle>
        <p className="text-sm text-muted-foreground">
          O que aparece no rodapé do site. Campo em branco volta ao valor que já
          vem no código.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading && <Skeleton className="h-40" />}

        {!isLoading && settings && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="contato-email">E-mail</FieldLabel>
                <Input
                  id="contato-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="suporteorbitahub@gmail.com"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="contato-telefone">Telefone</FieldLabel>
                <Input
                  id="contato-telefone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+55 (86) 9489-2129"
                />
                <FieldDescription>
                  Aparece como está aqui; o link de ligar usa só os números.
                </FieldDescription>
              </Field>
            </div>

            <Field>
              <FieldLabel>Redes sociais</FieldLabel>
              <div className="flex flex-col gap-2">
                {social.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma rede cadastrada. Enquanto esta lista estiver vazia,
                    o rodapé usa as redes que vêm no código.
                  </p>
                )}
                {social.map((item, index) => (
                  // A linha não tem id estável — a posição é a identidade
                  // enquanto o nome ainda está sendo digitado.
                  <div
                    key={index}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <Input
                      className="w-36"
                      value={item.label}
                      onChange={(e) =>
                        updateSocial(index, { label: e.target.value })
                      }
                      placeholder="Instagram"
                      aria-label={`Nome da rede ${index + 1}`}
                    />
                    <Input
                      className="min-w-52 flex-1"
                      value={item.href}
                      onChange={(e) =>
                        updateSocial(index, { href: e.target.value })
                      }
                      placeholder="https://instagram.com/orbitahub.plataforma"
                      aria-label={`Endereço da rede ${index + 1}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      aria-label={`Remover ${item.label || "rede"}`}
                      onClick={() =>
                        setSocial(social.filter((_, i) => i !== index))
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1 self-start"
                onClick={() => setSocial([...social, { label: "", href: "" }])}
              >
                <Plus className="size-4" />
                Adicionar rede
              </Button>
              <FieldDescription>
                A ordem aqui é a ordem no rodapé. Endereço completo, com https.
              </FieldDescription>
            </Field>

            <div>
              <Button
                disabled={save.isPending}
                onClick={() => {
                  const next: SiteSettings = {
                    ...settings,
                    contact: {
                      email: email.trim(),
                      phone: phone.trim(),
                      // Linha em branco é rascunho de quem clicou em adicionar
                      // e desistiu: não vai para o rodapé.
                      social: social
                        .map((s) => ({
                          label: s.label.trim(),
                          href: s.href.trim(),
                        }))
                        .filter((s) => s.label && s.href),
                    },
                  };
                  save.mutate({ settings: next });
                }}
              >
                Salvar contato
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
