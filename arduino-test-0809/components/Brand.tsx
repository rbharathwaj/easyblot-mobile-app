'use client';

import { motion } from 'framer-motion';
import { ease } from './motion';

/**
 * Brand lockup for the auth screens. The wordmark leads, the maker line sits
 * under it in the gray scale so it reads as attribution rather than as a
 * second heading competing with the page title.
 */
export default function Brand() {
  return (
    <div className="brand-lockup">
      <motion.div
        className="brand-mark"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={ease}
      >
        EasyBlot
      </motion.div>
      <motion.div
        className="brand-by"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ ...ease, delay: 0.08 }}
      >
        by Yantra Systems
      </motion.div>
    </div>
  );
}
