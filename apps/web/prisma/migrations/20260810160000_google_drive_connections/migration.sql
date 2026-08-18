-- CreateTable
CREATE TABLE "google_drive_connections" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleEmail" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_drive_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "google_drive_connections_organizationId_userId_key" ON "google_drive_connections"("organizationId", "userId");
CREATE INDEX "google_drive_connections_organizationId_idx" ON "google_drive_connections"("organizationId");

ALTER TABLE "google_drive_connections" ADD CONSTRAINT "google_drive_connections_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "google_drive_connections" ADD CONSTRAINT "google_drive_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
