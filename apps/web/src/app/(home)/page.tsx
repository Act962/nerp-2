import { getSiteContent } from "@/features/site/server/content";
import { OrbitaHome } from "./_components/orbita-home";

/**
 * A home é o site institucional da ÓRBITA HUB.
 *
 * O conteúdo dos painéis da barra sai do banco (admin em `/site`); enquanto
 * as tabelas estiverem vazias, `getSiteContent` devolve o mesmo conteúdo que
 * já vinha no código.
 *
 * O hero anterior do ERP continua no repositório, em
 * `_components/hero-section.tsx`, sem referência — está ali caso a decisão
 * mude, e não custa nada por não ser importado.
 */
export default async function Home() {
  const content = await getSiteContent();

  return <OrbitaHome content={content} />;
}
