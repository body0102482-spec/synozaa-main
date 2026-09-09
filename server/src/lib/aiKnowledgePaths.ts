import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Persistent root for AI knowledge uploads (prompt attachments, files, media).
 * Prefer SYNOZA_AI_KNOWLEDGE_ROOT; otherwise <app-parent>/synoza-media/knowledge.
 */
export function persistentAiKnowledgeRoot(): string {
  const fromEnv = process.env.SYNOZA_AI_KNOWLEDGE_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);

  const appRoot = path.resolve(__dirname, '../../..');
  const sibling = path.resolve(appRoot, '../synoza-media/knowledge');
  const inside = path.resolve(appRoot, 'synoza-media/knowledge');

  if (process.env.NODE_ENV === 'production') return sibling;
  if (fs.existsSync(sibling)) return sibling;
  if (fs.existsSync(inside)) return inside;
  return inside;
}

export function ensureAiKnowledgeDirs(): void {
  try {
    fs.mkdirSync(persistentAiKnowledgeRoot(), { recursive: true });
  } catch {
    /* uploads will fail loudly later */
  }
}
