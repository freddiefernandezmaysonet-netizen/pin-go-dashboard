import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const pagePath = new URL("./ConnectionCenterPage.tsx", import.meta.url);
const page = readFileSync(pagePath, "utf8");
const ast = ts.createSourceFile("ConnectionCenterPage.tsx", page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function functionSource(name) {
  let found;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(found, `Missing function ${name}`);
  return found.getText(ast);
}

// Execute actual extracted handlers with test doubles. These are not browser/E2E tests.
function loadFunctions(names, globals = {}) {
  const source = names.map(functionSource).join("\n");
  const result = ts.transpileModule(source, {
    fileName: "handlers.tsx", reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const errors = (result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0);
  return vm.runInNewContext(`${result.outputText}\n({${names.join(",")}})`, globals);
}

function channel(overrides = {}) {
  return { provider: "BOOKING_COM", name: "Booking.com", status: "NOT_CONNECTED", channelLinked: false, availability: "AVAILABLE", ...overrides };
}

const pure = loadFunctions(["isBookingComConnectionExisting", "statusLabel", "providerPresentation"]);

function connectHarness(currentChannel, { simulated = false, prepareError, sessionError } = {}) {
  const calls = [];
  const state = { session: null, error: null, notice: null };
  class DistributionApiError extends Error { constructor(code) { super(code); this.code = code; } }
  const globals = {
    id: "property-test",
    simulated,
    center: { channels: currentChannel ? [currentChannel] : [] },
    DistributionApiError,
    setBusyProvider: value => { state.busy = value; },
    setError: value => { state.error = value; },
    setNotice: value => { state.notice = value; },
    setFrameReady: value => { state.ready = value; },
    setSession: value => { state.session = value; },
    prepareDistributionChannel: async (id, provider) => {
      calls.push(["prepare", id, provider]);
      if (prepareError) throw new Error("test preparation failure");
    },
    issueDistributionConnectionSession: async (id, provider) => {
      calls.push(["session", id, provider]);
      if (sessionError) throw sessionError === "disabled"
        ? new DistributionApiError("OTA_CONNECTION_CENTER_RUNTIME_DISABLED")
        : new Error("test session failure");
      return { sessionId: "test-session", launchUrl: "https://example.invalid/setup", expiresAt: "2026-09-13T22:00:00.000Z" };
    },
    issueAirbnbHostConnectionLink: async id => {
      calls.push(["airbnb-link", id]);
      return { authorizationUrl: "https://example.invalid/airbnb" };
    },
    window: { location: { assign: url => { calls.push(["redirect", url]); } } },
  };
  const { connect } = loadFunctions(["isBookingComConnectionExisting", "connect"], globals);
  return { connect, calls, state };
}

function completionHarness({ simulated = false, provider = "BOOKING_COM", fault, waitForReconcile, sessionMissing = false, savedStatus = "READINESS_CHECK" } = {}) {
  const calls = [];
  const state = {};
  const sessionCompletionInFlight = { current: false };
  const { completeSession, closeSession } = loadFunctions(["completeSession", "closeSession"], {
    id: "property-test",
    simulated,
    sessionCompletionInFlight,
    session: sessionMissing ? null : { provider, value: { sessionId: "test-session" } },
    setCompleting: value => { state.completing = value; },
    setBusyProvider: value => { state.busy = value; },
    setSession: value => { state.session = value; },
    setFrameReady: value => { state.ready = value; },
    setNotice: value => { state.notice = value; },
    setError: value => { state.error = value; },
    setCenter: () => { throw new Error("Must not promote channel state in the browser"); },
    transitionDistributionConnectionSession: async (id, next) => {
      calls.push(["transition", id, next]);
      if (fault === "transition") throw new Error("test transition failure");
    },
    reconcileDistributionChannel: async (id, provider) => {
      calls.push(["reconcile", id, provider]);
      if (waitForReconcile) await waitForReconcile;
      if (fault === "reconcile") throw new Error("test reconcile failure");
    },
    load: async () => {
      calls.push(["reload"]);
      state.error = null; // The actual load clears old errors; reconciliation failures must survive it.
      if (fault === "reload") throw new Error("test reload failure");
      state.savedStatus = savedStatus;
    },
  });
  return { completeSession, closeSession, calls, state, sessionCompletionInFlight };
}

test("ConnectionCenterPage TSX transpiles without syntax diagnostics", () => {
  const result = ts.transpileModule(page, {
    fileName: "ConnectionCenterPage.tsx", reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  assert.equal((result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
});

test("existing-connection predicate is exclusive to Booking.com", () => {
  assert.equal(pure.isBookingComConnectionExisting(undefined), false);
  assert.equal(pure.isBookingComConnectionExisting(channel()), false);
  assert.equal(pure.isBookingComConnectionExisting(channel({ channelLinked: true })), true);
  assert.equal(pure.isBookingComConnectionExisting(channel({ status: "ACTIVE" })), true);
  for (const provider of ["AIRBNB", "EXPEDIA", "VRBO"]) {
    assert.equal(pure.isBookingComConnectionExisting(channel({ provider, channelLinked: true, status: "ACTIVE" })), false);
  }
});

test("linked Booking.com does not become ACTIVE merely through presentation", () => {
  const input = channel({ channelLinked: true, status: "MAPPING_REQUIRED" });
  const result = pure.providerPresentation(input, false);
  assert.equal(result.status, "Setup required");
  assert.match(result.description, /Booking.com is linked/);
  assert.equal(input.status, "MAPPING_REQUIRED");
  assert.equal(pure.providerPresentation(channel({ channelLinked: true, status: "FAILED" }), false).tone, "warning");
});

test("existing and new connections have distinct actions and onboarding visibility", () => {
  assert.match(page, /isBookingComConnectionExisting\(channel\) \? "Manage Booking.com"/);
  assert.match(page, /canConnect && channel\.provider === "BOOKING_COM" && !isBookingComConnectionExisting\(channel\)/);
  assert.match(page, /SELF_SERVICE\.has\(channel\.provider\) && !airbnbChannelLinked/);
  assert.match(page, /channel\.provider === "AIRBNB" \? "Connect Airbnb" : `Connect \$\{channel\.name\}`/);
});

test("guide follows documented extranet request, pending mapping and Hotel ID steps", () => {
  const guide = functionSource("BookingComConnectionGuide");
  assert.match(guide, /Account → Connectivity Provider/);
  assert.match(guide, /Channex.io/);
  assert.match(guide, /Hotel ID/);
  assert.match(guide, /Mapping can begin while the request is pending/);
  assert.match(guide, /activation must wait for acceptance/);
  assert.doesNotMatch(guide, /<input|<form|fetch\(|axios\./);
  assert.match(guide, /props\.simulated \?/);
  assert.match(guide, /href="https:\/\/account\.booking\.com\/" target="_blank" rel="noopener noreferrer"/);
});

test("new Booking.com prepares then requests one secure session", async () => {
  const h = connectHarness(channel());
  await h.connect("BOOKING_COM");
  assert.deepEqual(h.calls, [["prepare", "property-test", "BOOKING_COM"], ["session", "property-test", "BOOKING_COM"]]);
  assert.equal(h.state.session.provider, "BOOKING_COM");
  assert.equal(h.state.busy, null);
});

for (const status of ["MAPPING_REQUIRED", "ACTIVE", "FAILED"]) {
  test(`linked Booking.com ${status} opens its session without repeating preparation`, async () => {
    const h = connectHarness(channel({ channelLinked: true, status }));
    await h.connect("BOOKING_COM");
    assert.deepEqual(h.calls, [["session", "property-test", "BOOKING_COM"]]);
  });
}

test("ACTIVE Booking.com without channelLinked still avoids preparing a second connection", async () => {
  const h = connectHarness(channel({ status: "ACTIVE", channelLinked: false }));
  await h.connect("BOOKING_COM");
  assert.deepEqual(h.calls, [["session", "property-test", "BOOKING_COM"]]);
});

test("Booking.com simulation issues no API call or external navigation", async () => {
  const h = connectHarness(channel(), { simulated: true });
  await h.connect("BOOKING_COM");
  assert.deepEqual(h.calls, []);
  assert.equal(h.state.session.value.sessionId, "simulation-BOOKING_COM");
});

test("Airbnb retains preparation, provider authorization link and redirect", async () => {
  const h = connectHarness(channel({ provider: "AIRBNB" }));
  await h.connect("AIRBNB");
  assert.deepEqual(h.calls, [
    ["prepare", "property-test", "AIRBNB"],
    ["airbnb-link", "property-test"],
    ["redirect", "https://example.invalid/airbnb"],
  ]);
  assert.equal(h.state.session, null);
});

test("a failed new-connection preparation does not request a session", async () => {
  const h = connectHarness(channel(), { prepareError: true });
  await h.connect("BOOKING_COM");
  assert.deepEqual(h.calls, [["prepare", "property-test", "BOOKING_COM"]]);
  assert.ok(h.state.error);
  assert.equal(h.state.session, null);
});

test("a failed management session never falls back to prepare or automatic retries", async () => {
  const h = connectHarness(channel({ channelLinked: true }), { sessionError: true });
  await h.connect("BOOKING_COM");
  assert.deepEqual(h.calls, [["session", "property-test", "BOOKING_COM"]]);
  assert.ok(h.state.error);
  assert.equal(h.state.session, null);
});

test("runtime disabled remains an explicit unavailable notice", async () => {
  const h = connectHarness(channel({ channelLinked: true }), { sessionError: "disabled" });
  await h.connect("BOOKING_COM");
  assert.match(h.state.notice, /not yet available for commercial use/);
  assert.equal(h.state.session, null);
});

test("closing Booking.com completes the local session, reconciles exactly that property, then reloads saved status", async () => {
  const h = completionHarness();
  await h.completeSession();
  assert.deepEqual(h.calls, [["transition", "test-session", "completed"], ["reconcile", "property-test", "BOOKING_COM"], ["reload"]]);
  assert.match(h.state.notice, /closing does not confirm activation/);
  assert.equal(h.state.savedStatus, "READINESS_CHECK");
  assert.equal(h.state.session, null);
  assert.equal(h.state.completing, false);
});

test("simulation completion still changes no remote session", async () => {
  const h = completionHarness({ simulated: true });
  await h.completeSession();
  assert.deepEqual(h.calls, [["reload"]]);
  assert.equal(h.state.notice, "Simulation complete. No data was changed.");
});

test("non-Booking completion retains its existing notice and does not reconcile", async () => {
  const h = completionHarness({ provider: "AIRBNB" });
  await h.completeSession();
  assert.equal(h.state.notice, "Connection submitted for validation.");
  assert.deepEqual(h.calls, [["transition", "test-session", "completed"], ["reload"]]);
});

test("Booking.com frame labels do not imply activation or rollback", () => {
  const frame = functionSource("ConnectionFrame");
  assert.match(frame, /props\.bookingCom \? "Close and refresh" : "Finish connection"/);
  assert.match(frame, /props\.bookingCom \? "Close window" : "Cancel"/);
  assert.match(frame, /does not undo changes saved here or confirm activation/);
  assert.match(page, /bookingCom=\{session\.provider === "BOOKING_COM"\}/);
  assert.match(frame, /sandbox="allow-forms allow-popups allow-scripts allow-same-origin"/);
});

test("tenant-admin guards and the existing Airbnb-only activation surface remain", () => {
  assert.match(page, /if \(!id\) return <Navigate to="\/properties" replace \/>/);
  assert.match(page, /!user \|\| !ADMIN_ROLES\.has\(user\.role\)/);
  assert.match(page, /airbnbChannelLinked && !simulated/);
  assert.match(page, /<AirbnbActivationPanel/);
  assert.doesNotMatch(page, /\/mappings|\/activate|load_future_reservations/);
});

test("failed reconciliation still reloads persisted status and leaves a visible failure without retrying", async () => {
  const h = completionHarness({ fault: "reconcile" });
  await h.completeSession();
  assert.deepEqual(h.calls, [["transition", "test-session", "completed"], ["reconcile", "property-test", "BOOKING_COM"], ["reload"]]);
  assert.match(h.state.error, /couldn't refresh Booking.com/);
  assert.match(h.state.error, /not undone/);
  assert.equal(h.state.notice, null);
  assert.equal(h.state.completing, false);
  assert.equal(h.state.busy, null);
});

test("failed session completion never starts reconciliation or reloading", async () => {
  const h = completionHarness({ fault: "transition" });
  await h.completeSession();
  assert.deepEqual(h.calls, [["transition", "test-session", "completed"]]);
  assert.match(h.state.error, /couldn't complete/);
  assert.equal(h.state.notice, null);
  assert.equal(h.sessionCompletionInFlight.current, false);
});

test("no session causes no operation", async () => {
  const h = completionHarness({ sessionMissing: true });
  await h.completeSession();
  assert.deepEqual(h.calls, []);
});

test("duplicate clicks cannot duplicate completion or reconciliation and Close cannot race them", async () => {
  let release;
  const waitForReconcile = new Promise(resolve => { release = resolve; });
  const h = completionHarness({ waitForReconcile });
  const first = h.completeSession();
  await new Promise(setImmediate);
  assert.equal(h.sessionCompletionInFlight.current, true);
  await h.completeSession();
  await h.closeSession();
  assert.deepEqual(h.calls, [["transition", "test-session", "completed"], ["reconcile", "property-test", "BOOKING_COM"]]);
  release();
  await first;
  assert.deepEqual(h.calls.at(-1), ["reload"]);
  assert.equal(h.sessionCompletionInFlight.current, false);
});

test("ordinary Close window only closes the session, never reconciles or deactivates", async () => {
  const h = completionHarness();
  await h.closeSession();
  assert.deepEqual(h.calls, [["transition", "test-session", "cancelled"]]);
});

test("simulation Close window has no remote effects", async () => {
  const h = completionHarness({ simulated: true });
  await h.closeSession();
  assert.deepEqual(h.calls, []);
});

test("all returned lifecycle states remain server-owned after completion", async () => {
  for (const savedStatus of ["NOT_CONNECTED", "AUTHORIZATION_REQUIRED", "MAPPING_REQUIRED", "READINESS_CHECK", "ACTIVATION_PENDING", "ACTIVE", "DEGRADED", "FAILED", "DISCONNECTED"]) {
    const h = completionHarness({ savedStatus });
    await h.completeSession();
    assert.equal(h.state.savedStatus, savedStatus);
    assert.match(h.state.notice, /closing does not confirm activation/);
  }
});

test("close button is disabled while completion is running", () => {
  assert.match(functionSource("ConnectionFrame"), /onClick=\{props\.onClose\} disabled=\{props\.completing\} aria-label="Close connection"/);
});

test("completion has no provisioning, activation, sync, booking import or polling operation", () => {
  const source = functionSource("completeSession");
  assert.doesNotMatch(source, /prepareDistributionChannel|issueDistributionConnectionSession|confirmAirbnbHostMapping|activateAirbnb|FullSync|load_future_reservations|setInterval|setTimeout|\bfetch\(/);
  assert.equal((source.match(/await reconcileDistributionChannel\(/g) || []).length, 1);
});

test("reload failure is not presented as successful completion", async () => {
  const h = completionHarness({ fault: "reload" });
  await h.completeSession();
  assert.ok(h.state.error);
  assert.equal(h.state.notice, null);
  assert.equal(h.state.completing, false);
});
