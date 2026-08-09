'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { spring } from './motion';
import { Avatar } from './ui';
import { useAuth } from '../lib/auth/context';
import { useStore } from '../lib/store';

const TABS = [
  { href: '/', label: 'Home', icon: 'M3 10.5L12 3l9 7.5V21H3V10.5z' },
  { href: '/leaderboard', label: 'Leaderboard', icon: 'M4 20V11h4v9H4zm6 0V4h4v16h-4zm6 0v-6h4v6h-4z' },
  { href: '/forum', label: 'Forum', icon: 'M4 4h16v12H8l-4 4V4z' },
  { href: '/settings', label: 'Settings', icon: 'M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5zM3.5 12l1.6-1.1-.5-2 1.9-1.1 1.6 1.2 1.8-.9L10.4 6h3.2l.5 2 1.8.9 1.6-1.2 1.9 1.1-.5 2L20.5 12l-1.6 1.1.5 2-1.9 1.1-1.6-1.2-1.8.9-.5 2h-3.2l-.5-2-1.8-.9-1.6 1.2-1.9-1.1.5-2L3.5 12z' },
];

export default function Nav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { run } = useStore();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <nav className="nav">
      <div className="nav-brand">EASYBLOT</div>
      <div className="nav-items">
        {TABS.map((t) => {
          const active = isActive(t.href);
          return (
            <Link key={t.href} href={t.href} className={`tab${active ? ' active' : ''}`}>
              {active && (
                <motion.span className="tab-marker" layoutId="tab-marker" transition={spring} />
              )}
              <motion.svg viewBox="0 0 24 24" strokeLinejoin="round" strokeLinecap="round"
                animate={{ scale: active ? 1.06 : 1 }} transition={spring}>
                <path d={t.icon} />
              </motion.svg>
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>
      {user && (
        <div className="nav-foot">
          <Avatar user={{ initials: user.initials, activeNow: !!run?.active }} size="sm" />
          <div className="grow">
            <div className="name">{user.displayName}</div>
            <div className="meta">{run?.active ? 'Run in progress' : 'Idle'}</div>
          </div>
        </div>
      )}
    </nav>
  );
}
