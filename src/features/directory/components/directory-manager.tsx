"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { BadgeCheck, Building2, Plus, Search } from "lucide-react";
import { useState } from "react";
import { useDirectorySearch } from "../hooks/use-directory";
import { DirectoryClaimDialog } from "./directory-claim-dialog";
import { DirectoryCompanyFormDialog } from "./directory-company-form-dialog";

type CompanyType = "SUPERMERCADO" | "INDUSTRIA" | "DISTRIBUIDOR";
type ClaimedFilter = "all" | "claimed" | "unclaimed";

const TYPE_LABEL: Record<CompanyType, string> = {
  SUPERMERCADO: "Supermercado",
  INDUSTRIA: "Indústria",
  DISTRIBUIDOR: "Distribuidor",
};

export function DirectoryManager() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<CompanyType | "all">("all");
  const [claimed, setClaimed] = useState<ClaimedFilter>("all");
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data, isLoading } = useDirectorySearch({
    q: debouncedSearch,
    type: type === "all" ? undefined : type,
    claimed,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [claimFor, setClaimFor] = useState<{ id: string; name: string } | null>(
    null,
  );

  const companies = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="-translate-y-1/2 absolute top-1/2 left-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar empresa, CNPJ, cidade…"
            className="pl-8"
          />
        </div>
        <Select value={type} onValueChange={(value) => setType(value as never)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="SUPERMERCADO">Supermercados</SelectItem>
            <SelectItem value="INDUSTRIA">Indústrias</SelectItem>
            <SelectItem value="DISTRIBUIDOR">Distribuidores</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={claimed}
          onValueChange={(value) => setClaimed(value as ClaimedFilter)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="unclaimed">Livres</SelectItem>
            <SelectItem value="claimed">Reivindicadas</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" onClick={() => setFormOpen(true)}>
          <Plus className="size-4" /> Adicionar
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : companies.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
          Nenhuma empresa encontrada. Adicione uma para começar a montar a base.
        </div>
      ) : (
        <div className="space-y-2">
          {companies.map((company) => (
            <Card key={company.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Building2 className="size-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {company.name}
                      </span>
                      <Badge variant="secondary" className="whitespace-nowrap">
                        {TYPE_LABEL[company.type]}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground text-xs">
                      {company.document && <span>{company.document}</span>}
                      {(company.city || company.state) && (
                        <span>
                          {[company.city, company.state]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {company.isMine ? (
                    <Badge className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700">
                      <BadgeCheck className="size-3.5" /> Sua empresa
                    </Badge>
                  ) : company.isClaimed ? (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">
                        {company.claimedByName}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setClaimFor({ id: company.id, name: company.name })
                        }
                      >
                        Contestar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        setClaimFor({ id: company.id, name: company.name })
                      }
                    >
                      Reivindicar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DirectoryCompanyFormDialog open={formOpen} onOpenChange={setFormOpen} />
      {claimFor && (
        <DirectoryClaimDialog
          companyId={claimFor.id}
          companyName={claimFor.name}
          open={Boolean(claimFor)}
          onOpenChange={(open) => {
            if (!open) setClaimFor(null);
          }}
        />
      )}
    </div>
  );
}
