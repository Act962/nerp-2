import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CatalogSettingsProps } from "./catalog";
import { Button } from "@/components/ui/button";
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
import { SubdomainDialog } from "@/components/modals/domain/subdomain-dialog";

interface DomainTabProps {
  settings: CatalogSettingsProps;
}

export function TabDomain({ settings }: DomainTabProps) {
  return (
    <div className="space-y-6 mt-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Domínio</h2>
        <p className="text-sm text-muted-foreground">
          Compartilhe esse link com seus clientes e em suas redes sociais para
          aumentar suas vendas
        </p>
      </div>

      <Card className="p-6">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="domain">Customizar domínio</Label>
            <SubdomainDialog />
            <p className="text-xs text-muted-foreground">
              Subdomínio do seu catálogo que seus clientes irão acessar
            </p>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2">
            <div className="space-y-2">
              <h3 className="text-md font-semibold text-foreground">
                Você já possui um site com domínio próprio?
              </h3>
              <p className="text-xs text-muted-foreground">
                Se você já possui um site para sua loja e deseja usa-lo como
                endereço para seu catálogo, clique no link abaixo para vincular
                o seu site ao seu catálogo
              </p>
              <div className="w-full flex justify-center items-center">
                <Dialog>
                  <form>
                    <DialogTrigger asChild>
                      <Button className="mt-4" variant={"outline"} disabled>
                        Configurar o meu domínio próprio
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-xl">
                      <DialogHeader>
                        <DialogTitle>
                          Configuração de domínio próprio
                        </DialogTitle>
                        <DialogDescription>
                          Comece nos informando qual o seu site. Este é o
                          endereço (URL) que você comprou com algum provedor de
                          domínio. EX:negociosbr.com.br
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-3">
                        <Label htmlFor="username-1">
                          Endereço (URL) do seu site
                        </Label>
                        <Input
                          id="username-1"
                          name="username"
                          placeholder="www.seudominio.com.br"
                        />
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">Cancelar</Button>
                        </DialogClose>
                        <Button type="submit">Salvar</Button>
                      </DialogFooter>
                    </DialogContent>
                  </form>
                </Dialog>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
