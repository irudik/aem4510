export async function apiJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`Non-JSON response from ${url}: ${text}`);
    }
  }

  if (!response.ok) {
    const errorMessage = payload?.error || `${response.status} ${response.statusText}`;
    throw new Error(errorMessage);
  }

  return payload;
}

export function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function setStatus(element, tone, message) {
  element.className = `status ${tone}`;
  element.textContent = message;
  element.classList.remove("hidden");
}

export function clearStatus(element) {
  element.className = "status hidden";
  element.textContent = "";
}

export function phaseLabel(phase) {
  if (!phase) {
    return "unknown";
  }
  return String(phase).replaceAll("_", " ");
}

export function toCsv(rows) {
  if (!rows.length) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const escaped = (value) => {
    const raw = value == null ? "" : String(value);
    if (raw.includes(",") || raw.includes("\n") || raw.includes('"')) {
      return `"${raw.replaceAll('"', '""')}"`;
    }
    return raw;
  };

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escaped(row[header])).join(","));
  }

  return `${lines.join("\n")}\n`;
}

export function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}
