# Autopilot — the perpetual self-improving build loop

This app is built and continuously improved by an autonomous loop. This guide is the committed,
secrets-free explanation. The **live brain** is `AUTOPILOT.md` at the repo root — it is **gitignored**
(it holds local creds + the run log), so it lives only on the machine that runs the loop.

## The pieces
- **`AUTOPILOT.md`** (repo root, gitignored) — the durable brain: mission, guardrails, verification recipe,
  backlog, the self-generating engine, the anti-bloat rubric, a **Steering** section, and the Progress log.
  Re-read in full at the start of every cycle. Source of truth for what's done = this log + `git log`.
- **`.claude/commands/autopilot.md`** — the `/autopilot` slash command: runs exactly one build cycle.
- **`/loop /autopilot`** — the engine. `/loop` (dynamic mode) runs `/autopilot`, then schedules the next
  wake, repeating forever. State lives on disk, so it survives context resets.

## How one cycle works
1. **STOP check** — if `AUTOPILOT.stop` exists (repo root) or a `STOP…` line is in Steering → write the
   FINAL REPORT and end (no new wake). Else re-read `AUTOPILOT.md` + `git log`.
2. **Pick work** — open **Steering** requests first; else the top unchecked **Backlog** item; else
   **generate** the next improvement.
3. **Build directly** — write the files itself (no Workflow tool, no subagents — those prompt; see below).
4. **Verify** — `tsc` + `build` + `eslint` + a live RLS smoke for new data paths.
5. **Commit + push** to `main` on all-green (no co-author). One feature = one revertible commit.
6. **Log + re-arm** the next wake. Perpetual unless STOP / hard-block.

## It never stops on its own — only you stop it
- **Stop:** `touch AUTOPILOT.stop` at the repo root (or add a line starting with `STOP` in the Steering
  section of `AUTOPILOT.md`, or just Ctrl-C the process). Delete the flag to resume.
- **Steer (without stopping):** add bullet lines to the **Steering / human requests** section in
  `AUTOPILOT.md` — the loop does them before anything else. e.g. `- prioritize a mobile-polish pass` or
  `- build invoice PDF + email`.

## Self-generating engine + the quality bar
When the curated backlog is empty, each cycle **surveys the app → drafts 3–5 candidates (ops / ui-ux /
hardening) → scores them against the anti-bloat rubric → ships the single best**, rotating categories so it
improves on every axis. The rubric = **"better, not bigger"**: every cycle must serve a real operator moment,
fit the existing IA/brand, and leave the app *net-simpler* — or it's dropped. Full rubric + a theme bank are
in `AUTOPILOT.md`.

## How to run it (reliably = the terminal CLI)
The IDE extension (VS Code / Antigravity / Cursor) does **not** fire the background `/loop` wake while idle,
so the loop stalls there unattended. Run it from a **terminal**, where the process stays alive and ticks:
```bash
cd /Users/nicolasperez/MDNT/accounts/active/EliteEventsLA/App
caffeinate -dimsu &                  # keep the Mac awake (macOS)
claude --dangerously-skip-permissions
#   then inside the session:
/loop /autopilot
```
- `--dangerously-skip-permissions` → no approval prompts, so it's truly hands-off. (The CLI honors this; the
  extension doesn't, which is also why **Workflows are disabled** — `disableWorkflows: true` in
  `.claude/settings.local.json` — and the loop builds directly instead.)
- The wake only fires while the `claude` process is alive: keep the terminal open + the Mac awake/plugged in.
  Closing the terminal or letting it sleep pauses the loop (resumes when you start it again).
- **Run only one loop at a time** (don't loop in both the extension and the CLI — they'd collide).

## MCP / environment note
The live smoke tests use plain REST (publishable key + admin login over `fetch`), **not** the Supabase MCP,
so build + verify work in a fresh CLI with zero MCP setup. The Supabase MCP is only needed for schema
**migrations / `get_advisors` / type regen**; if it's not connected in your CLI, add it once
(`claude mcp add …`) or the loop will just pick non-migration work.

## If `AUTOPILOT.md` is missing (e.g. fresh clone)
It's gitignored, so a fresh clone won't have it. Recreate it from this guide + `docs/STATUS.md` (the mission,
operating loop, guardrails, backlog, engine, rubric), and put the run-time creds (admin login, Supabase URL +
publishable key, and any `STRIPE_*` / `RESEND_API_KEY`) in `.env.local` / the brain — never commit them.
