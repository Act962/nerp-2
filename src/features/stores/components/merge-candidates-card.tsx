"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { GitMerge } from "lucide-react";
import { useState } from "react";
import {
  useMergeCandidates,
  useMergeStoreWithDirectory,
} from "../hooks/use-stores";

/**
 * Card "N lojas para mesclar": lojas da org que, pela localização, são a mesma
 * do diretório Tradegram mas com nome diferente. Mesclar adota o nome canônico
 * e vincula ao diretório — mantendo o id da loja (as fotos ficam intactas).
 */
export function MergeCandidatesCard() {
  const { candidates, isLoading } = useMergeCandidates();
  const merge = useMergeStoreWithDirectory();
  const [open, setOpen] = useState(false);

  if (isLoading || candidates.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-left transition-colors hover:bg-amber-100 dark:bg-amber-950/40"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-amber-500 text-white">
          <GitMerge className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block font-medium text-amber-900 dark:text-amber-200">
            {candidates.length} loja{candidates.length === 1 ? "" : "s"} para
            mesclar
          </span>
          <span className="block text-sm text-amber-800/80 dark:text-amber-200/80">
            No mesmo local de uma loja do Tradegram, mas com nome diferente.
          </span>
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Lojas para mesclar</DialogTitle>
            <DialogDescription>
              Mesclar adota o nome do Tradegram e liga a loja ao diretório. A
              loja continua a mesma — as fotos não são afetadas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {candidates.map((c) => (
              <div
                key={c.storeId}
                className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.storeName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    → «{c.directoryName}»
                    {c.directoryCity ? ` · ${c.directoryCity}` : ""} · a{" "}
                    {c.distanceM} m
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  disabled={merge.isPending}
                  onClick={() =>
                    merge.mutate({
                      storeId: c.storeId,
                      directoryStoreId: c.directoryStoreId,
                    })
                  }
                >
                  {merge.isPending ? (
                    <Spinner />
                  ) : (
                    <GitMerge className="size-4" />
                  )}
                  Mesclar
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
