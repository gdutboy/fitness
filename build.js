import {mkdir,copyFile,cp,writeFile} from 'node:fs/promises';
const files=['index.html','style.css','app.js','core.js','data.js','sw.js','manifest.webmanifest'];
await mkdir('_site',{recursive:true});
for(const file of files)await copyFile(file,`_site/${file}`);
await cp('assets','_site/assets',{recursive:true});
await writeFile('_site/.nojekyll','');
console.log('Built static site in _site/');
