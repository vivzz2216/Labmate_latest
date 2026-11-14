import { Sandbox } from 'railway';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

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

export function template(sdk, requirements, spark=false, dlProfiles=[], prepareDl='') {
  const deps = {private:true,dependencies:{express:'4.21.2',joi:'17.13.3',cors:'2.8.5','cookie-parser':'1.4.7','express-session':'1.18.1',react:'18.2.0','react-dom':'18.2.0','react-router-dom':'6.30.1',vite:'5.4.21'}};
  const encodedDeps = Buffer.from(JSON.stringify(deps)).toString('base64');
  let runtime = sdk.template()
    .run('apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends gcc g++ default-jdk bubblewrap xvfb xauth libmagic1 fonts-dejavu-core r-base-core r-recommended r-cran-ggplot2 r-cran-dplyr r-cran-tidyr r-cran-reshape2 r-cran-e1071 r-cran-randomforest')
    .run('Rscript --vanilla -e \'stopifnot(all(vapply(c("ggplot2","dplyr","tidyr","tibble","scales","reshape2","MASS","lattice","boot","class","cluster","nnet","rpart","survival","e1071","randomForest"), requireNamespace, logical(1), quietly=TRUE)))\'')
    .run(`mkdir -p /opt/labmate-runtime && echo '${requirements.toString('base64')}' | base64 -d > /opt/labmate-runtime/requirements.txt && UV_PYTHON_INSTALL_DIR=/opt/labmate-runtime/python uv python install 3.11 && UV_PYTHON_INSTALL_DIR=/opt/labmate-runtime/python uv venv --python 3.11 --seed /opt/labmate-runtime/venv && uv pip install --python /opt/labmate-runtime/venv -r /opt/labmate-runtime/requirements.txt`)
    .run('PLAYWRIGHT_BROWSERS_PATH=/opt/labmate-runtime/browsers /opt/labmate-runtime/venv/bin/python -m playwright install --with-deps chromium')
    .run(`for kind in node react; do mkdir -p /opt/labmate-runtime/node_cache/$kind; echo '${encodedDeps}' | base64 -d > /opt/labmate-runtime/node_cache/$kind/package.json; (cd /opt/labmate-runtime/node_cache/$kind && npm install --ignore-scripts --no-audit --no-fund) || exit 1; done`);
  if (spark) runtime = runtime.run('apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends openjdk-17-jre-headless && uv pip install --python /opt/labmate-runtime/venv pyspark==3.5.7');
  const profiles = [...new Set(dlProfiles)].sort();
  if (profiles.some(value => !['mnist','mobilenet','resnet'].includes(value))) throw new Error('Invalid cache profile.');
  if (profiles.length) {
    if (!prepareDl) throw new Error('Missing trusted cache preparation script.');
    runtime = runtime.run(`echo '${Buffer.from(prepareDl).toString('base64')}' | base64 -d > /opt/labmate-runtime/prepare_dl.py && /opt/labmate-runtime/venv/bin/python /opt/labmate-runtime/prepare_dl.py ${profiles.join(' ')}`);
  }
  return runtime;
}

export async function run(request, sdk=Sandbox, requirements=undefined) {
  if (!process.env.RAILWAY_API_TOKEN || !process.env.RAILWAY_ENVIRONMENT_ID)
    throw new Error('Railway sandbox credentials are not configured.');
  requirements ??= await readFile(new URL('../requirements.txt', import.meta.url));
  // No variables, private networking, public domains or API credentials enter the VM.
  const spark = /\bpyspark\b/i.test(String(request.job?.code || '') + '\n' + String(request.job?.objective || ''));
  // The actual implementation selects the cache; an assignment listing two
  // alternative frameworks must not download both unnecessarily.
  const source = String(request.job?.code || request.job?.objective || '');
  const dlProfiles = [];
  if (/\bmnist\b/i.test(source) && !/\bfashion_mnist\b/i.test(source)) dlProfiles.push('mnist');
  if (/\bmobilenet(?:v2)?\b/i.test(source)) dlProfiles.push('mobilenet');
  if (/\bresnet(?:50)?\b/i.test(source)) dlProfiles.push('resnet');
  const prepareDl = dlProfiles.length ? await readFile(new URL('./prepare_dl.py', import.meta.url), 'utf8') : '';
  const vm = await sdk.create(template(sdk, requirements, spark, dlProfiles, prepareDl), {fetch:fetchReadRetry,networkIsolation:'ISOLATED', idleTimeoutMinutes:5,
    resources:{cpu:1,memoryGB:2},env:{}});
  const terminate = () => { vm.destroy().finally(() => process.exit(143)); };
  process.once('SIGTERM', terminate);
  try {
    await vm.files.write('/tmp/runtime.tar.gz',Buffer.from(request.bundle,'base64'));
    const setup = await vm.exec(`tar -xzf /tmp/runtime.tar.gz -C /opt/labmate-runtime && install -D "$(node -p 'process.execPath')" /opt/labmate-runtime/tools/node`, {timeoutSec:30,maxOutputBytes:4096});
    if (setup.exitCode !== 0 || setup.timedOut) throw new Error('Runtime installation failed.');
    const handle = vm.exec('/opt/labmate-runtime/venv/bin/python /opt/labmate-runtime/railway_job.py',
      {stdin:true,ephemeral:true,timeoutSec:230,maxOutputBytes:32*1024*1024});
    await handle.stdin.write(JSON.stringify(request.job));
    await handle.stdin.end();
    const result = await handle;
    if (result.exitCode !== 0 || result.timedOut || result.truncated) throw new Error('Incomplete sandbox receipt: '+String(result.stderr || '').slice(-2000));
    return JSON.parse(result.stdout);
  } finally {
    try { await vm.destroy(); } finally { process.removeListener('SIGTERM',terminate); }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    let data='';
    for await (const chunk of process.stdin) {data+=chunk; if(Buffer.byteLength(data)>48*1024*1024) throw new Error('Payload too large.');}
    process.stdout.write(JSON.stringify(await run(JSON.parse(data))));
  } catch (error) {
    // Provider exceptions may contain request metadata. Never log credential values.
    const message=String(error.message).replaceAll(process.env.RAILWAY_API_TOKEN || '<unset>','<redacted>');
    process.stderr.write(`Railway sandbox operation failed: ${message.slice(0,1500)}\n`);
    process.exitCode=1;
  }
}
