# MIGRATION BRIEF — Make this React app the new face of WA AIDA CRM on the existing Google Sheets backend

## Mission

This React app (kanban pipeline, follow-up queue, analytics) currently stores data in localStorage and syncs to a private GitHub JSON repo. The production WA AIDA CRM ("V19.x", a single-file PWA) runs on a battle-tested Google Apps Script + Google Sheets backend that holds REAL data (leads, tracked links, proposals, follow-ups, templates).

Goal: rewire THIS app to use that same Sheets backend as its only data brain — one product, one brain, modern face. This is a data-layer swap plus a feature port. It is NOT a redesign.

## Reference material — read first, extract exact contracts, never guess

All reference files are in `reference/` inside this project:

- `reference/Code.gs` — the entire backend (Apps Script Web App). Read the header comment (setup, GET-only rationale, WA_AIDA_TOKEN security) and the action dispatcher.
- `reference/v19-app.html` — the old front-end. Extract: the API call helper and its param names, localStorage keys (`waaida-script-url`, `waaida-force-demo`, token key), FORCE_DEMO logic, field mappings between app and Sheet.
- `reference/proposal.html`, `reference/track.html` — client-facing pages served by the backend's `open` action (for later phases).
- `reference/SETUP-REMINDERS.md` — how follow-up reminder triggers are set up (later phase).

## Hard rules (non-negotiable)

1. **Only work inside this project** (`wa-aida-crm`). Never touch `wvizmanos/wa-aida-crm-copy` — it is a public contest demo, active until Sep 7. Never edit the old PWA files or the Google Sheet structure.
2. **One brain.** After migration the Google Sheet is the ONLY source of truth. localStorage becomes a read cache only. The GitHub JSON sync (`wa-aida-crm-data`) must be disabled behind a feature flag — do not delete that code yet, just stop it from running.
3. **Real-data safety.** Never run destructive actions against the real backend from automated tests. Verify demo mode makes ZERO requests to `script.google.com`. For live verification use exactly one test lead named "ZCode migration test", exercise add → edit → stage → delete, confirm the delete cascades, and confirm the sheet is clean afterwards.
4. **No baked auto-connect.** Settings must start EMPTY: the user pastes their `/exec` URL and optional security token, then clicks Connect. The old app's baked-in DEFAULT_URL + default token auto-connecting from a public URL was a real incident — do not repeat it. In this repo, remove any demo-mode default that connects to anything real.
5. **Keep the winning UI.** Kanban board, follow-up queue, analytics, PWA install, exact brand palette (#16213e, #fdf8f3, #25d366, #1b5e20, #f59e0b, #c75b39). Same screens, new plumbing.

## The backend contract (verify exact param/response names in reference/Code.gs)

- **Transport:** every action is a GET with query params, response is JSON. Browsers cannot POST to Apps Script (the 302 redirect silently converts to GET and loses the body) — so never attempt POST.
- **Auth:** optional `token` param that must match the Apps Script script property `WA_AIDA_TOKEN`. Wrong or missing token → the backend returns an auth error; surface it as a toast ("Security token missing or wrong — add it in Settings") and keep the app usable in demo mode.
- **Actions** (dispatched in `doGet`): `list`, `meta`, `add`, `stage`, `note`, `value`, `delete`, `link`, `links`, `linkdel`, `ping`, `actlog`, `proposal_create`, `proposal_list`, `proposal_del`, `proposal_get`, `proposal_open`, `proposal_ping`, `proposal_accept`, `wa_send`, `fu_save`, `fu_del`, `fu_list`, `tpl_save`, `tpl_del`, `tpl_list`, `tpl_use`, `open`.
- **IDs are integers minted by the backend** (`nextId_`). Always adopt the ID returned by `add` (shape `{ok, id}`); never mint local fallback IDs above 1 — the old app's ghost-ID-100 bug (V19.5) caused orphan links. `delete` cascades to that lead's links, proposals, and reminders.
- **Demo mode:** `FORCE_DEMO = /(?:^|[?&])demo=1(?:&|$)/.test(location.search) || localStorage.getItem('waaida-force-demo') === '1'`. When forced: zero backend requests, sample data only. This must have top priority over any saved URL or token.

## Phase 1 — Data-layer swap (must land this session)

1. Build `src/api.js`: a small client holding the script URL + token (localStorage keys: `waaida-script-url`, `waaida-token` — both start empty), one function per backend action, GET with query params, parsed JSON out, and clean error mapping (auth error vs network error).
2. Swap the store: leads come from `list`; every mutation calls the real action (`add`, `stage`, `note`, `value`, `delete`). Use optimistic UI with refetch-on-settle. Keep localStorage as a last-known snapshot so a cold open still renders (mark it visibly: "Offline · showing cached data").
3. Settings screen: script URL field, security token field, Connect / Disconnect buttons, "Use demo data" toggle (writes/removes `waaida-force-demo`), and a status pill with exactly these states: `Demo data` / `Live · Sheet connected` / `Offline · cached` / `Saving…`.
4. FORCE_DEMO parity: same regex, same priority rules. Verify `?demo=1` renders sample data with zero `script.google.com` requests (show the devtools evidence in your final report).
5. Field mapping: map the React lead model to the Sheet's real columns using `list`/`add` payloads found in the reference files (names, `YYYY-MM-DD` dates, deal value as integer pesos). Where a React field has no Sheet column (e.g. some sources), store it the way the old app did — check `reference/v19-app.html` first.
6. Verification before any deploy:
   - Demo e2e: all screens work on sample data, zero backend calls.
   - Live e2e with the "ZCode migration test" lead: add → adopt backend ID → edit value → change stage → delete → confirm cascade left no orphan rows.
   - Wrong-token path: clear error, app falls back to demo, no crash.
   - Then and only then: `npm run build` and `npm run deploy` to the existing Pages site, and re-verify the live URL in both modes.

## Phase 2 — only if tokens remain today: tracked links (the Privyr-like feature)

Port `link` / `links` / `linkdel` / `ping`: per-lead tracked WhatsApp/Viber links — create from the lead drawer, list with open-counts, delete, and surface "link opened" pings as a badge/notification. Extract exact param names from `reference/v19-app.html` and `reference/Code.gs`. Do not start Phase 2 until Phase 1 is verified and deployed.

## Phase 3 — later sessions, do NOT start today

Proposals (`proposal_*`), follow-up reminders (`fu_*` + trigger setup in SETUP-REMINDERS.md), message templates (`tpl_*`), `wa_send`, the lead-generation webhook (`handleLeadgen_`), and the activity-log timeline view.

## Definition of done (Phase 1)

- Demo mode: all screens work on sample data with zero backend requests.
- Live mode: connects only with pasted URL + token; real leads render; the full add/edit/stage/delete cycle verified against the real sheet with the test lead; IDs always adopted from the backend.
- Auth failure is graceful; offline shows cached data with a visible marker.
- 375px mobile still clean; PWA still installs; `npm run deploy` live and verified in both modes.
- Nothing outside this project touched: no contest repo, no old PWA, no Sheet structure changes.
