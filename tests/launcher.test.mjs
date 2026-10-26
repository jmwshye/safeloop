import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
test('Windows launchers contain CRLF and skip npm install/build',async()=>{for(const name of ['start.bat','start.cmd']){const t=await readFile(new URL('../'+name,import.meta.url),'ascii');assert.ok(!/(?<!\r)\n/.test(t));assert.ok(t.includes('scripts\\start-local.mjs'));assert.ok(!t.includes('npm.cmd'))}});
test('built-in launcher serves only dist after listening',async()=>{const child=spawn(process.execPath,['scripts/start-local.mjs','--no-open'],{cwd:root,env:{...process.env,SAFELOOP_PORT:'5188'},stdio:['ignore','pipe','pipe']});try{const url=await new Promise((resolve,reject)=>{let out='';const t=setTimeout(()=>reject(Error('server readiness timeout')),10000);child.stdout.on('data',d=>{out+=d;const m=out.match(/SafeLoop is ready: (http:\/\/[^\s]+)/);if(m){clearTimeout(t);resolve(m[1])}});child.on('error',reject);child.on('exit',code=>{if(code)reject(Error('server exited '+code))})});const page=await fetch(url);assert.equal(page.status,200);assert.match(await page.text(),/SafeLoop/);assert.equal((await fetch(new URL('package.json',url))).status,404);assert.equal((await fetch(new URL('..%2f..%2fREADME.md',url))).status,403);assert.equal((await fetch(url,{method:'POST'})).status,405)}finally{child.kill()}});
