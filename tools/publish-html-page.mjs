#!/usr/bin/env node
/**
 * 把 HTML 文件发布成 Halo 独立页面（不需要 Markdown / HTML 编辑器插件）。
 *
 *   node tools/publish-html-page.mjs \
 *     --file ".\examples\example-tool.html" \
 *     --title "dBm 与瓦特互换" \
 *     --slug tools/dbm-watt \
 *     --theme-css
 *
 * 认证：HALO_URL（默认 http://localhost:8090）、HALO_USER、HALO_PASS
 * 可选：
 *   --name <name>     页面 metadata.name（默认由 slug 推导）
 *   --template <file> 模板文件（默认 raw.html，即「空白页面」）
 *   --draft           只存草稿，不发布
 *   --theme-css       把文件里的 <style> 追加到主题设置「SEO → 自定义 head 代码」
 *
 * 说明：Halo 会过滤正文里的 <style>，所以样式需要走 --theme-css（或手动放到自定义 head）。
 */

import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function arg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : "true";
}

function credential() {
  const user = process.env.HALO_USER;
  const pass = process.env.HALO_PASS;
  if (!user || !pass) {
    throw new Error("请通过 HALO_USER 与 HALO_PASS 环境变量提供管理账号");
  }
  return { user, pass };
}

const base = (process.env.HALO_URL ?? "http://localhost:8090").replace(/\/$/, "");
const { user, pass } = credential();
const auth = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;

async function api(method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: auth,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} -> ${response.status}\n${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : null;
}

const file = arg("file");
const title = arg("title");
const slug = arg("slug");
const template = arg("template", "raw.html");
const draft = arg("draft") === "true";
const withThemeCss = arg("theme-css") === "true";

if (!file || !title || !slug) {
  console.error(
    "用法: node tools/publish-html-page.mjs --file <html> --title <标题> --slug <路径> [--name <name>] [--template raw.html] [--draft] [--theme-css]",
  );
  process.exit(1);
}

const source = await readFile(file, "utf8");
const styleBlocks = [...source.matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi)].map((m) => m[0]);
const html = styleBlocks.length ? source.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "") : source;

const name =
  arg("name", slug.replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "")) || `page-${Date.now()}`;

async function findPage() {
  const response = await fetch(`${base}/apis/content.halo.run/v1alpha1/singlepages/${name}`, {
    headers: { Authorization: auth },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`查询页面失败: ${response.status}`);
  return response.json();
}

let page = await findPage();

if (!page) {
  await api("POST", "/apis/content.halo.run/v1alpha1/singlepages", {
    apiVersion: "content.halo.run/v1alpha1",
    kind: "SinglePage",
    metadata: { name, labels: {} },
    spec: {
      title,
      slug,
      template,
      visible: "PUBLIC",
      publish: false,
      allowComment: false,
      priority: 0,
      pinned: false,
      cover: "",
      deleted: false,
      owner: user,
      excerpt: { autoGenerate: true, raw: "" },
      baseSnapshot: "",
      headSnapshot: "",
      releaseSnapshot: "",
    },
  });
  console.log(`✓ 新建页面 ${name}`);
} else {
  console.log(`✓ 更新已存在的页面 ${name}`);
}

// 1) 写入正文（使用 console 的内容接口，它会生成合法的快照链）
const withContent = await api(
  "PUT",
  `/apis/api.console.halo.run/v1alpha1/singlepages/${name}/content`,
  { raw: html, content: html, rawType: "html" },
);

// 2) 让页面引用刚写入的快照（baseSnapshot 必须指向带正文的快照）
page = await findPage();
const snapshot = withContent?.spec?.headSnapshot ?? page.spec.headSnapshot;
page.spec.title = title;
page.spec.slug = slug;
page.spec.template = template;
page.spec.baseSnapshot = snapshot;
page.spec.publish = !draft;
await api("PUT", `/apis/content.halo.run/v1alpha1/singlepages/${name}`, page);

// 3) 发布
if (!draft) {
  await api("PUT", `/apis/api.console.halo.run/v1alpha1/singlepages/${name}/publish`, {});
}

// 4) 可选：把 <style> 追加到主题的自定义 head
if (withThemeCss && styleBlocks.length) {
  const configMap = await api("GET", "/api/v1alpha1/configmaps/strata-configMap");
  const seo = JSON.parse(configMap.data.seo ?? "{}");
  const marker = `/* ${name} */`;
  const css = styleBlocks.map((block) => block.replace(/<\/?style[^>]*>/gi, "")).join("\n");
  const existing = String(seo.custom_head ?? "");
  const cleaned = existing.replace(new RegExp(`\\/\\* ${name} \\*\\/[\\s\\S]*?\\/\\* end ${name} \\*\\/`, "g"), "").trimEnd();
  seo.custom_head = `${cleaned}${cleaned ? "\n" : ""}${marker}\n${css}\n/* end ${name} */\n`;
  await api("PATCH", "/api/v1alpha1/configmaps/strata-configMap", [
    { op: "replace", path: "/data/seo", value: JSON.stringify(seo) },
  ]);
  console.log(`✓ 已把 ${styleBlocks.length} 段样式写入「自定义 head 代码」`);
}

const finalPage = await findPage();
const permalink = finalPage.status?.permalink ?? `/${slug}`;
console.log(`✓ ${draft ? "草稿" : "已发布"} ${base}${permalink}`);
