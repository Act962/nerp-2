import { PRODUCT_PLACEHOLDER } from "@/features/promotional-catalog/components/cards/image-style";
import type { PacoteDeExemplo } from "../lib/nichos";

/**
 * Os dados de exemplo de cada ramo.
 *
 * O que travava os pacotes por nicho era foto: sem imagem de produto, um
 * catálogo promocional sai com buracos, e a primeira tela que a pessoa vê é
 * justamente o catálogo. A saída é a embalagem neutra que o próprio editor de
 * catálogo já usa quando um produto não tem foto (`PRODUCT_PLACEHOLDER`) —
 * não é a foto certa, mas é a MESMA que o produto real dela teria antes de
 * receber a dele, então o encarte sai inteiro e sem parecer quebrado.
 *
 * A mercearia mantém as fotos de verdade: ela já as tinha, e trocar fotos boas
 * por embalagem neutra seria piorar o que funciona.
 *
 * Os nomes são do ramo, e não "PRODUTO 1 - TESTE", por um motivo prático: num
 * encarte, nome genérico parece ERRO, não parece exemplo. Quem marca o que é
 * exemplo já é o `isDemo` — ele acende o selo nas listagens e é o que o card
 * do dashboard usa para apagar tudo de uma vez.
 */

export type CategoriaDoPacote = { slug: string; name: string; order: number };

export type ProdutoDoPacote = {
  sku: string;
  slug: string;
  name: string;
  categoria: string;
  costPrice: string;
  salePrice: string;
  promotionalPrice?: string;
  currentStock: number;
  minStock: number;
  barcode: string;
  foto: string;
  description: string;
};

export type ConteudoDoPacote = {
  categorias: CategoriaDoPacote[];
  produtos: ProdutoDoPacote[];
};

/** Código de barras de exemplo — prefixo 789 (Brasil), sequencial e fictício. */
function codigo(indice: number): string {
  return `789${String(900_000_000 + indice).padStart(10, "0")}`;
}

type Semente = {
  nome: string;
  categoria: string;
  custo: number;
  venda: number;
  promocao?: number;
  estoque: number;
  minimo: number;
  descricao: string;
};

function montar(
  prefixo: string,
  categorias: CategoriaDoPacote[],
  sementes: Semente[],
): ConteudoDoPacote {
  return {
    categorias,
    produtos: sementes.map((s, i) => ({
      sku: `${prefixo}-${String(i + 1).padStart(3, "0")}`,
      slug: `${prefixo.toLowerCase()}-${s.nome
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}`,
      name: s.nome,
      categoria: s.categoria,
      costPrice: s.custo.toFixed(2),
      salePrice: s.venda.toFixed(2),
      ...(s.promocao ? { promotionalPrice: s.promocao.toFixed(2) } : {}),
      currentStock: s.estoque,
      minStock: s.minimo,
      barcode: codigo(i + 1),
      foto: PRODUCT_PLACEHOLDER,
      description: s.descricao,
    })),
  };
}

/** Restaurante, lanchonete, delivery: o que sai pela cozinha e pelo balcão. */
const FOOD = montar(
  "DEMO-FOOD",
  [
    { slug: "demo-pratos", name: "Pratos", order: 0 },
    { slug: "demo-lanches", name: "Lanches", order: 1 },
    { slug: "demo-bebidas", name: "Bebidas", order: 2 },
  ],
  [
    {
      nome: "Prato feito do dia",
      categoria: "demo-pratos",
      custo: 9.5,
      venda: 24.9,
      estoque: 40,
      minimo: 10,
      descricao: "Arroz, feijão, guarnição e proteína do dia.",
    },
    {
      nome: "Filé de frango grelhado",
      categoria: "demo-pratos",
      custo: 12.0,
      venda: 32.9,
      promocao: 27.9,
      estoque: 30,
      minimo: 8,
      descricao: "Acompanha arroz, salada e batata.",
    },
    {
      nome: "Feijoada individual",
      categoria: "demo-pratos",
      custo: 15.0,
      venda: 39.9,
      estoque: 20,
      minimo: 6,
      descricao: "Servida às quartas e sábados.",
    },
    {
      nome: "Hambúrguer artesanal 180g",
      categoria: "demo-lanches",
      custo: 11.0,
      venda: 28.9,
      promocao: 24.9,
      estoque: 50,
      minimo: 12,
      descricao: "Pão brioche, queijo e molho da casa.",
    },
    {
      nome: "Sanduíche natural de frango",
      categoria: "demo-lanches",
      custo: 5.5,
      venda: 14.9,
      estoque: 25,
      minimo: 8,
      descricao: "Pão integral, frango desfiado e salada.",
    },
    {
      nome: "Porção de batata frita",
      categoria: "demo-lanches",
      custo: 6.0,
      venda: 19.9,
      estoque: 60,
      minimo: 15,
      descricao: "Serve duas pessoas.",
    },
    {
      nome: "Refrigerante lata 350ml",
      categoria: "demo-bebidas",
      custo: 2.8,
      venda: 6.5,
      estoque: 120,
      minimo: 24,
      descricao: "Gelado, sabores variados.",
    },
    {
      nome: "Suco natural 500ml",
      categoria: "demo-bebidas",
      custo: 3.5,
      venda: 11.9,
      promocao: 9.9,
      estoque: 40,
      minimo: 10,
      descricao: "Feito na hora, sem açúcar adicionado.",
    },
    {
      nome: "Água mineral 500ml",
      categoria: "demo-bebidas",
      custo: 1.2,
      venda: 4.0,
      estoque: 150,
      minimo: 30,
      descricao: "Com e sem gás.",
    },
    {
      nome: "Combo almoço executivo",
      categoria: "demo-pratos",
      custo: 13.0,
      venda: 34.9,
      promocao: 29.9,
      estoque: 35,
      minimo: 10,
      descricao: "Prato do dia, bebida e sobremesa.",
    },
  ],
);

/** Clínica: serviço é o "produto", e o estoque é o material de uso. */
const CLINICA = montar(
  "DEMO-CLI",
  [
    { slug: "demo-consultas", name: "Consultas", order: 0 },
    { slug: "demo-procedimentos", name: "Procedimentos", order: 1 },
    { slug: "demo-materiais", name: "Materiais", order: 2 },
  ],
  [
    {
      nome: "Consulta de avaliação",
      categoria: "demo-consultas",
      custo: 0,
      venda: 180.0,
      estoque: 0,
      minimo: 0,
      descricao: "Primeira consulta, com anamnese.",
    },
    {
      nome: "Consulta de retorno",
      categoria: "demo-consultas",
      custo: 0,
      venda: 90.0,
      estoque: 0,
      minimo: 0,
      descricao: "Retorno em até 30 dias.",
    },
    {
      nome: "Teleconsulta",
      categoria: "demo-consultas",
      custo: 0,
      venda: 120.0,
      promocao: 99.0,
      estoque: 0,
      minimo: 0,
      descricao: "Atendimento por vídeo, 30 minutos.",
    },
    {
      nome: "Limpeza de pele",
      categoria: "demo-procedimentos",
      custo: 25.0,
      venda: 220.0,
      promocao: 189.0,
      estoque: 0,
      minimo: 0,
      descricao: "Sessão de 60 minutos.",
    },
    {
      nome: "Drenagem linfática",
      categoria: "demo-procedimentos",
      custo: 20.0,
      venda: 160.0,
      estoque: 0,
      minimo: 0,
      descricao: "Sessão de 50 minutos.",
    },
    {
      nome: "Pacote 10 sessões",
      categoria: "demo-procedimentos",
      custo: 180.0,
      venda: 1400.0,
      promocao: 1190.0,
      estoque: 0,
      minimo: 0,
      descricao: "Dez sessões, uso em até seis meses.",
    },
    {
      nome: "Luva de procedimento (caixa)",
      categoria: "demo-materiais",
      custo: 28.0,
      venda: 0,
      estoque: 24,
      minimo: 6,
      descricao: "Caixa com 100 unidades.",
    },
    {
      nome: "Máscara descartável (caixa)",
      categoria: "demo-materiais",
      custo: 18.0,
      venda: 0,
      estoque: 30,
      minimo: 8,
      descricao: "Caixa com 50 unidades.",
    },
    {
      nome: "Álcool 70% 1L",
      categoria: "demo-materiais",
      custo: 9.0,
      venda: 0,
      estoque: 18,
      minimo: 6,
      descricao: "Uso em superfícies e antissepsia.",
    },
    {
      nome: "Gaze estéril (pacote)",
      categoria: "demo-materiais",
      custo: 6.5,
      venda: 0,
      estoque: 40,
      minimo: 12,
      descricao: "Pacote com 10 unidades.",
    },
  ],
);

/** Centro automotivo: peça na bancada e serviço na ordem. */
const AUTOMOTIVO = montar(
  "DEMO-AUTO",
  [
    { slug: "demo-servicos", name: "Serviços", order: 0 },
    { slug: "demo-pecas", name: "Peças", order: 1 },
    { slug: "demo-lubrificantes", name: "Lubrificantes", order: 2 },
  ],
  [
    {
      nome: "Troca de óleo e filtro",
      categoria: "demo-servicos",
      custo: 60.0,
      venda: 180.0,
      promocao: 149.0,
      estoque: 0,
      minimo: 0,
      descricao: "Mão de obra, óleo e filtro inclusos.",
    },
    {
      nome: "Alinhamento e balanceamento",
      categoria: "demo-servicos",
      custo: 30.0,
      venda: 120.0,
      estoque: 0,
      minimo: 0,
      descricao: "Quatro rodas.",
    },
    {
      nome: "Revisão de freios",
      categoria: "demo-servicos",
      custo: 45.0,
      venda: 160.0,
      estoque: 0,
      minimo: 0,
      descricao: "Inspeção, limpeza e regulagem.",
    },
    {
      nome: "Higienização do ar-condicionado",
      categoria: "demo-servicos",
      custo: 25.0,
      venda: 140.0,
      promocao: 119.0,
      estoque: 0,
      minimo: 0,
      descricao: "Troca do filtro de cabine inclusa.",
    },
    {
      nome: "Pastilha de freio dianteira",
      categoria: "demo-pecas",
      custo: 70.0,
      venda: 169.0,
      estoque: 16,
      minimo: 4,
      descricao: "Jogo com quatro pastilhas.",
    },
    {
      nome: "Filtro de ar do motor",
      categoria: "demo-pecas",
      custo: 22.0,
      venda: 59.9,
      estoque: 24,
      minimo: 6,
      descricao: "Compatível com linha leve.",
    },
    {
      nome: "Bateria 60Ah",
      categoria: "demo-pecas",
      custo: 320.0,
      venda: 549.0,
      promocao: 489.0,
      estoque: 8,
      minimo: 2,
      descricao: "Doze meses de garantia.",
    },
    {
      nome: 'Palheta limpador 16"',
      categoria: "demo-pecas",
      custo: 18.0,
      venda: 49.9,
      estoque: 30,
      minimo: 8,
      descricao: "Par, encaixe universal.",
    },
    {
      nome: "Óleo sintético 5W30 1L",
      categoria: "demo-lubrificantes",
      custo: 32.0,
      venda: 74.9,
      estoque: 48,
      minimo: 12,
      descricao: "API SN, para motores flex.",
    },
    {
      nome: "Fluido de freio DOT4 500ml",
      categoria: "demo-lubrificantes",
      custo: 14.0,
      venda: 39.9,
      estoque: 20,
      minimo: 6,
      descricao: "Troca recomendada a cada dois anos.",
    },
  ],
);

/**
 * Quando o ramo é "Outro" ou foi pulado.
 *
 * Neutro sem ser vazio: um produto, um serviço e um combo, que é o suficiente
 * para o catálogo, o PDV e o Astro terem o que mostrar enquanto a pessoa
 * cadastra o que é dela de verdade.
 */
const GENERICO = montar(
  "DEMO-GER",
  [
    { slug: "demo-produtos", name: "Produtos", order: 0 },
    { slug: "demo-servicos", name: "Serviços", order: 1 },
  ],
  [
    {
      nome: "Produto de exemplo A",
      categoria: "demo-produtos",
      custo: 10.0,
      venda: 24.9,
      promocao: 19.9,
      estoque: 40,
      minimo: 10,
      descricao:
        "Troque por um produto seu — ou apague os exemplos no card do Dashboard.",
    },
    {
      nome: "Produto de exemplo B",
      categoria: "demo-produtos",
      custo: 18.0,
      venda: 39.9,
      estoque: 25,
      minimo: 8,
      descricao: "Exemplo para você ver o catálogo e o PDV funcionando.",
    },
    {
      nome: "Produto de exemplo C",
      categoria: "demo-produtos",
      custo: 6.0,
      venda: 14.9,
      promocao: 11.9,
      estoque: 60,
      minimo: 15,
      descricao:
        "Exemplo com preço promocional, para o encarte ter o que mostrar.",
    },
    {
      nome: "Produto de exemplo D",
      categoria: "demo-produtos",
      custo: 45.0,
      venda: 99.0,
      estoque: 12,
      minimo: 4,
      descricao: "Exemplo de item de ticket mais alto.",
    },
    {
      nome: "Produto de exemplo E",
      categoria: "demo-produtos",
      custo: 3.5,
      venda: 9.9,
      estoque: 80,
      minimo: 20,
      descricao: "Exemplo de item de giro rápido.",
    },
    {
      nome: "Serviço de exemplo A",
      categoria: "demo-servicos",
      custo: 0,
      venda: 150.0,
      estoque: 0,
      minimo: 0,
      descricao: "Exemplo de serviço, sem estoque.",
    },
    {
      nome: "Serviço de exemplo B",
      categoria: "demo-servicos",
      custo: 0,
      venda: 80.0,
      promocao: 69.0,
      estoque: 0,
      minimo: 0,
      descricao: "Exemplo de serviço com promoção.",
    },
    {
      nome: "Pacote de exemplo",
      categoria: "demo-servicos",
      custo: 0,
      venda: 600.0,
      promocao: 499.0,
      estoque: 0,
      minimo: 0,
      descricao: "Exemplo de combinação de itens.",
    },
  ],
);

/**
 * O conteúdo de cada pacote. A mercearia não está aqui: ela vive em
 * `seed-demo.ts` com as fotos de verdade, e é a que os ramos de varejo usam.
 */
export const PACOTES: Partial<Record<PacoteDeExemplo, ConteudoDoPacote>> = {
  food: FOOD,
  clinica: CLINICA,
  automotivo: AUTOMOTIVO,
  generico: GENERICO,
};
