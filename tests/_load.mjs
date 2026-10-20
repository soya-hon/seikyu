// HTML内の「LOGIC-START〜LOGIC-END」ブロックだけを取り出して評価し、純関数を返す（依存なし）
import { readFileSync } from "node:fs";
import vm from "node:vm";

export function loadLogic(htmlFile, names) {
  const html = readFileSync(new URL("../" + htmlFile, import.meta.url), "utf8");
  const m = html.match(/\/\/ ===== LOGIC-START[^\n]*\n([\s\S]*?)\/\/ ===== LOGIC-END/);
  if (!m) throw new Error("logic block not found in " + htmlFile);
  const ctx = vm.createContext({});
  vm.runInContext(m[1] + `\n;globalThis.__x={${names.join(",")}};`, ctx);
  return ctx.__x;
}
