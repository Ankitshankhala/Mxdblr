-- Repoint banner colours from the retired navy palette to espresso.
--
-- The app-wide palette swap (navy -> espresso) changed CSS tokens and inline
-- styles, but Banner.bgColor is admin-editable data: existing rows kept the old
-- navy and rendered a navy hero scrim against an espresso site.
--
-- Two parts, both required:
--   1. the column DEFAULT, so new banners start espresso
--   2. an UPDATE of existing rows that still hold an exact old-palette value
--
-- Rows an admin has deliberately set to some other colour are left untouched --
-- only the three retired values are rewritten.

ALTER TABLE "Banner" ALTER COLUMN "bgColor" SET DEFAULT '#1F1813';

UPDATE "Banner" SET "bgColor" = '#1F1813' WHERE upper("bgColor") = '#1A1A2E';
UPDATE "Banner" SET "bgColor" = '#352B22' WHERE upper("bgColor") = '#2C2C4A';
UPDATE "Banner" SET "bgColor" = '#6E6257' WHERE upper("bgColor") = '#6B6B7D';
