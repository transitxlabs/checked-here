import {mkdtempSync,cpSync,readFileSync,writeFileSync,renameSync,mkdirSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import faults from './faults.mjs';
const release=process.argv.includes('--v121');
const prefix=release?'v1.2.1-':process.argv.includes('--v12')?'v1.2.0-':process.argv.includes('--v11')?'v1.1-':process.argv.includes('--v1')?'v1-':'';
const root=resolve(new URL('..',import.meta.url).pathname),results=[];
const evidence=resolve(process.env.EVIDENCE_DIR||join(root,'.work','evidence'));
const scratch=resolve(process.env.TMPDIR||join(root,'.work','tmp'));
const intermediate=join(evidence,'intermediate',`faults-${Date.now()}-${process.pid}`);
const retainPath=name=>{const path=join(evidence,name);try{readFileSync(path);mkdirSync(intermediate,{recursive:true});renameSync(path,join(intermediate,name));}catch(error){if(error.code!=='ENOENT')throw error;}return path;};
const discarded=join(scratch,'discarded');mkdirSync(evidence,{recursive:true});mkdirSync(discarded,{recursive:true});
const source_commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const requested=process.env.ROOT_SOURCE_COMMIT?.trim();if(requested&&requested!==source_commit)throw Error('Final source commit does not match HEAD');
const testFiles=readdirSync(join(root,'tests')).filter(file=>file.endsWith('.test.mjs')).map(file=>join('tests',file));
const ids=faults.map(f=>f[0]);if(new Set(ids).size!==ids.length)throw Error('Duplicate fault test IDs');
for(const [name,file,before,after] of faults) {
  const directory=mkdtempSync(join(scratch,'checkin-fault-'));
  try {
    for(const folder of ['js','tests']) cpSync(join(root,folder),join(directory,folder),{recursive:true});
    for(const file of ['sw.js','index.html','styles.css','icon.svg','manifest.webmanifest','icons','data-dictionary.csv','DATA_DICTIONARY.md','README.md','CHANGELOG.md']) cpSync(join(root,file),join(directory,file),{recursive:true});
    const path=join(directory,file),source=readFileSync(path,'utf8');
    if(!source.includes(before))throw Error(`Fault target missing: ${name}`);
    if(before===after)throw Error(`Fault is unchanged: ${name}`);
    writeFileSync(path,source.replace(before,after));
    const run=spawnSync(process.execPath,['--test','--test-name-pattern',`^${name} `,...testFiles],{cwd:directory,encoding:'utf8',env:{...process.env,TMPDIR:scratch}});
    const output=run.stdout+run.stderr;
    writeFileSync(retainPath(`${prefix}fault-${name}.txt`),`Source commit: ${source_commit}\n`+output.split('\n').map(line=>line.trimEnd()).join('\n'));
    const detected=run.status!==0 && new RegExp(`not ok \\d+ - ${name} `).test(output) && !output.includes('SyntaxError');
    results.push({test:name,file,removed:before,planted:after,exit_code:run.status,detected});
    process.stdout.write(`${name}: ${detected?'fault detected':'NOT DETECTED'} (exit ${run.status})\n`);
  } finally {renameSync(directory,join(discarded,directory.split('/').at(-1)));}
}
writeFileSync(retainPath(`${prefix}fault-results.json`),JSON.stringify({version:release?'1.2.1':prefix,source_commit,finalRun:!!requested,results},null,2)+'\n');
if(results.some(r=>!r.detected))process.exitCode=1;
