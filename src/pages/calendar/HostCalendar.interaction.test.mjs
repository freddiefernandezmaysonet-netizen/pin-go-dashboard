import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

const temp = mkdtempSync(join(process.cwd(), ".calendar-test-"));
await build({
  entryPoints: ["src/pages/calendar/HostCalendarPage.tsx"],
  outfile: join(temp, "page.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  jsx: "automatic",
  define: { "import.meta.env": "{}" },
  loader: { ".css": "empty" },
  logLevel: "silent",
});
const { HostCalendarPage } = await import(
  pathToFileURL(join(temp, "page.mjs")).href
);
const model = await import(
  pathToFileURL(join(process.cwd(), "src/calendar/model.ts")).href
);

test("date ranges and overlapping reservations preserve checkout and separate lanes", () => {
  assert.equal(model.validDate("2026-02-30"), false);
  assert.equal(model.shiftDate("2026-12-31", 1), "2027-01-01");
  const stays = model.layoutStays(
    [
      { id: "a", from: "2026-09-29", to: "2026-10-02" },
      { id: "b", from: "2026-10-01", to: "2026-10-03" },
      { id: "c", from: "2026-10-03", to: "2026-10-05" },
    ],
    "2026-10-01",
    14,
  );
  assert.equal(stays[0].start, 0);
  assert.equal(stays[0].end, 1.5);
  assert.notEqual(stays[0].lane, stays[1].lane);
  assert.equal(stays[2].lane, 0);
});

test("host can select nights and manage them; failed refresh never retains open availability", async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "https://example.test/calendar",
  });
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let failing = false;
  const dates = model.dateKeys("2026-10-01");
  globalThis.fetch = async (url) => ({
    ok: !failing,
    json: async () =>
      String(url).includes("/calendar?")
        ? {
            from: dates[0],
            to: "2026-10-15",
            page: 1,
            total: 1,
            hasMore: false,
            items: [
              {
                id: "p1",
                name: "Casa demo",
                timezone: "America/Puerto_Rico",
                state: "READY",
                today: dates[0],
                photoUrl: null,
                reservations: [],
                blocks: [],
                days: dates.map((date) => ({
                  date,
                  rate: 90,
                  minimumNights: 2,
                  status: "OPEN",
                })),
              },
            ],
          }
        : { items: [{ id: "p1", name: "Casa demo" }] },
  });
  const root = createRoot(document.getElementById("root"));
  try {
    await act(async () => {
      root.render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/calendar?from=2026-10-01"] },
          React.createElement(HostCalendarPage),
        ),
      );
    });
    assert.equal(document.querySelectorAll(".hc-day").length, 14);
    const nights = document.querySelectorAll(".hc-day button");
    await act(async () => nights[1].click());
    await act(async () => nights[3].click());
    assert.match(
      document.querySelector(".hc-primary").getAttribute("href"),
      /from=2026-10-02&to=2026-10-04/,
    );
    assert.equal(document.querySelectorAll(".hc-day.selected").length, 3);
    failing = true;
    await act(async () => document.querySelector(".hc-heading button").click());
    assert.ok(document.querySelector('[role="alert"]'));
    assert.equal(document.querySelectorAll(".hc-day").length, 0);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    Object.assign(globalThis, previous);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
test.after(() => rmSync(temp, { recursive: true, force: true }));
