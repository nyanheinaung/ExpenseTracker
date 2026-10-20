'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/** Calls `onChange` whenever anyone adds, edits or removes an expense in this sheet. */
export function useExpenseChanges(sheetId: string | undefined, onChange: () => void) {
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    if (!sheetId) return;
    const sb = supabase();
    const ch = sb
      .channel(`expenses-${sheetId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `sheet_id=eq.${sheetId}` }, () => cb.current())
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [sheetId]);
}
