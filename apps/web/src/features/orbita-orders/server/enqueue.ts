import "server-only";
import { inngest, orbitaOrderRequested } from "@/lib/inngest/client";
import type { OrbitaOrderDelivery } from "../lib/payload";

/**
 * Agenda a entrega do pedido ao Órbita. A entrega em si roda no Inngest
 * (`orbita-order-delivery`), com retry — o checkout do cliente não espera a
 * resposta do Órbita; a tela de sucesso consulta `checkout.orbitaStatus`.
 */
export async function enqueueOrbitaOrder(
  saleId: string,
  delivery?: OrbitaOrderDelivery,
): Promise<void> {
  await inngest.send(
    orbitaOrderRequested.create({
      saleId,
      delivery: delivery ?? { method: null, address: null, notes: null },
    }),
  );
}
