import {Sandbox} from 'railway';

let vm;
try {
  await Sandbox.list();
  console.log('AUTHENTICATION_OK');
  vm=await Sandbox.create({networkIsolation:'ISOLATED',idleTimeoutMinutes:5,resources:{cpu:1,memoryGB:2},env:{}});
  console.log('CREATED',vm.id);
  const result=await vm.exec('id; command -v unshare; unshare -Urnpf --mount-proc sh -c "id; echo NAMESPACE_PROBE_OK"',
    {timeoutSec:20,maxOutputBytes:4096,ephemeral:true});
  console.log(JSON.stringify({exitCode:result.exitCode,stdout:result.stdout,stderr:result.stderr,timedOut:result.timedOut}));
} catch(error) {
  console.error('PROBE_FAILED',String(error.message).replaceAll(process.env.RAILWAY_API_TOKEN || '<unset>','<redacted>'));
  process.exitCode=1;
} finally {
  if(vm) {await vm.destroy(); console.log('SANDBOX_DESTROYED');}
}
