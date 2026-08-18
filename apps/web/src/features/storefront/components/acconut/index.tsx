"use client";

import { useCustomer } from "@/features/storefront/hooks/use-catalog-customer";
import { useUserStore } from "../../../../context/catalog/use-cart-session";
import { FormCustomer, FormEmpty, FormSkeleton } from "./form-user";

interface AccountPageProps {
  subdomain: string;
}

export function AccountPage({ subdomain }: AccountPageProps) {
  const { user } = useUserStore();

  const { data, isLoading } = useCustomer({
    email: user?.email ?? "",
    subdomain,
  });

  if (isLoading) {
    return <FormSkeleton />;
  }

  if (!data || !user) {
    return <FormEmpty />;
  }

  const { userCatalog } = data;

  const nameUser = userCatalog.name.split(" ")[0];

  return (
    <div>
      <div className="flex flex-row items-center justify-between py-4">
        <span className="text-xl font-bold">Olá, {nameUser}</span>
        {/* <Tabs>
          <TabsList>
            <TabsTrigger value="orders">Pedidos</TabsTrigger>
            <TabsTrigger value="account">Minha Conta</TabsTrigger>
            <TabsTrigger value="wishlist">Lista de Desejos</TabsTrigger>
          </TabsList>
          <TabsContent value="account"></TabsContent>
        </Tabs> */}
      </div>
      <FormCustomer
        customer={userCatalog}
        isFormCustomerLoading={isLoading}
        subdomain={subdomain}
      />
    </div>
  );
}
