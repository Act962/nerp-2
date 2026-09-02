import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { CrmNodeType } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { requireWorkflowDaOrg } from "./_access";

/**
 * Grava o grafo inteiro de uma vez.
 *
 * Substituir tudo, como na grade da agenda: o editor mexe em nós e ligações ao
 * mesmo tempo, e diferença parcial exigiria o cliente reconciliar ids — mais
 * caminhos para o grafo ficar meio salvo, que é o estado em que a automação
 * roda pela metade.
 *
 * Os ids vêm do cliente, e é por isso que a gravação é uma transação que apaga
 * e recria: nó de outra organização não tem como sobreviver a isso.
 */
export const saveGraph = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Grava o grafo", tags: ["Automações"] })
  .input(
    z.object({
      workflowId: z.string().min(1),
      nos: z.array(
        z.object({
          /** Id temporário do editor; o servidor devolve o definitivo. */
          id: z.string().min(1),
          type: z.enum(CrmNodeType),
          name: z.string().trim().min(1),
          position: z.object({ x: z.number(), y: z.number() }),
          data: z.record(z.string(), z.unknown()).default({}),
        }),
      ),
      arestas: z.array(
        z.object({
          fromNodeId: z.string().min(1),
          toNodeId: z.string().min(1),
          fromOutput: z.string().default("main"),
        }),
      ),
    }),
  )
  .output(z.object({ ids: z.record(z.string(), z.string()) }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    const workflow = await requireWorkflowDaOrg(
      input.workflowId,
      organizationId,
    );

    const gatilhos = input.nos.filter((no) => no.type.startsWith("TRIGGER_"));
    if (gatilhos.length !== 1) {
      throw errors.BAD_REQUEST({
        message:
          "A automação precisa de exatamente um gatilho — o que a faz começar.",
      });
    }

    const conhecidos = new Set(input.nos.map((no) => no.id));
    for (const aresta of input.arestas) {
      if (
        !conhecidos.has(aresta.fromNodeId) ||
        !conhecidos.has(aresta.toNodeId)
      ) {
        throw errors.BAD_REQUEST({
          message: "Há uma ligação para um passo que não está no desenho.",
        });
      }
    }

    const ids: Record<string, string> = {};

    await prisma.$transaction(async (tx) => {
      // As ligações caem por cascata junto com os nós.
      await tx.crmWorkflowNode.deleteMany({
        where: { workflowId: workflow.id },
      });

      for (const no of input.nos) {
        const criado = await tx.crmWorkflowNode.create({
          data: {
            organizationId,
            workflowId: workflow.id,
            type: no.type,
            name: no.name,
            position: no.position,
            data: no.data as object,
          },
          select: { id: true },
        });
        ids[no.id] = criado.id;
      }

      for (const aresta of input.arestas) {
        await tx.crmWorkflowConnection.create({
          data: {
            organizationId,
            workflowId: workflow.id,
            fromNodeId: ids[aresta.fromNodeId],
            toNodeId: ids[aresta.toNodeId],
            fromOutput: aresta.fromOutput,
          },
        });
      }
    });

    return { ids };
  });
