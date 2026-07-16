# Paul's Job chat widget — SSO example

A complete, runnable example of **SSO auto-login** from an external website into the
Paul's Job chat widget. A user logs into this site, and the widget logs them in too —
no second sign-in.

**▶︎ [Try the live demo](https://paulsjob-chat-sso-example.dennis-pfaff.workers.dev)** — pick an
employee and watch the widget log them in.
&nbsp;·&nbsp;
**📖 [Read the integration guide](docs/integration.html)** — open it in a browser
(`open docs/integration.html`). Print to PDF from there if you need to send it on.

> The hosted demo runs against **staging** and is labelled as such in the UI. The guide
> documents production URLs, which is what you should use.

## What's here

| File | What it is |
|---|---|
| `server.js` | The whole backend. Signs an RS256 JWT with your SSO private key. **This is the file you lift.** |
| `public/index.html` | A demo site with a fake login, the widget embed, and logout. |
| `.env.example` | The four values you need, with notes on each. |
| `docs/integration.html` | The guide. |
| `worker.mjs`, `wrangler.jsonc`, `iconv-lite-stub.mjs` | Hosting glue for the live demo only. Ignore them when integrating. |

## Run it

You need Node 18+ and a Paul's Job company with dashboard access.

**1. Generate a key pair.** In your dashboard: **Settings → Developer & Security →
SSO Key Management → Generate Key**. Copy the private key — it is shown once — and note
its key ID (`kid`).

**2. Configure.**

```bash
cp .env.example .env
```

Fill in `SSO_PRIVATE_KEY`, `SSO_KEY_ID`, `COMPANY_SLUG`, and `WIDGET_SDK_URL`
(`https://<company-slug>.chatbot.app.paulsjob.ai/sdk.iife.js`). `.env` is gitignored —
keep it that way.

**3. Go.**

```bash
npm install
npm start
```

Open <http://localhost:3000>, pick a demo employee, and the chat launcher appears
already authenticated. Sign out and it tears down.

```bash
npm run check   # signs a token and verifies it against the live API
```

The demo identities are **fixed in `server.js`** rather than typed in. That's deliberate:
this example is publicly reachable and holds a real signing key, so a free-text email box
would let any visitor mint a token for a real person. Your app has a real session and
doesn't need the picker — see `getCurrentUser()`.

## How it works, in one paragraph

Your backend signs a short-lived JWT saying "this is alice@acme.com", using your company's
SSO private key. Your page passes it to `window.HyrdWidget.verifyToken(token)`. The Paul's Job
API finds your company's public key using the token's `kid`, checks the signature, and starts a
widget session. **The private key never reaches the browser** — that is the entire security
model. Full detail, including exactly which claims are checked, is in
[the guide](docs/integration.html).

## Two things that catch people out

- **Pass `domain` in the widget config.** Without it the widget looks for its iframes on *your*
  domain and 404s. See the guide's troubleshooting section.
- **Staging and production are separate.** A key pair generated in staging only works with the
  staging widget domain, and vice versa. Mixing them gives `Invalid key pair`.

## Security

Never commit `SSO_PRIVATE_KEY`, `SSO_KEY_ID`, or your company slug. Use `.env` (gitignored) or
your secret manager. Sign tokens **only** for the user in your own server-side session — an
endpoint that signs any posted email lets any visitor log in as anyone.

Two things the verify endpoint does **not** currently enforce, both verified against the live
API: expired tokens are still accepted, and **revoked key pairs still verify**. So if your
private key leaks there is no in-product way to stop it — guard it accordingly. Details in
[the guide](docs/integration.html#security).
