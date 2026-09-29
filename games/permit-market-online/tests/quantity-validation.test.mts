import test from "node:test";
import assert from "node:assert/strict";
import { bindQuantityValidation } from "../../../static/games/permit-market-online/quantity-validation.mjs";

test("quantity warnings require positive integers and clear after correction", () => {
  const handlers = {};
  const input = {
    value: "",
    validationMessage: "",
    addEventListener(name, callback) { handlers[name] = callback; },
    setCustomValidity(message) { this.validationMessage = message; },
  };
  bindQuantityValidation(input);
  for (const event of ["input", "invalid"]) {
    for (const value of ["", "0", "-1", "1.5", "abc"]) {
      input.value = value;
      handlers[event]();
      assert.match(input.validationMessage, /positive integer/);
    }
    for (const value of ["1", "2", "25"]) {
      input.value = value;
      handlers[event]();
      assert.equal(input.validationMessage, "");
    }
  }
  bindQuantityValidation(null);
});
