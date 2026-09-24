import { apiJson, clearStatus, setStatus } from "./shared.mjs";
import { auctionComparisonHtml } from "./auction-charts.mjs";

const tokenKey = "permit_market_admin_access_token";
const roundChoice = document.getElementById("chart-round");
const display = document.getElementById("chart-display");
const status = document.getElementById("chart-status");
const sessionName = document.getElementById("chart-session-name");
roundChoice.value = new URLSearchParams(location.search).get("round") === "auction2" ? "auction2" : "auction1";
let latestState = null;
let refreshing = false;

/** Redraw only the selected round; polling never changes the selection. */
function render() {
  sessionName.textContent = latestState?.session?.session_name ?? "No active session";
  display.innerHTML = latestState?.session ? auctionComparisonHtml(latestState, roundChoice.value, { popoutLink: false })
    : "<p>Create a session and open an auction in the Admin Dashboard.</p>";
}

/** Read the instructor's state without changing sessions, bids, or phases. */
async function refreshCharts() {
  if (refreshing) return;
  const token = localStorage.getItem(tokenKey);
  if (!token) {
    latestState = null;
    display.innerHTML = "";
    sessionName.textContent = "Instructor view";
    setStatus(status, "warn", "Sign in through the Admin Dashboard in this browser. This window will then update automatically.");
    return;
  }
  refreshing = true;
  try {
    const state = await apiJson("/api/permit-market/admin/state", { headers: { Authorization: `Bearer ${token}` } });
    // A logout during the request must not leave the previous session visible.
    if (localStorage.getItem(tokenKey) !== token) return;
    latestState = state;
    clearStatus(status);
    render();
  } catch (error) {
    latestState = null;
    display.innerHTML = "";
    sessionName.textContent = "Instructor view";
    setStatus(status, "bad", `Charts could not refresh: ${error.message}. Check the Admin Dashboard; this window will retry.`);
  } finally {
    refreshing = false;
  }
}

roundChoice.addEventListener("change", () => {
  const url = new URL(location.href);
  url.searchParams.set("round", roundChoice.value);
  history.replaceState(null, "", url);
  if (latestState) render();
});
window.addEventListener("storage", (event) => {
  if (event.key === tokenKey || event.key === null) {
    latestState = null;
    display.innerHTML = "";
    refreshCharts();
  }
});
refreshCharts();
window.setInterval(refreshCharts, 4000);
