'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar, ConfirmDialog, type ConfirmSpec } from './ui';
import { ease, spring } from './motion';
import { useAuth } from '../lib/auth/context';
import { useStore } from '../lib/store';

/**
 * Account menu — Settings and Log out.
 *
 * Settings left the main navigation because it is a destination people visit
 * rarely, unlike Home/Leaderboard/Forum. Parking it under the account chip
 * keeps the nav to the three places you actually move between.
 *
 * Three trigger presentations, one menu:
 * Two trigger presentations, one menu — never both on screen at once:
 *   rail — the sidebar's bottom-left chip (desktop only). Opens on hover.
 *   tab  — the fourth cell of the mobile tab bar (phones only).
 */
export default function AccountMenu({ variant }: { variant: 'rail' | 'tab' }) {
  const { user, logOut } = useAuth();
  const { run } = useStore();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [confirmSpec, setConfirmSpec] = useState<ConfirmSpec | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => () => { if (closeTimer.current) window.clearTimeout(closeTimer.current); }, []);

  if (!user) return null;

  const running = !!run?.active;

  // Hover only makes sense for the desktop rail, and only on real pointers —
  // touch devices fire synthetic hover that would trap the menu open.
  const hoverable = variant === 'rail'
    && typeof window !== 'undefined'
    && window.matchMedia?.('(hover: hover) and (min-width: 900px)').matches;

  const onEnter = () => {
    if (!hoverable) return;
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const onLeave = () => {
    if (!hoverable) return;
    // Small grace period so crossing the gap to the menu does not dismiss it.
    closeTimer.current = window.setTimeout(() => setOpen(false), 180);
  };

  const go = (href: string) => { setOpen(false); router.push(href); };

  // Activity log deliberately absent: it lives on Home, where you watch a run.
  // It is not an account concern, and having it in two places meant two
  // different views of the same data.
  const items = [
    { label: 'Settings', icon: gearIcon, onClick: () => go('/settings') },
    {
      label: 'Log out', icon: outIcon, danger: true,
      onClick: () => {
        setOpen(false);
        setConfirmSpec({
          title: 'Log out?',
          body: 'You will need your email and password to sign back in. Runs in progress continue on the device.',
          confirmLabel: 'Log out', destructive: true,
          onConfirm: async () => { await logOut(); router.push('/login'); },
        });
      },
    },
  ];

  return (
    <div
      className={`account-wrap account-${variant}`}
      ref={wrapRef}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {/* ---- Trigger ---- */}
      {variant === 'rail' && (
        <button className="nav-foot" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
          <Avatar user={{ initials: user.initials, avatar: user.avatar, activeNow: running }} size="sm" />
          <span className="grow" style={{ textAlign: 'left' }}>
            <span className="name" style={{ display: 'block' }}>{user.displayName}</span>
            <span className="meta" style={{ display: 'block' }}>{running ? 'Run in progress' : 'Idle'}</span>
          </span>
          <motion.span className="chev" animate={{ rotate: open ? 180 : 0 }} transition={spring}>⌃</motion.span>
        </button>
      )}

      {variant === 'tab' && (
        <button className={`tab${open ? ' active' : ''}`} onClick={() => setOpen((o) => !o)}
          aria-expanded={open} aria-haspopup="menu">
          <Avatar user={{ initials: user.initials, avatar: user.avatar, activeNow: running }} size="sm" />
          <span>Account</span>
        </button>
      )}

      {/* ---- Menu ---- */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="account-pop"
            role="menu"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={ease}
          >
            <div className="account-pop-head">
              <div className="name">{user.displayName}</div>
              <div className="meta">{user.email}</div>
            </div>
            {items.map((it) => (
              <button key={it.label} role="menuitem"
                className={`account-item${it.danger ? ' danger' : ''}`} onClick={it.onClick}>
                {it.icon()}
                <span>{it.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog spec={confirmSpec} onClose={() => setConfirmSpec(null)} />
    </div>
  );
}

/* ---- Outline icons, matching the nav set ---- */
const svg = (d: string) => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const gearIcon = () => svg('M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4a2 2 0 1 1 4 0a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z');
const outIcon = () => svg('M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h12');
