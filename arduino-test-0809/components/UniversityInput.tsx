'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ease } from './motion';
import { loadUniversities, searchUniversities, type University } from '../lib/universities';

/**
 * Type-ahead over the bundled US university list.
 * Free text is always accepted — Enter with no highlighted row keeps whatever
 * was typed, so an unlisted institute is never blocked from signing up.
 */
export default function UniversityInput({ value, onChange, error, id }: {
  value: string;
  onChange(v: string): void;
  error?: string | null;
  id?: string;
}) {
  const [list, setList] = useState<University[] | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  // 129 KB dataset, fetched on first focus rather than at page load.
  const ensureLoaded = () => { if (!list) void loadUniversities().then(setList); };

  const matches = useMemo(
    () => (list ? searchUniversities(list, value) : []),
    [list, value],
  );

  useEffect(() => { setHighlight(-1); }, [value]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const choose = (u: University) => { onChange(u.n); setOpen(false); setHighlight(-1); };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || !matches.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => (h + 1) % matches.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => (h <= 0 ? matches.length - 1 : h - 1)); }
    else if (e.key === 'Enter') {
      // Only intercept Enter when a row is actively highlighted, so the
      // form still submits normally for free-text institutions.
      if (highlight >= 0) { e.preventDefault(); choose(matches[highlight]); }
      else setOpen(false);
    } else if (e.key === 'Escape') { setOpen(false); }
  };

  const showList = open && matches.length > 0;

  return (
    <div className="combo" ref={boxRef}>
      <input
        id={id}
        className={`input${error ? ' error' : ''}`}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        placeholder="Start typing your institution"
        onFocus={() => { ensureLoaded(); setOpen(true); }}
        onChange={(e) => { ensureLoaded(); onChange(e.target.value); setOpen(true); }}
        onKeyDown={onKeyDown}
      />

      <AnimatePresence>
        {showList && (
          <motion.ul
            className="combo-list"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={ease}
            role="listbox"
          >
            {matches.map((u, i) => (
              <li
                key={u.n}
                role="option"
                aria-selected={i === highlight}
                className={i === highlight ? 'active' : ''}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => { e.preventDefault(); choose(u); }}
              >
                <span className="combo-name">{u.n}</span>
                {u.d[0] && <span className="combo-domain">{u.d[0]}</span>}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
