/**
 * AUTH ADAPTER — the swap seam.
 *
 * `AuthAdapter` is the only surface the UI talks to. `LocalAuthAdapter` below
 * implements it against the browser's own storage, which is what makes login
 * work with no server. To move to real auth later you write a second class
 * with the same methods that calls your API, and change one line in
 * lib/auth/context.tsx. No screen changes.
 *
 * What local mode genuinely does:
 *   - PBKDF2-SHA256 password hashing with per-user salts
 *   - real credential checks, duplicate-account rejection, session expiry
 *   - an email verification round-trip with expiring 6-digit codes
 *
 * What it cannot do, and why a server is eventually required:
 *   - actually send mail, so the code is surfaced in the UI instead
 *   - stop a determined user editing their own record in devtools
 *   - share accounts between browsers or machines
 */

import * as db from '../db';
import { hashPassword, verifyPassword, randomId, verificationCode } from './crypto';
import { classifyEmail } from './email';
import { type StoredUser, type Session, initialsFrom } from '../types';

const SESSION_TTL = 1000 * 60 * 60 * 24 * 14; // 14 days
const CODE_TTL = 1000 * 60 * 15; // 15 minutes

export class AuthError extends Error {
  field?: 'email' | 'password' | 'displayName' | 'institution' | 'code';
  constructor(message: string, field?: AuthError['field']) {
    super(message);
    this.name = 'AuthError';
    this.field = field;
  }
}

export interface SignUpInput {
  realName: string;
  email: string;
  password: string;
  displayName: string;
  institution: string;
}

export interface AuthAdapter {
  listUsers(): Promise<StoredUser[]>;
  currentUser(): Promise<StoredUser | null>;
  signUp(input: SignUpInput): Promise<StoredUser>;
  logIn(email: string, password: string): Promise<StoredUser>;
  logOut(): Promise<void>;
  submitCode(code: string): Promise<StoredUser>;
  resendCode(): Promise<string>;
  updateUser(patch: Partial<StoredUser>): Promise<StoredUser>;
  changePassword(current: string, next: string): Promise<void>;
  deleteAccount(): Promise<void>;
}

export class LocalAuthAdapter implements AuthAdapter {
  async listUsers(): Promise<StoredUser[]> {
    return db.get<StoredUser[]>(db.KEYS.users, []);
  }

  private async saveUsers(users: StoredUser[]) {
    await db.set(db.KEYS.users, users);
  }

  private async session(): Promise<Session | null> {
    const s = await db.get<Session | null>(db.KEYS.session, null);
    if (!s) return null;
    if (s.expiresAt < Date.now()) {
      await db.remove(db.KEYS.session);
      return null;
    }
    return s;
  }

  async currentUser(): Promise<StoredUser | null> {
    const s = await this.session();
    if (!s) return null;
    const users = await this.listUsers();
    return users.find((u) => u.id === s.userId) ?? null;
  }

  private async startSession(userId: string) {
    await db.set<Session>(db.KEYS.session, {
      token: randomId('sess_'),
      userId,
      expiresAt: Date.now() + SESSION_TTL,
    });
  }

  async signUp(input: SignUpInput): Promise<StoredUser> {
    const email = input.email.trim().toLowerCase();
    const verdict = classifyEmail(email);
    if (!verdict.ok) throw new AuthError(verdict.message || 'Enter a valid email address.', 'email');

    const realName = input.realName.trim();
    if (!realName) throw new AuthError('Enter your full name.', 'displayName');

    const displayName = input.displayName.trim() || realName.split(/\s+/)[0];
    if (displayName.length < 2) throw new AuthError('Display name needs at least 2 characters.', 'displayName');

    const institution = input.institution.trim();
    if (verdict.requiresInstitution && !institution) {
      throw new AuthError('Tell us which institution this address belongs to.', 'institution');
    }

    const users = await this.listUsers();
    if (users.some((u) => u.email === email)) {
      throw new AuthError('An account already exists for that address.', 'email');
    }
    if (users.some((u) => u.displayName.toLowerCase() === displayName.toLowerCase())) {
      throw new AuthError('That display name is taken.', 'displayName');
    }

    const code = verificationCode();
    const user: StoredUser = {
      id: randomId('usr_'),
      email,
      realName,
      displayName,
      initials: initialsFrom(displayName),
      institution: verdict.tier === 'institution' ? institution : '',
      showInstitution: false,
      tier: verdict.tier,
      password: await hashPassword(input.password),
      verified: false,
      pendingCode: code,
      codeExpiresAt: Date.now() + CODE_TTL,
      blotsWeek: 0,
      blotsTotal: 0,
      forumTotal: 0,
      activeNow: false,
      createdAt: Date.now(),
    };

    await this.saveUsers([...users, user]);
    await this.startSession(user.id);
    return user;
  }

  async logIn(email: string, password: string): Promise<StoredUser> {
    const users = await this.listUsers();
    const user = users.find((u) => u.email === email.trim().toLowerCase());

    // Same message for unknown address and wrong password, so the form cannot
    // be used to enumerate which addresses have accounts.
    const reject = () => new AuthError('Email or password is incorrect.', 'password');
    if (!user) throw reject();
    if (!(await verifyPassword(password, user.password))) throw reject();

    await this.startSession(user.id);
    return user;
  }

  async logOut(): Promise<void> {
    await db.remove(db.KEYS.session);
  }

  async submitCode(code: string): Promise<StoredUser> {
    const user = await this.currentUser();
    if (!user) throw new AuthError('Your session expired. Log in again.');
    if (user.verified) return user;
    if (!user.pendingCode || !user.codeExpiresAt) throw new AuthError('No code outstanding. Request a new one.', 'code');
    if (Date.now() > user.codeExpiresAt) throw new AuthError('That code expired. Request a new one.', 'code');
    if (code.trim() !== user.pendingCode) throw new AuthError('That code is not right.', 'code');

    return this.updateUser({ verified: true, pendingCode: null, codeExpiresAt: null });
  }

  /** Returns the code because there is no mail server in local mode. */
  async resendCode(): Promise<string> {
    const user = await this.currentUser();
    if (!user) throw new AuthError('Your session expired. Log in again.');
    const code = verificationCode();
    await this.updateUser({ pendingCode: code, codeExpiresAt: Date.now() + CODE_TTL });
    return code;
  }

  async updateUser(patch: Partial<StoredUser>): Promise<StoredUser> {
    const current = await this.currentUser();
    if (!current) throw new AuthError('Your session expired. Log in again.');

    if (patch.displayName !== undefined) {
      const name = patch.displayName.trim();
      const users = await this.listUsers();
      if (users.some((u) => u.id !== current.id && u.displayName.toLowerCase() === name.toLowerCase())) {
        throw new AuthError('That display name is taken.', 'displayName');
      }
      patch.displayName = name;
      patch.initials = initialsFrom(name);
    }

    const users = await this.listUsers();
    const next = users.map((u) => (u.id === current.id ? { ...u, ...patch } : u));
    await this.saveUsers(next);
    return next.find((u) => u.id === current.id)!;
  }

  async changePassword(currentPw: string, nextPw: string): Promise<void> {
    const user = await this.currentUser();
    if (!user) throw new AuthError('Your session expired. Log in again.');
    if (!(await verifyPassword(currentPw, user.password))) {
      throw new AuthError('Current password is incorrect.', 'password');
    }
    await this.updateUser({ password: await hashPassword(nextPw) });
  }

  async deleteAccount(): Promise<void> {
    const user = await this.currentUser();
    if (!user) return;
    const users = await this.listUsers();
    await this.saveUsers(users.filter((u) => u.id !== user.id));
    await db.remove(db.KEYS.userData(user.id));
    await this.logOut();
  }
}
