"use client";

import { Braces } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BOOK_VARIABLES, buildVariableToken } from "../../lib/book-variables";
import { EDITOR_BUTTON_CLASS } from "./editor-controls";

interface VariableMenuProps {
  // Recebe o token pronto ({{gerente}}); quem chama decide se insere no
  // elemento selecionado ou cria um texto novo.
  onInsert: (token: string) => void;
  // Variáveis de item só existem nas páginas de PDV — na capa não há item.
  allowItemScope: boolean;
  disabled?: boolean;
}

export function VariableMenu({
  onInsert,
  allowItemScope,
  disabled,
}: VariableMenuProps) {
  const available = BOOK_VARIABLES.filter(
    (variable) => allowItemScope || variable.scope === "book",
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={`gap-2 ${EDITOR_BUTTON_CLASS}`}
        >
          <Braces className="size-4" /> Variáveis
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-80 w-64 overflow-y-auto"
      >
        <DropdownMenuLabel className="text-xs">
          Insere no texto selecionado
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {available.map((variable, index) => {
          const previous = available[index - 1];
          return (
            <div key={variable.key}>
              {previous && previous.scope !== variable.scope && (
                <DropdownMenuSeparator />
              )}
              <DropdownMenuItem
                className="flex flex-col items-start gap-0.5 py-2.5"
                onSelect={() => onInsert(buildVariableToken(variable.key))}
              >
                <span className="text-sm">{variable.label}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {buildVariableToken(variable.key)}
                </span>
              </DropdownMenuItem>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
