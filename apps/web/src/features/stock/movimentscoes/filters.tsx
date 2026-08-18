import { Button } from "@/components/ui/button";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Check, ChevronsUpDown, Filter } from "lucide-react";
import { useQueryState } from "nuqs";
import { useState } from "react";
import z from "zod";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { UserBase } from "./list-movements";

const formFilterSchema = z.object({
  userIds: z.array(z.string()),
});
interface FilterMovimentsProps {
  members: UserBase[];
}

export function FilterMoviments({ members }: FilterMovimentsProps) {
  const [users, setUsers] = useQueryState("users");

  const [openProduct, setOpenProduct] = useState(false);
  const [modalOpen, setModalIsOpen] = useState(false);

  const form = useForm<z.infer<typeof formFilterSchema>>({
    resolver: zodResolver(formFilterSchema),
    defaultValues: {},
  });

  const handleApplyFilters = () => {
    if (form.getValues("userIds").length > 0) {
      const selectUsers = form.getValues("userIds");
      const usersSelected = members.filter((user) =>
        selectUsers.includes(user.id)
      );
      setUsers(usersSelected.map((user) => user.id).join(","));
    } else {
      setUsers(null);
    }

    setModalIsOpen(false);
  };

  const handleClearFilters = () => {
    form.reset({
      userIds: undefined,
    });
    setUsers(null);

    setModalIsOpen(false);
  };

  return (
    <Sheet open={modalOpen} onOpenChange={setModalIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Filter className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full px-4">
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>Filtre suas movimentações aqui</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-2">
          <Controller
            name="userIds"
            control={form.control}
            render={({ field }) => (
              <Field>
                <FieldLabel>Usuários</FieldLabel>
                <Popover open={openProduct} onOpenChange={setOpenProduct}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {field.value && field.value.length > 0 ? (
                        field.value.length === 1 ? (
                          members.find((cat) => cat.id === field.value[0])?.name
                        ) : (
                          `${field.value.length} usuários selecionados`
                        )
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          Selecione um usuário
                        </span>
                      )}
                      <ChevronsUpDown className="size-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0  w-full" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar produto..." />
                      <CommandList>
                        <CommandEmpty>Nenhum Usuário</CommandEmpty>
                        <CommandGroup>
                          {members.map((category) => (
                            <CommandItem
                              key={category.id}
                              value={`${category.name}-${category.id}`}
                              className="cursor-pointer"
                              onSelect={() => {
                                const currentValue = field.value || [];

                                if (currentValue.includes(category.id)) {
                                  field.onChange(
                                    currentValue.filter(
                                      (id) => id !== category.id
                                    )
                                  );
                                } else {
                                  field.onChange([
                                    ...currentValue,
                                    category.id,
                                  ]);
                                }

                                setOpenProduct(false);
                              }}
                            >
                              {field.value && (
                                <Check
                                  className={cn(
                                    "size-4",
                                    field.value.includes(category.id)
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                              )}
                              {category.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </Field>
            )}
          />
        </div>

        <SheetFooter>
          <Button type="submit" onClick={handleApplyFilters}>
            Aplicar
          </Button>
          <SheetClose asChild>
            <Button onClick={handleClearFilters} variant="outline">
              Limpar
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
