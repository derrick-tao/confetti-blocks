import {mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const hash=value=>createHash('sha256').update(value).digest('hex');
export async function build({root=fileURLToPath(new URL('./',import.meta.url)),out=resolve(root,'dist')}={}) {
 const inputs=['index.html','privacy.html','style.css','app.js','engine.js','effects.js','favicon.svg','manifest.webmanifest','sw.js','icon-192.png','icon-512.png','icon-maskable.png','.nojekyll'];
 const source=new Map(await Promise.all(inputs.map(async file=>[file,await readFile(resolve(root,file))])));
 const release=hash(Buffer.concat([await readFile(new URL(import.meta.url)),...inputs.flatMap(file=>[Buffer.from(`${file}\0`),source.get(file),Buffer.from('\0')])]));
 const output=new Map(),names={};
 for(const file of ['engine.js','effects.js','style.css']){names[file]=file.replace(/\.(js|css)$/,(ext)=>`.${hash(source.get(file)).slice(0,16)}${ext}`);output.set(names[file],source.get(file));}
 let app=source.get('app.js').toString();for(const file of ['engine.js','effects.js'])app=app.replaceAll(`./${file}`,`./${names[file]}`);
 names['app.js']=`app.${hash(app).slice(0,16)}.js`;output.set(names['app.js'],Buffer.from(app));
 for(const file of inputs.filter(file=>!['sw.js','app.js','engine.js','effects.js','style.css'].includes(file))){let bytes=source.get(file);if(file.endsWith('.html')){let html=bytes.toString();for(const name of ['app.js','style.css'])html=html.replaceAll(`./${name}`,`./${names[name]}`);bytes=Buffer.from(html);}output.set(file,bytes);}
 const manifest=[...output].filter(([name])=>name!=='.nojekyll').map(([url,bytes])=>({url,sha256:hash(bytes)})).sort((a,b)=>a.url.localeCompare(b.url));
 output.set('sw.js',Buffer.from(source.get('sw.js').toString().replace('__RELEASE_ID__',release).replace('/*__PRECACHE__*/[]',JSON.stringify(manifest))));
 await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});await Promise.all([...output].map(([file,bytes])=>writeFile(resolve(out,file),bytes)));return {release,manifest,names,out};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await build();
