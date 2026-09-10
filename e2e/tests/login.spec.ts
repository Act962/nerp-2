import { expect, test } from "@playwright/test";

/**
 * Molde para e2e: navegador de verdade, app buildado, sem mock.
 *
 * Deliberadamente cobre só o que não depende de dados semeados — assim a suíte
 * roda contra qualquer ambiente. Testes que exigem sessão devem semear um
 * usuário no banco e gravar o storageState num `setup project` do Playwright,
 * em vez de repetir o login em cada spec.
 */
test.describe("Login", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("renderiza o formulário", async ({ page }) => {
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Senha")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Login", exact: true }),
    ).toBeVisible();
  });

  test("recusa credencial inválida e mantém o usuário na página", async ({
    page,
  }) => {
    await page.getByLabel("E-mail").fill("ninguem@teste.local");
    await page.getByLabel("Senha").fill("senha-errada-123");
    await page.getByRole("button", { name: "Login", exact: true }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel("E-mail")).toBeVisible();
  });

  /**
   * O cadastro continua ABERTO — só saiu de vista.
   *
   * O que motivou esconder foi suporte: lojista que já tinha conta clicava em
   * "Cadastrar", criava uma segunda, caía numa tela sem empresa nenhuma e
   * abria chamado dizendo que os dados dele tinham sumido. Sem o link à mão,
   * quem não lembra da conta tende a tentar entrar em vez de criar outra.
   *
   * Os dois testes andam juntos de propósito: um fixa que o link sumiu, o
   * outro que a porta não foi trancada. Quebrar o segundo significa que
   * esconder virou bloquear, e aí a captação por CTA/rede social morre junto.
   */
  test("não mostra link de cadastro para quem chegou sem convite", async ({
    page,
  }) => {
    await expect(page.getByRole("link", { name: "Cadastrar" })).toHaveCount(0);
  });

  test("mas o /cadastro segue acessível por URL direta", async ({ page }) => {
    await page.goto("/cadastro");

    await expect(page).toHaveURL(/\/cadastro/);
    await expect(page.getByLabel("E-mail")).toBeVisible();
  });
});
