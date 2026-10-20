'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Category, JoinRequest, Person, Profile, Sheet } from '@/lib/types';

const PUBLIC_PAGES = ['/login', '/signup', '/forgot'];
const ANY_PAGES = ['/update-password'];

type AppState = {
  ready: boolean;
  userId: string | null;
  profile: Profile | null;
  sheet: Sheet | null;
  categories: Category[];
  people: Person[];
  requests: JoinRequest[];
  isOwner: boolean;
  refreshAll: () => Promise<void>;
  refreshSheet: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  refreshPeople: () => Promise<void>;
  refreshRequests: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}

export default function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const [authChecked, setAuthChecked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [configError, setConfigError] = useState('');

  // Session
  useEffect(() => {
    let sb;
    try {
      sb = supabase();
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : String(e));
      return;
    }
    sb.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setAuthChecked(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setAuthChecked(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setProfileLoaded(true);
      return;
    }
    const { data } = await supabase().from('profiles').select('id,email,display_name,sheet_id,role,status').eq('id', userId).maybeSingle();
    setProfile((data as Profile) ?? null);
    setProfileLoaded(true);
  }, [userId]);

  const refreshSheet = useCallback(async () => {
    const { data } = await supabase().from('sheets').select('id,name,monthly_budget,owner_id').maybeSingle();
    setSheet((data as Sheet) ?? null);
  }, []);

  const refreshCategories = useCallback(async () => {
    const { data } = await supabase()
      .from('categories')
      .select('id,name,is_system,sort_order')
      .is('deleted_at', null)
      .order('sort_order')
      .order('created_at');
    setCategories((data as Category[]) ?? []);
  }, []);

  const refreshPeople = useCallback(async () => {
    const { data } = await supabase().rpc('sheet_people');
    const list = ((data as Person[]) ?? []).slice().sort((a, b) => Number(b.is_current) - Number(a.is_current) || a.display_name.localeCompare(b.display_name));
    setPeople(list);
  }, []);

  const refreshRequests = useCallback(async () => {
    const { data } = await supabase().rpc('list_join_requests');
    setRequests((data as JoinRequest[]) ?? []);
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    setProfileLoaded(false);
    refreshProfile();
  }, [authChecked, refreshProfile]);

  const active = profile?.status === 'active';
  const isOwner = active && profile?.role === 'owner';

  useEffect(() => {
    if (!active) {
      setSheet(null);
      setCategories([]);
      setPeople([]);
      setRequests([]);
      return;
    }
    refreshSheet();
    refreshCategories();
    refreshPeople();
  }, [active, profile?.sheet_id, refreshSheet, refreshCategories, refreshPeople]);

  // Join requests: refresh now, every 30 seconds, and when the window regains focus (owner only).
  useEffect(() => {
    if (!isOwner) {
      setRequests([]);
      return;
    }
    refreshRequests();
    const t = setInterval(refreshRequests, 30000);
    const onFocus = () => refreshRequests();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [isOwner, refreshRequests]);

  // Live updates for the account, the sheet, its categories and members.
  useEffect(() => {
    if (!userId) return;
    const sb = supabase();
    const ch = sb
      .channel(`app-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, () => refreshProfile());
    if (profile?.sheet_id && active) {
      const sid = profile.sheet_id;
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'categories', filter: `sheet_id=eq.${sid}` }, () => refreshCategories())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sheets', filter: `id=eq.${sid}` }, () => refreshSheet())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `sheet_id=eq.${sid}` }, () => {
          refreshPeople();
          refreshProfile();
        });
    }
    ch.subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [userId, profile?.sheet_id, active, refreshProfile, refreshCategories, refreshSheet, refreshPeople]);

  // Send people to the right screen.
  const ready = authChecked && (userId ? profileLoaded : true);
  const isPublic = PUBLIC_PAGES.includes(pathname);
  const isAny = ANY_PAGES.includes(pathname);
  let target: string | null = null;
  if (ready && !isAny) {
    if (!userId) {
      if (!isPublic) target = '/login';
    } else if (isPublic) {
      target = '/';
    } else if (profile && profile.status !== 'active' && pathname !== '/waiting') {
      target = '/waiting';
    } else if (profile && profile.status === 'active' && pathname === '/waiting') {
      target = '/';
    }
  }
  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  const refreshAll = useCallback(async () => {
    await refreshProfile();
  }, [refreshProfile]);

  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
    router.replace('/login');
  }, [router]);

  const value = useMemo<AppState>(
    () => ({
      ready,
      userId,
      profile,
      sheet,
      categories,
      people,
      requests,
      isOwner,
      refreshAll,
      refreshSheet,
      refreshCategories,
      refreshPeople,
      refreshRequests,
      signOut
    }),
    [ready, userId, profile, sheet, categories, people, requests, isOwner, refreshAll, refreshSheet, refreshCategories, refreshPeople, refreshRequests, signOut]
  );

  if (configError) {
    return (
      <div className="center-screen">
        <h1 className="title">Setup needed</h1>
        <p className="muted">{configError}</p>
      </div>
    );
  }

  const waitingForData = !ready || target !== null || (!isPublic && !isAny && userId && pathname !== '/waiting' && !sheet);
  return (
    <Ctx.Provider value={value}>
      {waitingForData && !isPublic && !isAny ? (
        <div className="center-screen" aria-busy="true">
          <p className="muted">Loading…</p>
        </div>
      ) : (
        children
      )}
    </Ctx.Provider>
  );
}
