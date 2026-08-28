# Fiscal — Segurança do certificado A1 (Fase 0)

> Tira o certificado digital A1 do bucket público, exige owner/admin para ler a configuração fiscal e valida o .pfx no upload.
> Feature: `src/lib/fiscal/{certificate,storage}.ts` (novo) + `src/lib/s3-object-guard.ts` (novo) + `src/app/router/fiscal-config` + `src/features/fiscal-config`
> Criado em: 2026-08-28 · Atualizado em: 2026-08-28
> Status: ✅ Implementado (aguardando teste do dev)

---

## Situacao atual (antes desta spec)

Três fatos que, somados, deixavam o certificado ICP-Brasil da empresa baixável **sem sessão nenhuma**:

1. `src/app/router/fiscal-config/index.ts` — `get` usava `base + auth + org`, **sem `requireManage`**. Qualquer membro autenticado (caixa, promotor) recebia `certificateKey` em texto claro.
2. `src/app/api/s3/upload/route.ts` aceitava `application/x-pkcs12` e gravava o `.pfx` em `NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES` — **o mesmo bucket das imagens públicas**.
3. `src/app/api/s3/image/route.ts` não tem autenticação: recebia qualquer `key` na query string e devolvia o objeto com `Cache-Control: public, max-age=3600, immutable`.

Além disso, `certificateExpiresAt` nunca era preenchido (o upload não abria o arquivo), e `FISCAL_ENCRYPTION_KEY` não existia no `.env` nem no `globalEnv` do `turbo.json` — a primeira gravação de segredo lançaria.

É a Fase 0 do plano de emissão fiscal: **nada de emissão antes disto**.

---

## Decisoes tomadas

- **Upload por procedure oRPC, não por presigned URL.** A senha é indispensável para abrir o `.pfx`, e só abrindo dá para conferir validade e CNPJ. Validar no upload transforma "certificado errado" em erro de tela; validar só na primeira venda transformaria em incidente fiscal. Um A1 tem poucos KB, então base64 pelo oRPC não justifica presigned.
- **Bucket fiscal separado e privado** (`FISCAL_S3_BUCKET_NAME`), com key `fiscal/<organizationId>/certificates/<uuid>.pfx`. `fiscalBucket()` **falha** se a env faltar — nunca cai no bucket de imagens como fallback.
- **`node-forge` para ler PKCS#12**, não o binário `openssl`: serverless não tem `openssl`, e o LibreSSL do macOS recusa PKCS#12 legado (RC2-40-CBC), formato da maioria dos A1 brasileiros.
- **A `certificateKey` nunca mais sai para o client.** O `get` devolve `hasCertificate`, `certificateFilename`, `certificateExpiresAt` e `certificateStorageLegacy`.
- **`requireManage` também na leitura** — a config expõe máscaras de segredo e metadados do certificado; ler é tão sensível quanto escrever.
- **Certificado sai do `upsert`.** Arquivo, senha e validade são gravados juntos por `uploadCertificate`, que é quem consegue validar os três. O campo de senha solto saiu do formulário.
- **Guarda por extensão, não só por prefixo**, em `/api/s3/image`: os certificados legados foram gravados como `<uuid>-<nome>.pfx`, sem prefixo. A guarda recusa `.pfx/.p12/.pem/.key/.jks/.crt/.cer/.der`, o prefixo `fiscal/`, travessia de diretório e percent-encoding.
- **Keys legadas não são apagadas automaticamente** — vivem em outro bucket. O painel marca o certificado como legado e pede reenvio; a limpeza do objeto antigo é manual no R2.

---

## O que foi entregue

### Servidor
- `src/lib/fiscal/certificate.ts` — `parsePfx`, `isExpired`, `matchesCnpj`, `CertificateError` com código (`WRONG_PASSWORD` / `INVALID_FILE` / `NO_CERTIFICATE`). CNPJ extraído do `subjectAltName` (OID 2.16.76.1.3.3), com fallback no CN (`RAZAO:CNPJ`).
- `src/lib/fiscal/storage.ts` — bucket fiscal privado, `certificateObjectKey`, `belongsToOrg`, put/get/delete.
- `src/lib/s3-object-guard.ts` — `isSensitiveObjectKey`.
- `src/app/router/fiscal-config/index.ts` — `requireManage` no `get`; `certificateKey` fora do output; campos de certificado fora do `upsert`; procedure nova `uploadCertificate`.
- `src/app/api/s3/image/route.ts` — 403 para key sensível.
- `src/app/api/s3/upload/route.ts` — PKCS#12 fora da allowlist.

### Client
- `certificate-uploader.tsx` — arquivo + senha na mesma etapa, validação no servidor, aviso de armazenamento legado.
- `fiscal-config-panel.tsx` — campo de senha solto removido; validade vem preenchida do certificado.

### Ambiente
- `FISCAL_ENCRYPTION_KEY` e `FISCAL_S3_BUCKET_NAME` no `.env`, no `.env.test.example` e `FISCAL_*` no `globalEnv` do `turbo.json`.

---

## Testes

| Arquivo | Cobre |
|---|---|
| `src/lib/fiscal/certificate.test.ts` (14) | titular/emissor/validade, CNPJ por altName e por CN, e-CPF, senha errada × arquivo inválido, vencimento, CNPJ divergente |
| `src/lib/fiscal/encryption.test.ts` (11) | round-trip, IV aleatório, scrypt, unicode, env ausente, formato inválido, adulteração GCM, chave rotacionada, máscara |
| `src/lib/s3-object-guard.test.ts` (9) | imagens liberadas; `.pfx` legado, prefixo `fiscal/`, query string, percent-encoding, travessia, separador Windows |
| `tests/integration/fiscal-config.test.ts` (17) | `certificateKey` nunca no output, marcação de legado, `requireManage` em get/upsert/upload, isolamento entre orgs, upload feliz (bucket privado + senha cifrada + validade), senha errada, CNPJ divergente, vencido, e-CPF, não-PKCS#12, sem CNPJ cadastrado, troca apaga o anterior, legado não é apagado |

`src/lib/fiscal/__fixtures__/make-test-pfx.ts` gera o `.pfx` autoassinado em memória — nenhum binário de certificado versionado. O storage é mockado no teste de integração: nada sobe para o R2.

---

## Pendencias conhecidas

- [ ] Criar o bucket privado no R2 e apontar `FISCAL_S3_BUCKET_NAME` (dev usa `nerp-fiscal-dev`, ainda não criado).
- [ ] Apagar manualmente os `.pfx` que ficaram no bucket de imagens, depois que cada org reenviar o certificado.
- [ ] Definir `FISCAL_ENCRYPTION_KEY` no Coolify/Vercel (o valor de dev é local).
- [ ] Alertas de certificado vencendo (30/15/7 dias) — entram na fase de gestão fiscal.
