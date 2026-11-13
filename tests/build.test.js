import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {build} from '../build.js';
const source=new URL('../',import.meta.url);
export async function fixture(){const root=await mkdtemp(join(tmpdir(),'confetti-build-'));for(const entry of await readdir(source,{withFileTypes:true}))if(entry.isFile())await copyFile(new URL(entry.name,source),join(root,entry.name));return root;}
const snapshot=async directory=>Promise.all((await readdir(directory)).sort().map(async name=>[name,createHash('sha256').update(await readFile(join(directory,name))).digest('hex')]));
test('build is deterministic, source-preserving, integrity-verified and content-addressed',async()=>{
 const root=await fixture();try{
  const original=await readFile(join(root,'app.js')),one=await build({root}),files=await snapshot(one.out),two=await build({root});
  assert.equal(one.release,two.release);assert.deepEqual(await snapshot(two.out),files);assert.deepEqual(await readFile(join(root,'app.js')),original);
  const html=await readFile(join(two.out,'index.html'),'utf8'),app=await readFile(join(two.out,two.names['app.js']),'utf8');
  assert.ok(html.includes(two.names['app.js'])&&html.includes(two.names['style.css']));assert.ok(app.includes(two.names['engine.js'])&&app.includes(two.names['effects.js']));
  assert.ok(!two.manifest.some(e=>e.url==='./'));assert.ok(two.manifest.some(e=>e.url==='privacy.html'));
  for(const entry of two.manifest)assert.equal(createHash('sha256').update(await readFile(join(two.out,entry.url))).digest('hex'),entry.sha256);
  const worker=await readFile(join(two.out,'sw.js'),'utf8');assert.ok(worker.includes(two.release));assert.ok(!worker.includes('__RELEASE_ID__'));
  assert.ok(!(await readdir(two.out)).some(name=>['app.js','engine.js','effects.js','style.css','package.json'].includes(name)));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('script, worker, privacy, and icon-only changes each generate a new release',async()=>{
 const root=await fixture();try{
  let previous=await build({root});
  for(const file of ['app.js','sw.js','privacy.html','icon-192.png']){
   await writeFile(join(root,file),Buffer.concat([await readFile(join(root,file)),Buffer.from('\n')]));const next=await build({root});assert.notEqual(next.release,previous.release,file);previous=next;
  }
  const oldApp=previous.names['app.js'];await writeFile(join(root,'engine.js'),Buffer.concat([await readFile(join(root,'engine.js')),Buffer.from('\n// dependency change\n')]));
  assert.notEqual((await build({root})).names['app.js'],oldApp,'module dependency invalidates importer filename');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('production budget and restrictive policies',async()=>{
 const release=await build();let bytes=0;for(const entry of release.manifest)if(!entry.url.endsWith('.png'))bytes+=(await readFile(join(release.out,entry.url))).length;
 bytes+=(await readFile(join(release.out,'sw.js'))).length;assert.ok(bytes<120000,`${bytes} exceeds production budget`);
 for(const file of ['index.html','privacy.html']){const html=await readFile(join(release.out,file),'utf8');assert.ok(html.includes('Content-Security-Policy'));assert.ok(html.includes("script-src 'self'"));assert.ok(!html.includes('unsafe-inline'));assert.ok(html.includes('name="referrer" content="no-referrer"'));}
});
