import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { avatarStyle, initials, plain } from '../lib/format.js';

export function Modal({ open, title, icon, onClose, children, footer, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          {icon && <span style={{ fontSize: 24 }}>{icon}</span>}
          <h3>{title}</h3>
          <button className="icon-btn sm" onClick={onClose} aria-label="Tutup" id="modal-close"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ open, title = 'Yakin nih?', message, confirmText = 'Ya, hapus', onConfirm, onClose, busy }) {
  return (
    <Modal
      open={open}
      title={title}
      icon="🫣"
      onClose={onClose}
      footer={(
        <>
          <button className="btn btn-ghost" onClick={onClose} id="confirm-cancel">Batal</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={busy} id="confirm-ok">
            {busy && <Loader2 size={16} className="spin" />} {confirmText}
          </button>
        </>
      )}
    >
      <p className="muted" style={{ fontSize: 15 }}>{message}</p>
    </Modal>
  );
}

export const Avatar = ({ name, size = '' }) => (
  <span className={`avatar ${size}`} style={avatarStyle(name)}>{initials(name)}</span>
);

export function MoneyInput({ value, onChange, id, autoFocus }) {
  const [text, setText] = useState(value ? plain(value) : '');
  useEffect(() => { setText(value ? plain(value) : ''); }, [value]);
  return (
    <div className="money-input">
      <span>Rp</span>
      <input
        id={id}
        className="input"
        inputMode="numeric"
        autoFocus={autoFocus}
        value={text}
        placeholder="0"
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, '')) || 0;
          setText(n ? plain(n) : '');
          onChange(n);
        }}
      />
    </div>
  );
}

export const Switch = ({ on, onChange, id, label }) => (
  <button type="button" id={id} role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />
);

export function TagInput({ value, onChange, placeholder, locked = [] }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setDraft('');
  };
  return (
    <div className="tag-input">
      {value.map((t) => (
        <span key={t} className="badge violet">
          {t}
          {!locked.includes(t) && (
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Hapus ${t}`}><X size={12} /></button>
          )}
        </span>
      ))}
      <input
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
        onBlur={add}
      />
    </div>
  );
}

export const Loader = ({ text = 'Bentar ya, lagi ngitung duit…' }) => (
  <div className="loader">
    <div style={{ display: 'grid', placeItems: 'center', gap: 14 }}>
      <div className="spinner" />
      <p className="muted" style={{ fontWeight: 600 }}>{text}</p>
    </div>
  </div>
);

export const Empty = ({ emoji = '🫥', title = 'Belum ada data', children }) => (
  <div className="empty">
    <span className="big-emoji">{emoji}</span>
    <b style={{ color: 'var(--text)', fontSize: 16 }}>{title}</b>
    {children && <p style={{ marginTop: 4 }}>{children}</p>}
  </div>
);

export const ErrorState = ({ message, onRetry }) => (
  <div className="card"><Empty emoji="🛸" title="Waduh, ada error">
    {message}
    {onRetry && <><br /><button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={onRetry}>Coba lagi</button></>}
  </Empty></div>
);
