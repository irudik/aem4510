import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const studentScriptPath = resolve(
  import.meta.dirname,
  "../../../static/games/emissions-trading-online/student.mjs",
);
const studentHtmlPath = resolve(
  import.meta.dirname,
  "../../../static/games/emissions-trading-online/student.html",
);
const studentScriptSource = readFileSync(studentScriptPath, "utf8");
const studentHtmlSource = readFileSync(studentHtmlPath, "utf8");

/**
 * Ensure numeric student answers are not restricted to integer steps.
 * @param {string} inputId
 */
function assertInputAllowsDecimals(inputId) {
  const inputTagPattern = new RegExp(`<input[^>]*id="${inputId}"[^>]*>`);
  const match = studentScriptSource.match(inputTagPattern);

  assert.ok(match, `Missing input tag for ${inputId}`);
  assert.match(match[0], /step="any"/, `${inputId} must use step="any"`);
}

test("student answer inputs allow decimal values", () => {
  const inputIds = [
    "uniform-emissions",
    "uniform-abatement",
    "uniform-cost",
    "price-abatement",
    "md-efficient-emissions",
    "md-industry-cap",
  ];

  for (const inputId of inputIds) {
    assertInputAllowsDecimals(inputId);
  }
});

test("student portal includes nearest-integer input guidance", () => {
  assert.match(
    studentHtmlSource,
    /You can enter answers to the nearest integer\./,
    "Student instructions should tell users nearest-integer answers are allowed",
  );
});

test("MD stage guidance text includes marginal damages and MAC-type counts", () => {
  assert.match(
    studentScriptSource,
    /Marginal damages =/,
    "MD guidance should show marginal damages in the stage bubble",
  );
  assert.match(
    studentScriptSource,
    /Firms by MAC:/,
    "MD guidance should show firm counts by MAC type",
  );
  assert.match(
    studentScriptSource,
    /efficient industry cap/,
    "MD guidance should tell students why the MAC counts are shown",
  );
});
