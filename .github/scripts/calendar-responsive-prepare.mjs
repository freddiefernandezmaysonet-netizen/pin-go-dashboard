// One-time audited presentation-only preparation. Removed after validation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';

const base = '2e0429911851379065a8819333a3b6a07c0bbcfd';
const files = [
  ['src/pages/properties/PropertyCalendarPage.tsx', 'pgc'],
  ['src/components/properties/OperationalIntelligencePanel.tsx', 'pgo'],
  ['src/components/properties/PropertyCalendarStayRestrictionsPanel.tsx', 'pgs'],
];
for (const [path, prefix] of files) {
  const text = fs.readFileSync(path, 'utf8');
  assert.equal(text, execFileSync('git', ['show', `${base}:${path}`], {encoding:'utf8'}));
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(source.parseDiagnostics.length, 0);
  const edits = [];
  const seen = new Set();
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      if (/^[a-z]/.test(tag)) {
        const attrs = node.attributes.properties;
        const style = attrs.find(a => ts.isJsxAttribute(a) && a.name.getText(source) === 'style');
        const expr = style?.initializer;
        if (expr && ts.isJsxExpression(expr) && expr.expression) {
          const value = expr.expression.getText(source);
          const key = value.match(/^styles\.(\w+)$/)?.[1] ?? value.match(/^\{\s*\.\.\.styles\.(\w+)/)?.[1];
          if (key) {
            assert.ok(!attrs.some(a => ts.isJsxAttribute(a) && a.name.getText(source) === 'className'), `Unexpected existing class on ${path}:${key}`);
            let add = `className="${prefix}-${key}" `;
            if (prefix === 'pgc' && key === 'dayStatus') {
              add += 'data-compact-status={status === "Available" ? "Open" : status} ';
            }
            if (prefix === 'pgc' && key === 'dayCard') {
              add += 'data-calendar-date={dateKey} role="button" tabIndex={0} aria-pressed={selected} ';
              add += 'aria-label={`${format(day, "EEEE, MMMM d, yyyy")}. ${status}. Nightly rate ${status === "Blocked" ? "$0" : displayRate !== null ? `$${displayRate.toFixed(0)}` : "unavailable"}. ${reservation?.guestName || blockedDate?.reason || rateReason || ""}${reservation?.reservationNumber ? `. ${reservation.reservationNumber}` : ""}`} ';
              add += 'title={`${dateKey} · ${status} · ${status === "Blocked" ? "$0" : displayRate !== null ? `$${displayRate.toFixed(0)}` : "—"} · ${reservation?.guestName || blockedDate?.reason || rateReason || ""}`} ';
              add += 'onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }} ';
            }
            edits.push([style.getStart(source), add]);
            seen.add(key);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(edits.length > 10, `Expected existing styled elements in ${path}`);
  if (prefix === 'pgc') for (const key of ['page','calendarGrid','dayCard','dayStatus','missionControlCard','controlCenterCard']) assert.ok(seen.has(key), key);
  if (prefix === 'pgo') assert.ok(seen.has('stats'));
  if (prefix === 'pgs') assert.ok(seen.has('removalPanel'));
  let next = text;
  for (const [position, addition] of edits.sort((a,b) => b[0] - a[0])) next = next.slice(0,position) + addition + next.slice(position);
  assert.equal(ts.createSourceFile(path,next,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).parseDiagnostics.length,0);
  fs.writeFileSync(path,next);
  console.log(`Added ${edits.length} presentation hooks to ${path}; existing handlers, state and inline styles unchanged.`);
}

const routerPath = 'src/app/routes/router.tsx';
let router = fs.readFileSync(routerPath,'utf8');
assert.equal(router,execFileSync('git',['show',`${base}:${routerPath}`],{encoding:'utf8'}));
const anchor = 'function PropertyCalendarRoute() {\n  return (\n    <div style={{ display: "grid", gap: 20 }}>';
assert.equal(router.split(anchor).length,2);
router = 'import "../../pages/properties/PropertyCalendarResponsive.css";\n' + router.replace(anchor,anchor.replace('<div style=', '<div className="pg-calendar-route" style='));
fs.writeFileSync(routerPath,router);

const testPath = 'src/pages/properties/PropertyCalendarMissionControl.contract.test.mjs';
let test = fs.readFileSync(testPath,'utf8');
for (const key of ['missionControlCard','calendarToolbar','calendarGrid']) {
  const before = `<div style={styles.${key}}>`;
  assert.ok(test.includes(before));
  test = test.replaceAll(before, `<div className="pgc-${key}" style={styles.${key}}>`);
}
fs.writeFileSync(testPath,test);
console.log('Only updated exact source markers for the new classes; all prior render and refresh assertions retained.');
