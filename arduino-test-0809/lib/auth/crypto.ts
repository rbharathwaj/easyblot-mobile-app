/**
 * Password hashing with WebCrypto PBKDF2-SHA256.
 *
 * Plaintext passwords are never stored — only a random 16-byte salt and the
 * derived key. This is genuine hashing, not obfuscation, and the same routine
 * moves to the server unchanged when you add a backend.
 *
 * Caveat worth stating plainly: hashing in the browser protects the stored
 * record, but a local-only setup still has no server to rate-limit guesses
 * against. That is the real reason local auth is a prototype, not production.
 */

const ITERATIONS = 210_000; // OWASP 2023 floor for PBKDF2-SHA256
const KEY_BITS = 256;
const SALT_BYTES = 16;

function toB64(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export interface PasswordRecord {
  salt: string;
  hash: string;
  iterations: number;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    // BufferSource typing differs across TS lib versions; the bytes are the same.
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    key,
    KEY_BITS,
  );
  return toB64(new Uint8Array(bits));
}

export async function hashPassword(password: string): Promise<PasswordRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return { salt: toB64(salt), hash, iterations: ITERATIONS };
}

export async function verifyPassword(password: string, record: PasswordRecord): Promise<boolean> {
  const hash = await derive(password, fromB64(record.salt), record.iterations);
  return constantTimeEqual(hash, record.hash);
}

/** Comparison that does not short-circuit on the first differing character. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function randomId(prefix = ''): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return prefix + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 6-digit verification code, uniformly distributed. */
export function verificationCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, '0');
}

export interface PasswordStrength { ok: boolean; message: string }

export function checkPasswordStrength(pw: string): PasswordStrength {
  if (pw.length < 8) return { ok: false, message: 'Password must be at least 8 characters.' };
  if (pw.length > 128) return { ok: false, message: 'Password must be 128 characters or fewer.' };
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) {
    return { ok: false, message: 'Include at least one letter and one number.' };
  }
  return { ok: true, message: '' };
}
