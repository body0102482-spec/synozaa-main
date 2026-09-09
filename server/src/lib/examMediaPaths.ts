import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Packaged default assets (SVGs / seed as-mr) shipped with the app. */
export function packagedExamRoot(): string {
  return path.resolve(__dirname, '../../../client/public/exam');
}

/**
 * Persistent upload root — survives deploys that replace the app folder.
 * Prefer SYNOZA_EXAM_MEDIA_ROOT; otherwise use <app-parent>/synoza-media/exam
 * next to the app directory on the server, falling back to packaged path locally.
 */
export function persistentExamRoot(): string {
  const fromEnv = process.env.SYNOZA_EXAM_MEDIA_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);

  // Production layout: /home/.../synoza.anmka.com/server/dist -> ../../synoza-media/exam
  // lives at /home/.../synoza-media/exam (sibling of synoza.anmka.com) OR
  // /home/.../synoza.anmka.com/../synoza-media/exam
  const appRoot = path.resolve(__dirname, '../../..'); // synoza.anmka.com or repo root
  const sibling = path.resolve(appRoot, '../synoza-media/exam');
  const inside = path.resolve(appRoot, 'synoza-media/exam');

  // Prefer sibling outside the wiped app dir when it exists or when NODE_ENV=production
  if (process.env.NODE_ENV === 'production') {
    return sibling;
  }

  if (fs.existsSync(sibling)) return sibling;
  if (fs.existsSync(inside)) return inside;
  return packagedExamRoot();
}

export function examCasesUploadRoot(): string {
  return path.join(persistentExamRoot(), 'cases');
}

export function ensureExamMediaDirs(): void {
  try {
    fs.mkdirSync(examCasesUploadRoot(), { recursive: true });
  } catch {
    /* ignore — uploads will fail loudly later */
  }
}
