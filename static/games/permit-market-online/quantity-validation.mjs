/** Explain whole-permit restrictions in the browser's validation warning. */
export function bindQuantityValidation(input) {
  if (!input) return;
  const validate = () => {
    const quantity = Number(input.value);
    input.setCustomValidity(Number.isInteger(quantity) && quantity > 0
      ? "" : "Enter a positive integer for quantity (1, 2, 3, …).");
  };
  input.addEventListener("input", validate);
  input.addEventListener("invalid", validate);
}
