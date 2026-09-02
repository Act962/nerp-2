"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  useInviteAccess,
  useRemoveAccess,
  useSiteAccess,
} from "../hooks/use-site-admin";
import { SitePageHeader } from "./site-page-header";

const ROLE_LABEL = {
  SUPER_ADMIN: "Super admin",
  EDITOR: "Editor",
  REDATOR: "Redator",
} as const;

const ROLE_HINT = {
  SUPER_ADMIN: "Tudo, inclusive acessos",
  EDITOR: "Menu, páginas e mídia",
  REDATOR: "Só texto e imagem das páginas",
} as const;

export function SiteAccess() {
  const { admins, superAdminEmail, isLoading } = useSiteAccess();
  const invite = useInviteAccess();
  const remove = useRemoveAccess();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"EDITOR" | "REDATOR">("EDITOR");

  return (
    <>
      <SitePageHeader
        title="Acessos"
        description="Quem entra no admin do site. Só o super admin mexe nesta tela."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Convidar por e-mail</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dar acesso ao admin do site</DialogTitle>
              </DialogHeader>
              <Field>
                <FieldLabel htmlFor="invite-email">E-mail</FieldLabel>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <FieldDescription>
                  O acesso vale a partir do momento em que a pessoa entrar com
                  esse e-mail. Se ela ainda não tiver conta, basta criar uma.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="invite-name">Nome</FieldLabel>
                <Input
                  id="invite-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="invite-role">Papel</FieldLabel>
                <select
                  id="invite-role"
                  className="h-9 rounded-md border bg-transparent px-3 text-sm"
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as "EDITOR" | "REDATOR")
                  }
                >
                  <option value="EDITOR">Editor — {ROLE_HINT.EDITOR}</option>
                  <option value="REDATOR">Redator — {ROLE_HINT.REDATOR}</option>
                </select>
              </Field>
              <Button
                disabled={!email || invite.isPending}
                onClick={() =>
                  invite.mutate(
                    { email, name, role },
                    {
                      onSuccess: () => {
                        setOpen(false);
                        setEmail("");
                        setName("");
                      },
                    },
                  )
                }
              >
                Liberar acesso
              </Button>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="px-0">
          {isLoading ? (
            <Skeleton className="mx-6 h-32" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead className="hidden md:table-cell">Pode</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <span className="block text-sm font-medium">
                      {superAdminEmail}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      super admin do site
                    </span>
                  </TableCell>
                  <TableCell>{ROLE_LABEL.SUPER_ADMIN}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {ROLE_HINT.SUPER_ADMIN}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">fixo</Badge>
                  </TableCell>
                </TableRow>

                {admins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell>
                      <span className="block text-sm font-medium">
                        {admin.name ?? admin.email}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {admin.name ? admin.email : null}
                        {!admin.hasAccount && " · ainda não entrou"}
                      </span>
                    </TableCell>
                    <TableCell>{ROLE_LABEL[admin.role]}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {ROLE_HINT[admin.role]}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remover ${admin.email}`}
                        onClick={() => remove.mutate({ id: admin.id })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 max-w-prose text-sm text-muted-foreground">
        O super admin vem da variável <code>SITE_SUPER_ADMIN_EMAIL</code> e não
        pode ser removido nem rebaixado por esta tela. Quem não estiver aqui não
        vê o admin: a rota redireciona antes de renderizar.
      </p>
    </>
  );
}
