<img src="public/assets/brand/logo.svg" width="64" height="64" alt="Strata">

# Strata · 层理

面向 Halo 2.27 的极简技术博客主题，采用卡片化布局、窄栏正文与克制的配色。

- 主题标识：`strata`
- 最低版本：Halo `2.27.0`
- 许可证：MIT

## 功能

**布局**

- 首页、归档、分类、标签、作者页可选单栏、两栏、三栏
- 文章页封面位于正文卡片顶部，标题在封面下方
- 单栏文章页的目录显示在正文左侧；两栏、三栏显示在右侧栏
- 移动端隐藏侧栏，提供目录按钮与抽屉

**外观**

- 浅色、深色、跟随系统三种配色
- 浅色模式提供纸白、纯白、冷灰、暖白、主题色淡染五种底色
- 可调整浅色模式的柔和度与卡片亮度，降低大面积纯白造成的刺眼感
- 卡片支持指针跟随高光
- 背景可选星光、动态电路、落叶三种效果
- 切换主题时可选圆形扩散、淡入淡出或立即切换

**阅读**

- 目录、阅读进度条、返回顶部
- 代码块复制
- 正文图片灯箱
- 文末版权卡片与赞赏卡片

**页面**

- 友情链接页：申请流程、友链墙、友链须知、免责声明与申请表单
- 留言板：留言须知与留言墙
- 个人链接页：卡片形式展示其他平台主页
- 空白页面与空白文章：正文 HTML 原样输出
- 支持将完整 HTML 注册为页面模板

**SEO**

- 页面标题由主题输出，详情页带当前内容名称
- canonical、Open Graph 与结构化数据由主题输出，可在「主题设置 → SEO」中分别关闭
- 页面描述、关键词、robots 与 favicon 由 Halo 注入，主题不重复输出
- 分页页面使用自引用 canonical，并输出 `rel="prev"` 与 `rel="next"`

## 安装

1. 执行 `pnpm install` 与 `pnpm build`，生成 `dist/strata-<version>.zip`
2. 在 Halo 控制台「主题 → 安装」上传该 ZIP
3. 启用主题，进入「主题 → 设置」完成配置

## 页面模板

新建页面或文章时，可在「模板」中选择以下模板。

| 模板 | 适用 | 说明 |
| --- | --- | --- |
| 空白页面 | 页面 | 不套用卡片，正文 HTML 原样输出 |
| 空白文章 | 文章 | 同上 |
| 友情链接 | 页面 | 友链墙、申请流程与申请表单 |
| 留言板 | 页面 | 留言须知与留言墙 |
| 个人链接 | 页面 | 卡片形式展示其他平台主页 |

使用友情链接、留言板、个人链接模板时，正文留空，内容在主题设置中维护。

### 空白页面的页内卡片

空白页面与空白文章支持通过元数据在正文下方插入主题已有的卡片，无需复制 HTML。

编辑页面或文章 → 元数据 → **页内卡片**，填写键名，支持中英文逗号分隔：

| 键名 | 卡片 |
| --- | --- |
| `profile` | 个人信息（头像、名称、简介、社交入口） |
| `stats` | 站点统计（文章、标签、字数、评论、访问） |
| `copyright` | 版权声明 |
| `reward` | 赞赏（微信、爱发电、自定义） |

示例：

```
profile, stats
```

卡片按填写顺序显示，内容取自「主题设置」中的个人信息、文章页版权与赞赏配置。键名不存在时忽略，留空则不显示。

### 友情链接数据来源

「设置 → 友情链接 → 友链数据源」提供三种选择：

| 选项 | 行为 |
| --- | --- |
| 主题设置（默认） | 读取下方友链列表 |
| 链接管理插件 | 读取插件中的链接与分组，按分组标题展示 |
| 自动检测 | 检测到插件且插件有链接时读取插件数据，否则回退到列表 |

插件已启用但没有链接时，自动检测会回退到设置中的条目。


## 主题设置

| 分组 | 说明 |
| --- | --- |
| 外观 | 配色、强调色、浅色模式、夜间调暗、主题切换动画、布局、背景效果 |
| 字体 | 正文字体、字号、行高、代码字体 |
| 导航栏 | 搜索入口、菜单图标、社交链接 |
| 侧边栏 | 个人信息、站点统计、分类、标签等模块 |
| 文章列表 | 封面位置、尺寸、比例与非常规比例处理 |
| 首页 | 横幅与热门文章 |
| 文章页 | 封面、目录层数、版权声明、赞赏 |
| 留言板 | 留言须知 |
| 友情链接 | 申请流程、友链须知、免责声明、友链列表 |
| 个人链接 | 分组与条目 |
| 外链提醒 | 提示文案与白名单 |
| 性能优化 | 预连接、懒加载、图片优先级、链接预取 |
| 页脚设置 | 版权、RSS、Sitemap、ICP 备案、公安联网备案 |
| SEO | 元数据与结构化数据开关 |

各字段的取值与默认值以控制台说明为准。

## 常见问题

**导航栏没有搜索按钮**

搜索按钮依赖 `PluginSearchWidget` 插件，安装并启用后自动显示。

**文章页没有显示封面**

在「文章页 → 文章封面」中开启。设置的值为「关闭」时不显示封面。

**浅色模式过亮**

在「外观」中降低「浅色模式背景」的亮度，提高「浅色模式柔和度」，或开启「夜间自动调暗」。

**自定义 HTML 页面没有样式**

正文中的 `<style>` 会被 Halo 移除。包含样式的页面请使用自定义 HTML 模板，或将样式写入「SEO → 自定义 head 代码」。详见 [docs/custom-html.md](docs/custom-html.md)。

**分页后的页面在搜索结果中地址异常**

在控制台「站点设置 → 外部访问地址」中填写正式域名。canonical 与 Open Graph 均基于该地址生成。

## 开发

```bash
pnpm install      # 安装依赖
pnpm build-only   # 构建模板与静态资源
pnpm build        # 构建并打包至 dist/
```

本地调试环境见 [DEV.md](DEV.md)；自定义 HTML 页面见 [docs/custom-html.md](docs/custom-html.md)；主题变量见 [docs/theme-variables.md](docs/theme-variables.md)。

## 图片 AVIF（可选）

AVIF 体积通常比 PNG 小 60%–90%，宽高不变。提供两种接入方式，二选一，不要同时启用。

### 方案一：Nginx 内容协商（推荐）

由反向代理按 `Accept` 直接返回 `.avif` 或原图，浏览器只请求一次，前端无脚本。

1. 关闭 Halo 自动缩略图。否则所有 `<img>` 会被追加 `srcset` 与 `?width=`，与 AVIF 协商冲突。

   在 Halo 的 `docker-compose.yml` 中给 `services.halo.command` 追加：

   ```yaml
         - --halo.attachment.thumbnail.disabled=true
   ```

   应用后验证：

   ```bash
   curl -s https://your-domain.com/ | grep -c 'srcset='
   ```

   返回 `0` 即生效。

2. 让反向代理容器能读到附件目录。以 1Panel 为例，在 OpenResty 的 compose 中追加：

   ```yaml
         - /opt/1panel/apps/halo/halo/data/attachments:/halo-attachments:ro
   ```

   重建容器后确认：

   ```bash
   docker exec <openresty容器> ls /halo-attachments/upload | head
   ```

3. 在站点 443 的 server 内加入：

   ```nginx
   location ~ ^/upload/(?<base>.+)\.(?<ext>[^.]+)$ {
       root /halo-attachments/upload;

       set $file "/$base.$ext";
       if ($http_accept ~* "image/avif") {
           set $file "/$base.avif";
       }

       try_files $file /$base.$ext =404;

       add_header Vary Accept;
       add_header Cache-Control "public, max-age=604800";
       access_log off;
   }
   ```

   校验并重载：

   ```bash
   docker exec <openresty容器> openresty -t
   docker exec <openresty容器> openresty -s reload
   ```

4. 验证：

   ```bash
   curl -sI -H 'Accept: image/avif' https://your-domain.com/upload/example.png \
     | grep -iE 'content-type|vary'
   ```

   期望 `content-type: image/avif` 与 `vary: Accept`。

### 方案二：主题前端探测

主题对图片探测同名 `.avif`，存在则替换。开启后浏览器会先请求原图，再请求 AVIF，存在一次重复。

| 设置 | 范围 |
| --- | --- |
| 性能优化 → 全站优先使用 AVIF | 正文图片、封面、头像等 |
| 文章列表 → 封面优先使用 AVIF | 仅列表卡片与文章页封面 |

「AVIF 探测策略」可选：

- 不重复下载：只替换尚未开始加载的图片，首屏保持原图
- 全部替换：首屏也换 AVIF，但会多一次请求

### 生成 AVIF

```bash
pnpm avif ./covers --recursive
pnpm avif ./covers --quality 50 --effort 6 --out ./covers-avif
```

| 参数 | 说明 |
| --- | --- |
| `--quality` | 1–100，默认 55 |
| `--effort` | 0–9，默认 4 |
| `--lossless` | 无损模式 |
| `--recursive` | 递归子目录 |
| `--overwrite` | 覆盖已有 `.avif` |
| `--out` | 输出到指定目录 |
| `--dry` | 只统计，不写文件 |

PNG / JPEG / WebP 均可转换，宽度超过 2400 px 时等比缩小。生成的 `.avif` 需与原图同名、同目录。

### 排查要点

| 现象 | 常见原因 |
| --- | --- |
| 页面所有图片带 `?width=` | Halo 缩略图未关闭 |
| 配置后仍返回 PNG | location 写在了 80 端口 server，或未重载 |
| 全部 404 | `root` 写成宿主机路径，容器内不存在 |
| 仅带 Accept 时 404 | `try_files` 第一个参数为空，或 AVIF 文件名拼成 `xxx.png.avif` |
| 图片请求两次 | 主题前端探测与 Nginx 协商同时启用 |

完整配置与排查记录见 [docs/avif-openresty.md](docs/avif-openresty.md)。该文件随源码仓库提供，不进入主题安装包。

## 作者

CodfishYao (yaohaolin.cn)

## 许可证

MIT License，见 [LICENSE](LICENSE)。
