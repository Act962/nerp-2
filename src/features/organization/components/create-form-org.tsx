"use client";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import z from "zod";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarketSizeRibbon } from "@/features/tradegram/components/market-size-ribbon";
import { SEGMENT_HINTS, SEGMENT_LABELS } from "@/lib/org-segment";

const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

const createOrgSchema = z.object({
  name: z.string().min(1, ""),
  slug: z.string().min(1, "Slug é obrigatório"),
  logo: z.string().optional(),
  // O segmento redesenha o menu; a UF é o que faz o cadastro mostrar o tamanho
  // do mercado da praça da pessoa. CNPJ fica de fora de propósito — ver
  // `org.updateProfile`.
  segment: z.enum(["VAREJO", "INDUSTRIA", "DISTRIBUIDOR"]),
  state: z.string().length(2, "Informe a UF"),
  city: z.string().trim().max(120).optional(),
});

type CreateOrgSchema = z.infer<typeof createOrgSchema>;

export function CreateFormOrg({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const form = useForm<CreateOrgSchema>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      name: "",
      slug: "",
      logo: "",
      segment: "VAREJO",
      state: "",
      city: "",
    },
  });

  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const isFirstRender = useRef(true);
  const router = useRouter();
  const queryClient = useQueryClient();

  const name = form.watch("name");
  const logo = form.watch("logo");

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const slug = createSlug(e.target.value);
    form.setValue("slug", slug, { shouldValidate: true });
    setIsSlugManuallyEdited(true);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      form.setValue("logo", reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  function createSlug(text: string): string {
    if (!text) return "";

    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  const mutationCreateSettingsCatalog = useMutation(
    orpc.catalogSettings.create.mutationOptions(),
  );

  const onSubmit = async (formData: CreateOrgSchema) => {
    const { data } = await authClient.organization.checkSlug({
      slug: formData.slug,
    });

    if (!data?.status) {
      toast.error("Esse slug já está em uso");
      return;
    }

    const metadata = { name: formData.name, createdAt: new Date() };

    const { data: organization, error } = await authClient.organization.create({
      name: formData.name,
      slug: formData.slug,
      logo: formData.logo,
      metadata,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    await authClient.organization.setActive({
      organizationId: organization.id,
      organizationSlug: organization.slug,
    });

    // Mesma razão do trocador de org na sidebar: sem isto, quem já tinha
    // outra organização ativa levaria dados dela pro cache da recém-criada.
    queryClient.clear();

    // `await`, não fire-and-forget: se o perfil não gravar, a pessoa precisa
    // saber — redirecionar por cima de um erro engolido é o que faz uma
    // organização nascer sem segmento e ninguém descobrir.
    try {
      await orpc.org.updateProfile.call({
        segment: formData.segment,
        state: formData.state,
        city: formData.city || null,
        seedModules: true,
      });
    } catch {
      toast.error(
        "Organização criada, mas o perfil não foi salvo. Ajuste em Configurações.",
      );
      return;
    }

    mutationCreateSettingsCatalog.mutate({
      name: name,
    });

    toast.success("Organização criada com sucesso");
    // O diretório, não o dashboard: é a única tela que já mostra o mercado, e
    // dashboard de organização recém-criada é o pior primeiro contato possível.
    router.push("/trade/diretorio");
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (!isSlugManuallyEdited && name) {
      const slug = createSlug(name);
      form.setValue("slug", slug, { shouldValidate: true });
    }
  }, [name, isSlugManuallyEdited, form.setValue]);

  const isLoading = form.formState.isSubmitting;

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Crie sua organização</CardTitle>
          <CardDescription>
            Insira os dados abaixo para criar sua organização
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Nome da Organização</FieldLabel>
                <Input
                  id="name"
                  disabled={isLoading}
                  {...form.register("name")}
                  placeholder="Empresa de Vendas"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="slug">Slug</FieldLabel>
                <Input
                  id="slug"
                  disabled={isLoading}
                  {...form.register("slug")}
                  onChange={handleSlugChange}
                  placeholder="empresa-de-vendas"
                />
              </Field>

              {/* Três cartões, não um <Select>: é a pergunta que redesenha o
                produto inteiro, e merece o espaço visual. */}
              <Field>
                <FieldLabel>O que a sua empresa é?</FieldLabel>
                <Controller
                  control={form.control}
                  name="segment"
                  render={({ field }) => (
                    <div className="grid gap-2 sm:grid-cols-3">
                      {(["VAREJO", "INDUSTRIA", "DISTRIBUIDOR"] as const).map(
                        (value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => field.onChange(value)}
                            className={`rounded-lg border p-3 text-left transition ${
                              field.value === value
                                ? "border-primary bg-accent"
                                : "hover:bg-accent/50"
                            }`}
                          >
                            <span className="block text-sm font-medium">
                              {SEGMENT_LABELS[value]}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {SEGMENT_HINTS[value]}
                            </span>
                          </button>
                        ),
                      )}
                    </div>
                  )}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
                <Field>
                  <FieldLabel htmlFor="state">UF</FieldLabel>
                  <Controller
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isLoading}
                      >
                        <SelectTrigger id="state">
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                        <SelectContent>
                          {UFS.map((uf) => (
                            <SelectItem key={uf} value={uf}>
                              {uf}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="city">Cidade</FieldLabel>
                  <Input
                    id="city"
                    disabled={isLoading}
                    {...form.register("city")}
                    placeholder="Teresina"
                  />
                </Field>
              </div>

              {/* O argumento de venda no instante exato da decisão. */}
              <MarketSizeRibbon
                state={form.watch("state") || null}
                city={form.watch("city") || null}
              />

              <Field>
                <FieldLabel htmlFor="logo">Logo</FieldLabel>
                <Input
                  id="logo"
                  type="file"
                  disabled={isLoading}
                  accept="image/*"
                  onChange={handleLogoChange}
                />
                {logo && (
                  <div className="mt-2 relative group w-24 h-24 max-w-24">
                    <Image
                      src={logo}
                      alt="Logo da organização"
                      fill
                      className="rounded-md object-cover"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100"
                      onClick={() => form.setValue("logo", "")}
                    >
                      <XCircle />
                    </Button>
                  </div>
                )}
              </Field>
              <Field>
                <Button type="submit" disabled={isLoading}>
                  Criar
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
