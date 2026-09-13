-- AlterTable
ALTER TABLE "leads" ADD COLUMN "hyundaiGoLiveAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "locale" TEXT,
    "entityKey" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_events_createdAt_name_idx" ON "analytics_events"("createdAt", "name");

-- CreateIndex
CREATE INDEX "analytics_events_visitorId_idx" ON "analytics_events"("visitorId");

-- CreateIndex
CREATE INDEX "analytics_events_name_entityKey_createdAt_idx" ON "analytics_events"("name", "entityKey", "createdAt");

-- CreateIndex
CREATE INDEX "leads_hyundaiGoLiveAt_idx" ON "leads"("hyundaiGoLiveAt");
