import { Sandbox } from 'railway';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Railway's public API allows a fixed number of requests per hour per account (1,000 on Hobby).
// A short refusal is waited out here; a long one is reported so the student sees when execution resumes.
export const MAX_RATE_WAIT_MS = Number(process.env.LABMATE_RATE_LIMIT_WAIT_MS || 90000);
// One manual's questions share a VM; a job needing a different image gets its own, and only this many are kept.
const MAX_SESSION_VMS = 2;

export class RateLimitError extends Error {
  constructor(resetAt, retryAfterSec) {
    super(`RAILWAY_RATE_LIMITED reset=${resetAt || ''} retry_after=${retryAfterSec ?? ''}`);
    this.resetAt = resetAt;
  }
}

export async function fetchReadRetry(url, options={}, fetcher=fetch) {
  let read=false;
  try {read=/^\s*query\b/.test(JSON.parse(options.body).query || '');} catch {}
  for(let attempt=0; ;attempt++) {
    try {return await fetcher(url,{...options,signal:options.signal ?? AbortSignal.timeout(20000)});}
    catch(error) {
      // Polling reads are safe to repeat; ambiguous create/destroy mutations are not.
      if(!read || attempt>=2 || options.signal?.aborted) throw error;
      await new Promise(resolve=>setTimeout(resolve,200*(attempt+1)));
    }
  }
}

export function rateLimitWait(response, now=Date.now()) {
  const header = name => response.headers?.get?.(name) ?? null;
  const after = header('retry-after');
  let ms = after !== null && after !== '' && Number.isFinite(Number(after)) ? Math.max(0, Number(after) * 1000) : NaN;
  const reset = header('x-ratelimit-reset');
  if (!Number.isFinite(ms) && reset && Number.isFinite(Date.parse(reset))) ms = Math.max(0, Date.parse(reset) - now);
  return {ms, reset: reset || (Number.isFinite(ms) ? new Date(now + ms).toISOString() : '')};
}

export async function railwayFetch(url, options={}, fetcher=fetch, wait=sleep, maxWaitMs=MAX_RATE_WAIT_MS) {
  let waited = 0;
  for (let attempt = 0; ; attempt++) {
    const response = await fetchReadRetry(url, options, fetcher);
    if (response.status !== 429) return response;
    // A 429 is refused before any work is done, so even a create or destroy mutation is safe to send again.
    const {ms, reset} = rateLimitWait(response);
    if (!Number.isFinite(ms) || waited + ms > maxWaitMs || attempt >= 4)
      throw new RateLimitError(reset, Number.isFinite(ms) ? Math.ceil(ms / 1000) : undefined);
    const pause = Math.max(ms, 500) + Math.floor(Math.random() * 500);
    waited += pause;
    await wait(pause);
  }
}

export const needsNotebookExtras = job => /^\s*(?:import|from)\s+(?:nltk|networkx|bs4|skfuzzy|pgmpy|sympy|statsmodels)\b/m.test(String(job?.code || ''));

export function template(sdk, requirements, spark=false, dlProfiles=[], prepareDl='', notebookExtras=null) {
  const deps = {private:true,dependencies:{express:'4.21.2',joi:'17.13.3',cors:'2.8.5','cookie-parser':'1.4.7','express-session':'1.18.1',react:'18.2.0','react-dom':'18.2.0','react-router-dom':'6.30.1',vite:'5.4.21'}};
  const encodedDeps = Buffer.from(JSON.stringify(deps)).toString('base64');
  let runtime = sdk.template()
    .run('apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends gcc g++ default-jdk bubblewrap xvfb xauth libmagic1 fonts-dejavu-core r-base-core r-recommended r-cran-ggplot2 r-cran-dplyr r-cran-tidyr r-cran-reshape2 r-cran-e1071 r-cran-randomforest')
    .run('Rscript --vanilla -e \'stopifnot(all(vapply(c("ggplot2","dplyr","tidyr","tibble","scales","reshape2","MASS","lattice","boot","class","cluster","nnet","rpart","survival","e1071","randomForest"), requireNamespace, logical(1), quietly=TRUE)))\'')
    .run(`mkdir -p /opt/labmate-runtime && echo '${requirements.toString('base64')}' | base64 -d > /opt/labmate-runtime/requirements.txt && UV_PYTHON_INSTALL_DIR=/opt/labmate-runtime/python uv python install 3.11 && UV_PYTHON_INSTALL_DIR=/opt/labmate-runtime/python uv venv --python 3.11 --seed /opt/labmate-runtime/venv && uv pip install --index-strategy unsafe-best-match --python /opt/labmate-runtime/venv -r /opt/labmate-runtime/requirements.txt`)
    .run('PLAYWRIGHT_BROWSERS_PATH=/opt/labmate-runtime/browsers /opt/labmate-runtime/venv/bin/python -m playwright install --with-deps chromium')
    .run(`for kind in node react; do mkdir -p /opt/labmate-runtime/node_cache/$kind; echo '${encodedDeps}' | base64 -d > /opt/labmate-runtime/node_cache/$kind/package.json; (cd /opt/labmate-runtime/node_cache/$kind && npm install --ignore-scripts --no-audit --no-fund) || exit 1; done`);
  if (spark) runtime = runtime.run('apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends openjdk-17-jre-headless && uv pip install --index-strategy unsafe-best-match --python /opt/labmate-runtime/venv pyspark==3.5.7');
  if (notebookExtras) runtime = runtime.run(`echo '${notebookExtras.toString('base64')}' | base64 -d > /opt/labmate-runtime/requirements-colab-extra.txt && uv pip install --index-strategy unsafe-best-match --python /opt/labmate-runtime/venv -r /opt/labmate-runtime/requirements-colab-extra.txt && mkdir -p /opt/labmate-runtime/nltk_data && /opt/labmate-runtime/venv/bin/python -m nltk.downloader -d /opt/labmate-runtime/nltk_data vader_lexicon stopwords punkt_tab && test -f /opt/labmate-runtime/nltk_data/sentiment/vader_lexicon.zip`);
  const profiles = [...new Set(dlProfiles)].sort();
  if (profiles.some(value => !['mnist','mobilenet','resnet'].includes(value))) throw new Error('Invalid cache profile.');
  if (profiles.length) {
    if (!prepareDl) throw new Error('Missing trusted cache preparation script.');
    runtime = runtime.run(`echo '${Buffer.from(prepareDl).toString('base64')}' | base64 -d > /opt/labmate-runtime/prepare_dl.py && /opt/labmate-runtime/venv/bin/python /opt/labmate-runtime/prepare_dl.py ${profiles.join(' ')}`);
  }
  return runtime;
}

/** Which image a job needs. Jobs with the same key can share one VM. */
export function imageNeeds(job) {
  const spark = /\bpyspark\b/i.test(String(job?.code || '') + '\n' + String(job?.objective || ''));
  // The actual implementation selects the cache; an assignment listing two
  // alternative frameworks must not download both unnecessarily.
  const source = String(job?.code || job?.objective || '');
  const dlProfiles = [];
  if (/\bmnist\b/i.test(source) && !/\bfashion_mnist\b/i.test(source)) dlProfiles.push('mnist');
  if (/\bmobilenet(?:v2)?\b/i.test(source)) dlProfiles.push('mobilenet');
  if (/\bresnet(?:50)?\b/i.test(source)) dlProfiles.push('resnet');
  const notebook = needsNotebookExtras(job);
  return {spark, dlProfiles, notebook, key: JSON.stringify([spark, dlProfiles, notebook])};
}

function checkCredentials() {
  if (!process.env.RAILWAY_API_TOKEN || !process.env.RAILWAY_ENVIRONMENT_ID)
    throw new Error('Railway sandbox credentials are not configured.');
}

async function createVm(job, sdk, requirements, extraRequirements) {
  requirements ??= await readFile(new URL('../requirements.txt', import.meta.url));
  const needs = imageNeeds(job);
  const prepareDl = needs.dlProfiles.length ? await readFile(new URL('./prepare_dl.py', import.meta.url), 'utf8') : '';
  const notebookExtras = needs.notebook
    ? (extraRequirements ?? await readFile(new URL('../requirements-colab-extra.txt', import.meta.url))) : null;
  // No variables, private networking, public domains or API credentials enter the VM.
  return sdk.create(template(sdk, requirements, needs.spark, needs.dlProfiles, prepareDl, notebookExtras), {fetch:railwayFetch,networkIsolation:'ISOLATED', idleTimeoutMinutes:5,
    resources:{cpu:1,memoryGB:2},env:{}});
}

async function installRuntime(vm, bundle) {
  await vm.files.write('/tmp/runtime.tar.gz',Buffer.from(bundle,'base64'));
  const setup = await vm.exec(`tar -xzf /tmp/runtime.tar.gz -C /opt/labmate-runtime && install -D "$(node -p 'process.execPath')" /opt/labmate-runtime/tools/node`, {timeoutSec:30,maxOutputBytes:4096});
  if (setup.exitCode !== 0 || setup.timedOut) throw new Error('Runtime installation failed.');
}

async function runJob(vm, job) {
  // Each job runs in its own Bubblewrap namespaces with fresh /work and /tmp, so jobs sharing a VM never see each other's files.
  const handle = vm.exec('/opt/labmate-runtime/venv/bin/python /opt/labmate-runtime/railway_job.py',
    {stdin:true,ephemeral:true,timeoutSec:230,maxOutputBytes:32*1024*1024});
  await handle.stdin.write(JSON.stringify(job));
  await handle.stdin.end();
  const result = await handle;
  if (result.exitCode !== 0 || result.timedOut || result.truncated) {
    const reason = `exit=${result.exitCode}, timedOut=${Boolean(result.timedOut)}, truncated=${Boolean(result.truncated)}`;
    throw new Error(`Incomplete sandbox receipt (${reason}): `+String(result.stderr || '').slice(-2000));
  }
  return JSON.parse(result.stdout);
}

export async function run(request, sdk=Sandbox, requirements=undefined, extraRequirements=undefined) {
  checkCredentials();
  const vm = await createVm(request.job, sdk, requirements, extraRequirements);
  const terminate = () => { vm.destroy().finally(() => process.exit(143)); };
  process.once('SIGTERM', terminate);
  try {
    await installRuntime(vm, request.bundle);
    return await runJob(vm, request.job);
  } finally {
    try { await vm.destroy(); } finally { process.removeListener('SIGTERM',terminate); }
  }
}

/**
 * Runs one manual's jobs in as few VMs as possible. Creating a VM is what spends Railway API requests
 * (one create, status polls until it boots, one destroy), so a manual of eight programs costs about
 * one VM instead of eight. A VM that fails a job is destroyed and the next job gets a fresh one.
 */
export class Session {
  constructor(bundle, sdk=Sandbox, requirements=undefined, extraRequirements=undefined) {
    this.bundle = bundle; this.sdk = sdk; this.requirements = requirements; this.extraRequirements = extraRequirements;
    this.vms = new Map();
    this.created = 0;
  }

  async run(job) {
    checkCredentials();
    const {key} = imageNeeds(job);
    let vm = this.vms.get(key);
    const reused = Boolean(vm);
    if (vm) {
      this.vms.delete(key); this.vms.set(key, vm);  // most recently used last
    } else {
      vm = await this.#fresh(job, key);
    }
    try { return await runJob(vm, job); }
    catch (error) {
      await this.drop(key).catch(() => {});
      // A kept VM may have been reaped after idling (e.g. during a long AI repair between programs). That is a
      // transport failure, not the program's: run it once more on a fresh VM. Rerunning a program in a fresh
      // sandbox is harmless. A receipt failure or the API limit is reported as is.
      if (!reused || error instanceof RateLimitError || /Incomplete sandbox receipt/.test(String(error.message))) throw error;
      vm = await this.#fresh(job, key);
      try { return await runJob(vm, job); }
      catch (retryError) { await this.drop(key).catch(() => {}); throw retryError; }
    }
  }

  async #fresh(job, key) {
    while (this.vms.size >= MAX_SESSION_VMS) await this.drop(this.vms.keys().next().value).catch(() => {});
    const vm = await createVm(job, this.sdk, this.requirements, this.extraRequirements);
    this.created++;
    this.vms.set(key, vm);
    try { await installRuntime(vm, this.bundle); }
    catch (error) { await this.drop(key).catch(() => {}); throw error; }
    return vm;
  }

  async drop(key) {
    const vm = this.vms.get(key);
    this.vms.delete(key);
    if (vm) await vm.destroy();
  }

  async close() {
    const failures = [];
    for (const key of [...this.vms.keys()]) {
      try { await this.drop(key); } catch (error) { failures.push(error); }
    }
    if (failures.length) throw failures[0];
  }
}

function redact(message) {
  return String(message).replaceAll(process.env.RAILWAY_API_TOKEN || '<unset>','<redacted>').slice(0,1500);
}

/** Line protocol: first line {"bundle"}, then one {"job"} per line, answered by one {"ok",...} line each. */
export async function serve(input, output, makeSession=bundle => new Session(bundle)) {
  let session = null;
  const shutdown = () => {
    const closing = session ? session.close() : Promise.resolve();
    closing.catch(() => {}).finally(() => process.exit(143));
  };
  process.once('SIGTERM', shutdown);
  try {
    for await (const line of createInterface({input, crlfDelay: Infinity})) {
      if (!line.trim()) continue;
      let reply;
      try {
        const message = JSON.parse(line);
        if (session === null) {
          if (typeof message.bundle !== 'string') throw new Error('A session must start with the runtime bundle.');
          session = makeSession(message.bundle);
          continue;
        }
        reply = {ok: true, receipt: await session.run(message.job)};
      } catch (error) {
        reply = {ok: false, error: redact(error.message)};
      }
      output.write(JSON.stringify(reply) + '\n');
    }
  } finally {
    process.removeListener('SIGTERM', shutdown);
    if (session) {
      try { await session.close(); }
      catch (error) { process.stderr.write(`Railway sandbox cleanup failed: ${redact(error.message)}\n`); }
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--session')) {
    serve(process.stdin, process.stdout).catch(error => {
      process.stderr.write(`Railway sandbox operation failed: ${redact(error.message)}\n`);
      process.exitCode = 1;
    });
  } else {
    try {
      let data='';
      for await (const chunk of process.stdin) {data+=chunk; if(Buffer.byteLength(data)>48*1024*1024) throw new Error('Payload too large.');}
      process.stdout.write(JSON.stringify(await run(JSON.parse(data))));
    } catch (error) {
      // Provider exceptions may contain request metadata. Never log credential values.
      process.stderr.write(`Railway sandbox operation failed: ${redact(error.message)}\n`);
      process.exitCode=1;
    }
  }
}
