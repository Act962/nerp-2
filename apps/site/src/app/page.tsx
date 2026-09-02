import { APP_LINKS, getSiteContent, getSitePartners } from "@/lib/api";
import { PARTNERS_PREVIEW } from "@/lib/partners-preview";
import { OrbitaHome } from "./_components/orbita-home";

/**
 * A home é a experiência 3D da ÓRBITA HUB.
 *
 * O conteúdo dos painéis vem do `apps/web` pelo servidor, e não pelo
 * navegador: o menu tem de estar no HTML que chega, tanto para quem lê a
 * página quanto para quem a indexa.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [content, partners, params] = await Promise.all([
    getSiteContent(),
    getSitePartners(),
    searchParams,
  ]);

  /*
    `?parceiros=demo` mostra a seção com conteúdo de ensaio, só em
    desenvolvimento. Sem isso não há como conferir o leiaute antes de o
    cliente cadastrar o primeiro parceiro — a seção, corretamente, some
    quando as listas estão vazias.
  */
  const ensaio =
    process.env.NODE_ENV !== "production" && params.parceiros === "demo";

  return (
    <OrbitaHome
      content={content}
      partners={ensaio ? PARTNERS_PREVIEW : partners}
      loginHref={APP_LINKS.login}
      signupHref={APP_LINKS.signup}
    />
  );
}
