"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  INVITABLE_ROLES,
  INVITABLE_ROLE_VALUES,
  PAGE_PERMISSIONS,
  TRADE_ROLES,
  TRADE_ROLE_VALUES,
} from "@/lib/permissions";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useCreateInvitation } from "../hooks/use-invitations";

const inviteSchema = z.object({
  emails: z
    .array(z.email())
    .min(1, "Adicione ao menos um e-mail")
    .max(20, "No máximo 20 convites por vez"),
  role: z.enum(INVITABLE_ROLE_VALUES),
  // "nenhum" no lugar de null: o Select do Radix não aceita item de valor
  // vazio, e um sentinela explícito evita um estado intermediário indefinido.
  tradeRole: z.enum([...TRADE_ROLE_VALUES, "nenhum"]),
  permissions: z.array(z.string()),
});

type InviteForm = z.infer<typeof inviteSchema>;

// Separadores aceitos ao digitar ou colar uma lista de endereços.
const SEPARATORS = /[\s,;]+/;

export function InviteMemberDialog({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const createInvitation = useCreateInvitation();

  const form = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      emails: [],
      role: "member",
      tradeRole: "nenhum",
      permissions: [],
    },
  });

  const role = form.watch("role");
  const emails = form.watch("emails");

  useEffect(() => {
    if (!open) {
      form.reset();
      setDraft("");
      setDraftError(null);
    }
  }, [open, form]);

  /** Confirma o texto digitado como badge(s). Devolve o que sobrou inválido. */
  const commitDraft = (raw: string): void => {
    const candidates = raw.split(SEPARATORS).filter(Boolean);
    if (!candidates.length) return;

    const accepted: string[] = [];
    const rejected: string[] = [];

    for (const candidate of candidates) {
      const email = candidate.trim().toLowerCase();
      if (!z.email().safeParse(email).success) {
        rejected.push(candidate);
      } else if (!emails.includes(email) && !accepted.includes(email)) {
        accepted.push(email);
      }
    }

    if (accepted.length) {
      form.setValue("emails", [...emails, ...accepted], {
        shouldValidate: true,
      });
    }

    // O que não virou badge continua editável no input, com o motivo à vista.
    setDraft(rejected.join(" "));
    setDraftError(rejected.length ? "E-mail inválido" : null);
  };

  const removeEmail = (email: string) => {
    form.setValue(
      "emails",
      emails.filter((e) => e !== email),
      { shouldValidate: true },
    );
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === "," || event.key === ";") {
      // Enter confirma o e-mail; não submete o form ainda.
      event.preventDefault();
      commitDraft(draft);
      return;
    }
    // Backspace no campo vazio apaga o último badge.
    if (event.key === "Backspace" && !draft && emails.length) {
      event.preventDefault();
      removeEmail(emails[emails.length - 1]);
    }
  };

  const onSubmit = (data: InviteForm) => {
    const payload = {
      ...data,
      tradeRole: data.tradeRole === "nenhum" ? null : data.tradeRole,
    };
    createInvitation.mutate(payload, {
      onSuccess: ({ failed }) => {
        // Só fecha se tudo passou; senão o admin vê o que falhou.
        if (!failed.length) setOpen(false);
      },
    });
  };

  const isLoading = createInvitation.isPending;
  const emailsError = form.formState.errors.emails;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar membros</DialogTitle>
          <DialogDescription>
            Adicione um ou mais e-mails. Cada um recebe um link de convite que
            expira em 48 horas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="invite-email">E-mails</FieldLabel>

                {/* Caixa que imita o Input, com os badges dentro. O input
                    ocupa o espaço restante, então clicar na área vazia já
                    foca — sem precisar de handler num elemento não interativo. */}
                <div
                  className="flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 aria-invalid:border-destructive"
                  aria-invalid={!!emailsError || !!draftError}
                >
                  {emails.map((email) => (
                    <Badge key={email} variant="secondary" className="gap-1">
                      {email}
                      <button
                        type="button"
                        aria-label={`Remover ${email}`}
                        disabled={isLoading}
                        className="cursor-pointer rounded-full opacity-60 hover:opacity-100 disabled:cursor-not-allowed"
                        onClick={() => removeEmail(email)}
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}

                  <input
                    id="invite-email"
                    type="text"
                    inputMode="email"
                    autoComplete="off"
                    disabled={isLoading}
                    value={draft}
                    placeholder={
                      emails.length ? "" : "maria@empresa.com, joao@empresa.com"
                    }
                    className="min-w-[12ch] flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
                    onChange={(e) => {
                      setDraft(e.target.value);
                      setDraftError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    // Colar uma lista vira vários badges de uma vez.
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text");
                      if (SEPARATORS.test(text)) {
                        e.preventDefault();
                        commitDraft(text);
                      }
                    }}
                    // Sair do campo não pode perder o que foi digitado.
                    onBlur={() => commitDraft(draft)}
                  />
                </div>

                {draftError ? (
                  <p className="text-xs text-destructive">{draftError}</p>
                ) : emailsError ? (
                  <FieldError errors={[{ message: emailsError.message }]} />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Enter ou vírgula para adicionar. {emails.length}/20
                  </p>
                )}
              </Field>

              <Controller
                name="role"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Cargo</FieldLabel>
                    <Select
                      name={field.name}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger
                        id={field.name}
                        aria-invalid={fieldState.invalid}
                        disabled={isLoading}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INVITABLE_ROLES.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {
                        INVITABLE_ROLES.find((r) => r.value === field.value)
                          ?.description
                      }
                    </p>
                  </Field>
                )}
              />

              <Controller
                name="tradeRole"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Cargo no Trade</FieldLabel>
                    <Select
                      name={field.name}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger id={field.name} disabled={isLoading}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Nenhum</SelectItem>
                        {TRADE_ROLES.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {TRADE_ROLES.find((r) => r.value === field.value)
                        ?.description ??
                        "Função de campo. Não altera o acesso — quem define isso é o Cargo acima."}
                    </p>
                  </Field>
                )}
              />

              {role === "member" && (
                <Controller
                  name="permissions"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel>Páginas liberadas</FieldLabel>
                      <div className="grid grid-cols-2 gap-2">
                        {PAGE_PERMISSIONS.map((page) => {
                          const id = `invite-${page.key}`;
                          const checked = field.value.includes(page.key);
                          return (
                            <label
                              key={page.key}
                              htmlFor={id}
                              className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-accent"
                            >
                              <Checkbox
                                id={id}
                                checked={checked}
                                disabled={isLoading}
                                onCheckedChange={() =>
                                  field.onChange(
                                    checked
                                      ? field.value.filter(
                                          (k) => k !== page.key,
                                        )
                                      : [...field.value, page.key],
                                  )
                                }
                              />
                              <span className="truncate">{page.label}</span>
                            </label>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Vale para todos os convidados deste lote, aplicado no
                        aceite.
                      </p>
                    </Field>
                  )}
                />
              )}
            </FieldGroup>
          </div>

          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isLoading || !emails.length}>
              {isLoading && <Spinner />}
              {emails.length > 1
                ? `Enviar ${emails.length} convites`
                : "Enviar convite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
