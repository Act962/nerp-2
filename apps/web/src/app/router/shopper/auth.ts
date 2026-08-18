import { base } from "@/app/middlewares/base";
import { signShopperToken } from "@/features/shopper/lib/shopper-token";
import prisma from "@/lib/db";
import { compare, hash } from "bcrypt";
import { z } from "zod";
import { assertShopper } from "./_assert-shopper";

// Cadastro do cliente final (identidade global). Retorna o token bearer.
export const shopperSignup = base
  .route({ method: "POST", summary: "Cadastro do cliente" })
  .input(
    z.object({
      email: z.string().trim().email().max(160),
      password: z.string().min(6).max(72),
      name: z.string().trim().max(120).optional(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const email = input.email.toLowerCase();
    const existing = await prisma.shopper.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) throw errors.BAD_REQUEST({ message: "E-mail já cadastrado" });

    const passwordHash = await hash(input.password, 8);
    const shopper = await prisma.shopper.create({
      data: { email, passwordHash, name: input.name || undefined },
      select: { id: true, name: true, email: true },
    });

    return {
      shopperId: shopper.id,
      token: signShopperToken(shopper.id),
      name: shopper.name,
      email: shopper.email,
    };
  });

export const shopperLogin = base
  .route({ method: "POST", summary: "Login do cliente" })
  .input(
    z.object({
      email: z.string().trim().email().max(160),
      password: z.string().min(1).max(72),
    }),
  )
  .handler(async ({ input, errors }) => {
    const email = input.email.toLowerCase();
    const shopper = await prisma.shopper.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, passwordHash: true },
    });
    if (!shopper || !(await compare(input.password, shopper.passwordHash))) {
      throw errors.UNAUTHORIZED({ message: "E-mail ou senha inválidos" });
    }

    return {
      shopperId: shopper.id,
      token: signShopperToken(shopper.id),
      name: shopper.name,
      email: shopper.email,
    };
  });

export const shopperMe = base
  .route({ method: "GET", summary: "Sessão do cliente" })
  .input(z.object({ token: z.string().optional() }))
  .handler(async ({ input, errors }) => {
    const shopperId = await assertShopper(input.token, errors);
    const shopper = await prisma.shopper.findUnique({
      where: { id: shopperId },
      select: { id: true, name: true, email: true },
    });
    return shopper;
  });
