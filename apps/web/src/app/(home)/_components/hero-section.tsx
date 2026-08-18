"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Header } from "./header";
import { authClient } from "@/lib/auth-client";

export default function HeroSection() {
  const { data: session } = authClient.useSession();
  return (
    <>
      <Header />

      <main>
        <div
          aria-hidden
          className="z-2 absolute inset-0 isolate hidden opacity-50 contain-strict lg:block"
        >
          <div className="w-140 h-320 -translate-y-87.5 absolute left-0 top-0 -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(0,0%,85%,.08)_0,hsla(0,0%,55%,.02)_50%,hsla(0,0%,45%,0)_80%)]" />
          <div className="h-320 absolute left-0 top-0 w-60 -rotate-45 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.06)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)] [translate:5%_-50%]" />
          <div className="h-320 -translate-y-87.5 absolute left-0 top-0 w-60 -rotate-45 bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.04)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)]" />
        </div>

        <section className="bg-muted/50 dark:bg-background overflow-hidden">
          <div className="relative mx-auto max-w-5xl px-6 pt-28 lg:pt-24">
            <div className="relative z-10 mx-auto max-w-2xl text-center">
              <h1 className="text-balance text-4xl font-semibold md:text-5xl lg:text-6xl">
                Sistema de ERP Moderno
              </h1>
              <p className="text-muted-foreground mx-auto my-8 max-w-2xl text-xl">
                Sistema de ERP Moderno para empresas de todas as empresas.
              </p>

              <Button asChild size="lg">
                <Link href={session?.user ? "/dashboard" : "/login"}>
                  <span className="btn-label">Começar agora</span>
                </Link>
              </Button>
            </div>
          </div>

          <div className="mx-auto 2xl:max-w-7xl">
            <div className="perspective-distant pl-8 lg:pl-44">
              <div className="lg:h-176 rotate-x-20 mask-b-from-55% mask-b-to-100% mask-r-from-75% skew-x-12 pl-6 pt-6">
                <Image
                  className="rounded-lg border shadow-xl dark:hidden"
                  src="/card.webp"
                  alt="Tailark hero section"
                  width={2880}
                  height={2074}
                />
                <Image
                  className="rounded-lg hidden border shadow-xl dark:block"
                  src="/dark-card.webp"
                  alt="Tailark hero section"
                  width={2880}
                  height={2074}
                />
              </div>
            </div>
          </div>
        </section>
        {/* <section className="dark:bg-background bg-muted/50 relative z-10 py-16">
          <div className="m-auto max-w-5xl px-6">
            <h2 className="text-center text-lg font-medium">
              Sua empresa é parceira.
            </h2>
            <div className="mx-auto mt-20 flex max-w-4xl flex-wrap items-center justify-center gap-x-12 gap-y-8 sm:gap-x-16 sm:gap-y-12">
              <img
                className="h-5 w-fit dark:invert"
                src="https://html.tailus.io/blocks/customers/nvidia.svg"
                alt="Nvidia Logo"
                height="20"
                width="auto"
              />
              <img
                className="h-4 w-fit dark:invert"
                src="https://html.tailus.io/blocks/customers/column.svg"
                alt="Column Logo"
                height="16"
                width="auto"
              />
              <img
                className="h-4 w-fit dark:invert"
                src="https://html.tailus.io/blocks/customers/github.svg"
                alt="GitHub Logo"
                height="16"
                width="auto"
              />
              <img
                className="h-5 w-fit dark:invert"
                src="https://html.tailus.io/blocks/customers/nike.svg"
                alt="Nike Logo"
                height="20"
                width="auto"
              />
              <img
                className="h-4 w-fit dark:invert"
                src="https://html.tailus.io/blocks/customers/laravel.svg"
                alt="Laravel Logo"
                height="16"
                width="auto"
              />
              <img
                className="h-7 w-fit dark:invert"
                src="https://html.tailus.io/blocks/customers/lilly.svg"
                alt="Lilly Logo"
                height="28"
                width="auto"
              />
              <img
                className="h-5 w-fit dark:invert"
                src="https://html.tailus.io/blocks/customers/lemonsqueezy.svg"
                alt="Lemon Squeezy Logo"
                height="20"
                width="auto"
              />
              <img
                className="h-6 w-fit dark:invert"
                src="https://html.tailus.io/blocks/customers/openai.svg"
                alt="OpenAI Logo"
                height="24"
                width="auto"
              />
              <img
                className="h-4 w-fit dark:invert"
                src="https://html.tailus.io/blocks/customers/tailwindcss.svg"
                alt="Tailwind CSS Logo"
                height="16"
                width="auto"
              />
              <img
                className="h-5 w-fit dark:invert"
                src="https://html.tailus.io/blocks/customers/vercel.svg"
                alt="Vercel Logo"
                height="20"
                width="auto"
              />
              <img
                className="h-5 w-fit dark:invert"
                src="https://html.tailus.io/blocks/customers/zapier.svg"
                alt="Zapier Logo"
                height="20"
                width="auto"
              />
            </div>
          </div>
        </section> */}
      </main>
    </>
  );
}
