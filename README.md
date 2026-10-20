# Expense Tracker

Shared monthly expense tracker. Next.js on Vercel, Supabase for accounts and data.
Specification: `expense-tracker-spec_2026-10-20.md`.

## What is in this folder

| Path | What it is |
|---|---|
| `supabase/schema.sql` | Database setup. Run once in Supabase → SQL Editor. |
| `app/` | The screens (Home, Add expense, History, Settings, sign-in pages). |
| `components/`, `lib/` | Shared pieces used by the screens. |
| `.env.example` | The two settings the app needs. |

## Setup in short

1. **Supabase:** create a project (region Tokyo), open SQL Editor, paste all of `supabase/schema.sql`, Run. Copy the Project URL and the publishable (or anon) key.
2. **GitHub:** create a private repository and upload this folder's contents (not `node_modules` or `.next`).
3. **Vercel:** import the repository, add the two settings below, deploy.
4. **Supabase again:** Authentication → URL Configuration → set Site URL to your Vercel address and add `https://<your-app>.vercel.app/**` to Redirect URLs.
5. **Test:** create an owner account, then a second account that joins with the owner's email, approve it, add an expense.

## Settings (environment variables)

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

Both are safe to be public; the database rules in `schema.sql` decide who can see what.
Never put the secret / service_role key in this app.

## Running on your own PC (optional)

```
npm install
cp .env.example .env.local   # then fill in the two values
npm run dev                  # open http://localhost:3000
```
