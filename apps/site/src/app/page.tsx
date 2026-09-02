import { APP_LINKS, getSiteContent } from "@/lib/api";
import { OrbitaHome } from "./_components/orbita-home";

/**
 * A home é a experiência 3D da ÓRBITA HUB.
 *
 * O conteúdo dos painéis vem do `apps/web` pelo servidor, e não pelo
 * navegador: o menu tem de estar no HTML que chega, tanto para quem lê a
 * página quanto para quem a indexa.
 */
export default async function Home() {
  const content = await getSiteContent();

  return (
    <OrbitaHome
      content={content}
      loginHref={APP_LINKS.login}
      signupHref={APP_LINKS.signup}
    />
  );
}
