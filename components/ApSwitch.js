'use client';
import Link from 'next/link';

/** Artists | People switch: the two pages share one spot in the sidebar. */
export default function ApSwitch({ on }) {
  return (
    <nav className="apswitch" aria-label="Artists or people">
      <Link href="/artists" aria-current={on === 'artists' ? 'page' : undefined}>Artists</Link>
      <Link href="/people" aria-current={on === 'people' ? 'page' : undefined}>People</Link>
    </nav>
  );
}
