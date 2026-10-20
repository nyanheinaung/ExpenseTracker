# Monthly Expense Tracker — Specification

Version 1.0 · 2026-10-20 · Status: draft for review

Sample UI: https://claude.ai/artifact/9dygbZTZPv4Ys7nrxt3jBe (names, emails and amounts shown there are sample values only)

---

## 1. Purpose and scope

A simple monthly expense tracker that works equally well on phone and PC. Several people can record expenses into a shared sheet. The interface must be very simple: large touch targets, few choices per screen, and plain wording.

In scope: accounts, sheets, joining a sheet with owner approval, recording and editing expenses, monthly and yearly views, filters, category management, trash, CSV export.

Out of scope for v1: receipts/photos, multiple currencies, multiple sheets per account, notifications by email or push, offline entry.

## 2. Core rules

| # | Rule |
|---|------|
| R1 | One email address = one account. |
| R2 | One account is bound to exactly one sheet. |
| R3 | One sheet can have many accounts (members). |
| R4 | A new account either creates its own sheet (becomes **owner**) or requests to join an existing sheet by entering the **current owner's email**. |
| R5 | Joining requires the owner's approval. Until then the account can see nothing. |
| R6 | Nothing is hard-deleted from the user interface. Removed expenses go to Trash and can be restored. |
| R7 | Every sheet has a fixed category **Other** that cannot be renamed or removed and is not shown in Settings. |
| R8 | When a category is removed, all its expenses are reassigned to **Other**. |

## 3. Technology

| Layer | Choice |
|---|---|
| Front end | Next.js (App Router), TypeScript, deployed on Vercel |
| Back end / DB | Supabase (Postgres, Auth, Row Level Security, Realtime) |
| Auth | Supabase email + password, email confirmation on |
| Hosting secrets | Supabase URL and anon key as public env vars; service role key only in Vercel server env, never sent to the browser |
| Install | Progressive Web App (manifest + icons) so it can be added to a phone home screen |
| Time zone | Asia/Tokyo for "today" and month boundaries |
| Currency | JPY, whole yen (integer), shown as `¥1,240` |

## 4. Roles and permissions

| Action | Owner | Member | Pending |
|---|---|---|---|
| View sheet, expenses, totals | ✔ | ✔ | — |
| Add expense | ✔ | ✔ | — |
| Edit / remove own expense | ✔ | ✔ | — |
| Edit / remove others' expenses | ✔ | — | — |
| Restore from Trash | ✔ | own items | — |
| Change sheet name, budget | ✔ | — | — |
| Add / remove categories | ✔ | — | — |
| Approve / decline join requests | ✔ | — | — |
| Remove a member | ✔ | — | — |
| Transfer ownership | ✔ | — | — |
| Export CSV | ✔ | ✔ | — |
| Cancel own join request | — | — | ✔ |

## 5. Account and joining flows

### 5.1 Sign-up

Fields: Name (required), Email (required), Password (required, min 8 chars), Sheet creator's email (optional).

- **Creator email empty** → server creates a sheet, the 6 default categories (§7.1), and binds the account as **owner / active**. Go to Home.
- **Creator email filled** → server creates a join request and sets the account to **pending**. Go to Waiting screen.
  - The response is identical whether or not that email belongs to an owner (prevents checking who has an account).
  - If the email does not match an owner, the request stays unmatched and simply never gets approved.
  - A user cannot enter their own email.

### 5.2 Waiting for approval

Shows request date and two actions: **Check again** (re-reads status) and **Cancel request**.

- Approved → account becomes **member / active**, bound to that sheet. Go to Home.
- Declined → screen shows "Request declined" with options: request another sheet, or start my own sheet.
- Cancelled → same two options.
- Pending requests expire after 14 days (shown as declined).

### 5.3 Owner handling requests

Pending requests appear as a card at the top of Settings (name + email, **Approve** / **Decline**). PC sidebar shows a "1 request" badge. Approval and decline take effect immediately (Realtime).

### 5.4 Member removal and ownership

- Owner can remove a member (confirmation required). The member's account becomes unbound and sees the same choice as a declined request. Their past expenses stay in the sheet with their name.
- Owner can transfer ownership to an active member (confirmation required). From then on the new owner's email is the one used for join requests.
- The owner cannot leave or be removed without transferring ownership first.

### 5.5 Sign in / out

Standard email + password sign-in, "Forgot password" via Supabase reset email. Sign out from Settings.

## 6. Data model (Supabase / Postgres)

```sql
create table sheets (
  id              uuid primary key default gen_random_uuid(),
  name            text not null default 'My expenses' check (char_length(name) between 1 and 60),
  monthly_budget  integer check (monthly_budget is null or monthly_budget >= 0),
  owner_id        uuid not null,
  created_at      timestamptz not null default now()
);

create table profiles (
  id            uuid primary key references auth.users(id),
  email         text not null unique,
  display_name  text not null check (char_length(display_name) between 1 and 40),
  sheet_id      uuid references sheets(id),
  role          text check (role in ('owner','member')),
  status        text not null check (status in ('pending','active','unbound')),
  created_at    timestamptz not null default now()
);

create table join_requests (
  id              uuid primary key default gen_random_uuid(),
  requester_id    uuid not null references profiles(id),
  target_email    text not null,
  sheet_id        uuid references sheets(id),          -- null if email matched no owner
  status          text not null check (status in ('pending','approved','declined','cancelled','expired')),
  created_at      timestamptz not null default now(),
  decided_at      timestamptz,
  decided_by      uuid references profiles(id)
);
create unique index one_open_request on join_requests(requester_id) where status = 'pending';

create table categories (
  id          uuid primary key default gen_random_uuid(),
  sheet_id    uuid not null references sheets(id),
  name        text not null check (char_length(name) between 1 and 30),
  is_system   boolean not null default false,          -- true only for "Other"
  sort_order  integer not null default 0,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now()
);
create unique index category_name_unique
  on categories(sheet_id, lower(name)) where deleted_at is null;

create table expenses (
  id              uuid primary key default gen_random_uuid(),
  sheet_id        uuid not null references sheets(id),
  name            text not null check (char_length(trim(name)) between 1 and 100),
  amount          integer not null check (amount > 0 and amount <= 99999999),
  category_id     uuid not null references categories(id),
  payment_method  text not null check (payment_method in ('cash','card','transfer')),
  spent_on        date not null,
  created_by      uuid not null references profiles(id),
  created_at      timestamptz not null default now(),
  updated_by      uuid references profiles(id),
  updated_at      timestamptz,
  deleted_by      uuid references profiles(id),
  deleted_at      timestamptz
);
create index expenses_sheet_date on expenses(sheet_id, spent_on) where deleted_at is null;

create table expense_history (
  id          bigint generated always as identity primary key,
  expense_id  uuid not null references expenses(id),
  action      text not null check (action in ('create','update','delete','restore','recategorize')),
  before      jsonb,
  after       jsonb,
  changed_by  uuid references profiles(id),
  changed_at  timestamptz not null default now()
);
```

Notes:
- `profiles.email` uniqueness mirrors Supabase Auth and enforces R1.
- `expense_history` rows are written by a trigger on every insert / update of `expenses`.
- Amounts are stored as integers (yen); no decimals.

## 7. Categories

### 7.1 Defaults

Created with every new sheet: Supplies, Transport, Meals, Utilities, Materials, and **Other** (`is_system = true`).

### 7.2 Rules

- Settings → Categories lists all non-system, non-deleted categories with their expense count. **Other** is never listed.
- **Add:** name trimmed; must be 1–30 characters; must not match an existing active category or "Other" (case-insensitive). Errors: "Type a category name first." / "That category already exists."
- **Remove:** confirmation sheet states how many expenses will move ("Its 26 expenses will be moved to Other."). On confirm, one server function (single transaction) sets `deleted_at` on the category, reassigns its expenses to the sheet's Other category, and writes `recategorize` history rows. A status message confirms the result.
- Renaming categories: not in v1.
- Category lists everywhere else (Add expense, History filter) include Other.

## 8. Screens and behaviour

All screens use one accent colour, 16 px+ body text, touch targets ≥ 44 px, and plain labels. Phone layout has a bottom navigation bar: **Home · History · Settings**.

### 8.1 Home

- Header: previous / next month arrows and the month label (e.g. "October 2026") with a calendar icon. Tapping the label opens the **month picker** (§8.7). Sheet name shown under it.
- Card: total spent this month, progress bar against budget, "¥63,600 left" or "¥12,000 over budget" (warning colour). If no budget is set, the bar and remaining line are hidden.
- By category: categories with spending this month, highest first, each with amount and a bar (share of month total). Empty month shows "No expenses this month yet."
- Latest: the 2 most recent entries (name, date · member, amount) and a "See all" link to History.
- Large **Add expense** button fixed above the navigation bar.

### 8.2 Add / edit expense

Field order:

1. **Name** — required, text, max 100 characters. Shows saved-name suggestions (§9).
2. **Amount** — numeric keypad, whole yen, required (> 0).
3. **Category** — one-tap buttons in a 3-column grid; default = last used on this device, else first category.
4. **Paid by** — Cash / Card / Transfer; default = last used on this device.
5. **Date** — date input, defaults to today (Asia/Tokyo).

- **Save** validates; missing name shows "Please enter a name for this expense." and highlights the field; missing amount shows "Please enter an amount." On success, return to the previous screen and show a short "Saved" message.
- Edit mode (opened from History) uses the same form, plus a **Remove** button (moves to Trash after confirmation).

### 8.3 History

- Header: previous / next arrows and the period label with calendar icon (opens §8.7).
- **Monthly / Yearly** switch.
- Search box: matches expense name, case-insensitive, partial match.
- Two dropdowns side by side: **Category** (All, each active category, Other) and **Member** (All, each current member, plus former members who have expenses, marked "(former)").
- Search, Category and Member filters combine (all must match). An active dropdown is outlined in the accent colour.
- Summary line: "N items · ¥total" for the current filters, and a **Clear filters** button when any filter is active.
- **Monthly view:** entries grouped by day, newest first; day header like "MON, OCT 19"; each row shows name, "category · payment · member", amount. Tap a row to edit. No results: "No expenses match."
- **Yearly view:** January–December rows with the filtered total and a bar relative to the highest month. Months with no expenses at all show "–". Tapping a month switches to Monthly view for that month (filters kept).

### 8.4 Settings

- Join request card(s) at the top for the owner (§5.3).
- Sheet: name, monthly budget, Categories (opens §7.2). Owner-only items are read-only for members.
- Members: name, email, role badge. Owner sees a remove option per member and "Transfer ownership".
- Data: Trash (count, opens list with **Restore**), Download as CSV (§10).
- Sign out.

### 8.5 Sign-up and Waiting

As described in §5.1 and §5.2. Sign-up screen also links to Sign in.

### 8.6 PC layout

Same features and rules. At ≥ 1024 px the bottom bar becomes a left sidebar (sheet name, signed-in user, Home / History / Settings, request badge). Home shows three summary cards (Spent, Budget, Left), the latest expenses as a table (Date, Name, Category, Entered by, Amount), and the category breakdown beside it. Add expense opens as a dialog. Wide tables scroll inside their own box.

### 8.7 Month picker (calendar)

Bottom sheet on phone, popover on PC.
- Year with previous / next arrows.
- 12 month buttons (Jan–Dec); the month currently shown is highlighted.
- Home: tapping a month jumps to it; a **Back to this month** button returns to the current month.
- History: tapping a month switches to Monthly view for it; a **Show the whole year** button switches to Yearly view for the selected year.
- Tapping outside closes it.

## 9. Saved names (local memory)

- Stored only on the current device, in `localStorage`, under the key `expense-tracker:names:v1:<user-id>`. Not stored in Supabase and not shared between devices or members.
- A name is added (or moved to the front) each time an expense is saved successfully.
- Duplicates are merged case-insensitively; most recently used first; maximum 200 names (oldest dropped).
- Suggestions appear as soon as one character is typed: case-insensitive partial match, exact match hidden, list scrolls after about 5 rows. Tapping a suggestion fills the Name field.
- Read and write are wrapped in try/catch; if storage is unavailable, the field works without suggestions.

## 10. CSV export

Exports the period currently selected in History (month or year) with the current filters applied. UTF-8 with BOM (opens correctly in Excel). Columns: Date, Name, Category, Payment, Amount, Entered by, Created at. File name: `expenses_<sheet-name>_<YYYY-MM or YYYY>.csv`. Removed (Trash) items are excluded.

## 11. Security (Row Level Security)

- RLS enabled on every table.
- Helper `is_active_member(sheet uuid)` (security definer) returns true when the caller's profile is `active` and bound to that sheet. `is_owner(sheet uuid)` likewise for owners.
- `sheets`, `categories`, `expenses`: select allowed only when `is_active_member(sheet_id)`. Insert / update follow the permission table in §4.
- `profiles`: a user can read their own row and the rows of members of their sheet.
- `join_requests`: requester reads their own; owner reads requests for their sheet.
- Server-only functions (Postgres RPC, security definer, with explicit checks inside):
  - `create_own_sheet()` — §5.1, empty creator email.
  - `request_join(owner_email text)` — §5.1; neutral result; rate-limited (e.g. 5 per hour per user).
  - `respond_join(request_id uuid, approve boolean)` — owner only.
  - `cancel_join_request()`, `remove_member(profile_id uuid)`, `transfer_ownership(profile_id uuid)`.
  - `remove_category(category_id uuid)` — §7.2, single transaction.
  - `remove_expense(id uuid)`, `restore_expense(id uuid)` — set / clear `deleted_at`.
- No hard deletes are exposed to the client.

## 12. Realtime

Clients subscribe to changes on `expenses`, `categories` and `join_requests` for their sheet, so an entry made on one device appears on others without reloading.

## 13. Non-functional requirements

- Responsive: phone layout below 768 px, sidebar layout from 1024 px.
- Accessibility: real buttons and labelled inputs, visible focus, text contrast ≥ 4.5:1, touch targets ≥ 44 px, icon-only buttons have labels.
- Performance: Home and History load in under 2 seconds on a typical 4G phone for a sheet with 5,000 expenses.
- Language: English UI in v1; text kept in one file so a Japanese version can be added later.
- Browsers: latest Safari (iOS), Chrome (Android, Windows, macOS), Edge.

## 14. Delivery phases

1. **Foundation:** Supabase schema, RLS, sign-up / sign-in, create sheet, join request and approval, Waiting screen.
2. **Daily use:** Add / edit expense with saved names, Home, History monthly view with filters, month picker, Trash.
3. **Management:** Settings (budget, members, ownership), Categories, Yearly view, CSV export.
4. **Polish:** PC layout refinements, PWA install, Realtime, final accessibility pass.

## 15. Open decisions

| # | Question | Proposed default |
|---|---|---|
| D1 | Can members edit or remove other members' expenses? | No — owner only (§4). |
| D2 | How long are pending join requests kept? | 14 days, then expired. |
| D3 | Is a monthly budget per category needed? | Not in v1. |
| D4 | Should Trash items ever be purged automatically? | No — kept indefinitely. |
