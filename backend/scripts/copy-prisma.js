import { access, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.resolve(__dirname, '../src/generated/prisma');
const destDir = path.resolve(__dirname, '../dist/generated/prisma');

try {
  await access(srcDir);
  await cp(srcDir, destDir, { recursive: true });
  console.info('[postbuild] Prisma client copied to dist/generated/prisma');
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
    console.warn('[postbuild] Prisma client not found, skipping copy');
  } else {
    console.error('[postbuild] Failed to copy Prisma client', error);
    process.exit(1);
  }
}
