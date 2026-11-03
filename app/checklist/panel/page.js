'use client';
import Checklist from '@/components/Checklist';

// The small always-on-top window in the Mac app (Window › Notes Checklist).
export default function ChecklistPanel() {
  return <main className="cklpanel"><Checklist panel /></main>;
}
