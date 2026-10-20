import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLogic } from "./_load.mjs";

const { salesTax, niwari, sanwari, kani, gensoku } =
  loadLogic("niwari.html", ["salesTax", "niwari", "sanwari", "kani", "gensoku"]);

// 国税庁「２割特例用 消費税及び地方消費税の確定申告の手引き」設例 国税太郎
// 登録後の課税売上（税込）6,609,330円、登録後の値引き 192,900円
test("国税庁設例（国税太郎）と一致：2割特例", () => {
  const r = niwari({ s10: 6609330, r10: 192900 });
  assert.equal(r.st.ex10, 6008481); // 付表6 ①
  assert.equal(r.st.base, 6008000); // ② 課税標準額
  assert.equal(r.st.tax, 468624);   // ③ 消費税額
  assert.equal(r.st.ret, 13678);    // ④ 返還等対価に係る税額
  assert.equal(r.st.kiso, 454946);  // ⑤
  assert.equal(r.deduct, 363956);   // ⑥ 特別控除税額
  assert.equal(r.national, 90900);  // 差引税額
  assert.equal(r.local, 25600);     // 譲渡割額 納税額
  assert.equal(r.total, 116500);
});

test("2割特例：10%のみ（税込330万円）", () => {
  const r = niwari({ s10: 3300000 });
  assert.equal(r.st.base, 3000000);
  assert.equal(r.st.tax, 234000);
  assert.equal(r.deduct, 187200);
  assert.equal(r.national, 46800);
  assert.equal(r.local, 13200);
  assert.equal(r.total, 60000); // 税抜売上の2%
});

test("8%（軽減税率）の売上：税込108万円", () => {
  const st = salesTax({ s8: 1080000 });
  assert.equal(st.base8, 1000000);
  assert.equal(st.tax, 62400);
  const r = niwari({ s8: 1080000 });
  assert.equal(r.national, 12400); // 62,400−49,920=12,480→百円未満切捨て
  assert.equal(r.local, 3400);     // 12,400×22/78=3,497→3,400
});

test("千円未満切捨ての境界", () => {
  assert.equal(salesTax({ s10: 1100999 }).base, 1000000);
  assert.equal(salesTax({ s10: 1101100 }).base, 1001000);
  assert.equal(salesTax({ s10: 0 }).tax, 0);
});

test("簡易課税：みなし仕入率ごとの控除額と2割特例との比較", () => {
  const inp = { s10: 3300000 };
  assert.equal(kani(inp, 90).deduct, 210600);
  assert.equal(kani(inp, 90).total, 30000);              // 卸売業は2割特例より有利
  assert.equal(kani(inp, 80).total, niwari(inp).total);  // 80%は2割特例と同額
  assert.equal(kani(inp, 50).national, 117000);
  assert.equal(kani(inp, 50).local, 33000);
  assert.equal(kani(inp, 40).deduct, 93600);
});

test("3割特例（令和9・10年分の参考）：控除70%", () => {
  const r = sanwari({ s10: 3300000 });
  assert.equal(r.deduct, 163800);
  assert.equal(r.national, 70200);
  assert.equal(r.local, 19800);
});

test("原則課税：仕入税額を控除、仕入超過は還付", () => {
  const r = gensoku({ s10: 3300000, p10: 550000 });
  assert.equal(r.deduct, 39000);
  assert.equal(r.national, 195000);
  assert.equal(r.local, 55000);
  const refund = gensoku({ s10: 1100000, p10: 2200000 });
  assert.equal(refund.national, 78000 - 156000);
  assert.equal(refund.local, -22000);
});

test("売上ゼロなら納付ゼロ", () => {
  assert.equal(niwari({}).total, 0);
  assert.equal(kani({}, 50).total, 0);
});
