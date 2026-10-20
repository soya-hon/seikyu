// `node --test site/tests` でディレクトリを指定したときのエントリ。
// 同じディレクトリの *.test.mjs をすべて読み込む（依存なし）。
const { readdirSync } = require("node:fs");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");

for (const f of readdirSync(__dirname).filter(n => n.endsWith(".test.mjs")).sort()) {
  import(pathToFileURL(join(__dirname, f)).href);
}
