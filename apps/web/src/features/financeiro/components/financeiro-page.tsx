"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountsTab } from "./accounts-tab";
import { CashflowTab } from "./cashflow-tab";
import { CategoriesTab } from "./categories-tab";
import { ContactsTab } from "./contacts-tab";
import { DashboardTab } from "./dashboard-tab";
import { EntriesTab } from "./entries-tab";

export function FinanceiroPage() {
  return (
    <Tabs defaultValue="dashboard" className="w-full">
      <TabsList className="flex-wrap">
        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        <TabsTrigger value="entries">Lançamentos</TabsTrigger>
        <TabsTrigger value="cashflow">Fluxo de Caixa</TabsTrigger>
        <TabsTrigger value="accounts">Contas</TabsTrigger>
        <TabsTrigger value="categories">Categorias</TabsTrigger>
        <TabsTrigger value="contacts">Contatos</TabsTrigger>
      </TabsList>
      <TabsContent value="dashboard" className="mt-6">
        <DashboardTab />
      </TabsContent>
      <TabsContent value="entries" className="mt-6">
        <EntriesTab />
      </TabsContent>
      <TabsContent value="cashflow" className="mt-6">
        <CashflowTab />
      </TabsContent>
      <TabsContent value="accounts" className="mt-6">
        <AccountsTab />
      </TabsContent>
      <TabsContent value="categories" className="mt-6">
        <CategoriesTab />
      </TabsContent>
      <TabsContent value="contacts" className="mt-6">
        <ContactsTab />
      </TabsContent>
    </Tabs>
  );
}
