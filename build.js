import {mkdir, copyFile, rm} from 'node:fs/promises';
await rm('dist', {recursive:true, force:true});
await mkdir('dist');
for (const file of ['index.html','style.css','app.js','engine.js','effects.js','favicon.svg','manifest.webmanifest','sw.js','icon-192.png','icon-512.png','icon-maskable.png','.nojekyll']) await copyFile(file, `dist/${file}`);
