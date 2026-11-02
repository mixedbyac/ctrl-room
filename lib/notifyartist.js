'use client';
import { api } from '@/lib/supabase';

// Engineer side: email the artist when you leave a note or reply. Remembered per device; on by default.
export const emailArtistOn = () => { try { return localStorage.getItem('cr_email_artist') !== '0'; } catch { return true; } };
export const setEmailArtist = (on) => { try { localStorage.setItem('cr_email_artist', on ? '1' : '0'); } catch {} };
/** Fire and forget; resolves to { sent } or null. */
export const notifyArtist = (noteId) => (noteId ? api('/api/notes/notify', { noteId }).catch(() => null) : Promise.resolve(null));
