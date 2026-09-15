'use strict';
// No browser or npm dependencies: validate the shipped self-contained build.
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const parts=['partA.html','partB.html','partC.js','partD.js','partE.js','partF.js'];
const generated=parts.map(p=>fs.readFileSync(path.join(__dirname,p),'utf8')).join('');
if(generated!==fs.readFileSync(path.join(__dirname,'index.html'),'utf8')){
  console.error('index.html is out of date. Run node build.js.'); process.exit(1);
}
let failures=0;
function run(file,env,description,expected){
  const result=spawnSync(process.execPath,[path.join(__dirname,file)],{
    cwd:__dirname,env:{...process.env,...env},encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024,
  });
  const ok=result.status===0 && expected.test(result.stdout||'');
  console.log((ok?'PASS ':'FAIL ')+description);
  if(!ok){ failures++; console.error(result.error||result.stderr||result.stdout); }
}
run('smoke.js',{},'progression, combat, controls and regression tests',/ALL CHECKS PASSED/);
for(let stage=1;stage<=15;stage++){
  run('aiplay.js',{STAGE:String(stage),GEOM_ONLY:'1'},'stage '+stage+' terrain traversal (enemies disabled)',/final: CLEAR .*deaths= 0/);
  run('fuzz.js',{STAGE:String(stage)},'stage '+stage+' input fuzz with enemies',/FUZZ CLEAN/);
}
console.log(failures ? failures+' campaign checks failed.' : 'All 15 stages passed terrain, fuzz and regression validation.');
process.exit(failures?1:0);
