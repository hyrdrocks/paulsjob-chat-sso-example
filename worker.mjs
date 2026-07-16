// Cloudflare Worker entry for the hosted demo.
//
// This exists ONLY to host server.js — it adds no logic of its own, so the deployed
// demo is the same file the guide tells you to copy. If you are integrating the
// widget, ignore this file: server.js is the reference.
//
// `httpServerHandler` runs a node:http server (Express is one) on Workers.
// Requires nodejs_compat + a compatibility_date >= 2025-09-01, which auto-enables
// enable_nodejs_http_server_modules. See wrangler.jsonc.
import { httpServerHandler } from 'cloudflare:node'
import server from './server.js'

const PORT = 8080
server.app.listen(PORT)

export default httpServerHandler({ port: PORT })
