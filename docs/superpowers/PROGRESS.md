# Manager App — Progress & Resume Guide

> Living document. Read this first in any new session on this project — it's written so a fresh Claude Code session (no memory of prior conversations) can resume work efficiently. Update it at the end of every completed plan/block.

## What this project is

A family-management app (calendar, client/payment tracking for a cleaning-service side business, monthly expenses, notes) built for the user's mother — designed to also work for other families in the future (multi-household from day one). React Native + Expo Router + TypeScript + Supabase, web and mobile from one codebase.

- **Spec** (product requirements, all decisions): `docs/superpowers/specs/2026-09-17-family-manager-app-design.md`
- **GitHub:** https://github.com/MattiP99/Manager_App (branch `main`, no other branches — see "Workflow" below)
- **Supabase Cloud project ref:** `qivxrbhbffwqqmaadpnl` (already created, already linked)

## Status: 2 of 6 planned blocks complete

The spec was decomposed into sequential sub-project blocks (each its own plan doc under `docs/superpowers/plans/`, executed and merged one at a time):

1. ✅ **Fondamenta** (`2026-09-17-fondamenta.md`) — auth, household multi-tenancy, RLS foundation, tab shell. Complete, merged.
2. ✅ **Clienti + Pagamenti** (`2026-09-17-clienti-pagamenti.md`) — client management, work session logging, FIFO payment ledger, Pagamenti tab. Complete, merged.
3. ⬜ **Calendario Lavoro** — NEXT. Visual day/week/month calendar for work sessions (color-coded paid/unpaid), reusing `work_session_status` (Task 1 of block 2) and `useCreateWorkSession` (Task 4 of block 2). Not started — no spec/plan doc written yet for this block specifically, only the overall spec's §5 mentions a reusable `CalendarView` component.
4. ⬜ **Calendario familiare** (Francesca's appointments, recurring events)
5. ⬜ **Spese mensili**
6. ⬜ **Note** (with encrypted password section)
7. ⬜ **README finale** with screenshots/GIF demo/architecture diagram (explicitly requested by the user for a portfolio — see spec §"README" discussion in conversation, not in the spec doc itself)

## How to resume: the workflow this project uses

Every block follows the same cycle — **use it again for Calendario Lavoro and beyond**:

1. **`superpowers:brainstorming`** — only needed if the block's scope isn't already fully decided in the spec doc. For blocks 3-6, the spec's relevant section already has the design decided; a light brainstorm/confirmation pass with the user before writing the plan is still good practice (confirm scope, any new tech decisions) but doesn't need the full architectural ceremony again.
2. **`superpowers:writing-plans`** — write `docs/superpowers/plans/YYYY-MM-DD-<block-name>.md` following the exact structure of the two existing plan docs (Global Constraints section, numbered tasks with Files/Interfaces/Steps, no placeholders, real code in every step). **Read the existing Fondamenta and Clienti+Pagamenti plan docs as templates before writing a new one** — they show the established code conventions (hook naming, file layout, styling patterns) in full.
3. **User picks execution mode** — has always chosen subagent-driven (recommended default).
4. **`superpowers:subagent-driven-development`** — dispatch a fresh subagent per task, task review after each (spec + quality), fix loop on findings, final whole-branch review on the most capable model, ONE fix wave for that review's findings, re-review, then finish.
5. **`superpowers:finishing-a-development-branch`** — run full test suite, then ask the user: push to GitHub now, or keep local. (No feature branches are used in this project — see below.)

### Project-specific deviations from the default skill instructions

- **No git worktrees, no feature branches.** The user explicitly chose to work directly on `main` for every block (asked once per plan in `using-git-worktrees`'s Step 0 consent check — the answer has been "no" both times). When `finishing-a-development-branch`'s skill presents its 3-option menu (merge / push+PR / keep), **adapt it**: since there's no branch to merge, the real question is just "push these local commits to `origin/main` now, or keep them local for now." Ask that directly instead of the literal 3-option menu.
- **Every plan gets its own SDD workspace** at `.superpowers/sdd/<plan-filename-without-.md>/` (gitignored). **Delete it when the plan's final review comes back clean** (`rm -rf .superpowers/sdd/<name>`) — git history is the permanent record, per the skill's own instructions.

## Environment quirks specific to this project — save yourself the rediscovery

These bit multiple tasks across both blocks before being understood. **Include them in every implementer/reviewer dispatch that touches routes or does a `tsc --noEmit` check:**

1. **`.expo/types/router.d.ts` (gitignored) only fully regenerates after Metro completes a REAL bundle pass** — triggered by an actual HTTP request to the running dev server, not just the server starting up ("Waiting on http://..."). A `tsc --noEmit` run against a stale/partial version of this file produces spurious `router.replace('/')`-style errors, or (worse, seen once) a corrupted file with bogus route entries from an interrupted earlier run. **Correct verification sequence:** `npx expo start --web --port <N> &` in background → wait for "Waiting on http://..." in its log → `curl -s -o /dev/null http://localhost:<N>/` to force a real bundle → wait a few seconds → then run `tsc --noEmit` → then kill the background server (`netstat -ano | grep :<N>` then `taskkill //F //PID <pid>` on this Windows machine). Never just start-and-immediately-kill.
2. **Numeric Postgres columns (`numeric(10,2)` etc.) return as genuine JS `number` via supabase-js in this project** — empirically verified with a live throwaway script against the real database (see Clienti+Pagamenti plan's ledger, now deleted — the finding itself is what matters: don't add defensive `Number()`/`parseFloat()` coercion around Supabase query results "just in case," it's unnecessary here even though PostgREST folklore suggests otherwise for some setups).
3. **Any new Postgres view MUST declare `with (security_invoker = true)` explicitly.** Without it, a view runs with the view owner's (migration role's) privileges for RLS purposes, not the querying user — silently bypasses household isolation. This exact bug class caused a real incident in the Fondamenta block (`household_members` self-referential RLS recursion, fixed via a `SECURITY DEFINER` helper in migration `0002`) and was correctly avoided from the start in Clienti+Pagamenti's `work_session_status` view (migration `0004`).
4. **The established RLS pattern for new household-scoped tables:** `is_household_member(household_id)` (the helper function from migration `0002`) used as both `USING` and `WITH CHECK` in a single `for all` policy per table — no per-table RPC needed (that pattern is reserved for the household creation/join flow specifically, which needed atomicity + not exposing invite codes). Copy this template for every new table in future blocks (calendar events, expenses, notes).
5. **This execution environment has no interactive/headless browser tooling** (no Playwright/Puppeteer, nothing that can click through a UI). Established, repeatedly-applied standard: task/final reviews substitute careful hand-tracing of the actual diffed code (navigation param names matching end-to-end, conditional logic not inverted, correct field usage) for a literal browser click-through, and this has been treated as sufficient rather than a blocking gap — but real bugs have still been caught this way (see below), so don't use this as an excuse to skip careful review.
6. **List queries need an explicit secondary `.order()` tiebreak** — Postgres doesn't guarantee row order among ties on a single sort column (`date`, `name`, etc.). This has already had to be fixed twice (once in Fondamenta for household selection, once in Clienti+Pagamenti's final review for session/payment/client lists) — get it right from the start in new queries: `.order(primaryColumn).order('created_at', { ascending: false })` (or `.order('id')` when there's no `created_at` to lean on).
7. **`src/lib/database.types.ts` must be regenerated after every schema change**: `export SUPABASE_ACCESS_TOKEN=$(grep SUPABASE_ACCESS_TOKEN .env | cut -d '=' -f2)` then `npx supabase gen types typescript --project-id qivxrbhbffwqqmaadpnl > src/lib/database.types.ts`. Use the typed client (`createClient<Database>`) — casts like `as WorkSessionStatus[]` are fine when narrowly scoped to a known codegen quirk (generated/view columns marked nullable even when the schema guarantees they're present) but were specifically investigated field-by-field in two separate reviews before being accepted as safe, not rubber-stamped.

## Real bugs that were actually caught this way (evidence the process works, don't skip steps to save time)

- RLS infinite recursion in `household_members`'s own SELECT policy (Fondamenta) — found by running the RLS integration tests for real, not by reading the SQL.
- A "fix" that silently broke mobile session persistence by replacing `AsyncStorage` with a no-op storage adapter on native (Fondamenta) — caught by the controller reading the diff directly instead of trusting a "DONE_WITH_CONCERNS" self-report.
- A spurious redirect bug from misreading React Query's `isLoading` on a disabled query (Fondamenta final review).
- Two genuine money-correctness bugs in `dateRangeForPeriod` — a month-end date rollover silently dropping up to 3 days from period totals, and UTC-vs-local date computation misdating anything logged just after midnight (Clienti+Pagamenti final review) — both in the one function the plan explicitly required to be a tested pure function, which nonetheless shipped two helper functions with zero tests until the final review caught it.
- Weak RLS test assertions that would have passed even with a broken policy (a placeholder client_id causing an FK failure instead of proving RLS was the actual blocker; an unchecked setup insert that could silently produce zero rows and make an isolation check trivially pass) — caught in task-level review, not by the tests' own green checkmarks.

**Takeaway for whoever picks this up next:** independently re-verify `tsc`/test claims yourself rather than trusting implementer self-reports at face value — this has caught real problems on both blocks so far, not hypothetically.

## Also maintain: `docs/LEARNING.md`

A separate document for the user's own interview/portfolio prep (technical decisions + rationale, organized for explaining to a recruiter — not a resume-prompt for Claude). **Update it at the end of every block**, same cadence as this file. Don't let it drift out of sync.
