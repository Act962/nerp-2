import HeroSection from "./_components/hero-section";

/**
 * A raiz do `apps/web` é a porta do ERP.
 *
 * O site institucional da ÓRBITA HUB saiu daqui e virou um app próprio
 * (`apps/site`), que consome o conteúdo publicado por `/api/site/*`. O que o
 * `apps/web` continua sendo dono é do banco, do login, do storage e do admin
 * do site, em `/site`.
 */
export default function Home() {
  return <HeroSection />;
}
