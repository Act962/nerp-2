import "server-only";

// URLs e utilitários da SEFAZ Piauí (PI). NFCe do PI é autorizada pela SVRS
// (Sefaz Virtual do RS), como em vários estados menores. Mantemos separado
// pro roadmap depois expandir para outras UFs.

export const SEFAZ_PI = {
  uf: "PI" as const,
  cityCode: "2211001", // Teresina — IBGE
  cityName: "Teresina",

  // Portais para o usuário abrir num link:
  portalTeresina: "https://www.sefaz.pi.gov.br/", // portal geral SEFAZ PI
  portalNfce: "https://webas.sefaz.pi.gov.br/nfce-web/consultarNFCe.seam", // consulta pública NFCe
  portalHabilitacaoCsc:
    "https://webas.sefaz.pi.gov.br/nfce-web/gerarCscNfce.seam", // gerar CSC

  // Webservices (SVRS — homologação e produção). NFCe PI usa a SVRS.
  webservicesNfce: {
    HOMOLOGACAO: {
      status:
        "https://nfce-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx",
      autorizacao:
        "https://nfce-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx",
      consulta:
        "https://nfce-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx",
    },
    PRODUCAO: {
      status:
        "https://nfce.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx",
      autorizacao:
        "https://nfce.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx",
      consulta: "https://nfce.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx",
    },
  },
};

// Ping simples: o webservice de status SEFAZ é SOAP, mas responde `200` em GET
// básico (com WSDL). Aqui só checa se ele responde — não parseia o corpo,
// apenas confirma que o endpoint está no ar. O TESTE REAL de emissão passa pelo
// provedor (Focus NFe) na Fase B.
//
// ATENÇÃO: SEFAZ usa cadeia ICP-Brasil, que o Node não conhece por padrão.
// Em produção, o certificado A1 (Fase B) resolve — mTLS. Em DEV, este ping
// falha com "unable to get local issuer certificate". Para testar aqui, gere
// a env `NODE_EXTRA_CA_CERTS=/path/to/ICP-Brasilv15.pem` e reinicie o server.
export async function pingSefazNfce(
  environment: "HOMOLOGACAO" | "PRODUCAO",
): Promise<{
  ok: boolean;
  status: number;
  latencyMs: number;
  url: string;
  message?: string;
}> {
  const url = `${SEFAZ_PI.webservicesNfce[environment].status}?wsdl`;
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    return {
      ok: res.ok,
      status: res.status,
      latencyMs: Date.now() - started,
      url,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // Detecção de erro comum: cadeia ICP-Brasil ausente no Node.
    const icpBrasil = /UNABLE_TO_GET_ISSUER|self.signed|CERT_/i.test(msg);
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - started,
      url,
      message: icpBrasil
        ? "SEFAZ exige a cadeia ICP-Brasil. Em produção, o certificado A1 resolve. Em DEV, defina NODE_EXTRA_CA_CERTS=<caminho para ICP-Brasilv15.pem> e reinicie o server."
        : "Sem resposta do webservice (timeout ou falha de rede)",
    };
  }
}
