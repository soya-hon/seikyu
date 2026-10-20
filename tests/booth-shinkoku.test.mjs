import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLogic } from "./_load.mjs";

const { kyuyoShotokuR8: ky, kisoKojoR8: kiso, fuyouR8, judge, parseCSV, parseAmount, yearOf, guessColumns, aggregate } =
  loadLogic("booth-shinkoku.html", ["kyuyoShotokuR8", "kisoKojoR8", "fuyouR8", "judge", "parseCSV", "parseAmount", "yearOf", "guessColumns", "aggregate"]);

// 国税庁 No.1410 / 令和8年4月「源泉所得税の改正のあらまし」
test("給与所得（令和8年分）：最低保障74万円と特例表", () => {
  assert.equal(ky(0), 0);
  assert.equal(ky(740999), 0);
  assert.equal(ky(741000), 1000);
  assert.equal(ky(1360000), 620000);  // 扶養：給与収入136万円→所得62万円
  assert.equal(ky(1630000), 890000);  // 勤労学生：163万円→89万円
  assert.equal(ky(1970000), 1230000); // 特定親族：197万円→123万円
  assert.equal(ky(2070000), 1330000); // 配偶者特別控除：207万円→133万円
  assert.equal(ky(2190999), 1450999);
  assert.equal(ky(2191000), 1451000);
  assert.equal(ky(2193000), 1453000);
  assert.equal(ky(2196000), 1456000);
  assert.equal(ky(2200000), 1460000);
  assert.equal(ky(3600000), 2440000);
  assert.equal(ky(6600000), 4840000);
  assert.equal(ky(8500000), 6550000);
  assert.equal(ky(10000000), 8050000);
});

test("基礎控除104万円の上限：給与収入665万5,556円以下 ↔ 合計所得489万円以下", () => {
  assert.ok(ky(6655556) <= 4890000);
  assert.ok(ky(6660000) > 4890000);
});

// 国税庁 No.1199
test("基礎控除（令和8年分）の境界", () => {
  assert.equal(kiso(0), 1040000);
  assert.equal(kiso(1320000), 1040000);
  assert.equal(kiso(4890000), 1040000);
  assert.equal(kiso(4890001), 670000);
  assert.equal(kiso(6550000), 670000);
  assert.equal(kiso(6550001), 620000);
  assert.equal(kiso(23500000), 620000);
  assert.equal(kiso(23500001), 480000);
  assert.equal(kiso(24000001), 320000);
  assert.equal(kiso(24500001), 160000);
  assert.equal(kiso(25000001), 0);
});

test("扶養の目安（令和8年分）", () => {
  assert.deepEqual({ ...fuyouR8(620000) }, { fuyou: true, tokuteiShinzoku: false, haigushaTokubetsu: false, kinroGakusei: true });
  assert.equal(fuyouR8(620001).fuyou, false);
  assert.equal(fuyouR8(620001).tokuteiShinzoku, true);
  assert.equal(fuyouR8(1230000).tokuteiShinzoku, true);
  assert.equal(fuyouR8(1230001).tokuteiShinzoku, false);
  assert.equal(fuyouR8(890001).kinroGakusei, false);
});

// 国税庁 No.1900：給与1か所・年末調整あり → 給与以外の所得20万円以下は不要
test("会社員の20万円ルール（売上ではなく所得で判定）", () => {
  const base = { status: "employee", salary: 4000000, nencho: true, other: 0 };
  assert.equal(judge({ ...base, sales: 200000, fee: 0, expense: 0 }).need, false);
  assert.equal(judge({ ...base, sales: 200001, fee: 0, expense: 0 }).need, true);
  const r = judge({ ...base, sales: 300000, fee: 30000, expense: 70000 });
  assert.equal(r.sideShotoku, 200000);
  assert.equal(r.need, false);
  assert.equal(r.juminzeiNote, true); // 住民税申告の注意
  assert.equal(judge({ ...base, sales: 100000, fee: 0, expense: 0, other: 100001 }).need, true);
});

test("給与2,000万円超は申告必要", () => {
  assert.equal(judge({ status: "employee", salary: 20000001, nencho: true, sales: 0 }).need, true);
  assert.equal(judge({ status: "employee", salary: 20000000, nencho: true, sales: 0 }).need, false);
});

test("給与なし：基礎控除104万円の範囲内なら不要（課税所得は千円未満切捨て）", () => {
  const b = { status: "none", fee: 0, expense: 0 };
  assert.equal(judge({ ...b, sales: 1040000 }).need, false);
  assert.equal(judge({ ...b, sales: 1040999 }).need, false);
  assert.equal(judge({ ...b, sales: 1041000 }).need, true);
  assert.equal(judge({ ...b, sales: 1541000, shaho: 500000 }).need, true);
  assert.equal(judge({ ...b, sales: 1540999, shaho: 500000 }).need, false);
  assert.equal(judge({ ...b, salary: 5000000, nencho: true, sales: 300000 }).kyuyo, 0); // 給与欄は無視
});

test("学生：年末調整ありのバイトなら20万円ルール、扶養は合計所得で判定", () => {
  const r = judge({ status: "student", salary: 1000000, nencho: true, sales: 150000, fee: 10000, expense: 0 });
  assert.equal(r.need, false);
  assert.equal(r.gokei, 260000 + 140000);
  assert.equal(r.fuyou.fuyou, true);
  const r2 = judge({ status: "student", salary: 1360000, nencho: true, sales: 1000, fee: 0, expense: 0 });
  assert.equal(r2.fuyou.fuyou, false);
});

test("年末調整なしの給与＋副業は総合判定", () => {
  const r = judge({ status: "employee", salary: 1500000, nencho: false, sales: 300000, fee: 0, expense: 0 });
  assert.equal(r.rule, "general");
  assert.equal(r.gokei, 760000 + 300000);
  assert.equal(r.need, true); // 1,060,000−1,040,000=20,000
});

test("CSV：クォート・セル内改行・BOM・CRLF", () => {
  const rows = parseCSV('﻿注文番号,注文日時,商品名,価格,手数料\r\n1,2026/01/05 10:00,"アバター ""A""",3000,"213"\r\n2,2025-12-31,"説明\n改行",1500,128\n\n');
  assert.equal(rows.length, 3);
  assert.deepEqual([...rows[0]], ["注文番号", "注文日時", "商品名", "価格", "手数料"]);
  assert.equal(rows[1][2], 'アバター "A"');
  assert.equal(rows[2][2], "説明\n改行");
});

test("金額・日付の解析", () => {
  assert.equal(parseAmount("¥1,200"), 1200);
  assert.equal(parseAmount("１，５００円"), 1500);
  assert.equal(parseAmount("-300"), -300);
  assert.equal(parseAmount(""), 0);
  assert.equal(yearOf("2026/01/05 10:00"), 2026);
  assert.equal(yearOf("2026年3月1日"), 2026);
  assert.equal(yearOf("不明"), null);
});

test("列の推測と年別集計（手数料差引後の列にも対応）", () => {
  const rows = parseCSV("注文番号,注文日時,商品名,お支払金額,手数料\n1,2026/01/05,A,3000,213\n2,2026/06/01,B,1500,128\n3,2025/12/31,C,9999,999\n");
  const g = guessColumns(rows[0]);
  assert.deepEqual({ ...g }, { date: 1, fee: 4, amount: 3 });
  assert.deepEqual({ ...aggregate(rows.slice(1), g, 2026, false) }, { sales: 4500, fee: 341, net: 4159, count: 2, skipped: 1 });
  assert.equal(aggregate(rows.slice(1), g, null, false).count, 3);
  assert.equal(aggregate(rows.slice(1), g, 2026, true).sales, 4841);
});
