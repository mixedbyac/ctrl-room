// What people can be notified about, in the app (bell) and by email. Saved per person in their account (user_metadata.notify).
export const ENGINEER_KINDS = [
  ['plays', 'Someone listens', 'Plays on your mixes and share links'],
  ['notes', 'New notes', 'Clients and listeners leave a note'],
  ['approvals', 'Approvals & change requests', 'A song is approved, or changes are asked for'],
  ['uploads', 'Portal sends', 'Files come in through the Portal'],
  ['signups', 'Sign-ups', 'Someone makes an account or accepts an invite'],
  ['invoices', 'Invoices paid', 'An invoice is marked paid'],
  ['listening', 'Unusual listening', 'Possible leaks: lots of plays, new places or devices'],
];
export const CLIENT_KINDS = [
  ['mixes', 'New mixes & updates', 'Your engineer delivers a mix or posts an update'],
  ['notes', 'Replies & notes', 'Your engineer leaves a note or replies'],
  ['invoices', 'Invoices', 'An invoice is shared with you'],
];
const DEFAULT_OFF_EMAIL = new Set(['plays', 'notes']); // these can be a lot of email; on in the app
export function prefOf(notify, kind, channel) {
  const v = notify?.[kind]?.[channel];
  if (typeof v === 'boolean') return v;
  return channel === 'email' ? !DEFAULT_OFF_EMAIL.has(kind) : true;
}
