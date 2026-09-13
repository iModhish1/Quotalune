import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const directory=mkdtempSync(path.join(tmpdir(),'quotalis-gh-guard-'));
const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'bash';
try {
 const mock=path.join(directory,'gh');
 writeFileSync(mock,`#!/usr/bin/env bash
if [[ "$1 $2" == 'api user' ]]; then echo "\${TEST_ACTOR:-iModhish1}"; exit 0; fi
if [[ "$1" == api ]]; then echo "\${TEST_LOOKUP:-gh: Not Found (HTTP 404)}" >&2; exit 1; fi
if [[ "$1 $2" == 'repo create' ]]; then echo "$*" >> "$TEST_MUTATIONS"; exit 0; fi
if [[ "$1 $2" == 'repo view' ]]; then echo 'iModhish1/Quotalis|https://github.com/iModhish1/Quotalis'; exit 0; fi
exit 91
`,{mode:0o755});
 const mutations=path.join(directory,'mutations');
 const wrapper=path.resolve('scripts/gh-safe.sh').replaceAll('\\','/');
 const run=(extra=[],env={})=>spawnSync(bash,['-c','gh() { "$BASH" "$TEST_GH_MOCK" "$@"; }; export -f gh; shift; bash "$@"','guard',directory.replaceAll('\\','/'),wrapper,'--repo','iModhish1/Quotalis','--verify-kind','new-repo',...extra,'--','repo','create','iModhish1/Quotalis','--public'],{encoding:'utf8',env:{...process.env,TEST_GH_MOCK:mock.replaceAll('\\','/'),TEST_MUTATIONS:mutations.replaceAll('\\','/'),...env}});
 assert.notEqual(run([],{TEST_ACTOR:'someone-else'}).status,0);
 assert.notEqual(run([],{TEST_LOOKUP:'network unavailable'}).status,0);
 assert.equal(run(['--what-if']).status,0);
 assert.equal(existsSync(mutations),false);
 const created=run();assert.equal(created.status,0,created.stderr);
 assert.equal(readFileSync(mutations,'utf8').trim(),'repo create iModhish1/Quotalis --public');
 console.log('GitHub new-repository guard: owner, absence, dry run and exact creation passed');
}finally{rmSync(directory,{recursive:true,force:true});}
