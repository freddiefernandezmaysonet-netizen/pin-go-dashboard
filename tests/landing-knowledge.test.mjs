import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
const data=JSON.parse(readFileSync('dist/pingo-commercial-knowledge.json','utf8'));
test('published commercial feed corresponds to the exact landing source used by this build',()=>{
  assert.equal(data.schemaVersion,1);assert.equal(data.source,'https://www.pin-ngo.com/');
  assert.equal(data.contentVersion,createHash('sha256').update(readFileSync('src/pages/LandingContent.tsx','utf8')).digest('hex'));
  assert.ok(Number.isFinite(Date.parse(data.builtAt)));
});
test('Spanish and English public content explain the platform and its displayed plans',()=>{
  for(const lang of ['es','en']){
    assert.ok(data.languages[lang].length>2000);assert.ok(data.languages[lang].includes('Pin&Go'));
    assert.ok(data.languages[lang].includes('$39.99'));assert.ok(data.languages[lang].includes('Pin AI'));
  }
});
test('illustrative guest conversations and iframe implementation do not become sales facts',()=>{
  for(const lang of ['es','en']){
    assert.ok(!data.languages[lang].includes('11:00'));assert.ok(!data.languages[lang].includes('srcdoc'));
    assert.ok(!data.languages[lang].includes('<iframe'));assert.ok(!data.languages[lang].includes('maxLength='));
  }
});
