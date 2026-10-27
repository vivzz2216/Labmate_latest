/* Exercise the actual compiled interceptor with Axios adapters, without network. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const axios = require('axios');
const filename = path.resolve(__dirname, '../lib/api.ts');
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
}).outputText;

async function scenario(mode) {
  const storage = new Map([['labmate_access_token', 'old'], ['labmate_refresh_token', 'refresh'], ['labmate_csrf_token', 'old-csrf']]);
  global.window = {};
  global.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) };
  let refreshes = 0, requests = 0;
  const fail = (config, status) => Promise.reject(new axios.AxiosError('test response', undefined, config, {}, {status, data:{detail:'test'}, headers:{}, config}));
  const oldAdapter = axios.defaults.adapter;
  axios.defaults.adapter = async config => {
    if (config.url.includes('/basic-auth/refresh')) {
      refreshes++;
      assert.equal(config.timeout, 15000);
      await new Promise(resolve => setTimeout(resolve, 20));
      if (mode === 'outage') return fail(config, 503);
      if (mode === 'expired') return fail(config, 401);
      if (mode === 'incomplete') return { status:200, data:{}, headers:{}, config };
      return { status:200, data:{access_token:'new', refresh_token:'new-refresh', csrf_token:'new-csrf'}, headers:{}, config };
    }
    requests++;
    if (config.responseType === 'blob') {
      assert.equal(config.timeout, 600000, 'Word downloads must keep their longer deadline');
      return { status:200, data:Buffer.from('test document'), headers:{}, config };
    }
    assert.equal(config.timeout, 15000);
    if (config.headers.get('Authorization') !== 'Bearer new' || mode === 'rejected-retry') return fail(config, 401);
    return { status:200, data:{is_complete:true}, headers:{}, config };
  };
  try {
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(code, filename);
    const api = mod.exports.default;
    const result = await Promise.race([
      Promise.allSettled([api.get('/api/basic-auth/profile'), api.get('/api/basic-auth/profile')]),
      new Promise((_, reject) => { const timer=setTimeout(() => reject(new Error('refresh queue hung')), 2000); timer.unref(); })
    ]);
    assert.equal(refreshes, 1, 'parallel requests must share exactly one refresh');
    if (mode === 'success') {
      assert(result.every(r => r.status === 'fulfilled'));
      assert.equal(storage.get('labmate_access_token'), 'new');
      assert.equal(requests, 4);
      assert.equal((await api.get('/api/reports/1/download', {responseType:'blob'})).status, 200);
    } else {
      assert(result.every(r => r.status === 'rejected'));
      if (mode === 'expired') assert.equal(storage.has('labmate_access_token'), false);
      if (mode === 'outage') {
        assert.equal(storage.get('labmate_refresh_token'), 'refresh');
        assert(result.every(r => r.reason.response.status === 503));
      }
      if (mode === 'incomplete') assert.equal(storage.get('labmate_access_token'), 'old');
      if (mode === 'rejected-retry') assert.equal(requests, 4);
    }
    console.log('PASS:', mode);
  } finally { axios.defaults.adapter = oldAdapter; }
}
(async () => { for (const mode of ['success', 'outage', 'expired', 'incomplete', 'rejected-retry']) await scenario(mode); })()
  .catch(error => { console.error(error); process.exitCode = 1; });
