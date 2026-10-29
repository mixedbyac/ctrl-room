'use client';
import Link from 'next/link';
import { useProfiles, BlueCheck } from '@/components/Credit';

/** Bottom of the sidebar: your picture, name, email and role, then Your profile / Security / Sign out, all lined up. */
export default function SideMe({ session, eng, signOut }) {
  const list = useProfiles();
  const email = session.user.email || '';
  const prof = eng ? list.find((p) => p.email === email.toLowerCase()) : null;
  const md = session.user.user_metadata || {};
  const name = prof?.display_name || prof?.full_name || md.display_name || md.name || email.replace(/@.*/, '');
  const photo = prof?.photo_url || md.avatar_url || null;
  const verified = eng ? !!prof?.verified || !!session.user.email_confirmed_at : !session.user.app_metadata?.needs_verify;
  return (
    <div className="sideme">
      <Link href="/settings" className="sidemecard" title="Settings">
        <span className="sideav">{photo ? <img src={photo} alt="" /> : (name[0] || '?').toUpperCase()}</span>
        <span className="sidewho">
          <b>{name}{verified && <BlueCheck title="Verified" />}</b>
          <small>{email}</small>
          <small className="siderole">{eng ? 'Engineer' : 'Artist'}</small>
        </span>
      </Link>
      <nav className="sidelinks">
        <Link href="/settings">Settings</Link>
        <button type="button" onClick={signOut}>Sign out</button>
      </nav>
    </div>
  );
}
