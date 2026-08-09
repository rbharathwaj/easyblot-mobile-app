/**
 * Email classification — decides which tier an account gets.
 *
 * institution : an academic domain (.edu and international equivalents).
 *               These are the "real research labs" the product copy promises.
 * independent : everyone else — personal mail providers and unrecognised
 *               domains. Full access, just labelled differently.
 *
 * NOTE ON TRUST: this runs in the browser, so it is a *filter*, not proof.
 * Anyone can edit it in devtools. The thing that actually proves ownership of
 * the address is the verification code round-trip, and even that only becomes
 * trustworthy once the code is generated and checked server-side. See
 * lib/auth/adapter.ts for where that seam lives.
 */

export type AccountTier = 'institution' | 'independent';

/** Academic suffixes. Ordered longest-first so `.edu.au` wins over `.au`. */
const ACADEMIC_SUFFIXES = [
  '.edu',
  '.ac.uk', '.edu.au', '.ac.nz', '.ac.jp', '.ac.kr', '.ac.in', '.edu.in',
  '.edu.sg', '.edu.hk', '.edu.cn', '.ac.za', '.edu.br', '.ac.il', '.edu.mx',
];

/** Consumer mailbox providers — valid, just not institutional. */
const PERSONAL_PROVIDERS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com',
  'msn.com', 'yahoo.com', 'yahoo.co.uk', 'icloud.com', 'me.com', 'mac.com',
  'proton.me', 'protonmail.com', 'pm.me', 'aol.com', 'gmx.com', 'gmx.net',
  'zoho.com', 'mail.com', 'yandex.com', 'fastmail.com', 'hey.com',
]);

/** Throwaway domains — rejected outright, since they defeat verification. */
const DISPOSABLE = new Set([
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com',
  'yopmail.com', 'trashmail.com', 'sharklasers.com', 'getnada.com',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export interface EmailVerdict {
  ok: boolean;
  tier: AccountTier;
  domain: string;
  /** Shown under the email field as live feedback. */
  message: string;
  /** True when we want the university field to be required. */
  requiresInstitution: boolean;
}

export function domainOf(email: string): string {
  const at = email.lastIndexOf('@');
  return at < 0 ? '' : email.slice(at + 1).trim().toLowerCase();
}

export function isAcademicDomain(domain: string): boolean {
  return ACADEMIC_SUFFIXES.some((s) => domain.endsWith(s));
}

export function classifyEmail(rawEmail: string): EmailVerdict {
  const email = rawEmail.trim().toLowerCase();
  const domain = domainOf(email);

  if (!email) {
    return { ok: false, tier: 'independent', domain: '', message: '', requiresInstitution: false };
  }
  if (!EMAIL_RE.test(email)) {
    return {
      ok: false, tier: 'independent', domain,
      message: 'That does not look like a complete email address.',
      requiresInstitution: false,
    };
  }
  if (DISPOSABLE.has(domain)) {
    return {
      ok: false, tier: 'independent', domain,
      message: 'Disposable addresses cannot be verified. Use a permanent inbox.',
      requiresInstitution: false,
    };
  }
  if (isAcademicDomain(domain)) {
    return {
      ok: true, tier: 'institution', domain,
      message: 'Academic domain recognised — your account will be verified as institutional.',
      requiresInstitution: true,
    };
  }
  if (PERSONAL_PROVIDERS.has(domain)) {
    return {
      ok: true, tier: 'independent', domain,
      message: 'Personal address — you will join as an Independent user. Full access, no institution shown.',
      requiresInstitution: false,
    };
  }
  return {
    ok: true, tier: 'independent', domain,
    message: `${domain} is not a recognised academic domain — you will join as an Independent user.`,
    requiresInstitution: false,
  };
}

export const TIER_LABEL: Record<AccountTier, string> = {
  institution: 'Verified lab',
  independent: 'Independent',
};
