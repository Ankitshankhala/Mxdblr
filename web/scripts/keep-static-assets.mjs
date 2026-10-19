/**
 * Keeps earlier builds' /_next/static files (CSS, JS chunks) available after a
 * deploy. Run by npm around `next build`: `save` (prebuild) and `restore`
 * (postbuild).
 *
 * Why: browsers may show a page they saved before a deploy once more while
 * they fetch the new one (stale-while-revalidate), and dealers can have a page
 * open during a deploy. Both ask for the old build's hashed files, which
 * `next build` deletes, so the page appears unstyled or a click fails until a
 * reload. Kept here, those files keep working. Hashed names never collide with
 * the new build's, and files older than KEEP_DAYS are pruned.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KEEP_DAYS = 30;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const live = path.join(root, '.next', 'static');
const archive = path.join(root, '.next-static-archive');

/** Copies files from `from` into `to`, leaving files that already exist untouched. */
function mergeInto(from, to) {
  if (!fs.existsSync(from)) return 0;
  let copied = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copied += mergeInto(src, dest);
    } else if (!fs.existsSync(dest)) {
      fs.mkdirSync(to, { recursive: true });
      fs.copyFileSync(src, dest);
      const { atime, mtime } = fs.statSync(src);
      fs.utimesSync(dest, atime, mtime); // keep the build time, which pruning goes by
      copied++;
    }
  }
  return copied;
}

/** Deletes archived files older than KEEP_DAYS, then any empty folders. */
function prune(dir, cutoff) {
  if (!fs.existsSync(dir)) return 0;
  let removed = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removed += prune(p, cutoff);
      if (fs.readdirSync(p).length === 0) fs.rmdirSync(p);
    } else if (fs.statSync(p).mtimeMs < cutoff) {
      fs.unlinkSync(p);
      removed++;
    }
  }
  return removed;
}

const command = process.argv[2];
if (command === 'save') {
  const saved = mergeInto(live, archive);
  const pruned = prune(archive, Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000);
  console.log(`[keep-static-assets] archived ${saved} file(s), pruned ${pruned} older than ${KEEP_DAYS} days`);
} else if (command === 'restore') {
  const restored = mergeInto(archive, live);
  console.log(`[keep-static-assets] restored ${restored} earlier build file(s) into .next/static`);
} else {
  console.error('usage: node scripts/keep-static-assets.mjs save|restore');
  process.exit(1);
}
