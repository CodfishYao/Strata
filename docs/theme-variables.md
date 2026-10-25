# 主题变量与组件

本文档列出主题提供的 CSS 变量与通用组件，用于编写自定义 HTML。

## 使用方式

1. 新建页面或文章，模板选择「空白页面」或「空白文章」
2. 正文写入 HTML 结构与样式
3. 颜色、字体、圆角引用下列变量

示例：

```html
<div class="example-tool surface">
  <h2>示例工具</h2>
  <div class="ui-field">
    <label>输入值</label>
    <input type="text" />
  </div>
  <button class="btn btn--primary">计算</button>
</div>
```

## 颜色变量

| 变量 | 用途 | 浅色默认值 | 深色默认值 |
| --- | --- | --- | --- |
| `--accent` | 强调色：链接、聚焦、激活态 | `#2f6feb` | 同左 |
| `--accent-light` | 边框、悬停 | `color-mix(accent 45%, #fff)` | `color-mix(accent 60%, #fff)` |
| `--accent-soft` | 选中、标签底色 | `color-mix(accent 12%, transparent)` | `color-mix(accent 18%, transparent)` |
| `--page` | 页面底色 | `#ffffff` | `#0f0f10` |
| `--bg` | 卡片、面板底色 | `#ffffff` | `#0f0f10` |
| `--bg-soft` | 输入框、代码块、悬停底 | `#f7f7f5` | `#171718` |
| `--bg-sink` | 轨道、分隔区、按下态 | `#f0f0ed` | `#1e1e20` |
| `--fg` | 主文字 | `#111111` | `#f2f2f2` |
| `--fg-2` | 次要文字 | `#6b6b6b` | `#a6a6a6` |
| `--fg-3` | 弱文字、占位符 | `#9a9a9a` | `#767676` |
| `--line` | 常规边框、分隔线 | `#e6e6e2` | `#262628` |
| `--line-strong` | 强边框、聚焦边框 | `#d3d3cd` | `#35353a` |
| `--danger` | 删除、清空、错误提示 | `#d0483f` | `#f07167` |

浅色模式下，`--page`、`--bg`、`--bg-soft`、`--bg-sink` 会随「浅色模式背景」「浅色模式柔和度」「降低卡片亮度」「夜间自动调暗」变化。

## 通用组件

| 组件 | 用法 | 说明 |
| --- | --- | --- |
| 卡片 | `<div class="surface">…</div>` | 底色、边框、圆角与阴影 |
| 扁平卡片 | `class="surface surface--flat"` | 无阴影 |
| 次级按钮 | `<button class="btn">…</button>` | 边框样式 |
| 主按钮 | `class="btn btn--primary"` | 强调色 |
| 危险按钮 | `class="btn btn--danger"` | 删除、清空等操作 |
| 表单字段 | `<div class="ui-field"><label>标题</label><input /></div>` | 含标签间距、边框与聚焦样式 |
| 表单字段（整行） | `class="ui-field ui-field--full"` | 用于网格布局 |

`.surface` 在自定义页面中具备悬停高光；`.surface` 内的 `input`、`select`、`textarea` 自动套用主题样式。

## 字体与排版

| 变量 | 值 | 说明 |
| --- | --- | --- |
| `--font-sans` | Inter、HarmonyOS Sans、系统字体栈 | 正文字体 |
| `--font-mono` | JetBrains Mono、系统等宽字体 | 代码与数字 |
| `--fs-body` | 默认 `17px` | 正文字号 |
| `--lh-body` | 默认 `1.85` | 正文行高 |
| `--fs-small` | `0.875rem` | 小号正文 |
| `--fs-meta` | `0.8125rem` | 元信息 |

## 布局与尺寸

| 变量 | 值 | 说明 |
| --- | --- | --- |
| `--wrap` | `84.5rem` | 页面最大宽度 |
| `--measure` | `52rem` | 内容卡片最大宽度 |
| `--aside` | `17.5rem` | 侧栏宽度 |
| `--head-h` | `64px`，移动端 `58px` | 页头高度 |
| `--gap` | `2.5rem`，移动端 `1.5rem` | 区块间距 |
| `--radius` | `10px` | 中圆角 |
| `--radius-sm` | `6px` | 小圆角 |

## 深浅色

- `html[data-theme="light"]` 与 `html[data-theme="dark"]` 由主题脚本切换
- 单独适配深色：`[data-theme="dark"] .example-tool { … }`
- 「夜间自动调暗」生效时，`html` 上附加 `data-night="1"`

```css
[data-theme="dark"] .example-tool {
  box-shadow: 0 18px 40px -30px rgba(0, 0, 0, 0.8);
}
```

## 注意事项

- 颜色使用变量，不要写死色值
- 半透明色使用 `color-mix(in srgb, var(--accent) 12%, transparent)`
- 空白模板的内容区 `.raw-page` 已有上下留白
- 自定义内容中的固定定位浮层，建议放在 `.raw-page` 之外
- 变量仅在主题页面内生效；独立打开 HTML 文件时需自行提供兜底值
