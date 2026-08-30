import { installIntegracao } from "./install";
import { listIntegracoes } from "./list";
import { orbitaRevoke } from "./orbita/revoke";
import { orbitaStatus } from "./orbita/status";
import { previewIntegracao } from "./preview";
import { removeIntegracao } from "./remove";
import { setProviderLogo } from "./set-provider-logo";
import { testIntegracao } from "./test";

export const integracoesRoutes = {
  list: listIntegracoes,
  install: installIntegracao,
  test: testIntegracao,
  remove: removeIntegracao,
  preview: previewIntegracao,
  setProviderLogo,
  // Órbita CRM: a conexão mora em `NasaIntegrationKey`, não no catálogo
  // financeiro — por isso procedures próprias em vez de install/remove.
  orbita: { status: orbitaStatus, revoke: orbitaRevoke },
};
