"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { MenuIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function Header() {
  const [menuState, setMenuState] = useState(false);
  const { data: session, isPending } = authClient.useSession();
  return (
    <header className="sticky left-0 right-0 top-0 z-20 w-full border-b border-dashed bg-white backdrop-blur dark:bg-zinc-950/50 lg:dark:bg-transparent">
      <nav
        data-state={menuState && "active"}
        className="w-full border-b border-dashed bg-white backdrop-blur dark:bg-zinc-950/50 lg:dark:bg-transparent"
      >
        <div className="m-auto max-w-5xl px-6">
          <div className="flex flex-wrap items-center justify-between gap-6 py-3 lg:gap-0 lg:py-4">
            <div className="flex w-full justify-between lg:w-auto">
              <Link
                href="/"
                aria-label="home"
                className="flex items-center space-x-2"
              >
                <h2 className="font-bold">
                  <span className="text-yellow-500">N</span>ERP
                </h2>
              </Link>

              <button
                onClick={() => setMenuState(!menuState)}
                aria-label={menuState === true ? "Close Menu" : "Open Menu"}
                type="button"
                className="relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 lg:hidden"
              >
                <MenuIcon className="in-data-[state=active]:rotate-180 in-data-[state=active]:scale-0 in-data-[state=active]:opacity-0 m-auto size-6 duration-200" />
                <XIcon className="in-data-[state=active]:rotate-0 in-data-[state=active]:scale-100 in-data-[state=active]:opacity-100 absolute inset-0 m-auto size-6 -rotate-180 scale-0 opacity-0 duration-200" />
              </button>
            </div>

            <div className="bg-background in-data-[state=active]:block lg:in-data-[state=active]:flex mb-6 hidden w-full flex-wrap items-center justify-end space-y-8 rounded-3xl border p-6 shadow-2xl shadow-zinc-300/20 md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-6 lg:space-y-0 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none dark:shadow-none dark:lg:bg-transparent">
              <div className="flex w-full flex-col space-y-3 sm:flex-row sm:gap-3 sm:space-y-0 md:w-fit  lg:pl-6">
                {session?.user && !isPending && (
                  <Button size="sm" asChild>
                    <Link href="/dashboard">
                      <span>Dashboard</span>
                    </Link>
                  </Button>
                )}

                {!session?.user && (
                  <>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/login">
                        <span>Entrar</span>
                      </Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link href="/cadastro">
                        <span>Cadastrar</span>
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
