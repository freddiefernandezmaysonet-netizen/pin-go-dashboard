import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

// Isolated test-only renderer; API and Stripe card are mocked, never mounted live.
const testRequire = createRequire(process.env.PINGO_REACT_TEST_PACKAGE);
const React = testRequire("react");
const { act, create } = testRequire("react-test-renderer");
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const source = ts.transpileModule(readFileSync("src/components/payouts/HostPayoutsExperience.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
function component(fetch) {
  const exports = {};
  vm.runInNewContext(source, { exports, require: name => {
    if (name === "react" || name === "react/jsx-runtime") return testRequire(name);
    if (name === "../../api/payouts") return { getStripeConnectV2Eligibility: fetch };
    if (name === "./StripeConnectIsolationV2Card") return {
      StripeConnectIsolationV2Card: props => React.createElement("new-payouts", props),
    };
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return exports.HostPayoutsExperience;
}
test("loading never exposes the legacy setup action", async () => {
  let renderer;
  await act(async () => { renderer = create(React.createElement(component(() => new Promise(() => {})))); });
  assert.equal(renderer.root.findByProps({ role: "status" }).type, "p");
  assert.equal(renderer.root.findAllByType("button").length, 0);
  await act(async () => renderer.unmount());
});
test("network error offers retry; success mounts only the new interface", async () => {
  let calls = 0;
  const View = component(async () => {
    if (++calls === 1) throw new Error("synthetic network error");
    return { eligibility: { eligible: true, accountCreationAllowed: false } };
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(View)); });
  assert.equal(renderer.root.findAllByProps({ role: "alert" }).length, 1);
  await act(async () => renderer.root.findByType("button").props.onClick());
  assert.equal(renderer.root.findByType("new-payouts").props.accountCreationAllowed, false);
  assert.equal(calls, 2);
  await act(async () => renderer.unmount());
});
test("old backend ineligibility is an explicit error, never legacy fallback", async () => {
  let renderer;
  await act(async () => { renderer = create(React.createElement(component(async () => ({ eligibility: { eligible: false } })))); });
  assert.equal(renderer.root.findAllByProps({ role: "alert" }).length, 1);
  assert.equal(renderer.root.findAllByType("new-payouts").length, 0);
  await act(async () => renderer.unmount());
});

const cardSource = ts.transpileModule(
  readFileSync("src/components/payouts/StripeConnectIsolationV2Card.tsx", "utf8")
    .replace("import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY", '"pk_test_mock"'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
).outputText;
const incomplete = {
  stripeConnectAccountId: "acct_mock", detailsSubmitted: false,
  status: "RESTRICTED", payoutsEnabled: false, canAcceptDirectBookingPayments: false,
};
async function mountCard(sync) {
  const elements = [];
  const exports = {};
  vm.runInNewContext(cardSource, {
    exports,
    window: { StripeConnect: { init: () => ({ create: name => {
      const element = { name, remove() {}, setOnExit(handler) { this.exit = handler; } };
      elements.push(element);
      return element;
    } }) } },
    require: name => {
      if (name === "react" || name === "react/jsx-runtime") return testRequire(name);
      if (name === "../../api/payouts") return {
        syncHostPayoutStatus: sync,
        createStripeConnectIsolationV2Account: () => { throw new Error("Account creation forbidden in this test"); },
        createStripeConnectIsolationV2AccountSession: () => { throw new Error("Real sessions forbidden in this test"); },
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(exports.StripeConnectIsolationV2Card, { accountCreationAllowed: false }), {
      createNodeMock: () => ({ replaceChildren() {} }),
    });
  });
  return { renderer, elements, text: () => JSON.stringify(renderer.toJSON()) };
}

test("onboarding exit rechecks the server, deduplicates events and switches surfaces only after confirmation", async () => {
  let calls = 0, resolve;
  const view = await mountCard(() => {
    calls++;
    return calls === 1 ? Promise.resolve({ payoutStatus: incomplete }) : new Promise(r => { resolve = r; });
  });
  const onboarding = view.elements.find(e => e.name === "account-onboarding");
  assert.equal(typeof onboarding.exit, "function");
  await act(async () => { onboarding.exit(); onboarding.exit(); });
  assert.equal(calls, 2);
  assert.match(view.text(), /Checking your Stripe status/);
  assert.equal(view.elements.some(e => e.name === "payments"), false);
  await act(async () => resolve({ payoutStatus: { ...incomplete, detailsSubmitted: true, status: "READY", payoutsEnabled: true, canAcceptDirectBookingPayments: true } }));
  assert.match(view.text(), /Ready/);
  assert.equal(view.elements.some(e => e.name === "payments"), true);
  await act(async () => onboarding.exit());
  assert.equal(calls, 2, "removed component cannot trigger another sync");
  await act(async () => view.renderer.unmount());
});

test("abandoning setup preserves restricted status and retry recovers from refresh failure", async () => {
  let calls = 0;
  const view = await mountCard(async () => {
    if (++calls === 3) throw new Error("synthetic sync failure");
    return { payoutStatus: incomplete };
  });
  const onboarding = view.elements.find(e => e.name === "account-onboarding");
  await act(async () => onboarding.exit());
  assert.match(view.text(), /Action required/);
  assert.match(view.text(), /Complete setup with your organization/);
  assert.equal(view.elements.some(e => e.name === "payments"), false);
  await act(async () => onboarding.exit());
  assert.match(view.text(), /last confirmed status/);
  assert.match(view.text(), /Action required/);
  await act(async () => view.renderer.root.findAllByType("button").find(b => b.props.children === "Try again").props.onClick());
  assert.equal(calls, 4);
  assert.equal(view.renderer.root.findAllByProps({ role: "alert" }).length, 0);
  await act(async () => view.renderer.unmount());
});

test("late exit response after unmount is ignored", async () => {
  let calls = 0, resolve;
  const view = await mountCard(() => ++calls === 1
    ? Promise.resolve({ payoutStatus: incomplete })
    : new Promise(r => { resolve = r; }));
  const onboarding = view.elements.find(e => e.name === "account-onboarding");
  await act(async () => onboarding.exit());
  await act(async () => view.renderer.unmount());
  await act(async () => resolve({ payoutStatus: { ...incomplete, detailsSubmitted: true } }));
  await act(async () => onboarding.exit());
  assert.equal(calls, 2);
  assert.deepEqual(view.elements.map(e => e.name), ["account-onboarding"]);
});
