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

  test("leva para o cadastro pelo link do rodapé", async ({ page }) => {
    await page.getByRole("link", { name: "Cadastrar" }).click();
    await expect(page).toHaveURL(/\/cadastro/);
  });
});
