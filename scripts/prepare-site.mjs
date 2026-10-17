import { copyFile, cp, mkdir } from 'node:fs/promises';
// Publish only game assets, not source, test modules, account files or secrets.
await mkdir('_site/dist', {recursive:true});
for (const file of ['index.html','style.css','network-config.js']) await copyFile(file, `_site/${file}`);
await copyFile('dist/main.js', '_site/dist/main.js');
await cp('assets', '_site/assets', {recursive:true});
