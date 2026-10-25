#!/usr/bin/env node
/**
 * 把一份完整的 HTML（含 <style>/<script>）注册成主题的「自定义页面模板」。
 *
 *   node tools/add-html-template.mjs \
 *     --file ".\examples\example-tool.html" \
 *     --name example-tool \
 *     --label "阻抗转换" \
 *     --h1 "阻抗转换：Z参、Y参与串并联等效电路互换" \
 *     --description "在线阻抗转换工具：Z 参数与 Y 参数互换、串并联等效电路换算。" \
 *     --keywords "阻抗转换,Z参数,Y参数,串并联等效电路"
 *
 * 生成的模板会包含：
 *   - 页面标题（h1 + 副标题）与 <title>
 *   - meta description / keywords / robots
 *   - canonical + Open Graph（复用主题 modules/seo）
 *   - Twitter Card 与 WebApplication 结构化数据
 *
 * 为什么不用文章正文：Halo 会过滤正文里的 <style>，正文也有大小限制。
 */

import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function arg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : "true";
}

const file = arg("file");
const name = arg("name");
const label = arg("label");
const description = arg("description", "自定义 HTML 页面");
const h1 = arg("h1", label);
const subtitle = arg("subtitle");
// --keywords 保留解析以兼容旧调用；keywords 由 Halo 注入，模板不再输出
arg("keywords");

if (!file || !name || !label) {
  console.error(
    "用法: node tools/add-html-template.mjs --file <html> --name <模板名> --label <后台显示名> [--h1 <页面标题>] [--subtitle <副标题>] [--description <描述>] [--keywords <关键词>]",
  );
  process.exit(1);
}

const html = await readFile(file, "utf8");
const escapedDescription = description.replace(/"/g, "&quot;");
const subtitleBlock = subtitle ? `\n        <p class="subtitle">${subtitle}</p>` : "";
const hasH1 = /<h1[\s>]/i.test(html);
const headerBlock = hasH1
  ? ""
  : `            <header class="tool-header">
              <h1 class="tool-title">${h1}</h1>${subtitleBlock}
            </header>
`;

const template = `<!doctype html>
<html
  xmlns:th="https://www.thymeleaf.org"
  th:replace="~{layout :: html(head = ~{::head}, content = ~{::content})}"
>
  <th:block th:fragment="head">
    <title th:text="|\${singlePage.spec.title} - \${site.title}|">${label}</title>
    <th:block
      th:replace="~{modules/seo :: meta(
        url=\${site.url + singlePage.status.permalink},
        title=\${singlePage.spec.title},
        description='${description.replace(/'/g, "\\'")}',
        type='website',
        image=\${site.logo})}"
    />
    <meta name="twitter:card" content="summary_large_image" th:if="\${theme.config?.seo?.enable_metadata ?: true}" />
    <meta name="twitter:title" th:content="|\${singlePage.spec.title} - \${site.title}|" th:if="\${theme.config?.seo?.enable_metadata ?: true}" />
    <meta name="twitter:description" content="${escapedDescription}" th:if="\${theme.config?.seo?.enable_metadata ?: true}" />
    <script th:if="\${theme.config?.seo?.enable_structured_data ?: true}" type="application/ld+json" th:inline="javascript">
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": /*[[\${singlePage.spec.title}]]*/ "${h1}",
        "description": "${escapedDescription}",
        "url": /*[[\${site.url + singlePage.status.permalink}]]*/ "",
        "applicationCategory": "UtilitiesApplication",
        "operatingSystem": "Any",
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "CNY" }
      }
    </script>
  </th:block>

  <body>
    <th:block th:fragment="content">
      <div class="page-body">
        <div class="wrap">
          <div class="raw-page">
${headerBlock}${html}
          </div>
        </div>
      </div>
    </th:block>
  </body>
</html>
`;

await mkdir(join(root, "src", "custom"), { recursive: true });
await writeFile(join(root, "src", "custom", `${name}.tpl`), template, "utf8");
console.log(`✓ src/custom/${name}.tpl`);

// 更新 theme.yaml
const themePath = join(root, "theme.yaml");
let theme = await readFile(themePath, "utf8");
if (!theme.includes(`file: ${name}.html`)) {
  const entry = `      - name: ${label}
        description: ${description}
        file: ${name}.html`;
  theme = theme.replace(/(\n    page:\n)/, `$1${entry}\n`);
  await writeFile(themePath, theme, "utf8");
  console.log(`✓ theme.yaml 已登记 ${name}.html`);
} else {
  console.log("✓ theme.yaml 已有该模板");
}

execSync("pnpm build-only", { cwd: root, stdio: "inherit", shell: true });
await copyFile(join(root, "src", "custom", `${name}.tpl`), join(root, "templates", `${name}.html`));

const size = (await readFile(join(root, "templates", `${name}.html`), "utf8")).length;
console.log(`\n✓ templates/${name}.html（${size} 字符）`);
console.log(`完成。后台「页面 → 新建页面」→ 模板选「${label}」→ 正文留空。`);
