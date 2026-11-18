import test from 'node:test';
import assert from 'node:assert/strict';
import {run,fetchReadRetry,template,needsNotebookExtras} from './bridge.mjs';

process.env.RAILWAY_API_TOKEN='test-token-must-never-enter-vm';
process.env.RAILWAY_ENVIRONMENT_ID='test-environment';

test('approved notebook extras and corpora are built only when requested',()=>{
  assert.equal(needsNotebookExtras({code:'import nltk\nfrom bs4 import BeautifulSoup'}),true);
  assert.equal(needsNotebookExtras({code:'print(1)'}),false);
  const commands=[];const recipe={run(command){commands.push(command);return this}};
  template({template(){return recipe}},Buffer.from('base'),false,[],'',Buffer.from('nltk==3.10.4'));
  assert.ok(commands.some(c=>c.includes('vader_lexicon stopwords punkt_tab')));
  assert.ok(commands.some(c=>c.includes('requirements-colab-extra.txt')));
});

test('Spark dependencies are installed only for Spark jobs',()=>{
  for(const spark of [false,true]) {
    const commands=[];const recipe={run(command){commands.push(command);return this}};
    template({template(){return recipe}},Buffer.from('deps'),spark);
    assert.equal(commands.some(c=>c.includes('pyspark==3.5.7')),spark);
  }
});

test('R exists in the actual image; approved ML cache is opt-in and allowlisted',()=>{
  const commands=[];const recipe={run(command){commands.push(command);return this}};
  template({template(){return recipe}},Buffer.from('deps'),false,['mnist'],'trusted-cache-script');
  assert.ok(commands.some(c=>c.includes('r-base-core') && c.includes('r-cran-ggplot2')));
  assert.ok(commands.some(c=>c.includes('Rscript --vanilla')));
  assert.ok(commands.at(-1).endsWith('prepare_dl.py mnist'));
  assert.throws(()=>template({template(){return recipe}},Buffer.from('deps'),false,['; curl bad'],'trusted-cache-script'));
});

test('network retries are bounded and only apply to read queries',async()=>{
  let calls=0;
  const fail=async()=>{calls++;throw new Error('connection interrupted')};
  await assert.rejects(fetchReadRetry('https://example.invalid',{body:JSON.stringify({query:'mutation Create {}'})},fail));
  assert.equal(calls,1);
  calls=0;
  await assert.rejects(fetchReadRetry('https://example.invalid',{body:JSON.stringify({query:'query Status {}'})},fail));
  assert.equal(calls,3);
});

function fixture(result, setupFailure=false) {
  const calls={destroyed:0,commands:[],writes:[]};
  const recipe={withPackages(){return this},run(){return this}};
  const vm={files:{async write(...args){calls.writes.push(args)}},
    async destroy(){calls.destroyed++},
    exec(command,options){
      calls.commands.push({command,options});
      if(calls.commands.length===1)return Promise.resolve({exitCode:setupFailure?1:0});
      const promise=Promise.resolve(result);
      promise.stdin={async write(data){calls.stdin=data},async end(){}};
      return promise;
    }};
  return {calls,sdk:{template(){return recipe},async create(_,config){calls.config=config;return vm}}};
}

test('VM is isolated and destroyed after a complete receipt; payload is stdin',async()=>{
  const f=fixture({exitCode:0,stdout:'{"success":true,"output":"7"}'});
  assert.equal((await run({bundle:'',job:{code:'print(7)'}},f.sdk,Buffer.from('deps'))).output,'7');
  assert.equal(f.calls.destroyed,1);
  assert.equal(f.calls.config.networkIsolation,'ISOLATED');
  assert.equal(f.calls.config.idleTimeoutMinutes,5);
  assert.deepEqual(f.calls.config.env,{});
  assert.ok(!JSON.stringify(f.calls.config).includes(process.env.RAILWAY_API_TOKEN));
  assert.equal(JSON.parse(f.calls.stdin).code,'print(7)');
  assert.ok(!f.calls.commands[1].command.includes('print(7)'));
});

for(const result of [{exitCode:1,stdout:''},{exitCode:0,stdout:'garbage'},{exitCode:0,truncated:true,stdout:'{}'},{exitCode:-1,timedOut:true,stdout:'{}'}]) {
  test('failed/incomplete receipt still destroys VM: '+JSON.stringify(result),async()=>{
    const f=fixture(result);
    await assert.rejects(run({bundle:'',job:{}},f.sdk,Buffer.from('deps')));
    assert.equal(f.calls.destroyed,1);
  });
}

test('setup failure destroys VM before any code is run',async()=>{
  const f=fixture({},true);
  await assert.rejects(run({bundle:'',job:{}},f.sdk,Buffer.from('deps')));
  assert.equal(f.calls.destroyed,1);
  assert.equal(f.calls.commands.length,1);
});

test('an incomplete receipt identifies the exit condition even without stderr',async()=>{
  const f=fixture({exitCode:137,stdout:'',stderr:''});
  await assert.rejects(run({bundle:'',job:{}},f.sdk,Buffer.from('deps')),/exit=137, timedOut=false, truncated=false/);
  assert.equal(f.calls.destroyed,1);
});

test('cleanup failure cannot be reported as successful execution',async()=>{
  const f=fixture({exitCode:0,stdout:'{"success":true}'});
  const create=f.sdk.create;
  f.sdk.create=async(...args)=>{const vm=await create(...args);vm.destroy=async()=>{throw new Error('teardown failed')};return vm};
  await assert.rejects(run({bundle:'',job:{}},f.sdk,Buffer.from('deps')),/teardown failed/);
});

// --- Railway API allowance (2026-11-19): 429 handling and one VM per manual ---
import {railwayFetch,RateLimitError,Session,serve,imageNeeds} from './bridge.mjs';
import {PassThrough} from 'node:stream';

const reply=(status,headers={})=>({status,headers:new Headers(headers)});

test('a short 429 is waited out and retried, even for a create mutation',async()=>{
  const answers=[reply(429,{'retry-after':'2'}),reply(200)];const waits=[];let calls=0;
  const response=await railwayFetch('https://example.invalid',{body:JSON.stringify({query:'mutation Create {}'})},
    async()=>answers[calls++],async ms=>{waits.push(ms)});
  assert.equal(response.status,200);
  assert.equal(calls,2);
  assert.ok(waits[0]>=2000 && waits[0]<2600);
});

test('a long 429 is reported with the reset time instead of waiting',async()=>{
  const reset='2026-11-18T20:49:11.380Z';let waited=false;
  await assert.rejects(railwayFetch('https://example.invalid',{body:'{}'},async()=>reply(429,{'retry-after':'2006','x-ratelimit-reset':reset}),
    async()=>{waited=true}),error=>error instanceof RateLimitError && error.message===`RAILWAY_RATE_LIMITED reset=${reset} retry_after=2006`);
  assert.equal(waited,false);
});

test('repeated short 429s give up within the wait budget',async()=>{
  let calls=0;
  await assert.rejects(railwayFetch('https://example.invalid',{body:'{}'},async()=>{calls++;return reply(429,{'retry-after':'40'})},async()=>{},90000),RateLimitError);
  assert.equal(calls,3);
});

function sessionSdk(results){
  const calls={created:0,destroyed:0,installs:0,jobs:[]};
  const recipe={run(){return this}};
  let next=0;
  const sdk={template(){return recipe},async create(){
    const id=++calls.created;
    return {id,files:{async write(){}},async destroy(){calls.destroyed++},
      exec(command,options){
        if(!options.stdin){calls.installs++;return Promise.resolve({exitCode:0});}
        const promise=Promise.resolve(results[next++] ?? {exitCode:0,stdout:'{"success":true}'});
        promise.stdin={async write(data){calls.jobs.push({vm:id,job:JSON.parse(data)})},async end(){}};
        return promise;
      }};
  }};
  return {calls,sdk};
}

test('one manual shares one VM and installs the runtime once',async()=>{
  const {calls,sdk}=sessionSdk([]);
  const session=new Session('',sdk,Buffer.from('deps'));
  for(const code of ['print(1)','print(2)','#include <stdio.h>']) assert.deepEqual(await session.run({code}),{success:true});
  assert.equal(calls.created,1);
  assert.equal(calls.installs,1);
  assert.deepEqual(calls.jobs.map(j=>j.vm),[1,1,1]);
  await session.close();
  assert.equal(calls.destroyed,1);
});

test('a job needing another image gets its own VM; at most two are kept',async()=>{
  const {calls,sdk}=sessionSdk([]);
  const session=new Session('',sdk,Buffer.from('deps'),Buffer.from('extra'));
  await session.run({code:'print(1)'});
  await session.run({code:'import nltk'});
  await session.run({code:'print(2)'});
  assert.equal(calls.created,2);
  assert.notEqual(imageNeeds({code:'import nltk'}).key,imageNeeds({code:'print(1)'}).key);
  await session.run({code:'from pyspark.sql import SparkSession'});
  assert.equal(calls.created,3);
  assert.equal(calls.destroyed,1);
  await session.close();
  assert.equal(calls.destroyed,3);
});

test('a VM that fails a job is destroyed and the next job gets a fresh one',async()=>{
  const {calls,sdk}=sessionSdk([{exitCode:137,stdout:''}]);
  const session=new Session('',sdk,Buffer.from('deps'));
  await assert.rejects(session.run({code:'print(1)'}),/exit=137/);
  assert.equal(calls.destroyed,1);
  assert.deepEqual(await session.run({code:'print(2)'}),{success:true});
  assert.equal(calls.created,2);
  await session.close();
});

test('a kept VM that was reaped while idle is replaced once, transparently',async()=>{
  const {calls,sdk}=sessionSdk([]);
  const session=new Session('',sdk,Buffer.from('deps'));
  await session.run({code:'print(1)'});
  const vm=session.vms.values().next().value;
  vm.exec=(command,options)=>{if(options.stdin){const p=Promise.reject(new Error('sandbox not found'));p.catch(()=>{});p.stdin={async write(){},async end(){}};return p}return Promise.resolve({exitCode:0})};
  assert.deepEqual(await session.run({code:'print(2)'}),{success:true});
  assert.equal(calls.created,2);
  assert.equal(calls.destroyed,1);
  // A fresh VM's failure is never retried, so a broken program does not run twice.
  const {calls:c2,sdk:s2}=sessionSdk([]);
  const fresh=new Session('',s2,Buffer.from('deps'));
  s2.create=(orig=>async(...a)=>{const v=await orig(...a);v.exec=(command,options)=>{if(options.stdin){const p=Promise.reject(new Error('socket closed'));p.catch(()=>{});p.stdin={async write(){},async end(){}};return p}return Promise.resolve({exitCode:0})};return v})(s2.create);
  await assert.rejects(fresh.run({code:'print(3)'}),/socket closed/);
  assert.equal(c2.created,1);
  await session.close();
});

test('session protocol answers one line per job and closes the session at end of input',async()=>{
  const input=new PassThrough(), output=new PassThrough();let closed=0;const seen=[];
  const lines=[];output.on('data',chunk=>lines.push(...chunk.toString().split('\n').filter(Boolean)));
  const served=serve(input,output,bundle=>({bundle,async run(job){seen.push(job);if(job.fail)throw new Error('boom test-token-must-never-enter-vm');return {ok:job.n}},async close(){closed++}}));
  input.write(JSON.stringify({bundle:'b64'})+'\n');
  input.write(JSON.stringify({job:{n:1}})+'\n');
  input.write(JSON.stringify({job:{fail:true}})+'\n');
  input.end();
  await served;
  assert.deepEqual(JSON.parse(lines[0]),{ok:true,receipt:{ok:1}});
  const failure=JSON.parse(lines[1]);
  assert.equal(failure.ok,false);
  assert.ok(failure.error.includes('boom') && !failure.error.includes('test-token-must-never-enter-vm'));
  assert.equal(seen.length,2);
  assert.equal(closed,1);
});
