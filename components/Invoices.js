'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase, api } from '@/lib/supabase';
import { fmtDate, todayISO } from '@/lib/format';

const money = (n, cur = 'USD') => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur || 'USD', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n || 0); } catch { return `$${n}`; } };
const needsSql = (m) => /invoices|visible|project_locked/.test(String(m || ''));
export const SQL_HINT = 'Invoices need a quick database update: run supabase/009_invoices.sql in Supabase.';

export function useInvoices(projectId) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    if (!projectId) return;
    const { data, error } = await supabase().from('invoices').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
    if (error) { setErr(needsSql(error.message) ? SQL_HINT : error.message); setList([]); return; }
    setErr(''); setList(data || []);
  }, [projectId]);
  useEffect(() => { load(); }, [load]);
  return { list, err, load };
}

export const lockingInvoice = (list) => (list || []).find((i) => i.lock && i.status === 'unpaid' && i.visible) || null;

/** What the client sees, only for invoices you chose to show. */
export function InvoiceNotice({ list, compact = false }) {
  const open = (list || []).filter((i) => i.visible && i.status === 'unpaid');
  if (!open.length) return null;
  return (
    <div className={`invnote ${open.some((i) => i.lock) ? 'locked' : ''} ${compact ? 'compact' : ''}`}>
      {open.map((i) => {
        const late = i.due_date && i.due_date < todayISO();
        return (
          <div key={i.id} className="invrow">
            <span className="invicon" aria-hidden="true">{i.lock ? '🔒' : '$'}</span>
            <div className="invtext">
              <b>{i.lock ? 'Mixes unlock when this invoice is paid' : 'Invoice due'}{i.number ? ` · #${i.number}` : ''}</b>
              <span>{[i.amount != null ? money(i.amount, i.currency) : '', i.due_date ? `${late ? 'was due' : 'due'} ${fmtDate(i.due_date)}` : '', i.note].filter(Boolean).join(' · ')}</span>
            </div>
            {i.url && <a className="btn small primary" href={i.url} target="_blank" rel="noopener noreferrer">View &amp; pay</a>}
          </div>
        );
      })}
    </div>
  );
}

/** Engineer: attach and manage invoices on a project. Private unless you switch on "Show to client". */
export function InvoicePanel({ project, firstSongId, onChange }) {
  const { list, err, load } = useInvoices(project.id);
  const [f, setF] = useState({ number: '', amount: '', due_date: '', url: '', note: '', visible: false, lock: false });
  const [msg, setMsg] = useState('');
  const [hook, setHook] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const done = (m) => { setMsg(m); load(); onChange?.(); };

  const add = async (e) => {
    e.preventDefault(); setMsg('');
    if (!f.number.trim() && !f.url.trim() && !f.amount) return setMsg('Add at least an invoice number, amount or link.');
    if (f.url && !/^https?:\/\//i.test(f.url.trim())) return setMsg('Paste the full invoice link, starting with https://');
    const row = { project_id: project.id, number: f.number.trim().replace(/^#/, '') || null, amount: f.amount ? Number(String(f.amount).replace(/[^\d.]/g, '')) : null,
      due_date: f.due_date || null, url: f.url.trim() || null, note: f.note.trim() || null, visible: f.visible || f.lock, lock: f.lock };
    const { error } = await supabase().from('invoices').insert(row);
    if (error) return setMsg(needsSql(error.message) ? SQL_HINT : error.message);
    setF({ number: '', amount: '', due_date: '', url: '', note: '', visible: false, lock: false });
    done(row.visible ? 'Invoice added and shown to the client.' : 'Invoice added. Only you can see it until you switch on “Show to client”.');
  };
  const patch = async (inv, p, m) => {
    const { error } = await supabase().from('invoices').update(p).eq('id', inv.id);
    if (error) return setMsg(needsSql(error.message) ? SQL_HINT : error.message);
    done(m);
  };
  const remove = async (inv) => { if (!window.confirm('Remove this invoice from CTRL ROOM? (It stays in Invoice2go.)')) return; await supabase().from('invoices').delete().eq('id', inv.id); done('Removed.'); };
  const tell = async (inv) => {
    if (!inv.visible) await supabase().from('invoices').update({ visible: true }).eq('id', inv.id);
    const body = `Invoice${inv.number ? ` #${inv.number}` : ''}${inv.amount != null ? ` for ${money(inv.amount, inv.currency)}` : ''} is ready${inv.due_date ? `, due ${fmtDate(inv.due_date)}` : ''}.${inv.lock ? ' Your mixes unlock once it’s paid.' : ''}${inv.url ? ` Pay here: ${inv.url}` : ''}`;
    let texted = false;
    if (firstSongId) {
      try { texted = (await api('/api/sms', { songId: firstSongId, body })).sent; } catch {}
      await supabase().from('updates').insert({ song_id: firstSongId, body, texted });
    }
    done(texted ? 'Shown to the client and texted them.' : 'Shown to the client. It’s in their updates. Add Twilio to text them too.');
  };
  const getHook = async (reset = false) => { try { setHook((await api('/api/invoices', { reset })).url); } catch (e) { setMsg(e.message); } };

  return (
    <div className="panel invpanel" style={{ marginBottom: 24 }}>
      <h3>Invoices</h3>
      <p className="muted small" style={{ margin: 0 }}>Attach an Invoice2go (or any) invoice. It stays private unless you switch on <b>Show to client</b>. <b>Lock until paid</b> pauses the client’s listening until you mark it paid.</p>
      {err && <p className="ferr" style={{ margin: 0 }}>{err}</p>}

      {(list || []).map((i) => (
        <div key={i.id} className={`invitem ${i.status}`}>
          <div className="invmain">
            <b>{i.number ? `#${i.number}` : 'Invoice'}{i.amount != null ? ` · ${money(i.amount, i.currency)}` : ''}</b>
            <span>{[i.due_date ? `due ${fmtDate(i.due_date)}` : '', i.status === 'paid' && i.paid_at ? `paid ${fmtDate(i.paid_at.slice(0, 10))}` : '', i.note].filter(Boolean).join(' · ') || 'No due date'}</span>
            {i.url && <a className="link small" href={i.url} target="_blank" rel="noopener noreferrer">Open in Invoice2go ›</a>}
          </div>
          <select value={i.status} onChange={(e) => patch(i, { status: e.target.value, paid_at: e.target.value === 'paid' ? new Date().toISOString() : null }, e.target.value === 'paid' ? 'Marked paid. Anything locked is unlocked.' : 'Updated.')} aria-label="Status">
            <option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="void">Void</option>
          </select>
          <label className="invsw"><button type="button" className="switch" role="switch" aria-checked={i.visible} onClick={() => patch(i, { visible: !i.visible, ...(i.visible ? { lock: false } : {}) }, i.visible ? 'Hidden from the client.' : 'The client can see it now.')}><i /></button>Show to client</label>
          <label className="invsw"><button type="button" className="switch" role="switch" aria-checked={i.lock} disabled={i.status !== 'unpaid'} onClick={() => patch(i, { lock: !i.lock, ...(!i.lock ? { visible: true } : {}) }, i.lock ? 'Unlocked. The client can listen again.' : 'Locked. The client sees the invoice and can’t play mixes until it’s paid.')}><i /></button>Lock until paid</label>
          <span className="row-actions">
            {i.status === 'unpaid' && <button className="btn small" onClick={() => tell(i)}>Let them know</button>}
            <button className="btn small quiet" onClick={() => remove(i)}>Remove</button>
          </span>
        </div>
      ))}

      <form className="invform" onSubmit={add}>
        <div className="invgrid">
          <div className="fld"><label htmlFor="iv-n">Invoice #</label><input id="iv-n" value={f.number} onChange={set('number')} placeholder="1042" /></div>
          <div className="fld"><label htmlFor="iv-a">Amount</label><input id="iv-a" inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="450" /></div>
          <div className="fld"><label htmlFor="iv-d">Due</label><input id="iv-d" type="date" value={f.due_date} onChange={set('due_date')} /></div>
        </div>
        <div className="fld"><label htmlFor="iv-u">Invoice link <span className="opt">from Invoice2go: Share › Copy link</span></label><input id="iv-u" type="url" value={f.url} onChange={set('url')} placeholder="https://…" /></div>
        <div className="fld"><label htmlFor="iv-no">Note <span className="opt">optional, the client sees it if shown</span></label><input id="iv-no" value={f.note} onChange={set('note')} placeholder="50% deposit" /></div>
        <div className="row-actions">
          <label className="smsopt"><input type="checkbox" checked={f.visible || f.lock} onChange={set('visible')} disabled={f.lock} /> Show to client</label>
          <label className="smsopt"><input type="checkbox" checked={f.lock} onChange={set('lock')} /> Lock until paid</label>
          <button className="btn small primary">Add invoice</button>
        </div>
      </form>
      {msg && <p className="toast-inline" style={{ margin: 0 }}>{msg}</p>}

      <details className="invzap" onToggle={(e) => { if (e.currentTarget.open && !hook) getHook(); }}>
        <summary>Mark invoices paid automatically (Zapier)</summary>
        <ol>
          <li>In Zapier, make a Zap: <b>Invoice2go › Invoice paid</b> (or Payment received).</li>
          <li>Action: <b>Webhooks by Zapier › POST</b> to this URL, with a field <code>number</code> set to the invoice number:</li>
        </ol>
        {hook ? <div className="share-link"><code>{hook}</code><button type="button" className="btn small" onClick={() => { try { navigator.clipboard.writeText(hook); setMsg('Copied.'); } catch {} }}>Copy</button><button type="button" className="btn small quiet" onClick={() => { if (window.confirm('Make a new link? The old one stops working.')) getHook(true); }}>Reset</button></div> : <p className="muted small">Getting your link…</p>}
        <p className="muted small" style={{ margin: 0 }}>When Invoice2go marks it paid, CTRL ROOM marks it paid, unlocks the mixes and tells the client “Thank you!”.</p>
      </details>
    </div>
  );
}
