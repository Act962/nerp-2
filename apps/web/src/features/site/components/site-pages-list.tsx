"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCreatePage, useSitePages } from "../hooks/use-site-admin";
import { SECTION_LABEL, sitePath } from "../lib/section";
import { SitePageHeader } from "./site-page-header";

/** `CRM Tracking` → `crm-tracking`. */
function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function SitePagesList() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [section, setSection] =
    useState<keyof typeof SECTION_LABEL>("SOLUCOES");
  const router = useRouter();

  const { pages, isLoading } = useSitePages(search || undefined);
  const create = useCreatePage();

  return (
    <>
      <SitePageHeader
        title="Páginas"
        description="As páginas internas das soluções e dos segmentos. Sem página, o item do menu leva à órbita."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Nova página</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova página</DialogTitle>
              </DialogHeader>
              <Field>
                <FieldLabel htmlFor="new-title">Título</FieldLabel>
                <Input
                  id="new-title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setSlug(slugify(e.target.value));
                  }}
                  placeholder="CRM Tracking"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-section">Trecho do site</FieldLabel>
                <select
                  id="new-section"
                  className="h-9 rounded-md border bg-transparent px-3 text-sm"
                  value={section}
                  onChange={(e) =>
                    setSection(e.target.value as keyof typeof SECTION_LABEL)
                  }
                >
                  {Object.entries(SECTION_LABEL).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="new-slug">Endereço</FieldLabel>
                <Input
                  id="new-slug"
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                />
                <FieldDescription>
                  A página vai ficar em {sitePath(section, slug || "endereco")}.
                </FieldDescription>
              </Field>
              <Button
                disabled={!title || !slug || create.isPending}
                onClick={() =>
                  create.mutate(
                    { title, slug, section },
                    {
                      onSuccess: ({ id }) => {
                        setOpen(false);
                        setTitle("");
                        setSlug("");
                        router.push(`/site/paginas/${id}`);
                      },
                    },
                  )
                }
              >
                Criar e abrir
              </Button>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardHeader>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome…"
            className="max-w-sm"
          />
        </CardHeader>
        <CardContent className="px-0">
          {isLoading ? (
            <Skeleton className="mx-6 h-32" />
          ) : pages.length === 0 ? (
            <p className="px-6 pb-2 text-sm text-muted-foreground">
              Nenhuma página ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Página</TableHead>
                  <TableHead className="hidden sm:table-cell">Trecho</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Endereço
                  </TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((page) => (
                  <TableRow key={page.id}>
                    <TableCell className="font-medium">{page.title}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline">
                        {SECTION_LABEL[page.section]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {page.status === "PUBLISHED" ? (
                        <Badge variant="secondary">
                          {page.hasChanges
                            ? "publicada · com alterações"
                            : "publicada"}
                        </Badge>
                      ) : (
                        <Badge variant="outline">rascunho</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                      {sitePath(page.section, page.slug)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/site/paginas/${page.id}`}>Abrir</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
