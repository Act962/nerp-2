import { installIntegracao } from "./install";
import { listIntegracoes } from "./list";
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
};
