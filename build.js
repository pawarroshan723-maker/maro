'use strict';
const fs = require('node:fs');
const path = require('node:path');
const parts = ['partA.html','partB.html','partC.js','partD.js','partE.js','partF.js'];
const content = parts.map(name=>fs.readFileSync(path.join(__dirname,name),'utf8')).join('');
fs.writeFileSync(path.join(__dirname,'index.html'),content);
console.log('Built self-contained index.html');
