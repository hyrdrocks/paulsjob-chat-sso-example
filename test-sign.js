// Smallest thing that fails if the signing logic breaks.
//   node test-sign.js
// Asserts the token shape locally, checks the signature against the public key
// derived from your own private key, then verifies it against the live API.
const assert = require('node:assert')
const { createPublicKey, createVerify } = require('node:crypto')
const { signSsoToken, SSO_AUDIENCE } = require('./server')

const decode = s => JSON.parse(Buffer.from(s, 'base64url').toString())

async function main() {
  const token = signSsoToken({ email: 'check@example.com', name: 'Check User' })
  const [rawHeader, rawPayload, signature] = token.split('.')
  const header = decode(rawHeader)
  const claims = decode(rawPayload)

  // ── shape ──
  assert.strictEqual(header.alg, 'RS256', 'must be RS256')
  assert.strictEqual(header.kid, process.env.SSO_KEY_ID, 'kid must match SSO_KEY_ID — the API finds your key by it')
  assert.strictEqual(claims.email, 'check@example.com', 'email is the one claim the API requires')
  assert.strictEqual(claims.aud, SSO_AUDIENCE, 'aud must scope the token to the widget')
  assert.strictEqual(claims.exp - claims.iat, 300, 'TTL should be 5 minutes')

  // ── the signature actually verifies against our own public key ──
  const publicKey = createPublicKey(process.env.SSO_PRIVATE_KEY.replace(/\\n/g, '\n'))
  const ok = createVerify('RSA-SHA256')
    .update(`${rawHeader}.${rawPayload}`)
    .end()
    .verify(publicKey, Buffer.from(signature, 'base64url'))
  assert.ok(ok, 'signature must verify against the public half of SSO_PRIVATE_KEY')

  console.log('✓ token shape and signature OK')

  // ── the live API accepts it ──
  const base = new URL(process.env.WIDGET_SDK_URL).hostname.includes('staging')
    ? 'https://staging-api.paulsjob.ai'
    : 'https://api.paulsjob.ai'

  const res = await fetch(`${base}/dev/v1/company/sso/key-pairs/verify-token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      Token: token,
      EmployeeOrCandidate: process.env.EMPLOYEE_MODE === 'true' ? 'employee' : 'candidate',
    }),
  })
  const body = await res.json().catch(() => ({}))

  assert.ok(
    body?.data?.IsSignatureValid,
    `${base} rejected the token: ${body.message || res.status}\n` +
    '  Invalid key pair -> SSO_KEY_ID is not an active key in THIS environment\n' +
    '  signature error  -> SSO_PRIVATE_KEY does not match that kid',
  )
  console.log(`✓ ${base} accepted the token`)
}

main().then(() => process.exit(0)).catch(err => {
  console.error(`✗ ${err.message}`)
  process.exit(1)
})
