'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import Nav from '../../components/Nav';
import { useAuth } from '../../lib/auth/context';

/** Route guard: unauthenticated users go to signup, unverified to /verify. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'anonymous') router.replace('/signup');
    else if (user && !user.verified) router.replace('/verify');
  }, [status, user, router]);

  if (status !== 'authenticated' || !user?.verified) {
    return (
      <div className="auth-wrap">
        <div className="caption">Loading your workspace…</div>
      </div>
    );
  }

  return (
    <>
      <Nav />
      <div className="shell">
        <main className="main">
          <AnimatePresence mode="wait">
            <div key={pathname}>{children}</div>
          </AnimatePresence>
        </main>
      </div>
    </>
  );
}
