'use client';

import { useEffect, useState } from 'react';
import BottomSheet from './Sheet';
import { SHORT_MONTHS, MONTHS } from '@/lib/format';
import { IconLeft, IconRight } from './Icons';

/** Calendar for quick navigation: year arrows and a grid of 12 months. */
export default function MonthPicker({
  open,
  year,
  month,
  onPick,
  onClose,
  extra
}: {
  open: boolean;
  year: number;
  month: number | null;
  onPick: (y: number, m: number) => void;
  onClose: () => void;
  extra?: { label: (y: number) => string; onClick: (y: number) => void };
}) {
  const [y, setY] = useState(year);
  useEffect(() => {
    if (open) setY(year);
  }, [open, year]);
  return (
    <BottomSheet open={open} label="Choose a month" onClose={onClose}>
      <div className="picker-year">
        <button className="icon-btn" aria-label="Previous year" onClick={() => setY(y - 1)}>
          <IconLeft />
        </button>
        <span className="picker-year-label">{y}</span>
        <button className="icon-btn" aria-label="Next year" onClick={() => setY(y + 1)}>
          <IconRight />
        </button>
      </div>
      <div className="grid-4">
        {SHORT_MONTHS.map((label, i) => {
          const selected = y === year && i === month;
          return (
            <button key={label} className="chip" aria-pressed={selected} aria-label={`${MONTHS[i]} ${y}`} onClick={() => onPick(y, i)}>
              {label}
            </button>
          );
        })}
      </div>
      {extra && (
        <button className="btn btn-secondary" onClick={() => extra.onClick(y)}>
          {extra.label(y)}
        </button>
      )}
    </BottomSheet>
  );
}
