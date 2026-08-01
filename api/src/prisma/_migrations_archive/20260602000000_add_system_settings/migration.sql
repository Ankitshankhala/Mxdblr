-- CreateTable
CREATE TABLE "SystemSettings" (
    "id"                  INTEGER NOT NULL DEFAULT 1,
    "whatsappNumber"      TEXT NOT NULL DEFAULT '',
    "msg91ApiKey"         TEXT NOT NULL DEFAULT '',
    "cloudinaryCloud"     TEXT NOT NULL DEFAULT '',
    "cloudinaryApiKey"    TEXT NOT NULL DEFAULT '',
    "cloudinaryApiSecret" TEXT NOT NULL DEFAULT '',
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton row so GET /api/admin/settings always returns a row
INSERT INTO "SystemSettings" ("id", "updatedAt") VALUES (1, NOW())
ON CONFLICT ("id") DO NOTHING;
