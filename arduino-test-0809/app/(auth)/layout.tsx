'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { pageVariants } from '../../components/motion';
import { useAuth } from '../../lib/auth/context';

/** Anyone already signed in and verified is bounced away from auth pages. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated' && user?.verified) router.replace('/');
  }, [status, user, router]);

  return (
    <div className="auth-wrap">
      <motion.div className="auth-card" variants={pageVariants} initial="hidden" animate="show">
        {children}
      </motion.div>
    </div>
  );
}
