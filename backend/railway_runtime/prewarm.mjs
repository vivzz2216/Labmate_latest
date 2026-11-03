import {Sandbox} from 'railway';
import {readFile} from 'node:fs/promises';
import {template} from './bridge.mjs';

// Git checks this text file out with LF on Linux. Warm that exact recipe from Windows.
const requirements=Buffer.from((await readFile(new URL('../requirements.txt',import.meta.url),'utf8')).replace(/\r\n/g,'\n'));
await template(Sandbox,requirements).build();
console.log('PRODUCTION_TEMPLATE_READY');
