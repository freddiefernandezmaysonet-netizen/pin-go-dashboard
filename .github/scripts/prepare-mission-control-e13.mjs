import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const path = 'src/pages/properties/PropertyCalendarPage.tsx';
const expectedBlob = '850a3907ef1795fcb5dda683d66ad49987b40c46';
if (execFileSync('git', ['hash-object', path], {encoding:'utf8'}).trim() !== expectedBlob) {
  throw new Error('AUDITED_CALENDAR_CHANGED');
}
let text = fs.readFileSync(path, 'utf8');
const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const removals = [];
const counts = new Map();
const variables = new Set(['missionControlStatus','missionControlEngineHealth','missionControlEngineCards','missionEngineDisplayOrder']);
const functions = new Set(['getMissionEngineSortValue','getMissionEngineFallbackMessage','formatMissionEngineTime','formatAutopilotStatus','getAutopilotPillStyle']);
function remove(node, label) {
  counts.set(label, (counts.get(label) ?? 0) + 1);
  let start = node.getStart(file), end = node.getEnd();
  const lineStart = text.lastIndexOf('\n', start-1)+1;
  const nextLine = text.indexOf('\n', end);
  if (text.slice(lineStart,start).trim() === '') start=lineStart;
  if (nextLine >= 0 && text.slice(end,nextLine).trim() === '') end=nextLine+1;
  removals.push({start, end, value:''});
}
function visit(node) {
  if (ts.isVariableStatement(node)) {
    const matches = node.declarationList.declarations.filter(d => ts.isIdentifier(d.name) && variables.has(d.name.text));
    if (matches.length) {
      if (node.declarationList.declarations.length !== 1) throw new Error('COMBINED_VARIABLE_DECLARATION');
      remove(node, matches[0].name.text);
      return;
    }
  }
  if (ts.isFunctionDeclaration(node) && node.name && functions.has(node.name.text)) {
    remove(node, node.name.text);
    return;
  }
  if (ts.isJsxElement(node)) {
    const opening = node.openingElement.getText(file);
    const body = node.getText(file);
    if (opening.includes('getAutopilotPillStyle(missionControlStatus)')) { remove(node, 'autopilot-pill'); return; }
    if (opening.includes('getMissionStatusPillStyle(missionControlStatus)')) { remove(node, 'mission-status-pill'); return; }
    if (opening === '<div style={styles.missionHeroCard}>' && body.includes('>Engines Online<')) { remove(node, 'engines-online'); return; }
    if (opening === '<div style={styles.missionPanel}>' && body.includes('>Engine Health<')) { remove(node, 'engine-health-panel'); return; }
  }
  if (ts.isPropertyAssignment(node) && node.name.getText(file) === 'missionHeroGrid' && ts.isObjectLiteralExpression(node.initializer)) {
    const grid = node.initializer.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(file) === 'gridTemplateColumns');
    if (!grid || !ts.isPropertyAssignment(grid)) throw new Error('HERO_GRID_COLUMNS_MISSING');
    removals.push({start:grid.initializer.getStart(file),end:grid.initializer.getEnd(),value:'"repeat(3, minmax(0, 1fr))"'});
    counts.set('hero-columns', (counts.get('hero-columns') ?? 0) + 1);
  }
  ts.forEachChild(node, visit);
}
visit(file);
for (const key of [...variables,...functions,'autopilot-pill','mission-status-pill','engines-online','engine-health-panel','hero-columns']) {
  if (counts.get(key) !== 1) throw new Error(`EXPECTED_ONE:${key}:${counts.get(key)}`);
}
removals.sort((a,b) => b.start-a.start);
let previous = text.length;
for (const change of removals) {
  if (change.end > previous) throw new Error('OVERLAPPING_EDITS');
  text = text.slice(0,change.start) + change.value + text.slice(change.end);
  previous = change.start;
}
function once(old, replacement) {
  if (text.split(old).length !== 2) throw new Error(`ANCHOR_NOT_UNIQUE:${old.slice(0,80)}`);
  text = text.replace(old,replacement);
}
once('  getMissionControlDisplayStatus,\n','');
once('>APMS Mission Control<','>Mission Control<');
once('Autonomous property operations','Property operations overview');
once('Live engine health, operational memory, and autonomous execution for this property.', 'Reservation readiness, operational alerts, and recorded activity for this property.');
once(`        Pin&Go cannot prove current APMS health for this property, so no ACTIVE
        status or autonomy metrics are being inferred.`, `        Operational data is unavailable for this property. No activity or
        readiness metrics are inferred while the snapshot is unavailable.`);
once(`      <div style={styles.missionEnterpriseSubtitle}>
        Reservation readiness, operational alerts, and recorded activity for this property.
      </div>`, `      <div style={styles.missionEnterpriseSubtitle}>
        Reservation readiness, operational alerts, and recorded activity for this property.
      </div>
      <div role="note" style={styles.missionEnterpriseSubtitle}>
        Global engine health is not assessed in this view.
      </div>`);
for (const key of [...variables,...functions,'getMissionControlDisplayStatus']) {
  if (text.includes(key)) throw new Error(`GLOBAL_BINDING_REMAINS:${key}`);
}
fs.writeFileSync(path,text);
console.log('Applied exact presentation edits, preserving Guest Journey, operations and history:', path);
