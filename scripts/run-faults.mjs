import {mkdtempSync,cpSync,readFileSync,writeFileSync,rmSync,mkdirSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import faults from './faults.mjs';
const prefix=process.argv.includes('--v12')?'v1.2.0-':process.argv.includes('--v11')?'v1.1-':process.argv.includes('--v1')?'v1-':'';
const root=resolve(new URL('..',import.meta.url).pathname),results=[];
const testFiles=readdirSync(join(root,'tests')).filter(file=>file.endsWith('.test.mjs')).map(file=>join('tests',file));
mkdirSync(join(root,'evidence'),{recursive:true});
for(const [name,file,before,after] of faults) {
  const directory=mkdtempSync(join(tmpdir(),'checkin-fault-'));
  try {
    for(const folder of ['js','tests']) cpSync(join(root,folder),join(directory,folder),{recursive:true});
    for(const file of ['sw.js','index.html','styles.css','icon.svg','manifest.webmanifest','icons','data-dictionary.csv','DATA_DICTIONARY.md','README.md']) cpSync(join(root,file),join(directory,file),{recursive:true});
    const path=join(directory,file),source=readFileSync(path,'utf8');
    if(!source.includes(before)) throw Error(`Fault target missing: ${name}`);
    writeFileSync(path,source.replace(before,after));
    const run=spawnSync(process.execPath,['--test','--test-name-pattern',`^${name} `,...testFiles],{cwd:directory,encoding:'utf8'});
    const output=run.stdout+run.stderr;
    writeFileSync(join(root,'evidence',`${prefix}fault-${name}.txt`),output.split('\n').map(line=>line.trimEnd()).join('\n'));
    const detected=run.status!==0 && output.includes(`not ok 1 - ${name} `) && !output.includes('SyntaxError');
    results.push({test:name,file,removed:before,planted:after,exit_code:run.status,detected});
    process.stdout.write(`${name}: ${detected?'fault detected':'NOT DETECTED'} (exit ${run.status})\n`);
  } finally {rmSync(directory,{recursive:true,force:true});}
}
writeFileSync(join(root,'evidence',`${prefix}fault-results.json`),JSON.stringify(results,null,2)+'\n');
if(results.some(r=>!r.detected)) process.exitCode=1;
