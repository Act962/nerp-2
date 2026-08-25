"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useCreateDirectoryCompany } from "../hooks/use-directory";

type CompanyType = "SUPERMERCADO" | "INDUSTRIA" | "DISTRIBUIDOR";

const TYPE_OPTIONS: { value: CompanyType; label: string }[] = [
  { value: "SUPERMERCADO", label: "Supermercado" },
  { value: "INDUSTRIA", label: "Indústria" },
  { value: "DISTRIBUIDOR", label: "Distribuidor" },
];

export function DirectoryCompanyFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateDirectoryCompany();
  const [type, setType] = useState<CompanyType>("SUPERMERCADO");
  const [name, setName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [document, setDocument] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [website, setWebsite] = useState("");

  useEffect(() => {
    if (!open) return;
    setType("SUPERMERCADO");
    setName("");
    setTradeName("");
    setDocument("");
    setCity("");
    setState("");
    setWebsite("");
  }, [open]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) {
      toast.error("Informe o nome da empresa");
      return;
    }
    create.mutate(
      {
        type,
        name: name.trim(),
        tradeName: tradeName.trim() || undefined,
        document: document.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        website: website.trim() || undefined,
      },
      {
        onSuccess: (result) => {
          toast.success(
            result.deduped
              ? "Empresa já existia no diretório (CNPJ)"
              : "Empresa adicionada ao diretório",
          );
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar empresa ao diretório</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="company-type">Tipo</Label>
            <Select
              value={type}
              onValueChange={(value) => setType(value as CompanyType)}
            >
              <SelectTrigger id="company-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company-name">Nome *</Label>
            <Input
              id="company-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Razão social ou nome"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company-trade">Nome fantasia</Label>
            <Input
              id="company-trade"
              value={tradeName}
              onChange={(event) => setTradeName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company-doc">CNPJ</Label>
            <Input
              id="company-doc"
              value={document}
              onChange={(event) => setDocument(event.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="company-city">Cidade</Label>
              <Input
                id="company-city"
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company-state">UF</Label>
              <Input
                id="company-state"
                value={state}
                onChange={(event) => setState(event.target.value)}
                maxLength={2}
                placeholder="SP"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Spinner />}
              Adicionar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
