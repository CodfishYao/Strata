#!/usr/bin/env node
/**
 * 清理文章封面里的 ?width= 参数。
 *
 * 用法：
 *   HALO_URL=https://example.com \
 *   HALO_USER=账号 HALO_PASS=密码 \
 *   node tools/clean-image-params.mjs            # 预览
 *
 *   ... node tools/clean-image-params.mjs --apply # 写入
 *
 * 也可以只提供浏览器 Cookie：
 *   HALO_COOKIE='console_token=...' node tools/clean-image-params.mjs
 */
const BASE = (process.env.HALO_URL ?? "http://localhost:8090").replace(/\/$/, "");
const USER = process.env.HALO_USER;
const PASS = process.env.HALO_PASS;
const COOKIE = process.env.HALO_COOKIE;
const APPLY = process.argv.includes("--apply");

if (APPLY && !COOKIE && (!USER || !PASS)) {
  console.error("写入需要认证：请设置 HALO_USER 与 HALO_PASS，或提供 HALO_COOKIE");
  process.exit(1);
}

function headers(json, withAuth) {
  const result = { Accept: "application/json" };
  if (json) result["Content-Type"] = "application/json";
  if (withAuth) {
    if (COOKIE) result.Cookie = COOKIE;
    else result.Authorization = "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64");
  }
  return result;
}

async function request(method, path, body, withAuth = false) {
  const res = await fetch(BASE + path, {
    method,
    headers: headers(Boolean(body), withAuth),
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const text = await res.text();
  const isJson = (res.headers.get("content-type") ?? "").includes("application/json");

  if ([301, 302, 303, 307].includes(res.status)) {
    throw new Error(
      `请求被重定向到登录页：${method} ${path}\n` +
        "账号密码未通过校验，或反向代理未透传 Authorization。请确认 HALO_USER / HALO_PASS，或改用 HALO_COOKIE。",
    );
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 160)}`);
  }
  if (!isJson) {
    throw new Error(
      `${method} ${path} 返回的不是 JSON（可能是登录页或拦截页）：\n${text.slice(0, 160)}`,
    );
  }
  return JSON.parse(text);
}

const WIDTH_PARAM = /([?&])width=\d+&?/g;

function stripWidth(url) {
  if (!url) return url;
  let next = url.replace(WIDTH_PARAM, "$1");
  next = next.replace(/[?&]$/, "");
  return next;
}

// 列表与详情走公开接口，不需要认证，避免账号错误导致整批中断
const list = await request("GET", "/apis/api.content.halo.run/v1alpha1/posts?page=0&size=100");
console.log(`共 ${list.total} 篇文章`);

let coverChanged = 0;
let contentHits = 0;

for (const summary of list.items ?? []) {
  const name = summary.metadata.name;
  const detail = await request("GET", `/apis/api.content.halo.run/v1alpha1/posts/${name}`);
  const post = detail.post ?? detail;
  const cover = post.spec?.cover ?? "";
  const cleaned = stripWidth(cover);
  const content = detail.content?.content ?? "";
  const hits = (content.match(/width=\d+/g) ?? []).length;
  if (hits > 0) contentHits += hits;

  if (cleaned !== cover) {
    coverChanged++;
    console.log(`封面  ${post.spec.title}: ${cover} -> ${cleaned}`);
    if (APPLY) {
      post.spec.cover = cleaned;
      await request("PUT", `/apis/content.halo.run/v1alpha1/posts/${name}`, post, true);
    }
  }
  if (hits > 0) {
    console.log(`正文  ${post.spec.title}: 仍有 ${hits} 处 width 参数（未修改）`);
  }
}

console.log("");
console.log(
  `${APPLY ? "已清理" : "待清理"}封面 ${coverChanged} 篇；正文中仍带 width 参数的图片共 ${contentHits} 处`,
);
if (!APPLY && coverChanged > 0) {
  console.log("确认无误后加 --apply 执行写入。");
}
