import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

function once(text, before, after) {
  assert.equal(text.split(before).length, 2, `Non-unique audited replacement: ${before}`);
  return text.replace(before, after);
}
function emitted(source, fileName) {
  return ts.transpileModule(source, { fileName, compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    jsx: ts.JsxEmit.ReactJSX, sourceMap: false,
  }}).outputText;
}
function patch(path, expectedSha, transform, typeOnly = false) {
  assert.equal(execFileSync('git', ['hash-object', path], { encoding: 'utf8' }).trim(), expectedSha, `Audited source changed: ${path}`);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  assert.notEqual(before, after);
  if (typeOnly) assert.equal(emitted(after, path), emitted(before, path), `Runtime JavaScript must be unchanged: ${path}`);
  writeFileSync(path, after);
  console.log(`PATCHED ${path}${typeOnly ? ' — emitted JavaScript identical' : ''}`);
}

patch('src/auth/AuthProvider.tsx', '9c3bbe4ba04cd657dbe1cf669a09f49170547949', (source) => {
  let text = once(source,
    'import { fetchMeState, signalSessionActivity, type AuthSessionError } from "../api/auth";',
    'import { fetchMeState, signalSessionActivity, type AuthSessionError, type AuthenticatedUser } from "../api/auth";');
  text = once(text, 'type User = {\n  id: string;\n  email: string;\n  orgId: string;\n  role: string;\n  organizationName?: string | null;\n  organizationSlug?: string | null;\n};\n\n', '');
  text = once(text, 'user: User | null;', 'user: AuthenticatedUser | null;');
  return once(text, 'useState<User | null>(null)', 'useState<AuthenticatedUser | null>(null)');
}, true);

patch('src/pages/staff/StaffMembersPage.tsx', 'df90b90658ad99612371f1ae2b9d7f5f072c06a7', (text) =>
  once(text, 'String(me?.orgId ?? me?.organizationId ?? "")', 'String(me?.orgId ?? "")'));

patch('src/components/reviews/PublicReviewsSection.tsx', '225ecc2cb37c51273104ea03043d1483a57fa003', (text) =>
  once(text, 'dispatchPagination(\n                      pagination.loadMoreError\n                        ? { type: "RETRY" }\n                        : { type: "REQUEST_NEXT" }\n                    );', 'dispatchPagination({ type: "REQUEST_NEXT" });'));

patch('src/api/distribution.ts', '0bc3f8d7d28c1a2384c1014cf0ca0b506d6c920f', (text) => {
  const before = 'provider: "AIRBNB" | "BOOKING_COM" | "VRBO"';
  assert.equal(text.split(before).length, 4, 'Exactly three audited provider signatures');
  return text.replaceAll(before, 'provider: DistributionProvider');
}, true);
