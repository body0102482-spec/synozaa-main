const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const OUTPUT_SIZE = 256;
const JPEG_QUALITY = 0.82;

export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('INVALID_IMAGE');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('FILE_TOO_LARGE');
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(OUTPUT_SIZE / bitmap.width, OUTPUT_SIZE / bitmap.height, 1);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('CANVAS_ERROR');
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

export function isValidAvatarDataUrl(value: string): boolean {
  return /^data:image\/(jpeg|jpg|png|webp|gif);base64,/.test(value) && value.length <= 400_000;
}
