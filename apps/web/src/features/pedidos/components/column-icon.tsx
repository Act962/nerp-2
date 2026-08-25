import * as LucideIcons from "lucide-react";
import type { LucideProps } from "lucide-react";

type IconModule = Record<string, React.ComponentType<LucideProps>>;

interface ColumnIconProps extends LucideProps {
  // nome de um ícone lucide (ex "ChefHat") ou um emoji; null usa o fallback
  icon: string | null;
}

// Renderiza o ícone da coluna: se for um nome lucide válido usa o componente;
// senão trata como emoji/texto curto.
export function ColumnIcon({ icon, ...props }: ColumnIconProps) {
  if (!icon) return null;

  const Icon = (LucideIcons as unknown as IconModule)[icon];
  if (Icon) return <Icon {...props} />;

  return (
    <span className="text-base leading-none" aria-hidden>
      {icon}
    </span>
  );
}
