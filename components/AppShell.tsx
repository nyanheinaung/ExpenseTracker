'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from './AppProvider';
import { IconHome, IconList, IconSettings } from './Icons';

/** Page frame: bottom navigation on phones, side menu on PC. `bare` hides the bottom bar on phones (forms). */
export default function AppShell({ children, bare = false, dock = false }: { children: React.ReactNode; bare?: boolean; dock?: boolean }) {
  const pathname = usePathname() || '/';
  const { sheet, profile, requests } = useApp();
  const items = [
    { href: '/', label: 'Home', icon: <IconHome />, match: (p: string) => p === '/' },
    { href: '/history', label: 'History', icon: <IconList />, match: (p: string) => p.startsWith('/history') },
    { href: '/settings', label: 'Settings', icon: <IconSettings />, match: (p: string) => p.startsWith('/settings') }
  ];
  return (
    <div className={`shell${bare ? ' shell-bare' : ''}`}>
      <nav className="nav" aria-label="Main">
        <div className="nav-head">
          <div className="nav-sheet">{sheet?.name ?? ''}</div>
          <div className="nav-user">Signed in as {profile?.display_name}</div>
        </div>
        {items.map((it) => {
          const active = it.match(pathname);
          return (
            <Link key={it.href} href={it.href} className="nav-item" aria-current={active ? 'page' : undefined}>
              {it.icon}
              <span>{it.label}</span>
              {it.href === '/settings' && requests.length > 0 && (
                <span className="badge" aria-label={`${requests.length} join request${requests.length > 1 ? 's' : ''}`}>
                  {requests.length}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <main className={`main${dock ? ' has-dock' : ''}`}>{children}</main>
    </div>
  );
}
