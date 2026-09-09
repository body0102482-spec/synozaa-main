/** Egyptian mobile numbers: 010, 011, 012, or 015 followed by eight digits. */
export const EGYPTIAN_MOBILE_PATTERN = /^01[0125][0-9]{8}$/;

export function isValidEgyptianMobile(value: unknown): value is string {
  return typeof value === 'string' && EGYPTIAN_MOBILE_PATTERN.test(value);
}
