import {Sandbox} from 'railway';
import {readFile} from 'node:fs/promises';
import {template,fetchReadRetry} from './bridge.mjs';

const steps=[];
const recipe={withPackages(...names){steps.push('apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y '+names.join(' '));return this},run(command){steps.push(command);return this}};
template({template:()=>recipe},await readFile(new URL('../requirements.txt',import.meta.url)));
const vm=await Sandbox.create({fetch:fetchReadRetry,networkIsolation:'ISOLATED',idleTimeoutMinutes:5,resources:{cpu:1,memoryGB:2},env:{}});
console.log('DIAGNOSTIC_VM',vm.id);
try {
  const version=await vm.exec('python3 --version; command -v uv',{timeoutSec:15,maxOutputBytes:1024});
  console.log(version.stdout);
  for(let i=0;i<steps.length;i++) {
    console.log('STEP',i+1);
    const r=await vm.exec(steps[i],{timeoutSec:300,maxOutputBytes:16384});
    console.log(JSON.stringify({exitCode:r.exitCode,stdout:r.stdout.slice(-6000),stderr:r.stderr.slice(-6000),timedOut:r.timedOut}));
    if(r.exitCode!==0 || r.timedOut){process.exitCode=1;break;}
  }
} finally {await vm.destroy();console.log('DIAGNOSTIC_VM_DESTROYED');}
