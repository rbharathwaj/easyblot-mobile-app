import type { AccountTier } from './auth/email';
import type { PasswordRecord } from './auth/crypto';

/** Public projection — safe to render anywhere, contains no institution. */
export interface PublicUser {
  id: string;
  displayName: string;
  initials: string;
  tier: AccountTier;
  blotsWeek: number;
  blotsTotal: number;
  forumTotal: number;
  activeNow: boolean;
}

/** Full record — never leaves the data layer. */
export interface StoredUser extends PublicUser {
  email: string;
  firstName: string;
  lastName: string;
  /** Derived from firstName + lastName; kept for display in Settings. */
  realName: string;
  /** Institution accounts only; private unless showInstitution is on. */
  institution: string;
  showInstitution: boolean;
  password: PasswordRecord;
  verified: boolean;
  pendingCode: string | null;
  codeExpiresAt: number | null;
  createdAt: number;
}

export interface Session {
  token: string;
  userId: string;
  expiresAt: number;
}

export interface Step { pump: number; duration: number }

export interface Protocol {
  id: string;
  name: string;
  note: string;
  steps: Step[];
  runCount: number;
  lastRun: string | null;
}

export interface Pump {
  id: number;
  role: string;
  on: boolean;
  remaining: number | null;
  durationInput: string;
}

export interface DeviceState {
  name: string;
  paired: boolean;
  online: boolean;
  wifi: string;
  mdns: string;
}

export interface RunState {
  active: boolean;
  steps: Step[];
  index: number;
  remaining: number;
  protocolId: string | null;
  protocolName: string | null;
}

export interface LogLine { t: string; msg: string }

export interface Reply {
  id: string;
  authorId: string;
  author: string;
  initials: string;
  createdAt: number;
  body: string;
}

export interface Thread {
  id: string;
  category: string;
  authorId: string;
  author: string;
  authorInitials: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  replies: Reply[];
}

/** Per-account device + protocol state. */
export interface UserData {
  device: DeviceState | null;
  run: RunState | null;
  protocols: Protocol[];
  log: LogLine[];
  weeklyUsage: number[];
}

export const PUMP_ROLES = [
  'Primary', 'Secondary', 'Blocking', 'Wash Buffer', 'Drain', 'Recollect',
] as const;

export const FORUM_CATEGORIES = ['Troubleshooting', 'Protocols', 'Hardware', 'General'] as const;

export function emptyUserData(): UserData {
  return {
    device: null,
    run: null,
    protocols: [],
    log: [],
    weeklyUsage: [0, 0, 0, 0, 0, 0, 0],
  };
}

export function initialsFrom(name: string): string {
  return (
    name.trim().split(/[\s._-]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    || '?'
  );
}

export function toPublic(u: StoredUser): PublicUser {
  return {
    id: u.id,
    displayName: u.displayName,
    initials: u.initials,
    tier: u.tier,
    blotsWeek: u.blotsWeek,
    blotsTotal: u.blotsTotal,
    forumTotal: u.forumTotal,
    activeNow: u.activeNow,
  };
}
