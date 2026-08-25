import { PERSON_TYPE_LABELS, PERSON_TYPE_OPTIONS } from "@/schemas/customer";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { PersonType } from "@/schemas/customer";

interface PersonTypeSelectProps {
  value?: PersonType;
  onChange: (value: PersonType) => void;
}

export function PersonTypeSelect({ value, onChange }: PersonTypeSelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between"
        >
          <span className="text-muted-foreground text-sm">
            {value ? PERSON_TYPE_LABELS[value] : "Selecione um tipo de pessoa"}
          </span>
          <ChevronsUpDown className="size-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="p-0 w-full" align="start">
        <Command>
          <CommandInput placeholder="Buscar tipo..." />
          <CommandList>
            <CommandEmpty>Nenhum tipo encontrado</CommandEmpty>
            <CommandGroup>
              {PERSON_TYPE_OPTIONS.map((item) => (
                <CommandItem
                  key={item.value}
                  onSelect={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
