'use client';

import { useEffect, useRef } from 'react';

/** Bottom sheet on phones, centered dialog on PC. Closes with Escape or a tap outside. */
export default function BottomSheet({
  open,
  label,
  onClose,
  children,
  alert = false
}: {
  open: boolean;
  label: string;
  onClose: () => void;
  children: React.ReactNode;
  alert?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('button, input, select, a[href]');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay">
      <button className="backdrop" aria-label="Close" onClick={onClose} tabIndex={-1} />
      <div className="sheet-panel" role={alert ? 'alertdialog' : 'dialog'} aria-modal="true" aria-label={label} ref={ref}>
        {children}
      </div>
    </div>
  );
}

export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <BottomSheet open={open} label={title} onClose={onCancel} alert>
      <h2 className="sheet-title">{title}</h2>
      <p className="sheet-body">{body}</p>
      <div className="two-buttons">
        <button className="btn btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </BottomSheet>
  );
}
