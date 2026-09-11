import { expect, test } from "@playwright/test";

/**
 * A porta sem cadastro: da home ao dashboard, sem digitar nada.
 *
 * Cria conta anônima de verdade (é o ponto do teste), então roda contra o
 * banco do ambiente — a organização criada tem slug `sandbox-…` e expira
 * sozinha em 30 dias.
 */
test.describe("Começar agora", () => {
  test("da home ao dashboard, escolhendo ramo e soluções", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Começar agora" }).click();
    await expect(page).toHaveURL(/\/comecar/);

    await page.getByRole("button", { name: /Supermercados/ }).click();
    await page.getByRole("button", { name: "Continuar" }).click();

    // O ramo pré-marca soluções; a pessoa pode só seguir.
    await expect(
      page.getByRole("heading", { name: "O que você quer resolver?" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Criar minha empresa de teste/ })
      .click();

    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    // Empresa de teste: banner, guia e as 50 ★ na barra lateral.
    await expect(page.getByText(/empresa de teste/i).first()).toBeVisible();
    await expect(page.getByText("Seu guia")).toBeVisible();
    await expect(page.getByText("50 ★")).toBeVisible();
  });

  test("quem já tem conta chega pelo login", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Já tenho conta" }),
    ).toHaveAttribute("href", "/login");
  });
});
