/** Preserve unapplied instructor choices while the dashboard refreshes. */
export function phaseControls(phaseInput, secondsInput) {
  const fields = [
    { input: phaseInput, key: "current_phase", edited: false },
    { input: secondsInput, key: "round_seconds", edited: false },
  ];
  let sessionId;
  for (const field of fields) {
    for (const event of ["input", "change"]) {
      field.input.addEventListener(event, () => { field.edited = true; });
    }
  }
  return {
    sync(session) {
      const changedSession = sessionId !== session?.id;
      sessionId = session?.id;
      for (const field of fields) {
        if (changedSession) field.edited = false;
        if (!field.edited && session?.[field.key] != null) {
          field.input.value = String(session[field.key]);
        }
      }
    },
    applied(submitted) {
      for (const field of fields) {
        // Keep any further edit made while the save request was running.
        if (field.input.value === submitted[field.key]) field.edited = false;
      }
    },
  };
}
