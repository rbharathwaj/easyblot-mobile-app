'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Avatar, Card, Empty, Item, Page, Segmented } from '../../../components/ui';
import { spring } from '../../../components/motion';
import { useAuth } from '../../../lib/auth/context';
import { toPublic, type PublicUser } from '../../../lib/types';

const TOP_N = 10;

/** Titles earned from forum activity — the flair travels with the name. */
const TITLES = [
  { min: 75, label: 'Top Contributor', top: true },
  { min: 40, label: 'Frequent Contributor', top: false },
  { min: 15, label: 'Contributor', top: false },
];
const titleFor = (u: PublicUser) => TITLES.find((t) => u.forumTotal >= t.min) ?? null;

export default function LeaderboardPage() {
  const { user, users } = useAuth();
  const [period, setPeriod] = useState<'week' | 'alltime'>('week');

  // Ordering: value descending, ties broken by ascending id so the list is
  // deterministic across renders rather than relying on sort stability.
  const rows = useMemo(() => {
    const key = period === 'week' ? 'blotsWeek' : 'blotsTotal';
    return users
      .map(toPublic)
      .map((u) => ({ ...u, value: u[key] as number }))
      .sort((a, b) => b.value - a.value || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((u, i) => ({ ...u, rank: i + 1 }));
  }, [users, period]);

  const top = rows.slice(0, TOP_N);
  const mine = rows.find((r) => r.id === user?.id);
  const hero = rows[0];
  const heroEmpty = !hero || hero.value === 0;
  const liveCount = rows.filter((r) => r.activeNow).length;

  return (
    <Page>
      <Item className="page-head">
        <h1>Leaderboard</h1>
        {liveCount > 0 && <span className="pill">{liveCount} running now</span>}
      </Item>

      <Item>
        <Segmented<'week' | 'alltime'>
          layoutId="lb-period"
          value={period}
          onChange={setPeriod}
          options={[{ value: 'week', label: 'This Week' }, { value: 'alltime', label: 'All Time' }]}
        />
      </Item>

      <Item>
        {heroEmpty ? (
          <Card flat>
            <div style={{ textAlign: 'center', padding: '18px 8px' }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                {period === 'week' ? 'Superuser of the Week' : 'All-Time Leader'}
              </div>
              <div className="name" style={{ fontSize: 15 }}>No runs logged yet</div>
              <div className="caption" style={{ marginTop: 6 }}>
                The first completed sequence takes the top spot.
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <div style={{ textAlign: 'center', padding: '6px 0' }}>
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}
                style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.4" strokeLinejoin="round">
                  <path d="M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8z" />
                </svg>
              </motion.div>
              <div className="eyebrow" style={{ marginBottom: 14 }}>
                {period === 'week' ? 'Superuser of the Week' : 'All-Time Leader'}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <Avatar user={hero} size="lg" />
              </div>
              <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.03em' }}>{hero.displayName}</div>
              {titleFor(hero) && (
                <div style={{ marginTop: 7 }}>
                  <span className={`flair${titleFor(hero)!.top ? ' top' : ''}`}>{titleFor(hero)!.label}</span>
                </div>
              )}
              <div className="sub">
                {hero.value} blots run {period === 'week' ? 'this week' : 'all time'}
                {hero.activeNow ? ' · running now' : ''}
              </div>
            </div>
          </Card>
        )}
      </Item>

      <Item><div className="eyebrow" style={{ marginTop: 20 }}>Rankings</div></Item>

      <Item>
        <Card style={{ padding: '2px 16px' }}>
          {top.length ? top.map((u) => <Row key={u.id} u={u} isMe={u.id === user?.id} />) : (
            <Empty title="Nobody here yet">
              Accounts appear as they sign up on this browser.
            </Empty>
          )}
        </Card>
      </Item>

      {mine && mine.rank > TOP_N && (
        <Item>
          <div style={{ border: '1px dashed var(--g2)', borderRadius: 'var(--r-lg)', padding: '2px 14px', background: 'var(--g1)' }}>
            <Row u={mine} isMe pinned />
          </div>
        </Item>
      )}

      <Item>
        <div className="caption" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '14px 2px 0' }}>
          <span className="av-wrap" style={{ width: 11, height: 11 }}>
            <span className="av-dot" style={{ right: 0, bottom: 0 }} />
          </span>
          <span style={{ marginLeft: 5 }}>Running a wash right now.</span>
        </div>
        <div className="caption" style={{ padding: '8px 2px 0' }}>
          Ranked by blots run. Titles next to a name come from forum activity.
          Display names only — institutions are never published. Ties are ordered by account age.
        </div>
      </Item>
    </Page>
  );
}

function Row({ u, isMe, pinned }: { u: PublicUser & { rank: number; value: number }; isMe: boolean; pinned?: boolean }) {
  const title = titleFor(u);
  return (
    <motion.div className="lrow" layout transition={spring}
      style={isMe && !pinned ? { background: 'var(--g1)', margin: '0 -16px', padding: '13px 16px' } : undefined}>
      <div className="rank">{u.rank}</div>
      <Avatar user={u} size="sm" outline={!isMe} />
      <div className="grow">
        <div className="name-row">
          <span className="name">{u.displayName}</span>
          {isMe && <span className="caption">· you</span>}
          {title && <span className={`flair${title.top ? ' top' : ''}`}>{title.label}</span>}
        </div>
      </div>
      <div className="count">{u.value}</div>
    </motion.div>
  );
}
