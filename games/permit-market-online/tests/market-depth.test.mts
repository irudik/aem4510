import test from "node:test";
import assert from "node:assert/strict";
import { depthLevels, marketDepthHtml } from "../../../static/games/permit-market-online/market-depth.mjs";
import { bookLevels } from "../../../netlify/functions/_lib/permit_market.mts";

test("depth aggregates equal prices and accumulates from each side's best offer", () => {
  const levels = [{ price: 5, quantity: 2 }, { price: 8, quantity: 3 }, { price: 5, quantity: 4 }];
  assert.deepEqual(depthLevels(levels, "bid"), [
    { price: 8, quantity: 3, cumulative: 3 }, { price: 5, quantity: 6, cumulative: 9 },
  ]);
  assert.deepEqual(depthLevels(levels, "ask"), [
    { price: 5, quantity: 6, cumulative: 6 }, { price: 8, quantity: 3, cumulative: 9 },
  ]);
  assert.equal(levels.length, 3);
});

test("depth counts remaining permits, not original or filled quantities", () => {
  const book = bookLevels([
    { side: "bid", price: 5, quantity: 10, remaining_quantity: 3 },
    { side: "bid", price: 5, quantity: 4, remaining_quantity: 0 },
    { side: "ask", price: 7, quantity: 9, remaining_quantity: 2 },
  ]);
  assert.equal(depthLevels(book.bids, "bid")[0].cumulative, 3);
  assert.equal(depthLevels(book.asks, "ask")[0].cumulative, 2);
  const html = marketDepthHtml(book);
  assert.match(html, /Spread \$2/);
  assert.match(html, /depth-line depth-bid/);
  assert.match(html, /depth-line depth-ask/);
});

test("empty, one-sided, zero-price, and closed books have clear labels and finite coordinates", () => {
  assert.match(marketDepthHtml({}), /No open buy or sell orders/);
  for (const book of [{ bids: [{ price: 0, quantity: 1 }] }, { asks: [{ price: 7, quantity: 2 }] }]) {
    const html = marketDepthHtml(book, { closed: true });
    assert.doesNotMatch(html, /NaN|Infinity/);
    assert.match(html, /Market closed/);
    assert.match(html, /No (buy|sell) orders/);
    assert.doesNotMatch(html, /Spread/);
  }
});

test("invalid prices and quantities cannot enter chart markup", () => {
  assert.deepEqual(depthLevels([{ price: '<script>', quantity: 2 }, { price: -1, quantity: 2 },
    { price: 3, quantity: 0 }, { price: 4, quantity: Infinity }], "bid"), []);
});
