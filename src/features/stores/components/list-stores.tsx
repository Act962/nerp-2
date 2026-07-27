"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EditIcon,
  ImageIcon,
  MapIcon,
  MapPinnedIcon,
  MoreVerticalIcon,
  QrCodeIcon,
  ScanBarcodeIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  StoreQrDialog,
  type StoreQrVariant,
} from "@/features/shopper/components/store-qr-dialog";
import { useStores } from "../hooks/use-stores";
import { DeleteStore } from "./delete-store";
import { StoreFormDialog } from "./store-form-dialog";

export function ListStores() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [qrStoreId, setQrStoreId] = useState("");
  const [qrVariant, setQrVariant] = useState<StoreQrVariant>("scanner");

  const { stores, isLoading } = useStores(search || undefined);

  return (
    <>
      <Card>
        <CardHeader>
          <InputGroup className="max-w-sm">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Buscar loja..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </InputGroup>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loja</TableHead>
                  <TableHead>Gerente</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead className="text-center">Mapas</TableHead>
                  <TableHead className="text-center">Fotos PDV</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: 3 }).map((_, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {Array.from({ length: 7 }).map((_, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                {!isLoading && stores.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      Nenhuma loja encontrada.
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading &&
                  stores.map((store) => (
                    <TableRow key={store.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{store.name}</span>
                          {store.code && (
                            <span className="font-mono text-xs text-muted-foreground">
                              {store.code}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{store.managerName || "—"}</TableCell>
                      <TableCell>
                        {store.city && store.state
                          ? `${store.city}/${store.state}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {store.floorPlansCount}
                      </TableCell>
                      <TableCell className="text-center">
                        {store.pdvPhotosCount}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={store.isActive ? "default" : "secondary"}
                        >
                          {store.isActive ? "Ativa" : "Inativa"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/lojas/${store.id}/mapa`}>
                              <MapIcon className="size-4" />
                              Mapa
                            </Link>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVerticalIcon className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/mapa/${store.id}`}
                                  target="_blank"
                                  rel="noopener"
                                >
                                  <MapPinnedIcon className="mr-2 size-4" />
                                  Visão do promotor
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/lojas/${store.id}`}>
                                  <ImageIcon className="mr-2 size-4" />
                                  Fotos do PDV
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setQrStoreId(store.id);
                                  setQrVariant("scanner");
                                }}
                              >
                                <ScanBarcodeIcon className="mr-2 size-4" />
                                QR code scanner
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setQrStoreId(store.id);
                                  setQrVariant("promotor");
                                }}
                              >
                                <QrCodeIcon className="mr-2 size-4" />
                                QR code promotor
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedId(store.id);
                                  setOpenEdit(true);
                                }}
                              >
                                <EditIcon className="mr-2 size-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => {
                                  setSelectedId(store.id);
                                  setOpenDelete(true);
                                }}
                              >
                                <Trash2Icon className="mr-2 size-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <StoreFormDialog
        open={openEdit}
        onOpenChange={setOpenEdit}
        storeId={selectedId}
      />
      <DeleteStore
        id={selectedId}
        open={openDelete}
        onOpenChange={setOpenDelete}
      />
      <StoreQrDialog
        open={!!qrStoreId}
        onOpenChange={(open) => !open && setQrStoreId("")}
        storeId={qrStoreId}
        variant={qrVariant}
      />
    </>
  );
}
