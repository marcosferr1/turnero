const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

const SKIP_RE = /^(no|omitir|saltar|ninguno|n\/a|-)$/i;

export function isEmailSkipAnswer(text: string): boolean {
  return SKIP_RE.test(text.trim());
}
