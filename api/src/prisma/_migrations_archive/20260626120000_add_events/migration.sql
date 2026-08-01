-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM (
    'PRODUCT_LAUNCH',
    'DEALER_MEETUP',
    'TRAINING',
    'EXHIBITION',
    'CELEBRATION',
    'OTHER'
);

-- CreateTable
CREATE TABLE "Event" (
    "id"           TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "description"  TEXT NOT NULL DEFAULT '',
    "category"     "EventCategory" NOT NULL DEFAULT 'OTHER',
    "eventDate"    TIMESTAMP(3) NOT NULL,
    "location"     TEXT NOT NULL DEFAULT '',
    "coverImage"   TEXT NOT NULL DEFAULT '',
    "images"       TEXT[] DEFAULT ARRAY[]::TEXT[],
    "videos"       JSONB NOT NULL DEFAULT '[]',
    "published"    BOOLEAN NOT NULL DEFAULT false,
    "featured"     BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_published_eventDate_idx" ON "Event"("published", "eventDate");

-- CreateIndex
CREATE INDEX "Event_featured_idx" ON "Event"("featured");
