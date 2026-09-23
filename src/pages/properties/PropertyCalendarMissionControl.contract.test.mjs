import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const sourcePath = resolve('src/pages/properties/PropertyCalendarPage.tsx');
const source = readFileSync(sourcePath, 'utf8');
const stamp = '2026-09-23T10:00:00.000Z';
const originalFetch = globalThis.fetch;

function fixture(status) {
  const issue = {
    issueCode:'FIXTURE_LEGACY_MESSAGE_FAILURE', title:'Legacy communication needs review',
    issue:'Delivery confirmation is missing', operationalImpact:'Guest needs a message',
    recommendedAction:'Review delivery evidence', engine:'Messaging', severity:'CRITICAL',
    workflowState:'ACTION_REQUIRED', visibility:'HOST', responsibleActor:'HOST',
    actionRequired:true, canAutoResolve:false, autoResolveStatus:'NOT_SUPPORTED',
    reservationNumber:'PG-2026-000001', reservationId:'fixture-internal-id',
    firstDetectedAt:stamp, lastSignalAt:stamp, actionTarget:'RESERVATION',
  };
  const history = [{ decisionId:'fixture-audit', engine:'Guest Journey', entityType:'RESERVATION',
    status:'SUCCESS', summary:'Original journey recorded', startedAt:stamp, completedAt:stamp }];
  return {
    autopilotStatus:status, engineHealth:[{engine:'GUEST_JOURNEY',status:'ERROR',message:'Enterprise fixture'}],
    generatedAt:stamp, entityId:'fixture-property',
    freedomMetrics:{minutesReturned:15,interventionsAvoided:1,autonomousDecisions:1},
    autonomyScore:{score:50,operationalSuccessRate:50,humanInterventions:1}, confidenceScore:{score:60},
    guestJourneyMetrics:{activeReservations:1,reservationConfirmed:0,verificationPending:1,
      verificationCompleted:0,accessScheduled:0,readyForArrival:0,completionRate:0,hostInterventionRequired:1},
    operationalItems:[issue], currentOperationalState:[issue],hostActionQueue:[issue],
    waitingItems:[],autoResolvingItems:[],recentlyResolved:[],recommendedActions:[],
    recentAuditEntries:history,activityHistory:history,
  };
}

async function renderWithSnapshot(snapshot) {
  const anchor = /(const \[missionControlSnapshot, setMissionControlSnapshot\] =\s*useState<any \| null>\()null(\);)/g;
  assert.equal([...source.matchAll(anchor)].length,1,'inject only an isolated snapshot fixture');
  const instrumented = source.replace(anchor,(_match,prefix,suffix)=>prefix+JSON.stringify(snapshot)+suffix);
  const temporary = mkdtempSync(join(process.cwd(),'.mission-control-render-'));
  globalThis.fetch = () => { throw new Error('RENDER_TEST_MUST_NOT_CALL_NETWORK'); };
  try {
    const outfile = join(temporary,'page.mjs');
    await build({stdin:{contents:instrumented,sourcefile:sourcePath,resolveDir:dirname(sourcePath),loader:'tsx'},
      outfile,bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',
      define:{'import.meta.env':'{}'},logLevel:'silent'});
    const { PropertyCalendarPage } = await import(pathToFileURL(outfile).href);
    return renderToStaticMarkup(React.createElement(MemoryRouter,{initialEntries:['/properties/fixture-property/calendar']},
      React.createElement(Routes,null,React.createElement(Route,{path:'/properties/:id/calendar',element:React.createElement(PropertyCalendarPage)}))));
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(temporary,{recursive:true,force:true});
  }
}

test('calendar retires E13 global indicators but keeps operational reporting and refresh',()=>{
  assert.doesNotMatch(source,/getMissionControlDisplayStatus|missionControlStatus|missionControlEngineHealth|missionControlEngineCards/);
  assert.doesNotMatch(source,/Auto Pilot Paused|Auto Pilot Active|Auto Pilot Error|>Engines Online<|>Engine Health</);
  for(const marker of ['<OperationalIntelligencePanel','guestJourneyMetrics','Arrival readiness pipeline','Recent APMS Activity',
    'autoResolutionLogItems','missionControlRecommendedActions','createMissionControlRefreshState','MISSION_CONTROL_POLL_INTERVAL_MS']) {
    assert.ok(source.includes(marker),`retain ${marker}`);
  }
  assert.match(source,/Global engine health is not assessed in this view\./);
});

for(const status of ['ACTIVE','PAUSED','ERROR','NEEDS_ATTENTION',null]) {
  test(`render preserves host alert and original journey while ignoring global ${String(status)}`,async()=>{
    const html = await renderWithSnapshot(fixture(status));
    assert.match(html,/Legacy communication needs review/);
    assert.match(html,/PG-2026-000001/);
    assert.match(html,/Original journey recorded/);
    assert.match(html,/Arrival readiness pipeline/);
    assert.match(html,/Verification pending/);
    assert.doesNotMatch(html,/Auto Pilot|Engines Online|Engine Health|Enterprise fixture/);
    assert.doesNotMatch(html,/>fixture-internal-id</);
    assert.match(html,/Global engine health is not assessed in this view/);
  });
}

test('unavailable snapshot remains unavailable rather than implying healthy engines',async()=>{
  const html = await renderWithSnapshot(null);
  assert.match(html,/Mission Control live state is unavailable/);
  assert.doesNotMatch(html,/Auto Pilot Active|Engines Online|Engine Health/);
});

test('this candidate branch cannot trigger automatic Vercel deployments',()=>{
  const config = JSON.parse(readFileSync('vercel.json','utf8'));
  assert.equal(config.git.deploymentEnabled['agent/mission-control-e13-decoupling-v1'],false);
  assert.notEqual(config.git.deploymentEnabled.main,false);
});
