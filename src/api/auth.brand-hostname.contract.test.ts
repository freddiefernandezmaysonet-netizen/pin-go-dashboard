import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function readAuthApi() {
  return readFile(new URL("./auth.ts", import.meta.url), "utf8");
}

test("session requests identify the browser-visible brand hostname", async () => {
  const source = await readAuthApi();

  assert.match(
    source,
    /window\.location\.hostname\.trim\(\)\.toLowerCase\(\)/
  );
  assert.match(source, /"X-Pin-Go-Brand-Hostname": hostname/);

  const headerCalls = source.match(/brandHostnameHeader\(\)/g) ?? [];
  assert.equal(headerCalls.length, 4);
  assert.match(
    source,
    /fetch\(`\$\{API_BASE\}\/auth\/me`[\s\S]*?headers: brandHostnameHeader\(\)/
  );
  assert.match(
    source,
    /fetch\(`\$\{API_BASE\}\/auth\/login`[\s\S]*?\.\.\.brandHostnameHeader\(\)/
  );
  assert.match(
    source,
    /fetch\(`\$\{API_BASE\}\/auth\/logout`[\s\S]*?headers: brandHostnameHeader\(\)/
  );
});
