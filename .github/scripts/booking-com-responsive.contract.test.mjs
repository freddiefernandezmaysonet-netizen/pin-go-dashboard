import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const base = '9c78a70502d889f5d504efeb722701c93f3efeb5';
const shellPath = 'src/app/layout/AppShell.tsx';
const pagePath = 'src/pages/distribution/ConnectionCenterPage.tsx';
const shell = readFileSync(shellPath, 'utf8');
const page = readFileSync(pagePath, 'utf8');
const before = path => process.env.RESPONSIVE_BASELINE_DIR
  ? readFileSync(join(process.env.RESPONSIVE_BASELINE_DIR, path), 'utf8')
  : execFileSync('git', ['show', `${base}:${path}`], { encoding: 'utf8' });
const original = before(shellPath);
function declaration(source, name) {
  const ast = ts.createSourceFile('source.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let match;
  function visit(node) {
    if ((ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) && node.name?.getText(ast) === name) match = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(match, `Missing ${name}`);
  return match.getText(ast);
}

test('desktop navigation, page titles, roles and logout preserve their exact logic', () => {
  for (const name of ['baseNav', 'SideItem', 'getPageTitle', 'handleLogout', 'memberHiddenPaths', 'memberNav', 'organizationNav', 'nav']) {
    assert.equal(declaration(shell, name), declaration(original, name), name);
  }
});

test('organization-branding request effect is unchanged', () => {
  function brandingEffect(source) {
    const ast = ts.createSourceFile('shell.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const matches = [];
    function visit(node) {
      if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' && node.getText(ast).includes('getOrganizationBrandingReview')) matches.push(node.getText(ast));
      ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.equal(matches.length, 1);
    return matches[0];
  }
  assert.equal(brandingEffect(shell), brandingEffect(original));
});

test('Connection Center source including all authorization handlers remains byte-identical', () => {
  assert.equal(page, before(pagePath));
});

test('responsive widths do not conceal overflow by clipping application content', () => {
  assert.doesNotMatch(shell, /overflowX:\s*["'](?:hidden|clip)|overflow-x:\s*(?:hidden|clip)/);
  assert.match(shell, /240px minmax\(0, 1fr\)/);
  assert.match(shell, /@media \(max-width: 720px\)/);
  assert.match(shell, /minmax\(min\(100%, 300px\), 1fr\)/);
  assert.match(shell, /footer \{ flex-wrap: wrap/);
});

test('mobile navigation has focus containment, Escape, focus return and background isolation', () => {
  assert.match(shell, /event\.key === "Escape"/);
  assert.match(shell, /event\.key === "Tab"/);
  assert.match(shell, /menuButtonRef\.current\?\.focus\(\)/);
  assert.match(shell, /role=\{mobileNavigationActive \? "dialog"/);
  assert.match(shell, /aria-modal=\{mobileNavigationActive \? true/);
  assert.match(shell, /inert=\{mobileNavigationActive \? true/);
  assert.match(shell, /inert=\{isMobile && !mobileNavOpen \? true/);
  assert.match(shell, /visibility: hidden; pointer-events: none/);
  assert.match(shell, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(shell, /query\.removeEventListener\("change", updateViewport\)/);
  assert.match(shell, /document\.removeEventListener\("keydown", handleKeyDown\)/);
});

test('mobile disclosure preserves route-close and reduced-motion behavior', () => {
  assert.match(shell, /aria-controls="pin-go-primary-navigation"/);
  assert.match(shell, /aria-expanded=\{mobileNavigationActive\}/);
  assert.match(shell, /if \(!query\.matches\) setMobileNavOpen\(false\)/);
  assert.match(shell, /\[location\.pathname\]/);
  assert.match(shell, /closest\("a\[href\]"\)/);
  assert.match(shell, /prefers-reduced-motion: reduce/);
});
