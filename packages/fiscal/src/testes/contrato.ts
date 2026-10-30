import { describe, expect, it } from "vitest";
import type {
  ProvedorFiscal,
  RespostaEmissao,
  SolicitacaoEmissao,
} from "../aplicacao/portas";
import { chaveValida, partesDaChave } from "../core/chave";
import { ReferenciaDesconhecidaError } from "../dominio/erros";
import { somenteDigitos } from "../dominio/identificadores";
import type { NotaFiscal } from "../dominio/nota-fiscal";

/**
 * Teste de contrato de `ProvedorFiscal`.
 *
 * É a régua para trocar de provedor: o adaptador novo entra no lugar da Focus
 * quando passa NESTA bateria. Roda contra o simulado em todo `pnpm test`; contra
 * um provedor real, roda em homologação com credenciais de teste, fora do CI:
 *
 *   testarContratoDoProvedorFiscal("Focus (homologação)", {
 *     criarProvedor: () => new ProvedorFocus({ token, ambiente: "HOMOLOGACAO" }),
 *     ...
 *   });
 */

export type OpcoesContrato = {
  criarProvedor: () => ProvedorFiscal | Promise<ProvedorFiscal>;
  /** Uma NFC-e que a SEFAZ de homologação autoriza. */
  notaValida: () => NotaFiscal;
  /** Uma NFC-e que a SEFAZ rejeita por conteúdo (ex.: NCM inexistente). */
  notaRejeitavel?: () => NotaFiscal;
  /** Série/número livres — contra provedor real, nunca repetir. */
  proximaNumeracao: () => { serie: number; numero: number };
  novaRef: () => string;
  /** Pausa entre consultas quando o provedor responde PROCESSANDO. */
  intervaloConsultaMs?: number;
  maxConsultas?: number;
  timeoutMs?: number;
};

export function testarContratoDoProvedorFiscal(
  nome: string,
  o: OpcoesContrato,
): void {
  const timeout = o.timeoutMs ?? 5_000;

  const solicitacao = (nota: NotaFiscal): SolicitacaoEmissao => ({
    ref: o.novaRef(),
    ...o.proximaNumeracao(),
    emitidaEm: new Date(),
    nota,
  });

  async function ateDecidir(
    provedor: ProvedorFiscal,
    s: SolicitacaoEmissao,
    primeira: RespostaEmissao,
  ): Promise<RespostaEmissao> {
    let resposta = primeira;
    for (
      let i = 0;
      resposta.situacao === "PROCESSANDO" && i < (o.maxConsultas ?? 10);
      i++
    ) {
      await new Promise((r) => setTimeout(r, o.intervaloConsultaMs ?? 0));
      resposta = await provedor.consultar(s.ref, s.nota.modelo);
    }
    return resposta;
  }

  describe(`contrato ProvedorFiscal — ${nome}`, () => {
    it(
      "autoriza uma NFC-e válida com chave coerente com a numeração enviada",
      async () => {
        const provedor = await o.criarProvedor();
        const s = solicitacao(o.notaValida());
        const resposta = await ateDecidir(
          provedor,
          s,
          await provedor.emitir(s),
        );

        expect(resposta.situacao).toBe("AUTORIZADA");
        if (resposta.situacao !== "AUTORIZADA") return;
        expect(chaveValida(resposta.chave)).toBe(true);
        const partes = partesDaChave(resposta.chave);
        expect(partes.modelo).toBe(s.nota.modelo);
        expect(partes.serie).toBe(s.serie);
        expect(partes.numero).toBe(s.numero);
        expect(partes.cnpj).toBe(somenteDigitos(s.nota.emitente.cnpj));
        expect(resposta.protocolo).toMatch(/^\d{15}$/);
      },
      timeout,
    );

    it(
      "reenviar a mesma ref não emite outra nota",
      async () => {
        const provedor = await o.criarProvedor();
        const s = solicitacao(o.notaValida());
        const primeira = await ateDecidir(
          provedor,
          s,
          await provedor.emitir(s),
        );
        const segunda = await ateDecidir(provedor, s, await provedor.emitir(s));

        expect(primeira.situacao).toBe("AUTORIZADA");
        expect(segunda).toMatchObject({
          situacao: "AUTORIZADA",
          chave: primeira.situacao === "AUTORIZADA" ? primeira.chave : "",
        });
      },
      timeout,
    );

    it("consultar uma ref nunca enviada lança ReferenciaDesconhecidaError", async () => {
      const provedor = await o.criarProvedor();
      await expect(provedor.consultar(o.novaRef(), 65)).rejects.toBeInstanceOf(
        ReferenciaDesconhecidaError,
      );
    });

    it(
      "cancela uma nota autorizada",
      async () => {
        const provedor = await o.criarProvedor();
        const s = solicitacao(o.notaValida());
        const autorizada = await ateDecidir(
          provedor,
          s,
          await provedor.emitir(s),
        );
        if (autorizada.situacao !== "AUTORIZADA")
          throw new Error("pré-condição: nota autorizada");

        const resposta = await provedor.cancelar({
          ref: s.ref,
          modelo: s.nota.modelo,
          chave: autorizada.chave,
          justificativa: "Venda desfeita a pedido do cliente no caixa",
        });
        expect(resposta.situacao).toBe("CANCELADA");
      },
      timeout,
    );

    it(
      "inutiliza um número nunca usado",
      async () => {
        const provedor = await o.criarProvedor();
        const nota = o.notaValida();
        const { serie, numero } = o.proximaNumeracao();
        const resposta = await provedor.inutilizar({
          modelo: nota.modelo,
          cnpj: somenteDigitos(nota.emitente.cnpj),
          serie,
          numeroInicial: numero,
          numeroFinal: numero,
          justificativa: "Numero pulado por falha no envio da venda",
        });
        expect(resposta.situacao).toBe("INUTILIZADA");
        if (resposta.situacao === "INUTILIZADA")
          expect(resposta.protocolo).toMatch(/^\d{15}$/);
      },
      timeout,
    );

    it(
      "inutilizar número já autorizado volta como recusa, não como exceção",
      async () => {
        const provedor = await o.criarProvedor();
        const s = solicitacao(o.notaValida());
        const autorizada = await ateDecidir(
          provedor,
          s,
          await provedor.emitir(s),
        );
        if (autorizada.situacao !== "AUTORIZADA")
          throw new Error("pré-condição: nota autorizada");

        const resposta = await provedor.inutilizar({
          modelo: s.nota.modelo,
          cnpj: somenteDigitos(s.nota.emitente.cnpj),
          serie: s.serie,
          numeroInicial: s.numero,
          numeroFinal: s.numero,
          justificativa: "Numero pulado por falha no envio da venda",
        });
        expect(resposta.situacao).toBe("RECUSADA");
      },
      timeout,
    );

    const notaRejeitavel = o.notaRejeitavel;
    if (notaRejeitavel)
      it(
        "rejeição da SEFAZ volta como resposta, não como exceção",
        async () => {
          const provedor = await o.criarProvedor();
          const s = solicitacao(notaRejeitavel());
          const resposta = await ateDecidir(
            provedor,
            s,
            await provedor.emitir(s),
          );
          expect(resposta.situacao).toBe("REJEITADA");
          if (resposta.situacao === "REJEITADA")
            expect(resposta.codigo).toMatch(/^\d{3}$/);
        },
        timeout,
      );

    if (notaRejeitavel)
      it(
        "a mesma ref, rejeitada, aceita o conteúdo corrigido",
        async () => {
          const provedor = await o.criarProvedor();
          const errada = solicitacao(notaRejeitavel());
          await ateDecidir(provedor, errada, await provedor.emitir(errada));

          const corrigida = {
            ...errada,
            nota: o.notaValida(),
            emitidaEm: new Date(),
          };
          const resposta = await ateDecidir(
            provedor,
            corrigida,
            await provedor.emitir(corrigida),
          );
          expect(resposta.situacao).toBe("AUTORIZADA");
        },
        timeout,
      );
  });
}
