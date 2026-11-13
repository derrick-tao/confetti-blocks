import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {existsSync} from 'node:fs';
import {chromium} from '@playwright/test';
export const mime={html:'text/html',js:'text/javascript',css:'text/css',png:'image/png',svg:'image/svg+xml',webmanifest:'application/manifest+json'};
export function launchBrowser(options={}){const executablePath=process.env.CHROMIUM_PATH||(!process.env.CI&&existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);return chromium.launch({...options,executablePath,args:['--no-sandbox',...(options.args||[])]});}
export async function serve(root='dist',{prefix='/confetti-blocks/',transform}={}){
 const directory=resolve(root);
 const server=createServer(async(req,res)=>{
  try{const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith(prefix)){res.writeHead(404).end();return;}
   const relative=decodeURIComponent(url.pathname.slice(prefix.length))||'index.html',file=resolve(directory,relative);
   if(!file.startsWith(directory+sep)){res.writeHead(404).end();return;}
   let data=await readFile(file);if(transform){const changed=await transform(relative,data);if(changed===null){res.writeHead(503).end();return;}if(changed)data=changed;}
   res.writeHead(200,{'Content-Type':mime[file.split('.').at(-1)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  }catch{res.writeHead(404).end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {url:`http://127.0.0.1:${server.address().port}${prefix}`,close:()=>new Promise(resolve=>server.close(resolve))};
}
