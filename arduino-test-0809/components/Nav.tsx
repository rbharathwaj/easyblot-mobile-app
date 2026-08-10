'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { spring } from './motion';
import AccountMenu from './AccountMenu';

/**
 * Settings is deliberately absent: it lives in the account menu, so the nav
 * only holds the three places people actually move between.
 */
const TABS = [
  { href: '/', label: 'Home', icon: 'M3 10.5L12 3l9 7.5V21H3V10.5z' },
  { href: '/leaderboard', label: 'Leaderboard', icon: 'M4 20V11h4v9H4zm6 0V4h4v16h-4zm6 0v-6h4v6h-4z' },
  { href: '/forum', label: 'Forum', icon: 'M4 4h16v12H8l-4 4V4z' },
];

export default function Nav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <nav className="nav">
      <div className="nav-brand">
        <div className="nav-brand-mark">EasyBlot</div>
        <div className="nav-brand-by">by Yantra Systems</div>
      </div>

      <div className="nav-items">
        {TABS.map((t) => {
          const active = isActive(t.href);
          return (
            <Link key={t.href} href={t.href} className={`tab${active ? ' active' : ''}`}>
              {active && <motion.span className="tab-marker" layoutId="tab-marker" transition={spring} />}
              <motion.svg viewBox="0 0 24 24" strokeLinejoin="round" strokeLinecap="round"
                animate={{ scale: active ? 1.06 : 1 }} transition={spring}>
                <path d={t.icon} />
              </motion.svg>
              <span>{t.label}</span>
            </Link>
          );
        })}

        {/* Fourth cell on phones only; the desktop rail uses the chip below. */}
        <AccountMenu variant="tab" />
      </div>

      <AccountMenu variant="rail" />
    </nav>
  );
}
