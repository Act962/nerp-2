/**
 * `@nerp/fiscal` — núcleo fiscal isomórfico do NERP.
 *
 * Tudo aqui roda nos dois lados: no servidor (Node) e na webview do Tauri. É o
 * que permite ao PDV offline montar a NFC-e, calcular a chave e o QR Code e
 * imprimir o DANFCe no momento da venda, com o servidor assinando e
 * transmitindo o MESMO documento quando a conexão volta.
 *
 * Por isso nada aqui importa `node:crypto`, `Buffer`, `fs` ou rede. Material
 * criptográfico e endpoints da SEFAZ ficam do lado do servidor; a assinatura
 * entra por função injetada.
 *
 * Camadas (arquitetura de portas e adaptadores):
 *
 * - `core/`, `uf/`, `cstat` — regras técnicas da SEFAZ (chave, QR, códigos);
 * - `dominio/`   — a nota, o ciclo de vida do documento, a validação;
 * - `aplicacao/` — casos de uso e as PORTAS (interfaces) que eles exigem;
 * - adaptadores reais (Prisma, Focus, R2) moram em `apps/web`; os de memória,
 *   em `@nerp/fiscal/testes`.
 */
export * from "./core/sha1";
export * from "./core/chave";
export * from "./core/qrcode";
export * from "./uf/uf";
export * from "./uf/autorizadores";
export * from "./cstat";

export * from "./dominio/erros";
export * from "./dominio/identificadores";
export * from "./dominio/nota-fiscal";
export * from "./dominio/validacao";
export * from "./dominio/tabelas";
export * from "./dominio/cadastro-produto";
export * from "./dominio/documento-fiscal";
export * from "./dominio/numeracao";
export * from "./dominio/alertas";

export * from "./aplicacao/portas";
export * from "./aplicacao/solicitar-emissao-nfce";
export * from "./aplicacao/processar-emissao";
export * from "./aplicacao/reenviar-documento-rejeitado";
export * from "./aplicacao/cancelar-documento-fiscal";
export * from "./aplicacao/inutilizar-numeracao";
