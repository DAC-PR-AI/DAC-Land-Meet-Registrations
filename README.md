# DAC Developers – Event RSVP & Entry Pass

Mobile-first RSVP app for the **DAC Land Acquisition Meet** (29 Oct 2026, 6 PM, Ramada Plaza Guindy).
Next.js on Vercel → Google Apps Script → Google Sheet.

| Page | Who | What |
|---|---|---|
| `/` | Guests (WhatsApp link) | Hero + registration form. Auto-closes 29 Oct 2026, 5:00 PM IST |
| `/pass/DAC-LE-0001?k=…` | Guests | Digital Entry Pass with QR, Download, WhatsApp, Calendar, Directions |
| `/checkin` | Venue staff | PIN-protected. Scan QR or search by mobile / Pass ID, live counts |

All event details live in **`lib/event.ts`** (and a copy at the top of `apps-script/Code.gs` for the email).

---

## Step 1 — Google Sheet + Apps Script (≈10 min)

> **Use the `land@dacdevelopers.com` Google account if at all possible.** Emails are sent from whichever account deploys the script.
> Google Workspace ≈ **1,500 emails/day**; personal Gmail ≈ **100/day**.

1. Create a new Google Sheet, name it e.g. **"DAC Land Meet – Registrations"**.
2. **Extensions → Apps Script**. Delete the sample code and paste the whole of `apps-script/Code.gs`.
3. (Recommended) Project Settings ⚙ → tick **"Show appsscript.json"** → replace its content with `apps-script/appsscript.json` (sets India time zone).
4. Project Settings ⚙ → **Script Properties → Add**:
   | Property | Value |
   |---|---|
   | `APPS_SCRIPT_SECRET` | a long random string, e.g. `dac-LE-7f3k9q2m8x4p` |
   | `SITE_URL` | your Vercel URL, e.g. `https://dac-invite.vercel.app` (no trailing `/`) |
5. In the editor, choose function **`setup`** → **Run** → approve permissions
   (Advanced → Go to project → Allow). This creates the **Registrations** tab and grants Sheets + Gmail access.
6. **Deploy → New deployment** → type **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   → **Deploy** → copy the **Web app URL** (ends in `/exec`).
7. Paste that URL in a browser → you should see `{"ok":true,"service":"DAC RSVP",...}`.

> **If you edit Code.gs later:** Deploy → *Manage deployments* → ✏ Edit → Version: **New version** → Deploy. (The URL stays the same. Saving alone does NOT update the live app.)

## Step 2 — Vercel (≈5 min)

1. Push this folder to a GitHub repo (or run `npx vercel` from the folder).
2. Vercel → **Add New Project** → import the repo (Framework: Next.js, defaults are fine).
3. **Environment Variables** (see `.env.example`):
   | Name | Value |
   |---|---|
   | `APPS_SCRIPT_URL` | the `/exec` URL from Step 1.6 |
   | `APPS_SCRIPT_SECRET` | exactly the same as the Script Property |
   | `CHECKIN_PIN` | staff PIN, e.g. `2910` |
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-project>.vercel.app` |
4. Deploy. If your final domain differs from what you put in `SITE_URL` / `NEXT_PUBLIC_SITE_URL`, update both and redeploy (Vercel: *Redeploy*; Apps Script: no redeploy needed for property changes).

### Brand assets (optional, drop into `/public`)
- `dac-logo.png` – DAC logo (transparent PNG, ~300px tall). If missing, a styled "DAC" wordmark is shown.
- `og.jpg` – WhatsApp link preview, **1200×630, under 300 KB**. A branded default is already included; replace it if you have the invitation artwork.

## Step 3 — Test (1-minute checklist)

On your phone, using the live Vercel link:

- [ ] Open the link → hero + form load, fonts look right, no zoom when tapping fields
- [ ] Tap **Get My Entry Pass** empty → friendly red errors appear
- [ ] Register test entry #1 → tick animation → Entry Pass with QR (**DAC-LE-0001**)
- [ ] **Download Pass** saves a PNG · **Save to my WhatsApp** opens your own chat with the message
- [ ] Email arrives (check Spam/Promotions once) with QR + View Pass button
- [ ] Register again with the **same mobile** → "You're already registered!" → same pass
- [ ] Register test entry #2 with a different number → **DAC-LE-0002**
- [ ] Sheet shows both rows, **Email Status = Sent**, **Send Pass** link opens WhatsApp Web
- [ ] Open `/checkin` → enter PIN → **Scan QR** of entry #1 from another phone → **VALID** → Mark → scan again → **ALREADY CHECKED-IN**
- [ ] Search "2" → finds DAC-LE-0002 · search 9999999999 → **NO PASS FOUND**
- [ ] **Before sharing the link:** delete the 2 test rows from the sheet. (Pass numbers continue from 0003; to restart at 0001, also delete Script Property `PASS_SEQ`.)

---

## Operations notes

- **Sending passes from the official WhatsApp:** In the sheet, click **Send Pass** in each row → WhatsApp Web opens with the message pre-filled → press Send. (Open WhatsApp Web logged in on the official number first.)
- **Pass security:** Pass links carry a private key (`?k=…`), so nobody can browse other guests' passes by changing the number in the URL. The QR itself only contains the Pass ID; it is validated against the sheet at the door.
- **Staff check-in:** Check-in needs HTTPS (camera) — works on the Vercel URL. If the camera fails, use **Search** with the mobile number or just the pass number (e.g. `12`).
- **Two or more staff devices** can check in simultaneously; a lock prevents double check-ins.
- **Closing time** is enforced on both the page and the API (`registrationClosesISO` in `lib/event.ts`).
- **Email failure never blocks registration** – the reason is written to *Email Status*; use *Send Pass* on WhatsApp for those guests.
- Do **not** rename the *Registrations* tab or reorder its columns. Adding your own columns **to the right** is fine.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Form says "Something went wrong" | Check Vercel env vars; open the `/exec` URL in a browser (should show `ok:true`); Vercel → Logs |
| Logs show `Unauthorized` | `APPS_SCRIPT_SECRET` differs between Vercel and Script Properties |
| Logs show `Unexpected response from backend` | Web App access is not **Anyone**, or URL isn't the `/exec` one |
| Code changes not live | Apps Script: Manage deployments → Edit → **New version** |
| Email Status = quota exceeded | Daily Gmail limit hit — use *Send Pass* links on WhatsApp |
| WhatsApp preview shows no image | Use `og.jpg` < 300 KB; re-share the link (WhatsApp caches previews) |

## Local development
```bash
npm install
cp .env.example .env.local   # fill values
npm run dev                  # http://localhost:3000
```
