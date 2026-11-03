import { isValidCnpj, isValidCpf } from "@/lib/document";
import type { ValorConvertido } from "./converter";

// Regras da importação ERP → NERP, puras: sem Prisma, sem Oracle. Gravar é a
// parte irreversível do processo — um casamento errado polui milhares de
// cadastros —, então a decisão do que fazer com cada linha precisa ser testável
// sem banco nenhum. O adaptador do NERP só executa o que sai daqui.
//
// Política acordada com o dono do produto (spec mapeamento-banco):
// - o ERP só PREENCHE o que está vazio no NERP; o que alguém editou não muda;
// - fatos do ERP (ativo/bloqueado lá) são espelho e sempre atualizam;
// - produto casa pelo código do ERP e depois pelo código de barras;
// - cliente casa pelo código do ERP e depois pelo CPF/CNPJ.

export const TIPOS_IMPORTAVEIS = ["produto", "cliente", "estoque"] as const;
export type TipoImportavel = (typeof TIPOS_IMPORTAVEIS)[number];

export const MOTIVOS = {
  semCodigo: "Sem código no ERP",
  semNome: "Sem nome no ERP",
  duplicadoNoErp: "Código repetido na leitura do ERP",
  inativoNoErp: "Inativo no ERP — não é criado no NERP",
  criarDesligado: "Não existe no NERP e 'criar faltantes' está desligado",
  conflitoDeVinculo:
    "Casou pelo código de barras com um produto já vinculado a outro código do ERP",
  semProduto: "O produto ainda não existe no NERP (importe produtos antes)",
} as const;
export type Motivo = keyof typeof MOTIVOS;

type Valores = Record<string, ValorConvertido>;

function texto(valor: ValorConvertido | undefined): string | null {
  if (valor === null || valor === undefined) return null;
  const limpo = String(valor).trim();
  return limpo === "" ? null : limpo;
}

function numero(valor: ValorConvertido | undefined): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

function soDigitos(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\D/g, "");
}

// ---------------------------------------------------------------- produto

export interface ProdutoLocal {
  id: string;
  erpCode: string | null;
  barcode: string | null;
  packQty: number | null;
  erpActive: boolean | null;
}

export interface DadosDeProdutoNovo {
  codigo: string;
  nome: string;
  ean: string | null;
  unidadesPorCaixa: number | null;
  ativoNoErp: boolean | null;
}

export type AcaoDeProduto =
  | { acao: "criar"; codigo: string; dados: DadosDeProdutoNovo }
  | {
      acao: "atualizar";
      id: string;
      codigo: string;
      vinculou: boolean;
      campos: string[];
      dados: {
        erpCode?: string;
        barcode?: string;
        packQty?: number;
        erpActive?: boolean;
      };
    }
  | { acao: "semMudanca"; id: string; codigo: string }
  | { acao: "ignorar"; codigo: string | null; motivo: Motivo };

export function planejarProdutos(
  linhas: Valores[],
  locais: ProdutoLocal[],
  opcoes: { criarFaltantes: boolean },
): AcaoDeProduto[] {
  const porCodigo = new Map<string, ProdutoLocal>();
  const porBarra = new Map<string, ProdutoLocal>();
  for (const local of locais) {
    if (local.erpCode && !porCodigo.has(local.erpCode)) {
      porCodigo.set(local.erpCode, local);
    }
    const barra = soDigitos(local.barcode);
    if (barra && !porBarra.has(barra)) porBarra.set(barra, local);
  }
  // Barras já ocupadas (no banco ou neste lote): `barcode` é único por org.
  const barrasEmUso = new Set(porBarra.keys());
  const vistos = new Set<string>();
  const acoes: AcaoDeProduto[] = [];

  for (const linha of linhas) {
    const codigo = texto(linha.codigo);
    if (!codigo) {
      acoes.push({ acao: "ignorar", codigo: null, motivo: "semCodigo" });
      continue;
    }
    if (vistos.has(codigo)) {
      acoes.push({ acao: "ignorar", codigo, motivo: "duplicadoNoErp" });
      continue;
    }
    vistos.add(codigo);

    const ean = texto(linha.ean);
    const porCaixa = numero(linha.unidadesPorCaixa);
    const ativo = typeof linha.ativo === "boolean" ? linha.ativo : null;

    let local = porCodigo.get(codigo) ?? null;
    let vinculou = false;
    if (!local && ean) {
      const pelaBarra = porBarra.get(ean) ?? null;
      if (pelaBarra?.erpCode && pelaBarra.erpCode !== codigo) {
        acoes.push({ acao: "ignorar", codigo, motivo: "conflitoDeVinculo" });
        continue;
      }
      if (pelaBarra) {
        local = pelaBarra;
        vinculou = true;
      }
    }

    if (!local) {
      if (ativo === false) {
        acoes.push({ acao: "ignorar", codigo, motivo: "inativoNoErp" });
        continue;
      }
      if (!opcoes.criarFaltantes) {
        acoes.push({ acao: "ignorar", codigo, motivo: "criarDesligado" });
        continue;
      }
      const nome = texto(linha.nome);
      if (!nome) {
        acoes.push({ acao: "ignorar", codigo, motivo: "semNome" });
        continue;
      }
      const eanLivre = ean && !barrasEmUso.has(ean) ? ean : null;
      if (eanLivre) barrasEmUso.add(eanLivre);
      acoes.push({
        acao: "criar",
        codigo,
        dados: {
          codigo,
          nome,
          ean: eanLivre,
          unidadesPorCaixa:
            porCaixa && porCaixa > 1 ? Math.round(porCaixa) : null,
          ativoNoErp: ativo,
        },
      });
      continue;
    }

    const dados: Extract<AcaoDeProduto, { acao: "atualizar" }>["dados"] = {};
    const campos: string[] = [];
    if (!local.erpCode) {
      dados.erpCode = codigo;
      campos.push("erpCode");
    }
    if (!soDigitos(local.barcode) && ean && !barrasEmUso.has(ean)) {
      dados.barcode = ean;
      barrasEmUso.add(ean);
      campos.push("barcode");
    }
    if (local.packQty === null && porCaixa && porCaixa > 1) {
      dados.packQty = Math.round(porCaixa);
      campos.push("packQty");
    }
    // Espelho do ERP, não edição do usuário: sempre acompanha.
    if (ativo !== null && local.erpActive !== ativo) {
      dados.erpActive = ativo;
      campos.push("erpActive");
    }
    acoes.push(
      campos.length === 0
        ? { acao: "semMudanca", id: local.id, codigo }
        : { acao: "atualizar", id: local.id, codigo, vinculou, campos, dados },
    );
  }
  return acoes;
}

// ---------------------------------------------------------------- cliente

export interface ClienteLocal {
  id: string;
  erpCode: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  erpBlocked: boolean | null;
}

export interface DadosDeClienteNovo {
  codigo: string;
  nome: string;
  documento: string | null;
  pessoa: "FISICA" | "JURIDICA";
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  bloqueado: boolean | null;
}

export type AcaoDeCliente =
  | { acao: "criar"; codigo: string; dados: DadosDeClienteNovo }
  | {
      acao: "atualizar";
      id: string;
      codigo: string;
      vinculou: boolean;
      campos: string[];
      dados: {
        erpCode?: string;
        document?: string;
        email?: string;
        phone?: string;
        city?: string;
        state?: string;
        erpBlocked?: boolean;
      };
    }
  | { acao: "semMudanca"; id: string; codigo: string }
  | { acao: "ignorar"; codigo: string | null; motivo: Motivo };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function planejarClientes(
  linhas: Valores[],
  locais: ClienteLocal[],
  opcoes: { criarFaltantes: boolean },
): AcaoDeCliente[] {
  const porCodigo = new Map<string, ClienteLocal>();
  const porDocumento = new Map<string, ClienteLocal[]>();
  const emailsEmUso = new Set<string>();
  for (const local of locais) {
    if (local.erpCode && !porCodigo.has(local.erpCode)) {
      porCodigo.set(local.erpCode, local);
    }
    const documento = soDigitos(local.document);
    if (documento) {
      porDocumento.set(documento, [
        ...(porDocumento.get(documento) ?? []),
        local,
      ]);
    }
    if (local.email) emailsEmUso.add(local.email.trim().toLowerCase());
  }
  const vinculadosAgora = new Set<string>();
  const vistos = new Set<string>();
  const acoes: AcaoDeCliente[] = [];

  for (const linha of linhas) {
    const codigo = texto(linha.codigo);
    if (!codigo) {
      acoes.push({ acao: "ignorar", codigo: null, motivo: "semCodigo" });
      continue;
    }
    if (vistos.has(codigo)) {
      acoes.push({ acao: "ignorar", codigo, motivo: "duplicadoNoErp" });
      continue;
    }
    vistos.add(codigo);

    // Só documento com dígito verificador certo casa ou é gravado: o ERP usa
    // "111.111.111-11" e afins para o consumidor final, e casar por ele
    // juntaria clientes diferentes num cadastro só.
    const documento = soDigitos(texto(linha.documento));
    const documentoValido =
      isValidCpf(documento) || isValidCnpj(documento) ? documento : null;
    const emailBruto = texto(linha.email)?.toLowerCase() ?? null;
    const email = emailBruto && EMAIL.test(emailBruto) ? emailBruto : null;
    const telefone =
      soDigitos(texto(linha.telefone)) ||
      soDigitos(texto(linha.celular)) ||
      null;
    const cidade = texto(linha.cidade);
    const uf = texto(linha.uf)?.toUpperCase() ?? null;
    const ativo = typeof linha.ativo === "boolean" ? linha.ativo : null;
    const bloqueado =
      typeof linha.bloqueado === "boolean" ? linha.bloqueado : null;

    let local = porCodigo.get(codigo) ?? null;
    let vinculou = false;
    if (!local && documentoValido) {
      // Mesmo CNPJ em vários códigos do ERP (lojas de uma rede) é comum: cada
      // cliente local vincula a UM código; os seguintes viram cadastro próprio.
      local =
        porDocumento
          .get(documentoValido)
          ?.find(
            (candidato) =>
              !candidato.erpCode && !vinculadosAgora.has(candidato.id),
          ) ?? null;
      if (local) vinculou = true;
    }

    if (!local) {
      if (ativo === false) {
        acoes.push({ acao: "ignorar", codigo, motivo: "inativoNoErp" });
        continue;
      }
      if (!opcoes.criarFaltantes) {
        acoes.push({ acao: "ignorar", codigo, motivo: "criarDesligado" });
        continue;
      }
      const nome = texto(linha.nome);
      if (!nome) {
        acoes.push({ acao: "ignorar", codigo, motivo: "semNome" });
        continue;
      }
      // E-mail é único por organização: repetido fica de fora, o cadastro entra.
      const emailLivre = email && !emailsEmUso.has(email) ? email : null;
      if (emailLivre) emailsEmUso.add(emailLivre);
      acoes.push({
        acao: "criar",
        codigo,
        dados: {
          codigo,
          nome,
          documento: documentoValido,
          pessoa: documentoValido?.length === 14 ? "JURIDICA" : "FISICA",
          email: emailLivre,
          telefone,
          cidade,
          uf,
          bloqueado,
        },
      });
      continue;
    }

    vinculadosAgora.add(local.id);
    const dados: Extract<AcaoDeCliente, { acao: "atualizar" }>["dados"] = {};
    const campos: string[] = [];
    if (!local.erpCode) {
      dados.erpCode = codigo;
      campos.push("erpCode");
    }
    if (!soDigitos(local.document) && documentoValido) {
      dados.document = documentoValido;
      campos.push("document");
    }
    if (!local.email && email && !emailsEmUso.has(email)) {
      dados.email = email;
      emailsEmUso.add(email);
      campos.push("email");
    }
    if (!local.phone && telefone) {
      dados.phone = telefone;
      campos.push("phone");
    }
    if (!local.city && cidade) {
      dados.city = cidade;
      campos.push("city");
    }
    if (!local.state && uf) {
      dados.state = uf;
      campos.push("state");
    }
    if (bloqueado !== null && local.erpBlocked !== bloqueado) {
      dados.erpBlocked = bloqueado;
      campos.push("erpBlocked");
    }
    acoes.push(
      campos.length === 0
        ? { acao: "semMudanca", id: local.id, codigo }
        : { acao: "atualizar", id: local.id, codigo, vinculou, campos, dados },
    );
  }
  return acoes;
}

// ---------------------------------------------------------------- estoque

export interface RegistroDeEstoque {
  productId: string;
  filial: string;
  nomeFilial: string | null;
  disponivel: number;
}

export interface PlanoDeEstoque {
  registros: RegistroDeEstoque[];
  lidas: number;
  semProduto: number;
  duplicados: number;
  filiais: string[];
}

/**
 * Disponível = total − reservado − bloqueado (nunca negativo). O espelho só
 * guarda quem TEM disponível; produto que não aparece fica com zero.
 */
export function planejarEstoque(
  linhas: Valores[],
  produtoPorCodigo: Map<string, string>,
): PlanoDeEstoque {
  const registros: RegistroDeEstoque[] = [];
  const vistos = new Set<string>();
  const filiais = new Set<string>();
  let semProduto = 0;
  let duplicados = 0;
  for (const linha of linhas) {
    const codigo = texto(linha.codigoProduto);
    const filial = texto(linha.filial);
    if (!codigo || !filial) continue;
    filiais.add(filial);
    const productId = produtoPorCodigo.get(codigo);
    if (!productId) {
      semProduto += 1;
      continue;
    }
    const chave = `${productId}:${filial}`;
    if (vistos.has(chave)) {
      duplicados += 1;
      continue;
    }
    vistos.add(chave);
    const disponivel =
      (numero(linha.quantidade) ?? 0) -
      (numero(linha.reservada) ?? 0) -
      (numero(linha.bloqueada) ?? 0);
    if (disponivel <= 0) continue;
    registros.push({
      productId,
      filial,
      nomeFilial: texto(linha.nomeFilial),
      disponivel: Math.round(disponivel * 1000) / 1000,
    });
  }
  return {
    registros,
    lidas: linhas.length,
    semProduto,
    duplicados,
    filiais: [...filiais].sort(),
  };
}

// ---------------------------------------------------------------- resumo

export interface ResumoDasAcoes {
  criar: number;
  vincular: number;
  preencher: number;
  semMudanca: number;
  ignorar: number;
  ignorados: { motivo: string; quantidade: number }[];
  camposPreenchidos: Record<string, number>;
  exemplos: { acao: string; codigo: string | null; detalhe: string }[];
}

const EXEMPLOS_POR_ACAO = 5;

export function resumirAcoes(
  acoes: (AcaoDeProduto | AcaoDeCliente)[],
  descrever: (acao: AcaoDeProduto | AcaoDeCliente) => string,
): ResumoDasAcoes {
  const resumo: ResumoDasAcoes = {
    criar: 0,
    vincular: 0,
    preencher: 0,
    semMudanca: 0,
    ignorar: 0,
    ignorados: [],
    camposPreenchidos: {},
    exemplos: [],
  };
  const porMotivo = new Map<Motivo, number>();
  const exemplosPorAcao = new Map<string, number>();
  const exemplo = (rotulo: string, acao: AcaoDeProduto | AcaoDeCliente) => {
    const quantos = exemplosPorAcao.get(rotulo) ?? 0;
    if (quantos >= EXEMPLOS_POR_ACAO) return;
    exemplosPorAcao.set(rotulo, quantos + 1);
    resumo.exemplos.push({
      acao: rotulo,
      codigo: acao.codigo,
      detalhe: descrever(acao),
    });
  };
  for (const acao of acoes) {
    if (acao.acao === "criar") {
      resumo.criar += 1;
      exemplo("criar", acao);
    } else if (acao.acao === "semMudanca") {
      resumo.semMudanca += 1;
    } else if (acao.acao === "ignorar") {
      resumo.ignorar += 1;
      porMotivo.set(acao.motivo, (porMotivo.get(acao.motivo) ?? 0) + 1);
      exemplo(`ignorar:${acao.motivo}`, acao);
    } else {
      if (acao.vinculou) resumo.vincular += 1;
      else resumo.preencher += 1;
      for (const campo of acao.campos) {
        resumo.camposPreenchidos[campo] =
          (resumo.camposPreenchidos[campo] ?? 0) + 1;
      }
      exemplo(acao.vinculou ? "vincular" : "preencher", acao);
    }
  }
  resumo.ignorados = [...porMotivo.entries()].map(([motivo, quantidade]) => ({
    motivo: MOTIVOS[motivo],
    quantidade,
  }));
  return resumo;
}
