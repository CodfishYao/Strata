#!/usr/bin/env node
/**
 * 将指定目录下的工具页改写为仅使用 Strata 主题变量与组件的版本：
 *  - 删除其它主题变量映射（--primary / --card-bg / --btn-* / --line-color / --radius-* / --color-red-500）
 *  - 卡片改用主题 .surface，表单改用主题 .ui-field，按钮用主题 .btn
 *  - 只保留工具自己的布局样式（网格、列表、分页、模态框），全部使用主题 token
 *
 * 用法：node tools/refactor-tools.js --dir <目录>
 */

import fs from "node:fs";
import path from "node:path";

const DIR = process.argv[process.argv.indexOf("--dir") + 1] ?? "./examples";

const CSS = `
/* ---------- 工具页布局：样式全部来自主题变量与组件 ---------- */
.dbwtool,
.dbptool,
.zttool {
  max-width: 900px;
  margin: 0 auto;
  line-height: 1.6;
}

.dbwtool .grid,
.dbptool .grid,
.zttool .grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.25rem;
}

.tool-header { margin: 1rem 0 2rem; text-align: center; }
.tool-title { margin: 0 0 0.4rem; font-size: 1.5rem; font-weight: 600; }
.subtitle { color: var(--fg-3); font-size: 0.9rem; }

/* 卡片内部（外观来自主题 .surface） */
.card-full { grid-column: 1 / -1; }

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.9rem;
  padding-bottom: 0.6rem;
  border-bottom: 1px solid var(--line);
}

.card-title { font-size: 1rem; font-weight: 600; }

.unit-badge {
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-sm);
  background: var(--bg-soft);
  color: var(--fg-3);
  font-size: 0.7rem;
}

.input-group { margin-bottom: 0.9rem; }
.input-group:last-child { margin-bottom: 0; }
.complex-hint { margin-top: 0.25rem; color: var(--fg-3); font-size: 0.75rem; text-align: right; }
.hint-error { color: var(--danger); }
.tips-text { margin-top: 0.5rem; color: var(--fg-2); font-size: 0.85rem; }

.btn-danger { border-color: var(--danger); background: transparent; color: var(--danger); }
.btn-danger:hover { background: var(--danger); color: #fff; }

.clear-all-btn {
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--danger);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--danger);
  font-family: inherit;
  font-size: 0.82rem;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}
.clear-all-btn:hover { background: var(--danger); color: #fff; }

.saved-data-section { margin-top: 2rem; }
.saved-data-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}
.saved-data-title { font-size: 1.05rem; font-weight: 600; }
.search-bar-row { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
.search-input { flex: 1; }

.results-list {
  margin: 0;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  list-style: none;
  overflow: hidden;
}

.list-item {
  display: grid;
  grid-template-columns: 3rem 1.6fr 1fr 1.6fr 1.2fr;
  gap: 0.5rem;
  align-items: center;
  padding: 0.7rem 1rem;
  border-bottom: 1px solid var(--line);
  font-size: 0.875rem;
}
.list-item:last-child { border-bottom: 0; }
.list-item:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); }
.list-header { background: var(--bg-soft); color: var(--fg-2); font-weight: 600; }

.text-truncate {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.text-link { color: var(--accent); text-decoration: underline; cursor: pointer; }
.empty-state { padding: 2rem; color: var(--fg-3); text-align: center; }

.action-btns { display: flex; gap: 0.4rem; }
.view-btn,
.delete-btn {
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--fg-2);
  font-family: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}
.view-btn { border-color: var(--accent-light); color: var(--accent); }
.delete-btn { border-color: var(--danger); color: var(--danger); }
.view-btn:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.delete-btn:hover { background: var(--danger); color: #fff; }

.pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 1rem;
}
.page-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; }
.page-btn {
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--bg-soft);
  color: var(--fg-2);
  font-family: inherit;
  cursor: pointer;
}
.page-btn.active { border-color: var(--accent); background: var(--accent); color: #fff; }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.page-info { color: var(--fg-3); font-size: 0.85rem; }

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 210;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.62);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.22s ease;
}
.modal-overlay.active { opacity: 1; pointer-events: all; }

.modal-content {
  width: min(92vw, 400px);
  max-height: 88vh;
  padding: 1.5rem;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--bg);
  box-shadow: 0 40px 90px -40px #000;
  overflow-y: auto;
}
.modal-content-large { max-width: 600px; }
.modal-title { margin: 0 0 1rem; font-size: 1.05rem; font-weight: 600; }
.modal-title-danger { color: var(--danger); }
.modal-body { color: var(--fg-2); font-size: 0.9rem; }
.modal-input {
  width: 100%;
  margin: 0.75rem 0;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--bg-soft);
  color: var(--fg);
  font-family: inherit;
}
.modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }

.verification-code {
  margin: 0.75rem 0;
  padding: 0.75rem;
  border: 2px dashed var(--danger);
  border-radius: var(--radius-sm);
  color: var(--danger);
  font-family: var(--font-mono);
  font-size: 1.4rem;
  letter-spacing: 0.3rem;
  text-align: center;
}

.detail-row { margin-bottom: 0.9rem; padding-bottom: 0.9rem; border-bottom: 1px solid var(--line); }
.detail-row:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: 0; }
.detail-label { color: var(--fg-3); font-size: 0.8rem; }
.detail-value { font-size: 0.95rem; word-break: break-all; }

.freq-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 7rem;
  gap: 0.5rem;
  align-items: center;
}

.rlc-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.rlc-row > div {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.rlc-row label {
  color: var(--fg-2);
  font-size: 0.8rem;
}

@media (max-width: 640px) {
  .grid { grid-template-columns: 1fr; }
  .freq-row { grid-template-columns: 1fr; }
  .rlc-row { grid-template-columns: 1fr; }
  .list-item { grid-template-columns: 1fr; }
  .list-header { display: none; }
  .search-bar-row { flex-direction: column; }
  .saved-data-header { flex-direction: column; align-items: flex-start; }
  .pagination { justify-content: center; }
}
`;

const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".html"));
let total = 0;

for (const name of files) {
  const file = path.join(DIR, name);
  let html = fs.readFileSync(file, "utf8");

  // 1) 替换整段样式
  const styleCount = (html.match(/<style[\s\S]*?<\/style>/g) || []).length;
  if (!styleCount) {
    console.log(`skip ${name}: no <style>`);
    continue;
  }
  html = html.replace(/<style[\s\S]*?<\/style>/, `<style>${CSS}</style>`);

  // 2) 给卡片和表单补上主题组件类（保留原有 class，避免破坏脚本）
  html = html.replace(/class="([^"]*)"/g, (match, value) => {
    const tokens = value.split(/\s+/).filter(Boolean);
    if (tokens.includes("card") && !tokens.includes("surface")) tokens.push("surface");
    if (tokens.includes("input-group") && !tokens.includes("ui-field")) tokens.push("ui-field");
    if (tokens.includes("saved-data-section") && !tokens.includes("surface")) tokens.push("surface");
    return `class="${tokens.join(" ")}"`;
  });

  fs.writeFileSync(file, html, "utf8");
  total++;
  console.log(`✓ ${name}`);
}

console.log(`\n完成：${total} 个文件`);
