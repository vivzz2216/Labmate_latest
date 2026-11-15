import test from 'node:test';
import assert from 'node:assert/strict';
import {run,fetchReadRetry,template,needsNotebookExtras} from './bridge.mjs';

process.env.RAILWAY_API_TOKEN='test-token-must-never-enter-vm';
process.env.RAILWAY_ENVIRONMENT_ID='test-environment';

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

test('notebook-extra layer is added only for jobs that import extra libraries',async()=>{
  const build=notebookExtras=>{const commands=[];const recipe={run(command){commands.push(command);return this}};
    template({template(){return recipe}},Buffer.from('deps'),false,[],'',notebookExtras);return commands};
  assert.ok(!build(null).some(c=>c.includes('nltk')));
  const extra=build(Buffer.from('networkx==3.7\n')).at(-1);
  assert.ok(extra.includes(Buffer.from('networkx==3.7\n').toString('base64')));
  assert.ok(extra.includes('--no-deps')&&extra.includes('vader_lexicon')&&extra.includes('test -f'));
  assert.equal(needsNotebookExtras({code:'import pandas as pd\nfrom nltk.sentiment.vader import SentimentIntensityAnalyzer'}),true);
  assert.equal(needsNotebookExtras({code:'  import networkx as nx'}),true);
  assert.equal(needsNotebookExtras({code:'from bs4 import BeautifulSoup'}),true);
  assert.equal(needsNotebookExtras({code:'import pandas\nprint("import nltk")'}),false);
  for(const [code,expected] of [['print(7)',false],['import networkx as nx\nprint(7)',true]]) {
    const commands=[];const recipe={run(command){commands.push(command);return this}};
    const f=fixture({exitCode:0,stdout:'{"success":true}'});f.sdk.template=()=>recipe;
    await run({bundle:'',job:{code,language:'colab'}},f.sdk,Buffer.from('deps'),Buffer.from('extra-pins'));
    assert.equal(commands.some(c=>c.includes(Buffer.from('extra-pins').toString('base64'))),expected);
  }
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
