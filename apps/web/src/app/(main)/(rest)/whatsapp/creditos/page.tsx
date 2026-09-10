import { redirect } from "next/navigation";

// Os créditos deixaram de ser "do WhatsApp": Stars pagam o Astro também, e a
// página vive em Configurações. Quem tinha o link antigo cai na nova.
export default function Page() {
  redirect("/configuracoes/stars");
}
