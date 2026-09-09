export const SUPPORT_PHONE_DISPLAY = '01024828652';
export const WHATSAPP_NUMBER = '201024828652';
export const WHATSAPP_BASE_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

export function buildWhatsAppUrl(message: string) {
  return `${WHATSAPP_BASE_URL}?text=${encodeURIComponent(message)}`;
}

export function buildSupportWhatsAppUrl(isAr: boolean, topic?: 'qbank' | 'general' | 'plan') {
  if (topic === 'qbank') {
    return buildWhatsAppUrl(
      isAr
        ? 'مرحباً، محتاج مساعدة في Synoza Q-Bank.'
        : 'Hi, I need help with Synoza Q-Bank.',
    );
  }
  if (topic === 'plan') {
    return buildWhatsAppUrl(
      isAr ? 'مرحباً، محتاج مساعدة في باقة Synoza.' : 'Hi, I need help with my Synoza plan.',
    );
  }
  return buildWhatsAppUrl(
    isAr ? 'مرحباً، محتاج مساعدة في Synoza.' : 'Hi, I need help with Synoza.',
  );
}
