declare module 'arabic-persian-reshaper' {
  export const ArabicShaper: {
    convertArabic: (text: string) => string;
  };
  export const PersianShaper: {
    convertArabic: (text: string) => string;
  };
}
