import { CatalogList } from "@/features/promotional-catalog/catalog-list";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  // Sem a permissão da página, o catálogo nem abre (antes a rota era livre
  // para qualquer membro logado). Editar exige, além disso, a ação
  // `catalogo-promocional-editar` — checada no servidor, em cada mutation.
  await requirePermission("catalogo-promocional");
  return <CatalogList />;
}
