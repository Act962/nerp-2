import {
  Bell,
  ClipboardList,
  MessageCircle,
  Megaphone,
  Package,
  Receipt,
  Route,
  Sparkles,
  Star,
  Tag,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";

export type Ambiente = {
  chave: string;
  titulo: string;
  href: string;
  icone: LucideIcon;
  /** Ainda não liberado: o botão aparece com "Em breve". */
  emBreve?: boolean;
};

// A ordem é a da grade da home: o que o vendedor usa em toda visita primeiro.
export const AMBIENTES: Ambiente[] = [
  {
    chave: "clientes",
    titulo: "Clientes",
    href: "/forca-de-vendas/clientes",
    icone: Users,
  },
  {
    chave: "pedidos",
    titulo: "Pedidos",
    href: "/forca-de-vendas/pedidos",
    icone: ClipboardList,
  },
  {
    chave: "produtos",
    titulo: "Produtos",
    href: "/forca-de-vendas/produtos",
    icone: Package,
  },
  {
    chave: "ofertas",
    titulo: "Ofertas do dia",
    href: "/forca-de-vendas/ofertas",
    icone: Tag,
  },
  {
    chave: "rota",
    titulo: "Rota",
    href: "/forca-de-vendas/rota",
    icone: Route,
  },
  {
    chave: "mensagens",
    titulo: "Mensagens",
    href: "/forca-de-vendas/mensagens",
    icone: MessageCircle,
  },
  {
    chave: "campanhas",
    titulo: "Campanhas",
    href: "/forca-de-vendas/campanhas",
    icone: Megaphone,
    emBreve: true,
  },
  {
    chave: "metas",
    titulo: "Metas",
    href: "/forca-de-vendas/metas",
    icone: Target,
  },
  {
    chave: "consultas",
    titulo: "Consultas",
    href: "/forca-de-vendas/consultas",
    icone: Receipt,
  },
  {
    chave: "avisos",
    titulo: "Avisos",
    href: "/forca-de-vendas/avisos",
    icone: Bell,
  },
  {
    chave: "astro",
    titulo: "Astro",
    href: "/forca-de-vendas/astro",
    icone: Sparkles,
    emBreve: true,
  },
  {
    chave: "star-friends",
    titulo: "Star Friends",
    href: "/forca-de-vendas/star-friends",
    icone: Star,
    emBreve: true,
  },
];
