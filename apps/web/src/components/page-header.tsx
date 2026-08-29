import type React from "react";
interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    // No celular título e ações empilham. Lado a lado, o título era espremido
    // numa coluna de quatro palavras enquanto os botões vazavam para fora da
    // tela — foi o que aconteceu em Produtos a 430px.
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children && (
        // `flex-wrap`: três botões de ação não cabem numa linha de 430px.
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  );
}
