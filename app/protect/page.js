'use client';
import Link from 'next/link';
import { useApp } from '@/components/AppShell';
import PoweredBy from '@/components/PoweredBy';

export default function Protect() {
  const { session } = useApp();
  return (
    <main className="protect">
      <header className="pr-top">
        <Link href="/" className="pr-brand"><img src="/logo.png" alt="" /><span>CTRL ROOM</span></Link>
        <nav>{session ? <Link className="btn small" href="/">Open CTRL ROOM</Link> : <><Link className="btn small quiet" href="/login">Sign in</Link><Link className="btn small primary" href="/portal">Send your files</Link></>}</nav>
      </header>

      <section className="pr-hero">
        <p className="pr-eyebrow">Unreleased music, kept that way</p>
        <h1 className="up">Your music stays in the room.</h1>
        <p className="pr-lede">CTRL ROOM is where your mixes live until the world is ready for them. Only the people on your project can hear them, and if a link ends up somewhere it shouldn’t, your engineer knows right away.</p>
      </section>

      <section className="pr-row">
        <div className="pr-copy">
          <h2 className="up">An eye on every link.</h2>
          <p>Behind every share link, CTRL ROOM looks for signs that something is off: a burst of plays out of nowhere, a listen from a place nobody on the project has played from, one link spreading across too many devices.</p>
          <p>When it sees one, your engineer gets a text with what happened and where, and can shut that link down in one tap. The ways music leaks keep changing, and CTRL ROOM keeps changing with them.</p>
        </div>
        <div className="ins-card pr-example">
          <p className="pr-ex">Example</p>
          <div className="ins-alert">
            <div className="ins-head"><span className="ins-bang">!</span><div><b>Unusual activity on Late Bloom</b><span>Today · 9:41 pm</span></div></div>
            <p>5 plays in 10 minutes on a share link from Lisbon, PT. Nobody on this project has listened from there before.</p>
            <div className="row-actions"><span className="btn small danger" aria-hidden="true">Shut down link</span><span className="btn small dangerq" aria-hidden="true">Reset link</span></div>
          </div>
          <p className="pr-note">An example of an alert, not a real one.</p>
        </div>
      </section>

      <section className="pr-row">
        <div className="pr-copy">
          <h2 className="up">Know when it lands.</h2>
          <p>See when a mix was played, on which version, and how much of it was heard. It’s only about your mixes, never about following anyone around the web.</p>
        </div>
        <div className="ins-card pr-example">
          <p className="pr-ex">Example</p>
          <div className="ins-latest"><span className="ins-av">JR</span><div><b>Jordan listened to Late Bloom</b><span>Tuesday · 2:08 pm · v3 · 3:41 heard</span></div></div>
          <div className="ins-barhead"><b>Plays this week</b><span className="muted small">Late Bloom EP</span></div>
          <ul className="ins-bars">
            {[['Late Bloom', 14], ['Paper Sun', 9], ['Northbound', 6], ['Quiet Hours', 3]].map(([t, n]) => (
              <li key={t}><span>{t}</span><span className="ins-track"><i style={{ width: `${(n / 14) * 100}%`, opacity: 0.45 + 0.55 * (n / 14) }} /></span><b className="mono">{n}</b></li>
            ))}
          </ul>
          <p className="pr-note">An example chart, not live numbers.</p>
        </div>
      </section>

      <section className="pr-rules">
        <h2 className="up">Locked down by default.</h2>
        {[
          ['Private from the start', 'Mixes are stored privately. Every play uses a link that expires, made only for people on that project. Other artists can never see your work, and that’s checked by the database on every request, not just the website.'],
          ['Only you get in', 'New accounts confirm their email before anything unlocks, and you can turn on two-step verification so a stolen password isn’t enough.'],
          ['Share on your terms', 'Share links play only the current mix, never notes or other versions. They can be switched off or reset at any time, and the old link stops working instantly.'],
          ['Exactly as it was mixed', 'What you hear is the file as delivered: no compression, no limiting, no volume changes. Everything travels encrypted.'],
        ].map(([t, d]) => <div key={t} className="ins-rule"><b>{t}</b><span>{d}</span></div>)}
      </section>

      <footer className="pr-foot"><span><b>CTRL ROOM</b> · where the music lives before it’s out.</span><span><Link href="/portal">Send your files</Link> · <Link href="/login">Sign in</Link></span></footer>
      <PoweredBy />
    </main>
  );
}
