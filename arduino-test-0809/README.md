# EasyBlot — web app

Next.js (App Router) + TypeScript + Framer Motion. Companion app for the
EasyBlot benchtop Western blot wash system.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

Deploys to Vercel with no configuration — point Vercel at this directory,
no environment variables needed. A `.vercel.app` subdomain is enough; you do
not need to own a domain.

## Starting state

There is **no demo data**. No seeded users, threads, protocols, or device.
The first account you create is the only account, the leaderboard shows one
row, and the forum and protocol library are genuinely empty until you fill
them. Every empty state is designed rather than accidental.

`Settings → Reset local data` wipes everything and returns you to signup.

## Accounts

Two tiers, decided by the email domain at signup:

| Address | Tier | Effect |
| --- | --- | --- |
| `.edu`, `.ac.uk`, `.edu.au`, … | **Verified lab** | Institution recorded, private by default |
| `gmail.com`, `outlook.com`, any other domain | **Independent** | Full access, no institution attached |
| `mailinator.com` and other disposables | rejected | They defeat verification |

Both tiers get identical functionality — device control, forum, leaderboard.
The tier is a label, not a paywall. The account type is shown live under the
email field while typing, so nobody is surprised after submitting.

Institution is never rendered on the leaderboard or forum for either tier.

## How login works today

`lib/auth/adapter.ts` holds the whole auth implementation behind an
`AuthAdapter` interface. The shipped `LocalAuthAdapter` stores accounts in the
browser and does real work:

- **PBKDF2-SHA256**, 210k iterations, 16-byte random salt per user
  (`lib/auth/crypto.ts`). Plaintext passwords are never written anywhere.
- Constant-time hash comparison.
- Sessions with a 14-day expiry, restored across reloads.
- Duplicate email and display-name rejection.
- Login failures return one message for both "no such account" and "wrong
  password", so the form cannot be used to enumerate registered addresses.
- Email verification with expiring 6-digit codes.

Verified by 55 assertions covering hashing, tier classification, signup
rejection paths, the verification round-trip, login, password change, session
persistence, and account deletion.

### What it cannot do

**This is not production auth.** Being honest about the limits:

1. **No mail is sent.** There is no server, so the verification code is
   displayed on the verify screen instead of emailed. It proves the flow, not
   the address.
2. **The user controls the store.** Accounts live in `localStorage`; anyone
   can edit their own record in devtools and set `verified: true`. Client-side
   checks are a filter, not an authority.
3. **No cross-device accounts.** Sign up in Chrome and you have no account in
   Firefox or on your phone. Nothing is shared between visitors, so the
   leaderboard and forum are per-browser.
4. **No rate limiting.** Nothing throttles password guesses.

Points 1 and 2 are the reason real deployments need a server. Hashing in the
browser protects the stored record; it cannot make the browser trustworthy.

### Moving to a real backend

Write a class implementing `AuthAdapter` that calls your API, then change one
line in `lib/auth/context.tsx`:

```ts
const adapter: AuthAdapter = new SupabaseAuthAdapter();
```

No screen changes. With Supabase specifically:

- Email OTP / magic link **is** the verification — if they can open the link,
  they own the address. The `.edu` rule moves into a database trigger or an
  Edge Function so it cannot be bypassed.
- Put the institution privacy rule in Row Level Security with a public view
  that omits the column, so the client physically cannot fetch other users'
  institutions. Right now it is a UI convention; there it becomes a guarantee.
- `lib/db.ts` is the matching seam for forum, protocol, and run data.

## Device control

`lib/store.tsx` keeps the MQTT contract from the prototype:

```
PUBLISH   easyblot/cmd/pump      {pump, action, duration}
PUBLISH   easyblot/cmd/sequence  {steps:[{pump,duration}]}
PUBLISH   easyblot/cmd/stop      {}
SUBSCRIBE easyblot/status, easyblot/status/log
```

The 1 Hz interval in `StoreProvider` stands in for inbound `status` messages.
Swapping in a real client means replacing the bodies of `startSequence`,
`togglePump`, and `stopAll`.

Two constraints to plan for before wiring the hardware:

- Browsers cannot speak raw MQTT over TCP — you need **MQTT over WebSockets**
  (Mosquitto: `listener 9001` / `protocol websockets`).
- A page served over **HTTPS cannot open a `ws://` connection**. A
  Vercel-hosted app therefore cannot reach a plain local broker. Either put a
  certificate on the broker, serve the control UI from the device itself over
  HTTP on the LAN, or ship a native app for the control path.

Protocol names never reach the device — they are app-side bookkeeping.

## Layout

Mobile-first. Bottom tab bar below 900px, left sidebar above it, from one
component. Breakpoints at 680 / 900 / 1320px.

## Motion

Framer Motion throughout, with a shared vocabulary in `components/motion.ts`
so a card, a sheet, and a page settle with the same physics. Page transitions
with staggered children, `layoutId` for the nav marker and segmented control,
`AnimatePresence` for list add/remove, spring-driven sheets and modals.
`prefers-reduced-motion` is respected in `globals.css`.

## Layout of the code

```
app/(auth)/     signup, login, verify — centred card, no nav
app/(app)/      home, leaderboard, forum, settings — guarded, with nav
components/     ui primitives, nav, motion vocabulary, device sheets
lib/auth/       adapter (swap seam), crypto, email tiers, React context
lib/store.tsx   device + run + protocol + forum state, 1 Hz tick
lib/db.ts       persistence seam — async today so a server drops in cleanly
```
