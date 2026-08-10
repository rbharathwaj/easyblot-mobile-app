'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar, Btn, Card, Empty, Field, Item, Modal, Page } from '../../../components/ui';
import { rowVariants, spring } from '../../../components/motion';
import { useStore } from '../../../lib/store';
import { FORUM_CATEGORIES } from '../../../lib/types';
import { useAuth } from '../../../lib/auth/context';

const PAGE_SIZE = 15;
const ago = (ts: number) => {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export default function ForumPage() {
  const { threads, addThread } = useStore();
  const { user, users } = useAuth();
  // Posts store only an authorId, so the picture is resolved at render time
  // and stays current when someone changes their photo.
  const avatarOf = (id: string) => users.find((u) => u.id === id)?.avatar ?? null;
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'All' | string>('All');
  const [page, setPage] = useState(1);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [postCategory, setPostCategory] = useState<string>(FORUM_CATEGORIES[0]);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads.filter(
      (t) => (category === 'All' || t.category === category) && (!q || t.title.toLowerCase().includes(q)),
    );
  }, [threads, category, query]);

  const shown = filtered.slice(0, page * PAGE_SIZE);

  const submit = () => {
    if (title.trim().length < 6) { setError('Give the thread a title (at least 6 characters).'); return; }
    addThread({ title: title.trim(), body: body.trim() || '(no details provided)', category: postCategory });
    setTitle(''); setBody(''); setError(null); setComposing(false); setPage(1);
  };

  return (
    <Page>
      <Item className="page-head">
        <h1>Forum</h1>
        {threads.length > 0 && <span className="pill">{threads.length} threads</span>}
      </Item>

      <Item>
        <Field>
          <input className="input" placeholder="Search thread titles" value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
        </Field>
      </Item>

      <Item>
        <div className="chips">
          {['All', ...FORUM_CATEGORIES].map((c) => (
            <button key={c} className={`chip${category === c ? ' active' : ''}`}
              onClick={() => { setCategory(c); setPage(1); }}>{c}</button>
          ))}
        </div>
      </Item>

      <Item>
        {!filtered.length ? (
          <Card>
            <Empty
              title={query.trim() ? 'No threads match that search' : `Nothing in ${category} yet`}
              action={<Btn size="sm" onClick={() => setComposing(true)}>Start a thread</Btn>}
            >
              {query.trim()
                ? 'Try a different term, or start the thread yourself.'
                : 'Be the first to write one — protocols and dead ends are both useful.'}
            </Empty>
          </Card>
        ) : (
          <Card style={{ padding: '2px 16px' }}>
            <AnimatePresence initial={false}>
              {shown.map((t) => (
                <motion.div key={t.id} variants={rowVariants} initial="hidden" animate="show" exit="exit" layout>
                  <Link href={`/forum/${t.id}`} className="lrow tappable" style={{ alignItems: 'flex-start' }}>
                    <span style={{ marginTop: 2 }}>
                      <Avatar
                        user={{ initials: t.authorInitials, avatar: avatarOf(t.authorId), activeNow: false }}
                        size="sm" outline
                      />
                    </span>
                    <span className="grow">
                      <span className="name" style={{ display: 'block', whiteSpace: 'normal' }}>{t.title}</span>
                      <span className="meta" style={{ display: 'block' }}>
                        {t.author}{t.authorId === user?.id ? ' (you)' : ''} · {t.replies.length}{' '}
                        {t.replies.length === 1 ? 'reply' : 'replies'} · {ago(t.updatedAt)}
                      </span>
                    </span>
                    <span style={{ color: 'var(--g3)', marginTop: 6 }}>›</span>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </Card>
        )}
      </Item>

      {shown.length < filtered.length && (
        <Item>
          <Btn variant="ghost" block onClick={() => setPage((p) => p + 1)}>
            Load more ({filtered.length - shown.length} older)
          </Btn>
        </Item>
      )}

      <Item>
        <div className="caption" style={{ padding: '14px 2px 0' }}>
          Posts show display names only — no institution is attached.
        </div>
      </Item>

      <motion.button className="fab" onClick={() => setComposing(true)} aria-label="New post"
        whileTap={{ scale: 0.92 }} whileHover={{ scale: 1.05 }} transition={spring}>+</motion.button>

      <Modal open={composing} onClose={() => setComposing(false)}>
        <h2>New post</h2>
        <p className="sub">Posted as {user?.displayName}. Your institution stays private.</p>
        <div style={{ height: 16 }} />
        <Field label="Category">
          <select className="input" value={postCategory} onChange={(e) => setPostCategory(e.target.value)}>
            {FORUM_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Title" error={error}>
          <input className={`input${error ? ' error' : ''}`} value={title} maxLength={120}
            placeholder="Describe the issue or protocol"
            onChange={(e) => { setTitle(e.target.value); setError(null); }} />
        </Field>
        <Field label="Body">
          <textarea className="input" rows={5} value={body}
            placeholder="Include firmware version, pump numbers, and durations where relevant."
            onChange={(e) => setBody(e.target.value)} />
        </Field>
        <div className="modal-actions">
          <Btn variant="ghost" onClick={() => setComposing(false)}>Cancel</Btn>
          <Btn onClick={submit}>Post</Btn>
        </div>
      </Modal>
    </Page>
  );
}
