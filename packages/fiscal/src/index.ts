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
 */
export * from "./core/sha1";
export * from "./core/chave";
export * from "./core/qrcode";
export * from "./uf/uf";
export * from "./uf/autorizadores";
export * from "./cstat";
