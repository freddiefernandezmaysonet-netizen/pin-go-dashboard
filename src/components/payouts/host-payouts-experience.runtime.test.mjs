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
