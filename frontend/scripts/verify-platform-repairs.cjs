/* Actual client-cache and proxy modules with controlled HTTP adapters. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const axios = require('axios');
function load(relative) {
  const filename = path.resolve(__dirname, relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  }}).outputText;
  const mod = new Module(filename, module); mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename)); mod._compile(compiled, filename);
  return mod.exports;
}
function storage() {
  const store = {};
  Object.defineProperties(store, {
    getItem: {value: key => store[key] ?? null},
    setItem: {value: (key, value) => { store[key] = String(value); }},
    removeItem: {value: key => { delete store[key]; }},
  });
  return store;
}
async function main() {
  global.window = {}; global.localStorage = storage(); global.sessionStorage = storage();
  localStorage.setItem('labmate_user', JSON.stringify({id: 1}));
  const previous = axios.defaults.adapter;
  let release;
  axios.defaults.adapter = config => new Promise(resolve => { release = data => resolve({status:200, data, headers:{}, config}); });
  try {
    const {apiService} = load('../lib/api.ts');
    const pending = apiService.getUserProfile();
    await new Promise(resolve => setImmediate(resolve));
    apiService.clearSessionCaches();
    localStorage.setItem('labmate_user', JSON.stringify({id: 2}));
    release({name: 'Previous account'});
    await assert.rejects(pending, /Session changed/);
    assert.equal(apiService.peekUserProfile(), null);
    const current = apiService.getUserProfile();
    await new Promise(resolve => setImmediate(resolve));
    release({name: 'Current account'});
    assert.equal((await current).name, 'Current account');
    assert.equal(sessionStorage.getItem('labmate_profile_1'), null);
    assert.match(sessionStorage.getItem('labmate_profile_2'), /Current account/);
    apiService.invalidateProfileCache();
    assert.equal(apiService.peekUserProfile(), null, 'invalidating must also clear persisted stale profile');
    console.log('PASS: account switch, in-flight response fence, and persistent cache invalidation');
  } finally { axios.defaults.adapter = previous; }
  const previousFetch = global.fetch;
  process.env.BACKEND_URL = 'http://127.0.0.1:8012';
  try {
    global.fetch = async () => new Response('<h1>Untrusted document</h1>', {headers: {
      'Content-Type':'text/html', 'Content-Security-Policy':"sandbox; default-src 'none'",
      'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer',
    }});
    const {NextRequest} = require('next/server');
    const {proxyBackend} = load('../lib/backend-proxy.ts');
    const response = await proxyBackend(new NextRequest('http://localhost:3018/api/upload/preview/1'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Security-Policy'), "sandbox; default-src 'none'");
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
    console.log('PASS: document security headers survive the frontend proxy');
  } finally { global.fetch = previousFetch; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
