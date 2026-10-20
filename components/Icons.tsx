type P = { size?: number };
const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true
});
export const IconHome = ({ size = 22 }: P) => (
  <svg {...base(size)}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></svg>
);
export const IconList = ({ size = 22 }: P) => (
  <svg {...base(size)}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
);
export const IconSettings = ({ size = 22 }: P) => (
  <svg {...base(size)}><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></svg>
);
export const IconPlus = ({ size = 22 }: P) => (
  <svg {...base(size)} strokeWidth={2.4}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconLeft = ({ size = 20 }: P) => (
  <svg {...base(size)}><path d="m15 18-6-6 6-6" /></svg>
);
export const IconRight = ({ size = 20 }: P) => (
  <svg {...base(size)}><path d="m9 18 6-6-6-6" /></svg>
);
export const IconCalendar = ({ size = 18 }: P) => (
  <svg {...base(size)}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
);
export const IconCheck = ({ size = 22 }: P) => (
  <svg {...base(size)} strokeWidth={2.4}><path d="M20 6 9 17l-5-5" /></svg>
);
export const IconClock = ({ size = 16 }: P) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
