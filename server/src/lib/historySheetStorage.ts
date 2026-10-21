import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { persistentExamRoot } from './examMediaPaths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_MAX_UPLOAD_SIZE_MB = 20;
const configuredMaxUploadSizeMb = Number(process.env.HISTORY_SHEET_MAX_UPLOAD_SIZE_MB);

export const MAX_HISTORY_SHEET_UPLOAD_SIZE_MB =
  Number.isSafeInteger(configuredMaxUploadSizeMb) &&
  configuredMaxUploadSizeMb > 0 &&
  Number.isSafeInteger(configuredMaxUploadSizeMb * 1024 * 1024)
    ? configuredMaxUploadSizeMb
    : DEFAULT_MAX_UPLOAD_SIZE_MB;
export const MAX_HISTORY_SHEET_UPLOAD_SIZE_BYTES =
  MAX_HISTORY_SHEET_UPLOAD_SIZE_MB * 1024 * 1024;

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export interface HistorySheetUpload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export class HistorySheetValidationError extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
    this.name = 'HistorySheetValidationError';
  }
}

export function validateHistorySheetUpload(file: HistorySheetUpload) {
  if (file.size > MAX_HISTORY_SHEET_UPLOAD_SIZE_BYTES) {
    throw new HistorySheetValidationError(
      `History Sheet exceeds the maximum allowed size of ${MAX_HISTORY_SHEET_UPLOAD_SIZE_MB} MB.`,
      413,
    );
  }
  if (file.size === 0 || file.buffer.length === 0) {
    throw new HistorySheetValidationError('The uploaded History Sheet is empty.');
  }

  const extension = path.extname(file.originalname).toLowerCase();
  const expectedMimeType = MIME_TYPE_BY_EXTENSION[extension];
  if (!expectedMimeType || file.mimetype.toLowerCase() !== expectedMimeType) {
    throw new HistorySheetValidationError('Upload a PDF or DOCX History Sheet.');
  }

  const isPdf = extension === '.pdf' && file.buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  const isDocx =
    extension === '.docx' &&
    file.buffer.length >= 4 &&
    file.buffer[0] === 0x50 &&
    file.buffer[1] === 0x4b &&
    file.buffer[2] === 0x03 &&
    file.buffer[3] === 0x04;
  if (!isPdf && !isDocx) {
    throw new HistorySheetValidationError('The file contents do not match the selected document type.');
  }

  const name = path
    .basename(file.originalname.replace(/\\/g, '/'))
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .replace(/\.+$/, '');
  const nameWithoutExtension = name.toLowerCase().endsWith(extension)
    ? name.slice(0, -extension.length)
    : name;
  const safeName = nameWithoutExtension.slice(0, 180 - extension.length);
  const fileName = `${safeName || 'history-sheet'}${extension}`;

  return {
    extension,
    mimeType: expectedMimeType,
    fileName,
  };
}

export function createHistorySheetStorageKey(extension: string): string {
  if (extension !== '.pdf' && extension !== '.docx') {
    throw new HistorySheetValidationError('Unsupported History Sheet file type.');
  }
  return `${randomUUID()}${extension}`;
}

export function historySheetStorageRoot(): string {
  const configuredRoot = process.env.SYNOZA_HISTORY_SHEET_ROOT?.trim();
  if (configuredRoot) return path.resolve(configuredRoot);

  if (process.env.NODE_ENV === 'production') {
    return path.resolve(persistentExamRoot(), '..', 'history-sheets');
  }

  return path.resolve(__dirname, '../../uploads/history-sheets');
}

export async function ensureHistorySheetStorageRoot(): Promise<string> {
  const root = historySheetStorageRoot();
  const publicRoot = path.resolve(persistentExamRoot());
  const relative = path.relative(publicRoot, root);
  if (
    relative === '' ||
    (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))
  ) {
    throw new Error('History Sheet storage must be outside the public exam media directory.');
  }
  await fs.mkdir(root, { recursive: true });
  return root;
}

export function resolveHistorySheetPath(storageKey: string): string {
  if (!/^[0-9a-f-]{36}\.(pdf|docx)$/i.test(storageKey)) {
    throw new Error('Invalid History Sheet storage key.');
  }
  return path.join(historySheetStorageRoot(), storageKey);
}

export async function removeHistorySheetFile(storageKey: string): Promise<void> {
  await ensureHistorySheetStorageRoot();
  await fs.unlink(resolveHistorySheetPath(storageKey));
}
