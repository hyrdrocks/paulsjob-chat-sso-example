// Deploy glue, not part of the example. Ignore this file if you're integrating.
//
// Express imports body-parser at load time, which imports iconv-lite, whose
// `require("./streams")(...)` breaks under the Workers bundler. This app never reads
// a request body (see server.js — no body parser is registered; /sso-token takes no
// input), so nothing here is ever called. Aliased in wrangler.jsonc.
//
// If you ever add a body parser to server.js, DELETE this alias — otherwise charset
// decoding would silently do nothing on Workers.
const notUsed = () => {
  throw new Error('iconv-lite stub: this app does not parse request bodies (see iconv-lite-stub.mjs)')
}

export const encodingExists = () => false
export const decode = notUsed
export const encode = notUsed
export const getDecoder = notUsed
export const getEncoder = notUsed
export const enableStreamingAPI = () => {}
export const decodeStream = notUsed
export const encodeStream = notUsed

export default { encodingExists, decode, encode, getDecoder, getEncoder, enableStreamingAPI, decodeStream, encodeStream }
