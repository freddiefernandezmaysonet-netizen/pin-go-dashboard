import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const BASE = '8b3e210eefb44f02553a86a2b6fabc3a860fb9b9';
const paths = [
  'src/api/adminBranding.ts', 'src/api/airbnbHostSelfService.ts',
  'src/api/distribution.ts', 'src/api/distributionFullSync.ts', 'src/api/properties.ts',
  'src/auth/RequireGuest.tsx', 'src/pages/dashboard/locks/TtlockConnectPage.tsx',
  'src/pages/integrations/TtlockConnectPage.tsx', 'src/pages/property-detail/PropertyDetailPage.tsx',
];
const read = path => readFileSync(path, 'utf8');
const before = path => process.env.BASELINE_DIR
  ? read(join(process.env.BASELINE_DIR, path))
  : execFileSync('git', ['show', `${BASE}:${path}`], { encoding: 'utf8' });
const config = ts.convertCompilerOptionsFromJson(JSON.parse(read('tsconfig.app.json')).compilerOptions, '.').options;

function canonical(source, path, baseline) {
  const emitted = ts.transpileModule(source, { fileName: path, compilerOptions: { ...config, noEmit: false, sourceMap: false, removeComments: true } }).outputText;
  const ast = ts.createSourceFile(path + '.js', emitted, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const result = ts.transform(ast, [context => {
    function visit(node) {
      // The only runtime-import correction: FormEvent does not exist in React.
      if (baseline && path.endsWith('/TtlockConnectPage.tsx') && ts.isImportDeclaration(node) && node.moduleSpecifier.text === 'react') {
        const clause = node.importClause;
        assert.ok(clause?.namedBindings && ts.isNamedImports(clause.namedBindings));
        const bindings = ts.factory.updateNamedImports(clause.namedBindings, clause.namedBindings.elements.filter(item => item.name.text !== 'FormEvent'));
        return ts.factory.updateImportDeclaration(node, node.modifiers, ts.factory.updateImportClause(clause, false, clause.name, bindings), node.moduleSpecifier, node.attributes);
      }
      // Expanding object shorthand changes no values, evaluation order or keys.
      if (ts.isShorthandPropertyAssignment(node) && !node.objectAssignmentInitializer) {
        return ts.factory.createPropertyAssignment(node.name.text, ts.factory.createIdentifier(node.name.text));
      }
      return ts.visitEachChild(node, visit, context);
    }
    return node => ts.visitNode(node, visit);
  }]);
  const text = ts.createPrinter({ removeComments: true }).printFile(result.transformed[0]);
  result.dispose();
  return text;
}

for (const path of paths) {
  test(`emitted application logic remains equivalent: ${path}`, () => {
    assert.equal(canonical(read(path), path, false), canonical(before(path), path, true));
  });
}

function declaration(source, name) {
  const ast = ts.createSourceFile('source.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function visit(node) {
    if ((ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name?.text === name) found = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(found, `Missing ${name}`);
  return found.getText(ast);
}

function execute(source, overrides = {}) {
  const calls = [];
  const exports = {};
  const code = ts.transpileModule(source.replaceAll('import.meta.env.DEV', 'false').replaceAll('import.meta.env.VITE_API_BASE', '"https://local.invalid"'), {
    fileName: 'isolated.tsx', compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, useDefineForClassFields: true },
  }).outputText;
  const modules = {
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-router-dom': { Navigate: 'Navigate' },
    './AuthProvider': { useAuth: () => ({ loading: false, user: null }) },
    ...(overrides.modules ?? {}),
  };
  runInNewContext(code, {
    exports, URL, crypto: { randomUUID: () => 'local-test-only' },
    require(name) { assert.ok(name in modules, `Unexpected import ${name}`); return modules[name]; },
    async fetch(url, options) {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => overrides.payload, text: async () => JSON.stringify(overrides.payload) };
    },
  }, { timeout: 1000 });
  return { api: exports, calls };
}
const plain = value => JSON.parse(JSON.stringify(value));

for (const [path, name, args] of [
  ['src/api/airbnbHostSelfService.ts', 'AirbnbHostSelfServiceApiError', ['TEST_ONLY', 422]],
  ['src/api/distribution.ts', 'DistributionApiError', ['TEST_ONLY', 503]],
  ['src/api/distributionFullSync.ts', 'DistributionFullSyncApiError', [422, 'TEST_ONLY']],
]) {
  test(`error class identity and descriptors preserved: ${name}`, () => {
    function describe(source) {
      const Type = execute(declaration(source, name)).api[name];
      const value = new Type(...args);
      assert.ok(value instanceof Type);
      assert.equal(value.name, name);
      const descriptors = Object.getOwnPropertyDescriptors(value);
      delete descriptors.stack;
      return plain(descriptors);
    }
    assert.deepEqual(describe(read(path)), describe(before(path)));
  });
}

for (const status of [null, 'DRAFT', 'ACTIVE', 'SUSPENDED', undefined, '', 'UNKNOWN', false, 1, {}, []]) {
  test(`branding runtime validation retained: ${JSON.stringify(status)}`, async () => {
    const item = { name: ' Local Org ', slug: 'local-org', propertyCount: 2, brandStatus: status };
    const payload = { ok: true, data: { organizations: [item] } };
    const client = execute(read('src/api/adminBranding.ts'), { payload });
    const baseline = execute(before('src/api/adminBranding.ts'), { payload });
    const valid = status === null || ['DRAFT', 'ACTIVE', 'SUSPENDED'].includes(status);
    if (valid) {
      assert.deepEqual(plain(await client.api.searchEnterpriseBrandingOrganizations(' local ')), plain(await baseline.api.searchEnterpriseBrandingOrganizations(' local ')));
    } else {
      for (const { api } of [client, baseline]) {
        await assert.rejects(api.searchEnterpriseBrandingOrganizations(' local '), error => error.code === 'ADMIN_BRANDING_RESPONSE_INVALID');
      }
    }
    assert.deepEqual(plain(client.calls), plain(baseline.calls));
    assert.equal(client.calls.length, 1);
  });
}

test('create-property coordinates and serialized request remain unchanged', async () => {
  for (const coordinates of [{ latitude: 18.15, longitude: -65.82 }, { latitude: null, longitude: null }]) {
    const input = { name: 'LOCAL TEST', checkInTime: '16:00', ...coordinates };
    const after = execute(read('src/api/properties.ts'), { payload: { ok: true } });
    const baseline = execute(before('src/api/properties.ts'), { payload: { ok: true } });
    await after.api.createProperty(input);
    await baseline.api.createProperty(input);
    assert.deepEqual(plain(after.calls), plain(baseline.calls));
    assert.deepEqual(JSON.parse(after.calls[0].options.body), input);
  }
});

for (const [status, label] of [['UPCOMING', 'UPCOMING'], ['IN_HOUSE', 'IN HOUSE'], ['CHECKED_OUT', 'CHECKED OUT'], ['CANCELLED', 'CANCELLED']]) {
  test(`reservation badge label and styling preserved: ${status}`, () => {
    const name = 'operationalBadge';
    const path = 'src/pages/property-detail/PropertyDetailPage.tsx';
    const load = source => execute('export ' + declaration(source, name)).api[name];
    const node = load(read(path))(status);
    assert.equal(node.props.children, label);
    assert.deepEqual(plain(node), plain(load(before(path))(status)));
  });
}

for (const state of [{ loading: true, user: null }, { loading: false, user: null }, { loading: false, user: { id: 'local-only' } }]) {
  test(`RequireGuest behavior preserved: ${JSON.stringify(state)}`, () => {
    const path = 'src/auth/RequireGuest.tsx';
    const options = { modules: { './AuthProvider': { useAuth: () => state } } };
    const child = { type: 'local-child', props: {} };
    assert.deepEqual(plain(execute(read(path), options).api.RequireGuest({ children: child })), plain(execute(before(path), options).api.RequireGuest({ children: child })));
  });
}
