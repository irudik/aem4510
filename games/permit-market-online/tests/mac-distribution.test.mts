import test from "node:test";
import assert from "node:assert/strict";
import { closedMacDistributions } from "../../../netlify/functions/_lib/permit_mac_distribution.mts";
import { macHistogram, macDistributionsHtml } from "../../../static/games/permit-market-online/mac-distribution.mjs";
const teams = [1, 2, 3].map((slope, i) => ({ id: String(i), team_name: `Firm ${i}`, baseline_emissions: 12, mac_slope: slope }));
const session = { allocation_round1: "free" };
const results = [{ round_key: "auction1", cap: 14 }];
const allocations = [4, 5, 5].map((permits_won, i) => ({ team_id: String(i), round_key: "auction1", permits_won }));
const scores = [12, 6, 4].map((abatement, i) => ({ team_id: String(i), round_key: "round1", abatement, mac_shock: 1, benchmark_price: 14 }));

test("only completed phases produce MAC distributions", () => {
  assert.deepEqual(closedMacDistributions(session, teams, [], [], []), []);
  assert.equal(closedMacDistributions(session, teams, results, allocations, []).length, 1);
  assert.equal(closedMacDistributions(session, teams, results, allocations, scores.slice(0, 2)).length, 1);
  assert.equal(closedMacDistributions(session, teams, results, allocations, scores).length, 2);
});
test("free allocation overlays initial MACs and conserves the number of firms in common bins", () => {
  const report = closedMacDistributions(session, teams, results, allocations, scores)[1];
  assert.deepEqual(report.initial_macs.map(row => row.mac), [8, 14, 21]);
  assert.deepEqual(report.macs.map(row => row.mac), [12, 12, 12]);
  assert.equal(report.benchmark_price, 14);
  const histogram = macHistogram(report);
  assert.equal(histogram.final.reduce((a, b) => a + b), 3);
  assert.equal(histogram.initial.reduce((a, b) => a + b), 3);
  assert.equal(Math.max(...histogram.final), 3);
  assert.equal(Math.max(...histogram.initial), 1);
  assert.equal(histogram.final.length, histogram.initial.length);
  const html = macDistributionsHtml([report]);
  assert.match(html, /mac-hist-initial/);
  assert.match(html, /mac-hist-price/);
  assert.match(html, /Cost-effective price: \$14.00/);
  assert.doesNotMatch(macDistributionsHtml([{ ...report, phase_closed: false }]), /mac-hist-price|Cost-effective price/);
});
test("initial and final MACs use the same realized costs, and auction rounds omit the free overlay", () => {
  const shocked = scores.map(score => ({ ...score, mac_shock: 1.5 }));
  const report = closedMacDistributions(session, teams, results, allocations, shocked)[1];
  assert.deepEqual(report.initial_macs.map(row => row.mac), [12, 21, 31.5]);
  assert.deepEqual(report.macs.map(row => row.mac), [18, 18, 18]);
  const auction = closedMacDistributions({ allocation_round1: "uniform" }, teams, results, allocations, scores)[1];
  assert.deepEqual(auction.initial_macs, []);
});
test("banked and owed permits enter the round-two initial allocation", () => {
  const reports = closedMacDistributions({ allocation_round2: "free", banking_enabled: true, borrowing_enabled: true }, [teams[0]],
    [{ round_key: "auction2", cap: 4 }], [{ round_key: "auction2", team_id: "0", permits_won: 4 }],
    [{ round_key: "round1", team_id: "0", permits_banked_out: 3, permits_borrowed_out: 1 },
      { round_key: "round2", team_id: "0", abatement: 6, mac_shock: 1, benchmark_price: 6 }]);
  assert.equal(reports[1].initial_macs[0].mac, 6);
  assert.match(macDistributionsHtml(reports), /excluding banking and borrowing/);
});
test("zero MACs fit the first bin and firm names remain text", () => {
  const report = { phase: "market1", round_key: "round1", benchmark_price: 0, initial_macs: [], macs: [{ team_name: "<script>x</script>", mac: 0 }] };
  assert.equal(macHistogram(report).final[0], 1);
  assert.doesNotMatch(macDistributionsHtml([report]), /<script>|NaN|Infinity/);
  assert.match(macDistributionsHtml([]), /Close an auction or market/);
});

test("initial-allocation histograms hide the benchmark until that round's trading closes", () => {
  for (const allocation_round1 of ["free", "uniform"]) {
    for (const current_phase of ["auction1", "market1"]) {
      const active = { allocation_round1, current_phase };
      for (const incomplete of [[], scores.slice(0, 2)]) {
        const reports = closedMacDistributions(active, teams, results, allocations, incomplete);
        assert.equal(reports[0].phase_closed, true);
        assert.equal(reports[0].benchmark_visible, false);
        assert.doesNotMatch(macDistributionsHtml(reports), /mac-hist-price|Cost-effective price/);
        assert.deepEqual(macHistogram(reports[0]),
          macHistogram({ ...reports[0], benchmark_price: 9999 }));
      }
      const closed = closedMacDistributions(active, teams, results, allocations, scores);
      assert.ok(closed.every(report => report.benchmark_visible));
      assert.equal((macDistributionsHtml(closed).match(/class="mac-hist-price"/g) ?? []).length, 1);
    }
  }
});

test("one chart per round replaces initial allocation with the overlapping trading result", () => {
  const initial = closedMacDistributions(session, teams, results, allocations, []);
  const before = macDistributionsHtml(initial);
  assert.equal((before.match(/class="mac-hist-chart"/g) ?? []).length, 1);
  assert.match(before, /Round 1: initial free allocation/);
  assert.doesNotMatch(before, /mac-hist-initial/);
  const completed = closedMacDistributions(session, teams, results, allocations, scores);
  for (const reports of [completed, [...completed].reverse()]) {
    const after = macDistributionsHtml(reports);
    assert.equal((after.match(/class="mac-hist-chart"/g) ?? []).length, 1);
    assert.match(after, /Round 1: after trading/);
    assert.match(after, /mac-hist-initial/);
    assert.match(after, /mac-hist-final/);
    assert.doesNotMatch(after, /Round 1: initial free allocation/);
  }
  const nextRound = initial.map(report => ({ ...report, round_key: "round2", phase: "auction2" }));
  const both = macDistributionsHtml([...completed, ...nextRound]);
  assert.equal((both.match(/class="mac-hist-chart"/g) ?? []).length, 2);
  assert.match(both, /Round 1: after trading/);
  assert.match(both, /Round 2: initial free allocation/);
});
