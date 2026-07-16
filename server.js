// Minimal SSO token endpoint for the Paul's Job chat widget.
//
// This is the only server-side piece the integration needs. It signs a short-lived
// RS256 JWT with your company's SSO private key. The widget sends that token to the
// Paul's Job API, which verifies the signature against the public key it holds for
// your `kid`, and logs the user in.
//
// The private key NEVER leaves this process. Everything below the /config line is
// safe for the browser; SSO_PRIVATE_KEY is not.

// Loads .env when running under Node. Wrapped because the hosted demo runs on
// Cloudflare Workers, which has no .env file — there the values come from secrets.
try { require('dotenv').config() } catch { /* no .env — env vars are already set */ }

const express = require('express')
const jwt = require('jsonwebtoken')

const app = express()
// No body parser: nothing here reads a request body. /sso-token deliberately takes
// no input — the user comes from the session — and the demo login passes its id in
// the path. (It also keeps this runnable on Cloudflare Workers, where body-parser's
// iconv-lite dependency does not bundle.)
app.use(express.static('public'))

const {
  SSO_PRIVATE_KEY,
  SSO_KEY_ID,
  COMPANY_SLUG,
  WIDGET_SDK_URL,
  EMPLOYEE_MODE = 'true',
  PORT = 3000,
} = process.env

// Fail loudly at boot rather than at the first user's login.
for (const [name, value] of Object.entries({ SSO_PRIVATE_KEY, SSO_KEY_ID, COMPANY_SLUG, WIDGET_SDK_URL })) {
  if (!value)
    throw new Error(`Missing ${name}. Copy .env.example to .env and fill it in.`)
}

// The widget's iframes live on the same host as the SDK, so default `domain` to its
// origin. Deriving it means the two can't drift out of sync.
const WIDGET_DOMAIN = process.env.WIDGET_DOMAIN || new URL(WIDGET_SDK_URL).origin

// Env vars can't hold real newlines, so a PEM is usually pasted with \n escapes.
const privateKey = SSO_PRIVATE_KEY.replace(/\\n/g, '\n')

// 5 minutes, matching what the Paul's Job API itself issues for widget tokens.
// See README "Why five minutes" — this token is a credential; it should not outlive
// the login it authorises.
const TOKEN_TTL_SECONDS = 5 * 60

/**
 * Sign an SSO token for one user.
 *
 * `email` is the only claim the API requires — it identifies the user inside the
 * widget. `name` is optional and only affects display. Anything else you add is
 * ignored by the verifier, so don't rely on it for access control.
 */
function signSsoToken({ email, name }) {
  const now = Math.floor(Date.now() / 1000)
  return jwt.sign(
    { email, name, iat: now, exp: now + TOKEN_TTL_SECONDS },
    privateKey,
    { algorithm: 'RS256', keyid: SSO_KEY_ID },
  )
}

/**
 * Public config for the browser. Deliberately explicit: it is easy to leak a secret
 * by spreading process.env into a template, so the browser gets exactly these three.
 */
app.get('/config', (_req, res) => {
  res.json({
    company: COMPANY_SLUG,
    sdkUrl: WIDGET_SDK_URL,
    domain: WIDGET_DOMAIN,
    employeeMode: EMPLOYEE_MODE === 'true',
    // Derived, not configured: the hosted demo runs on staging and says so.
    env: WIDGET_DOMAIN.includes('.staging.') ? 'staging' : null,
  })
})

function readCookie(req, name) {
  const hit = (req.headers.cookie || '')
    .split(';')
    .map(s => s.trim())
    .find(s => s.startsWith(`${name}=`))
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null
}

// ── Demo-only auth. Stands in for whatever real login your site already has. ──
//
// The identities are FIXED here on the server, and a visitor may only pick one by
// id. That is deliberate: this demo is publicly reachable and holds a real signing
// key, so if it signed whatever email was posted, any passer-by could mint a token
// for a real person. Your app has a real session and doesn't need this.
const DEMO_USERS = {
  amara: { email: 'amara.okafor@example.com', name: 'Amara Okafor', title: 'Product Designer' },
  jonas: { email: 'jonas.weber@example.com', name: 'Jonas Weber', title: 'Site Reliability Engineer' },
  mei: { email: 'mei.tanaka@example.com', name: 'Mei Tanaka', title: 'Talent Partner' },
}

/**
 * THE INTEGRATION POINT.
 *
 * In your real app, delete the body of this function and read your session instead
 * (e.g. `req.session.user`). The rule that matters: derive the user from YOUR OWN
 * server-side session. Never take the email from the request body — anyone could
 * then mint a token for anyone.
 */
function getCurrentUser(req) {
  return DEMO_USERS[readCookie(req, 'demo_user')] || null
}

app.get('/demo-users', (_req, res) => {
  res.json(Object.entries(DEMO_USERS).map(([id, u]) => ({ id, name: u.name, title: u.title })))
})

app.post('/login/:id', (req, res) => {
  // Only an id from the fixed set above — never an email off the wire.
  const user = DEMO_USERS[req.params.id]
  if (!user) return res.status(400).json({ error: 'unknown demo user' })
  res.set('Set-Cookie', `demo_user=${encodeURIComponent(req.params.id)}; Path=/; SameSite=Lax; HttpOnly`)
  res.json(user)
})

app.post('/logout', (_req, res) => {
  res.set('Set-Cookie', 'demo_user=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly')
  res.json({ ok: true })
})

app.get('/me', (req, res) => {
  const user = getCurrentUser(req)
  return user ? res.json(user) : res.status(401).json({ error: 'not logged in' })
})

app.post('/sso-token', (req, res) => {
  const user = getCurrentUser(req)
  if (!user) return res.status(401).json({ error: 'not logged in' })

  try {
    res.set('Cache-Control', 'no-store') // a token is a credential; never cache it
    res.json({ token: signSsoToken(user) })
  } catch (err) {
    console.error('Failed to sign SSO token:', err.message)
    res.status(500).json({ error: 'could not sign token' })
  }
})

// Only listen when run directly, so test-sign.js can import signSsoToken.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Paul's Job chat SSO example: http://localhost:${PORT}`)
    console.log(`  company:  ${COMPANY_SLUG}`)
    console.log(`  kid:      ${SSO_KEY_ID}`)
    console.log(`  sdk:      ${WIDGET_SDK_URL}`)
    console.log(`  domain:   ${WIDGET_DOMAIN}`)
  })
}

module.exports = { app, signSsoToken }
