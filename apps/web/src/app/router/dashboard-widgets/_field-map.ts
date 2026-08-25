import prisma from "@/lib/db";
import type { ResolveContext, WidgetValue } from "./_types";

const MAX_PROMOTERS = 40;

export async function getFieldMap(ctx: ResolveContext): Promise<WidgetValue> {
  const [stores, promoterMembers] = await Promise.all([
    prisma.store.findMany({
      where: {
        organizationId: ctx.organizationId,
        isActive: true,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        latitude: true,
        longitude: true,
      },
    }),
    prisma.member.findMany({
      where: {
        organizationId: ctx.organizationId,
        role: { in: ["member", "admin", "owner"] },
      },
      select: { id: true, userId: true, user: { select: { name: true } } },
      take: MAX_PROMOTERS,
    }),
  ]);

  const positions = await Promise.all(
    promoterMembers.map(async (member) => {
      const photo = await prisma.pdvPhoto.findFirst({
        where: {
          organizationId: ctx.organizationId,
          createdById: member.userId,
          capturedLatitude: { not: null },
          capturedLongitude: { not: null },
        },
        orderBy: { capturedAt: "desc" },
        select: {
          capturedLatitude: true,
          capturedLongitude: true,
          capturedCity: true,
          capturedState: true,
        },
      });
      if (
        !photo ||
        photo.capturedLatitude === null ||
        photo.capturedLongitude === null
      ) {
        return null;
      }
      return {
        id: `promoter-${member.id}`,
        lat: photo.capturedLatitude,
        lng: photo.capturedLongitude,
        label: member.user.name,
        type: "promoter" as const,
        detail: [photo.capturedCity, photo.capturedState]
          .filter(Boolean)
          .join(", "),
      };
    }),
  );

  const storePins = stores
    .filter(
      (s): s is typeof s & { latitude: number; longitude: number } =>
        s.latitude !== null && s.longitude !== null,
    )
    .map((s) => ({
      id: s.id,
      lat: s.latitude,
      lng: s.longitude,
      label: s.name,
      type: "store" as const,
      detail: [s.city, s.state].filter(Boolean).join(", "),
    }));

  const promoterPins = positions.filter(
    (p): p is NonNullable<typeof p> => p !== null,
  );

  return {
    kind: "MAP",
    scope: "field",
    pins: [...storePins, ...promoterPins],
  };
}
