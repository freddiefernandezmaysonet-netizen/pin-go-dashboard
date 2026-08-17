import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("public booking contacts the organization instead of Pin&Go support", async () => {
  const source = await readFile(
    new URL("./PublicPropertyDetailPage.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /contactEmail:\s*string/);
  assert.match(
    source,
    /mailto:\$\{property\.organization\.contactEmail\}/
  );
  assert.match(
    source,
    /<strong>\{property\.organization\.contactEmail\}<\/strong>/
  );
  assert.doesNotMatch(source, /support@pin-ngo\.com/);
});
