-- Events feed now orders by displayOrder (admin-controlled) then eventDate desc,
-- so the homepage matches the admin reorder controls. "featured" is a card badge
-- only and is no longer a sort key.

-- DropIndex (old feed index keyed on eventDate only, and the now-unused featured index)
DROP INDEX IF EXISTS "Event_published_eventDate_idx";
DROP INDEX IF EXISTS "Event_featured_idx";

-- CreateIndex (covers WHERE published ORDER BY displayOrder asc, eventDate desc)
CREATE INDEX "Event_published_displayOrder_eventDate_idx" ON "Event"("published", "displayOrder", "eventDate");
