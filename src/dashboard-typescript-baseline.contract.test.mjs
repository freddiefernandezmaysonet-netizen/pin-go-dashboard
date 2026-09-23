import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const read = (path) => readFileSync(path, 'utf8');
const auth = read('src/auth/AuthProvider.tsx');
const staff = read('src/pages/staff/StaffMembersPage.tsx');
const reviews = read('src/components/reviews/PublicReviewsSection.tsx');
const distributionSource = read('src/api/distribution.ts');
const compile = (source) => ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
}}).outputText;
const moduleUrl = (code) => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');

// Pure modules only. No app startup, real session, database or provider credentials.
const pagination = await import(moduleUrl(compile(read('src/lib/publicReviewsPagination.ts'))));
const framePolicyUrl = moduleUrl(compile(read('src/lib/distributionFramePolicy.ts')));
let distributionCode = compile(distributionSource);
const frameImport = 'from "../lib/distributionFramePolicy"';
assert.equal(distributionCode.split(frameImport).length, 2);
distributionCode = distributionCode.replace(frameImport, `from ${JSON.stringify(framePolicyUrl)}`)
  .replaceAll('import.meta.env', '{"VITE_API_BASE":"https://dashboard-test.invalid"}');
const distribution = await import(moduleUrl(distributionCode));

async function withMockFetch(mock, operation) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { return await operation(); }
  finally { globalThis.fetch = original; }
}

function sourceFunction(source, name) {
  const file = ts.createSourceFile('fixture.ts', source, ts.ScriptTarget.Latest, true);
  const node = file.statements.find((item) => ts.isFunctionDeclaration(item) && item.name?.text === name);
  assert.ok(node, name);
  return { node, file };
}

test('AuthProvider consumes the canonical API user type, without fabricating a role', () => {
  assert.match(auth, /type AuthenticatedUser.*from "\.\.\/api\/auth"/);
  assert.doesNotMatch(auth, /type User\s*=/);
  assert.match(auth, /user: AuthenticatedUser \| null/);
  assert.match(auth, /useState<AuthenticatedUser \| null>\(null\)/);
  assert.equal((auth.match(/setUser\(state\.user\)/g) ?? []).length, 2);
  assert.doesNotMatch(auth, /role\s*:\s*["'](?:ADMIN|ORG_ADMIN|PLATFORM_ADMIN)["']/);
  assert.match(auth, /setSessionError\(state\.sessionError\)/);
});

test('staff uses orgId and preserves rejection when the session has no organization', () => {
  const expression = staff.match(/resolvedOrgId = (String\(me\?\.orgId \?\? ""\));/)?.[1];
  assert.ok(expression);
  const resolveOrganization = new Function('me', `return ${expression};`);
  assert.equal(resolveOrganization({ orgId: 'fixture-org' }), 'fixture-org');
  assert.equal(resolveOrganization({ orgId: 'fixture-org', organizationId: 'other-org' }), 'fixture-org');
  assert.equal(resolveOrganization({ organizationId: 'other-org' }), '');
  assert.equal(resolveOrganization(null), '');
  assert.match(staff, /if \(!resolvedOrgId\) \{\s*throw new Error\("No organizationId found in current session"\)/);
  assert.doesNotMatch(staff, /me\?\.organizationId/);
});

test('reviews retry button dispatches the implemented action and retains bilingual labels', () => {
  assert.doesNotMatch(reviews, /type:\s*["']RETRY["']/);
  assert.match(reviews, /onClick=\{\(\) => \{\s*setLoading\(true\);\s*dispatchPagination\(\{ type: "REQUEST_NEXT" \}\);/);
  assert.ok(reviews.includes('Reintentar evaluaciones'));
  assert.ok(reviews.includes('Retry reviews'));
  assert.match(reviews, /disabled=\{loading\}/);
});

test('failed page 2 retries page 2; only success allows advancing to page 3', () => {
  const reduce = pagination.publicReviewsPaginationReducer;
  const initial = pagination.INITIAL_PUBLIC_REVIEWS_PAGINATION;
  const initialCopy = structuredClone(initial);
  const first = reduce(initial, { type: 'SUCCEEDED', page: 1 });
  const request2 = reduce(first, { type: 'REQUEST_NEXT' });
  const failed = reduce(request2, { type: 'FAILED', message: 'LOAD_MORE_FAILED' });
  const retry = reduce(failed, { type: 'REQUEST_NEXT' });
  assert.equal(retry.request.page, 2);
  assert.equal(retry.loadedPage, 1);
  assert.equal(retry.request.attempt, failed.request.attempt + 1);
  assert.equal(retry.loadMoreError, '');
  const success = reduce(retry, { type: 'SUCCEEDED', page: 2 });
  assert.equal(reduce(success, { type: 'REQUEST_NEXT' }).request.page, 3);
  assert.deepEqual(initial, initialCopy);
});

test('repeated review failures never skip the uncompleted page or produce undefined state', () => {
  const reduce = pagination.publicReviewsPaginationReducer;
  let state = reduce(pagination.INITIAL_PUBLIC_REVIEWS_PAGINATION, { type: 'SUCCEEDED', page: 4 });
  for (let index = 0; index < 3; index += 1) {
    state = reduce(state, { type: 'REQUEST_NEXT' });
    assert.equal(state.request.page, 5);
    assert.equal(state.loadedPage, 4);
    state = reduce(state, { type: 'FAILED', message: 'fixture-failure' });
    assert.ok(state);
  }
});

test('all three distribution operations use the existing central provider type', () => {
  for (const name of ['prepareDistributionChannel', 'reconcileDistributionChannel', 'issueDistributionConnectionSession']) {
    const { node, file } = sourceFunction(distributionSource, name);
    assert.equal(node.parameters[1].type.getText(file), 'DistributionProvider');
  }
  assert.deepEqual([...distribution.DISTRIBUTION_PROVIDERS], ['AIRBNB', 'BOOKING_COM', 'EXPEDIA', 'VRBO']);
});

for (const provider of ['AIRBNB', 'BOOKING_COM', 'EXPEDIA', 'VRBO']) {
  test(`${provider}: mocked requests retain routes, session credentials and idempotency`, async () => {
    const calls = [];
    await withMockFetch(async (url, options) => {
      calls.push({ url, options });
      const payload = url.endsWith('/prepare') ? { ok: true, provisioningStatus: 'READY' }
        : url.endsWith('/reconcile') ? { ok: true, readiness: {} }
        : { ok: true, session: { sessionId: 'fixture-session', launchUrl: 'https://app.channex.io/fixture-session', expiresAt: '2030-01-01T00:00:00Z' } };
      return { ok: true, status: 200, json: async () => payload };
    }, async () => {
      assert.equal(await distribution.prepareDistributionChannel('fixture/property', provider), 'READY');
      await distribution.reconcileDistributionChannel('fixture/property', provider);
      assert.equal((await distribution.issueDistributionConnectionSession('fixture/property', provider)).sessionId, 'fixture-session');
    });
    assert.equal(calls.length, 3);
    for (const [index, operation] of ['prepare', 'reconcile', 'session'].entries()) {
      const { url, options } = calls[index];
      assert.equal(url, `https://dashboard-test.invalid/api/dashboard/distribution/properties/fixture%2Fproperty/channels/${provider}/${operation}`);
      assert.equal(options.method, 'POST');
      assert.equal(options.credentials, 'include');
      assert.equal(options.cache, 'no-store');
      assert.equal(options.body, '{}');
      assert.equal(options.headers['Content-Type'], 'application/json');
      assert.match(options.headers['Idempotency-Key'], new RegExp(`^ota\\.${operation}:`));
    }
  });
}

test('Expedia still rejects non-allowlisted, HTTP and credential-bearing frame URLs', async () => {
  for (const launchUrl of ['https://malicious.invalid/frame', 'http://app.channex.io/frame', 'https://user:pass@app.channex.io/frame']) {
    await withMockFetch(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, session: {
      sessionId: 'fixture-session', launchUrl, expiresAt: '2030-01-01T00:00:00Z',
    }}) }), () => assert.rejects(distribution.issueDistributionConnectionSession('fixture-property', 'EXPEDIA'), /INVALID_DISTRIBUTION_SESSION_RESPONSE/));
  }
});

test('distribution retains backend error and status instead of bypassing authorization', async () => {
  await withMockFetch(async () => ({ ok: false, status: 403, json: async () => ({ error: 'FORBIDDEN' }) }),
    () => assert.rejects(distribution.prepareDistributionChannel('fixture-property', 'EXPEDIA'),
      (error) => error instanceof distribution.DistributionApiError && error.status === 403 && error.code === 'FORBIDDEN'));
});
