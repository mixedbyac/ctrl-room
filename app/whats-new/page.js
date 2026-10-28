'use client';
import { useEffect } from 'react';
import { useApp, TopBar } from '@/components/AppShell';
import { forRole } from '@/lib/changelog';
import { markSeen } from '@/components/UpdateWatcher';
import { fmtDate } from '@/lib/format';

export default function WhatsNew() {
  const { eng, session } = useApp();
  const list = forRole(eng);
  useEffect(() => { if (list[0]) markSeen(list[0].id); }, [eng]); // eslint-disable-line
  if (!session) return null;
  return (
    <>
      <TopBar crumbs={[{ label: 'Home', href: '/' }, { label: 'What’s new' }]} />
      <section className="page">
        <div className="hhead"><h1 className="up">What’s new</h1><p className="lede">Every update to Ctrl Room, newest first.</p></div>
        <ol className="changelog">
          {list.map((e, i) => (
            <li key={e.id} className={i === 0 ? 'latest' : ''}>
              <span className="cldate mono">{fmtDate(e.date)}</span>
              <div>
                <h2 className="up">{e.title}{i === 0 && <span className="new">LATEST</span>}</h2>
                <ul>{e.items.map((it, k) => <li key={k}>{it.text}{eng && it.for !== 'all' && <span className="clfor">{it.for === 'engineer' ? 'You only' : 'Clients'}</span>}</li>)}</ul>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
