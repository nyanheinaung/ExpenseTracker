'use client';

import { useEffect, useState } from 'react';
import { takeFlash } from '@/lib/names';

/** Shows a short message left by the previous screen, e.g. "Saved". */
export default function Flash({ message }: { message?: string }) {
  const [text, setText] = useState('');
  useEffect(() => {
    const m = takeFlash();
    if (m) setText(m);
  }, []);
  useEffect(() => {
    if (message) setText(message);
  }, [message]);
  useEffect(() => {
    if (!text) return;
    const t = setTimeout(() => setText(''), 3500);
    return () => clearTimeout(t);
  }, [text]);
  return (
    <div className="flash-wrap" role="status" aria-live="polite">
      {text && <div className="flash">{text}</div>}
    </div>
  );
}
