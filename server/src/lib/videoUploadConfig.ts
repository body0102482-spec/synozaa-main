const DEFAULT_MAX_VIDEO_UPLOAD_SIZE_MB = 100;
const configuredSizeMb = Number(process.env.MAX_VIDEO_UPLOAD_SIZE_MB);

export const MAX_VIDEO_UPLOAD_SIZE_MB =
  Number.isSafeInteger(configuredSizeMb) &&
  configuredSizeMb > 0 &&
  Number.isSafeInteger(configuredSizeMb * 1024 * 1024)
    ? configuredSizeMb
    : DEFAULT_MAX_VIDEO_UPLOAD_SIZE_MB;

export const MAX_VIDEO_UPLOAD_SIZE_BYTES =
  MAX_VIDEO_UPLOAD_SIZE_MB * 1024 * 1024;