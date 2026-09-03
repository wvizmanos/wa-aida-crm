# Follow-up Reminders — Setup (V19)

What you get: every follow-up you schedule in the app is synced to a new
**Reminders** tab in your spreadsheet. Once a day (you pick the hour) the
backend emails you a digest of everything due in the next 24 hours — plus
anything overdue that was never marked done. Works even when no phone is
open. Follow-up tab also shows a red badge with the count of what's due.

## One-time setup (5 minutes)

1. **Paste the new backend** — open your spreadsheet → Extensions → Apps
   Script → select all in Code.gs and replace with the new `backend/Code.gs`
   (the version that has the "Follow-up reminders (V19)" section).
2. **Authorize email sending** — in the Apps Script editor, pick the
   function `sendFollowupReminders` in the toolbar dropdown and click **Run**.
   - First run asks for permission to send email on your behalf → approve.
   - Expected result: `{ "ok": true, "sent": 0 }` (nothing due yet — correct).
3. **Add the daily trigger** — click the **Triggers** icon (clock) in the
   left sidebar → **Add Trigger**:
   - Function: `sendFollowupReminders`
   - Event source: **Time-driven**
   - Type: **Day timer** → pick **8 AM to 9 AM**
   - Save. (Check Project Settings → time zone = Asia/Manila so 8–9 AM is
     Philippine morning.)
4. **Update the app** — drag the new `index.html` into your GitHub repo
   (same as every update). The Follow-up tab gets a red due-count badge.

## How it behaves

- Every schedule you create is saved to the **Reminders** tab (id, lead,
  phone, template, due time) and removed when you delete it in the app.
- The digest email lists: `Name (phone) — template — due date/time`.
- Each item is reminded **once** (marked in the tab). Overdue items keep
  appearing in digests until you remove them in the app.
- Old schedules made before V19 are migrated to the sheet automatically the
  first time you open the Follow-up tab on the updated app.
- Bonus: your schedules now survive clearing the browser — they live in the
  sheet, not just on one phone.

## Optional: set your digest email

By default the digest goes to the script owner's Google account email. To
send it elsewhere: Apps Script → Project Settings (⚙) → Script properties →
add `WA_AIDA_OWNER_EMAIL` = the email you want.
