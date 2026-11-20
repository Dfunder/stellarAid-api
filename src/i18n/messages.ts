export type Locale = 'en' | 'es';

export type MessageKey =
  | 'auth.reset.invalid'
  | 'auth.reset.tokenRequired'
  | 'validation.password.minLength';

const catalogs: Record<Locale, Record<MessageKey, string>> = {
  en: {
    'auth.reset.invalid': 'The password reset link is invalid or has expired.',
    'auth.reset.tokenRequired': 'Password reset token is required.',
    'validation.password.minLength':
      'Password must contain at least 8 characters.',
  },
  es: {
    'auth.reset.invalid':
      'El enlace para restablecer la contraseña no es válido o expiró.',
    'auth.reset.tokenRequired':
      'Se requiere el token para restablecer la contraseña.',
    'validation.password.minLength':
      'La contraseña debe contener al menos 8 caracteres.',
  },
};

export function resolveLocale(value: string | undefined): Locale {
  const language = value?.split(',')[0]?.split('-')[0]?.trim().toLowerCase();
  return language === 'es' ? 'es' : 'en';
}

export function translate(locale: Locale, key: MessageKey): string {
  return catalogs[locale][key] ?? catalogs.en[key];
}
