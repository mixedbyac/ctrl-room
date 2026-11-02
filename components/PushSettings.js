'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/supabase';
import { pushSupport, turnOnPush, turnOffPush, thisDeviceOn } from '@/lib/pushclient';
import { deviceName } from '@/lib/format';
import { isMacApp, macNotifyOn, setMacNotify, macNotifyPermission } from '@/lib/native';

/** Settings › Notifications: get CTRL ROOM notifications on this phone or computer. */
export default function PushSettings() {
  const [mac, setMac] = useState(null);
  useEffect(() => { setMac(isMacApp()); }, []);
  return mac === null ? null : mac ? <MacNotify /> : <WebPush />;
}

function WebPush() {
  const [sup, setSup] = useState(null);
  const [on, setOn] = useState(false);
  const [devices, setDevices] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const refresh = async () => {
    setSup(pushSupport()); setOn(await thisDeviceOn());
    api('/api/push', { action: 'status' }).then((r) => setDevices(r.devices || [])).catch(() => {});
  };
  useEffect(() => { refresh(); }, []);
  const enable = async () => {
    setBusy(true); setMsg('');
    try { const r = await turnOnPush(deviceName?.() || 'This device'); setDevices(r.devices || []); setOn(true); await api('/api/push', { action: 'test' }); setMsg('On. We just sent a test notification.'); }
    catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  const disable = async () => { setBusy(true); try { await turnOffPush(); setOn(false); refresh(); setMsg('Off on this device.'); } catch (e) { setMsg(e.message); } setBusy(false); };
  return (
    <div className="panel secpanel" id="push">
      <b>Phone notifications {on && <span className="tbadge ok">✓ On here</span>}</b>
      <span className="muted small">Get a notification on your lock screen when someone sends files, leaves a note, approves, or a new mix is ready. Uses the same choices as “In the app” below.</span>
      {sup === 'ios-home' ? (
        <ol className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>In Safari, tap the Share button, then <b>Add to Home Screen</b>.</li>
          <li>Open CTRL ROOM from your Home Screen and sign in.</li>
          <li>Come back to Settings › Notifications and tap <b>Turn on</b>.</li>
        </ol>
      ) : sup === 'unsupported' ? (
        <span className="small muted">This browser can’t show notifications. Try Safari on iPhone (from the Home Screen), or Chrome.</span>
      ) : sup === 'ok' && (
        <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {on ? <>
            <button className="btn small" disabled={busy} onClick={() => api('/api/push', { action: 'test' }).then((r) => setMsg(r.sent ? 'Sent. Check your notifications.' : 'Couldn’t reach this device. Turn it off and on again.'))}>Send a test</button>
            <button className="btn small quiet" disabled={busy} onClick={disable}>Turn off here</button>
          </> : <button className="btn small primary" disabled={busy} onClick={enable}>{busy ? 'Turning on…' : 'Turn on'}</button>}
        </div>
      )}
      {devices.length > 0 && <span className="small muted">On for: {devices.map((d) => d.device || 'a device').join(', ')}</span>}
      {msg && <span className="small" role="status">{msg}</span>}
    </div>
  );
}

/** In the Mac app: real macOS banners (and the unread count on the Dock icon). */
function MacNotify() {
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { (async () => setOn(macNotifyOn() && (await macNotifyPermission(false))))(); }, []);
  const enable = async () => {
    setMsg('');
    const ok = await macNotifyPermission(true);
    if (!ok) return setMsg('macOS didn’t allow it. Open System Settings › Notifications › CTRL ROOM and turn on Allow notifications, then try again.');
    setMacNotify(true); setOn(true); setMsg('On. New files, notes and approvals show up as Mac notifications while CTRL ROOM is open (even with the window closed).');
  };
  const disable = () => { setMacNotify(false); setOn(false); setMsg('Off in the Mac app.'); };
  return (
    <div className="panel secpanel" id="push">
      <b>Mac notifications {on && <span className="tbadge ok">✓ On</span>}</b>
      <span className="muted small">Banners in the corner of your screen and a count on the Dock icon. Uses the same choices as “In the app” below.</span>
      <div className="row" style={{ gap: 10 }}>{on ? <button className="btn small quiet" onClick={disable}>Turn off</button> : <button className="btn small primary" onClick={enable}>Turn on</button>}</div>
      {msg && <span className="small" role="status">{msg}</span>}
    </div>
  );
}
