import test from "node:test";
import assert from "node:assert/strict";
import { phaseControls } from "../../../static/games/permit-market-online/phase-controls.mjs";

/** Minimal input elements for testing refreshes without a browser. */
function controls() {
  const phase = Object.assign(new EventTarget(), { value: "setup" });
  const seconds = Object.assign(new EventTarget(), { value: "300" });
  const edits = phaseControls(phase, seconds);
  const session = { id: "one", current_phase: "auction1", round_seconds: 300 };
  edits.sync(session);
  return { phase, seconds, edits, session };
}

test("refreshes preserve the selected phase and timer after edits and blur", () => {
  const { phase, seconds, edits, session } = controls();
  assert.equal(phase.value, "auction1");
  phase.value = "market1";
  phase.dispatchEvent(new Event("change"));
  seconds.value = "600";
  seconds.dispatchEvent(new Event("input"));
  seconds.dispatchEvent(new Event("blur"));
  for (let i = 0; i < 5; i++) edits.sync(session);
  assert.equal(phase.value, "market1");
  assert.equal(seconds.value, "600");
});

test("successful apply restores synchronization; unsaved or failed edits remain", () => {
  const { phase, seconds, edits, session } = controls();
  phase.value = "market1";
  phase.dispatchEvent(new Event("change"));
  seconds.value = "600";
  seconds.dispatchEvent(new Event("input"));
  edits.sync(session);
  assert.equal(phase.value, "market1");
  assert.equal(seconds.value, "600");
  edits.applied({ current_phase: "market1", round_seconds: "600" });
  edits.sync({ ...session, current_phase: "auction2", round_seconds: 900 });
  assert.equal(phase.value, "auction2");
  assert.equal(seconds.value, "900");
});

test("an edit during saving survives the earlier save response", () => {
  const { phase, edits, session } = controls();
  phase.value = "auction2";
  phase.dispatchEvent(new Event("change"));
  edits.applied({ current_phase: "market1", round_seconds: "300" });
  edits.sync({ ...session, current_phase: "market1" });
  assert.equal(phase.value, "auction2");
});

test("starting another session resets pending choices to that session", () => {
  const { phase, seconds, edits } = controls();
  phase.value = "market2";
  phase.dispatchEvent(new Event("change"));
  seconds.value = "";
  seconds.dispatchEvent(new Event("input"));
  edits.sync({ id: "two", current_phase: "setup", round_seconds: 120 });
  assert.equal(phase.value, "setup");
  assert.equal(seconds.value, "120");
});
