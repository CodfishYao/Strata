# 自定义 HTML 页面

Halo 会移除正文中的 `<style>`，正文也有大小限制。包含样式或脚本的完整页面，请按以下三种方式之一接入。

## 方式一：注册为页面模板

适用于包含 `<style>`、`<script>` 或体积较大的页面。

1. 在主题目录执行：

   ```powershell
   node tools/add-html-template.mjs `
     --file ".\examples\example-tool.html" `
     --name example-tool `
     --label "示例工具" `
     --h1 "示例工具" `
     --description "页面说明"
   ```

   参数说明：

   | 参数 | 说明 |
   | --- | --- |
   | `--file` | HTML 文件路径 |
   | `--name` | 模板文件名，生成 `templates/<name>.html` |
   | `--label` | 控制台显示的模板名称 |
   | `--h1` | 页面主标题 |
   | `--subtitle` | 副标题，可选 |
   | `--description` | 页面描述，写入 Open Graph 标签 |

2. 在控制台「页面 → 新建页面」，模板选择该名称，正文留空，发布。

说明：

- 源文件保存为 `src/custom/<name>.tpl`，请勿放置于 `src/` 根目录
- `pnpm build` 会自动将 `src/custom/*.tpl` 同步至 `templates/`

## 方式二：通过脚本发布

适用于纯 HTML、样式较少的页面。

1. 设置管理账号环境变量：

   ```powershell
   $env:HALO_URL  = "http://localhost:8090"
   $env:HALO_USER = "<管理员账号>"
   $env:HALO_PASS = "<管理员密码>"
   ```

2. 执行发布：

   ```powershell
   node tools/publish-html-page.mjs `
     --file ".\examples\demo.html" `
     --title "演示页面" `
     --slug tools/demo `
     --theme-css
   ```

   | 参数 | 说明 |
   | --- | --- |
   | `--file` | HTML 文件路径 |
   | `--title` | 页面标题 |
   | `--slug` | 访问路径 |
   | `--theme-css` | 将文件内的 `<style>` 追加至「SEO → 自定义 head 代码」 |

正文中的 `<script>` 会保留，`<style>` 需通过 `--theme-css` 或自定义 head 引入。

## 方式三：正文配合全站样式

适用于结构较少的页面。

1. 在「SEO → 自定义 head 代码」中写入 `<style>` 或 `<link>`
2. 页面模板选择「空白页面」，正文粘贴 HTML 结构
3. 自定义类名的颜色引用 [theme-variables.md](theme-variables.md) 中的变量

## 注意事项

- 控制台默认编辑器不支持 HTML 源码模式，直接粘贴会被转义，请使用上述脚本或模板方式
- 使用空白页面或空白文章时，可在「元数据 → 页内卡片」中填写 `profile`、`stats`、`copyright`、`reward`（逗号分隔），正文下方会自动插入主题已有的卡片
- 三种方式均可使用主题变量，配色随强调色与深浅色变化
