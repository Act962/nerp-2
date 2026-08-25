"use client";

import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { PanelRightOpen } from "lucide-react";
import React from "react";

export function Heading() {
  const { toggleSidebar } = useSidebar();

  return (
    <div className="flex items-center justify-between border-b border-border py-4 px-6">
      <div className="flex items-center gap-2">
        <button onClick={toggleSidebar}>
          <PanelRightOpen className="size-4" />
        </button>
        <h2 className="font-medium">Produtos</h2>
      </div>
    </div>
  );
}
