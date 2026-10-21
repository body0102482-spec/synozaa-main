import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HistorySheetValidationError,
  MAX_HISTORY_SHEET_UPLOAD_SIZE_BYTES,
  validateHistorySheetUpload,
} from './historySheetStorage.js';

test('accepts a PDF with matching MIME type and file signature', () => {
  const result = validateHistorySheetUpload({
    originalname: 'history.pdf',
    mimetype: 'application/pdf',
    size: 9,
    buffer: Buffer.from('%PDF-1.7'),
  });

  assert.deepEqual(result, {
    extension: '.pdf',
    mimeType: 'application/pdf',
    fileName: 'history.pdf',
  });
});

test('accepts a DOCX with matching MIME type and ZIP signature', () => {
  const result = validateHistorySheetUpload({
    originalname: 'history.docx',
    mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: 4,
    buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  });

  assert.equal(result.extension, '.docx');
});

test('rejects unsupported extensions and mismatched MIME types', () => {
  assert.throws(
    () =>
      validateHistorySheetUpload({
        originalname: 'history.txt',
        mimetype: 'text/plain',
        size: 4,
        buffer: Buffer.from('text'),
      }),
    HistorySheetValidationError,
  );
  assert.throws(
    () =>
      validateHistorySheetUpload({
        originalname: 'history.pdf',
        mimetype: 'application/msword',
        size: 5,
        buffer: Buffer.from('%PDF-'),
      }),
    HistorySheetValidationError,
  );
});

test('rejects oversized and invalid-signature documents', () => {
  assert.throws(
    () =>
      validateHistorySheetUpload({
        originalname: 'history.pdf',
        mimetype: 'application/pdf',
        size: MAX_HISTORY_SHEET_UPLOAD_SIZE_BYTES + 1,
        buffer: Buffer.from('%PDF-'),
      }),
    (error: unknown) =>
      error instanceof HistorySheetValidationError && error.statusCode === 413,
  );
  assert.throws(
    () =>
      validateHistorySheetUpload({
        originalname: 'history.pdf',
        mimetype: 'application/pdf',
        size: 5,
        buffer: Buffer.from('other'),
      }),
    HistorySheetValidationError,
  );
});

test('sanitizes client filenames before persisting metadata', () => {
  const result = validateHistorySheetUpload({
    originalname: '..\\private\\history\r\n.pdf',
    mimetype: 'application/pdf',
    size: 5,
    buffer: Buffer.from('%PDF-'),
  });

  assert.equal(result.fileName, 'history.pdf');
});
