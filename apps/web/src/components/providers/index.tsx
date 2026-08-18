"use client";

import { createQueryClient } from "@/lib/query/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        <NuqsAdapter>{children}</NuqsAdapter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
