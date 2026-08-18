import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

function uniqueSorted(values: (string | null)[]): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => !!value)),
  ).sort((a, b) => a.localeCompare(b));
}

export const pdvPhotoFilterOptions = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}))
  .handler(async ({ context }) => {
    const rows = await prisma.pdvPhoto.findMany({
      where: { organizationId: context.org.id },
      select: {
        section: true,
        responsibleCompany: true,
        coordinatorName: true,
        consultantName: true,
        code: true,
      },
    });

    return {
      sections: uniqueSorted(rows.map((row) => row.section)),
      companies: uniqueSorted(rows.map((row) => row.responsibleCompany)),
      coordinators: uniqueSorted(rows.map((row) => row.coordinatorName)),
      consultants: uniqueSorted(rows.map((row) => row.consultantName)),
      codes: uniqueSorted(rows.map((row) => row.code)),
    };
  });
