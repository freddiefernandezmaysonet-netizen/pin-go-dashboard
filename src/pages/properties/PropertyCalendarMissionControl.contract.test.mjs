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


test('calendar and date controls appear before the single expanded Mission Control',()=>{
  const mission = source.indexOf('<div className="pgc-missionControlCard" style={styles.missionControlCard}>');
  assert.ok(mission > 0);
  assert.equal(source.split('<div className="pgc-missionControlCard" style={styles.missionControlCard}>').length-1,1);
  for (const marker of ['<div className="pgc-calendarToolbar" style={styles.calendarToolbar}>','<div className="pgc-calendarGrid" style={styles.calendarGrid}>','{hasSelectedRange && (','{selectedDay && (']) {
    const position = source.indexOf(marker);
    assert.ok(position >= 0 && position < mission,marker+' must remain above Mission Control');
  }
  assert.ok(source.indexOf('style={styles.backLink}') > mission);
});

test('rendered calendar precedes Mission Control for live, unavailable, and legacy-alert snapshots',async()=>{
  const legacy = {...fixture('ERROR'),operationalItems:undefined,recommendedActions:[{
    priority:'CRITICAL',requiresHumanAction:true,engine:'Messaging',title:'Legacy fallback retained',
    reservationId:'fixture-internal-id',reservationNumber:'PG-2026-000002',canAutoResolve:false,
  }]};
  for (const snapshot of [fixture('ACTIVE'),null,legacy]) {
    const html = await renderWithSnapshot(snapshot);
    const mission = html.indexOf('>Mission Control<');
    assert.ok(mission > 0);
    assert.equal(html.split('>Mission Control<').length-1,1);
    for (const marker of ['>Today</button>','>SUN<','>SAT<']) {
      const position = html.indexOf(marker);
      assert.ok(position >= 0 && position < mission,marker+' must render before Mission Control');
    }
    assert.ok(html.indexOf('Back to property') > mission);
    assert.doesNotMatch(html,/<details|<summary|aria-expanded="false"/);
    if (snapshot === null) assert.match(html,/Mission Control live state is unavailable/);
    else if (snapshot === legacy) assert.match(html,/Legacy fallback retained/);
    else assert.match(html,/Legacy communication needs review/);
  }
});

test('calendar-first candidate keeps automatic deployment disabled without disabling main',()=>{
  const config = JSON.parse(readFileSync('vercel.json','utf8'));
  assert.equal(config.git.deploymentEnabled['agent/calendar-first-mission-control-v1'],false);
  assert.notEqual(config.git.deploymentEnabled.main,false);
});
