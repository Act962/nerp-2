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
      {/* No celular o breadcrumb logo acima já diz em que página se está, então
          o título repete e a descrição é enfeite — juntos custavam altura no
          topo de TODA tela, empurrando o conteúdo para fora da dobra.
          `sr-only` e não `hidden` no título: ele some da tela mas continua na
          árvore de acessibilidade, que é o que leitor de tela usa para navegar
          por cabeçalhos. */}
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold text-foreground max-sm:sr-only sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground max-sm:hidden">
            {description}
          </p>
        )}
      </div>
      {children && (
        // No celular cada ação ocupa metade da linha e a última estica para
        // preencher: com três botões sai 2 em cima e 1 inteiro embaixo, em vez
        // de 2 + 1 solto e desalinhado.
        <div
          className={
            "flex flex-wrap items-center gap-2 max-sm:[&>*]:min-w-[calc(50%-0.25rem)] max-sm:[&>*]:flex-1"
          }
        >
          {children}
        </div>
      )}
    </div>
  );
}
