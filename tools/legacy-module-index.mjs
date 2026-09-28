// Rebuilds the mechanical index in docs/legacy-module-index.md.
// It only reads the unpacked legacy bundle; it never executes legacy code.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('C:/ProgramData/cocos/editors/Creator/3.8.6/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const legacyRoot = 'E:/json/smoke_wxd0b7dafebccb8110_unpacked';
const outputPath = new URL('../docs/legacy-module-index.md', import.meta.url);
const files = ['appservice.app.js', ...Array.from({ length: 10 }, (_, i) => `chunk_${i}.appservice.js`)];
const modules = new Map();

for (const file of files) {
  const content = fs.readFileSync(path.join(legacyRoot, file), 'utf8');
  const starts = [...content.matchAll(/define\("([^"]+)",function\(/g)];
  for (let i = 0; i < starts.length; i += 1) {
    const name = starts[i][1];
    if (name.startsWith('@swc/') || name.startsWith('vendor/')) continue;
    const start = starts[i].index;
    const next = i + 1 < starts.length ? starts[i + 1].index : content.length;
    const block = content.slice(start, next);
    const end = block.indexOf(`currentFile:'${name}'`);
    if (end < 0 || modules.has(name)) continue;
    modules.set(name, { file, code: block.slice(0, end) });
  }
}

const rows = [];
for (const [name, { file, code }] of [...modules.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const exports = new Set([...code.matchAll(/get ([A-Za-z_$][\w$]*)\(\)/g)].map((m) => m[1]));
  for (const match of code.matchAll(/Object\.defineProperty\(exports,"([^"]+)"/g)) {
    if (match[1] !== '__esModule') exports.add(match[1]);
  }
  const methods = new Set([...code.matchAll(/\{key:"([^"]+)",value:function/g)].map((m) => m[1]));
  const source = ts.createSourceFile(name, code, ts.ScriptTarget.ES2020, true, ts.ScriptKind.JS);
  function propertyName(node) {
    if (!node) return '';
    if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
    return '';
  }
  function collectObject(object) {
    if (!ts.isObjectLiteralExpression(object)) return;
    for (const prop of object.properties) {
      const key = propertyName(prop.name);
      if (!key) continue;
      if (key === 'methods' && ts.isPropertyAssignment(prop)) {
        collectObject(prop.initializer);
      } else if (ts.isMethodDeclaration(prop) ||
        (ts.isPropertyAssignment(prop) && (ts.isFunctionExpression(prop.initializer) || ts.isArrowFunction(prop.initializer)))) {
        methods.add(key);
      }
    }
  }
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
      ['Component', 'Page', 'App', 'Behavior'].includes(node.expression.text) && node.arguments.length) {
      collectObject(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  rows.push({ name, file, exports: [...exports].sort(), methods: [...methods].sort() });
}

const lines = [
  '# 旧包模块／方法静态索引',
  '',
  '由 `tools/legacy-module-index.mjs` 从旧微信编译包生成；只解析代码，不运行旧包。统计排除 @swc 运行时及 vendor。详细规则见 `legacy-rules.md`，与当前实现差异见 `legacy-vs-current.md`。',
  '',
  `共索引 ${rows.length} 个模块。表中“导出”是静态可识别的公开名称；“方法”是小程序 Page/Component/App/Behavior 方法与编译后类成员名。匿名回调和未导出的内部函数不在此索引，不能将此表当成逐方法语义证明。`,
  '',
];
const code = (value) => '`' + value + '`';
for (const group of ['app', 'behaviors', 'config', 'domain', 'presentation', 'services', 'components', 'pages']) {
  const selected = rows.filter(({ name }) => name === group + '.js' || name.startsWith(group + '/'));
  if (!selected.length) continue;
  lines.push(`## ${group}（${selected.length}）`, '', '| 模块（所在编译文件） | 导出 | 静态可识别方法 |', '| --- | --- | --- |');
  for (const row of selected) {
    lines.push(`| ${code(row.name)}（${row.file}） | ${row.exports.length ? row.exports.map(code).join('、') : '—'} | ${row.methods.length ? row.methods.map(code).join('、') : '—'} |`);
  }
  lines.push('');
}
fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
console.log(`Wrote ${outputPath.pathname}: ${rows.length} modules`);
