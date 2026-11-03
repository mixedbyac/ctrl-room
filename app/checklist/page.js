'use client';
import Checklist from '@/components/Checklist';
import { TopBar } from '@/components/AppShell';

export default function ChecklistPage() {
  return <><TopBar crumbs={[{ label: 'Home', href: '/' }, { label: 'Notes checklist' }]} /><section className="page"><Checklist /></section></>;
}
