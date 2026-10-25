# 图片 AVIF、OpenResty 内容协商与排查记录

本文记录图片 AVIF 化的完整配置与排查结论，供迁移、重装、证书续期后参照。

文中域名、容器名使用占位符，实际使用时替换。

| 项 | 占位符 |
| --- | --- |
| 站点域名 | `your-domain.com` |
| OpenResty 容器 | `1Panel-openresty-xxxx` |
| Halo 数据目录 | `/opt/1panel/apps/halo/halo/data` |
| 站点配置目录 | `/opt/1panel/apps/openresty/openresty/conf/conf.d/` |

## 一、最终效果

同一个图片地址，按浏览器能力返回不同格式，全程只请求一次。

| 请求头 | 返回 | 响应头 |
| --- | --- | --- |
| `Accept: image/avif` | `.avif` 文件 | `Content-Type: image/avif`、`Vary: Accept` |
| 其他 | 原图 | `Content-Type: image/png` |

URL 保持 `.png` 不变，格式切换发生在响应层，前端无需脚本。

## 二、目录结构

```
/opt/1panel/apps/halo/halo/data/attachments
├─ upload/       # 原图与同名 .avif
└─ thumbnails/   # Halo 生成的缩略图
```

图片 URL `/upload/xxx.png` 对应磁盘 `attachments/upload/xxx.png`，因此 Nginx 的 `root` 要指到 `upload` 这一层。

## 三、关闭 Halo 自动缩略图

Halo 会给页面内所有 `<img>` 追加 `srcset` 与 `?width=` 参数，与 AVIF 协商冲突，需要关闭。

在 Halo 的 `docker-compose.yml` 中，给 `services.halo.command` 追加：

```yaml
      - --halo.attachment.thumbnail.disabled=true
```

不要写成 service 层级的 `attachment:`，Compose 不认识该字段。

应用：

```bash
cd /opt/1panel/apps/halo/halo
docker compose up -d
```

验证：

```bash
curl -s https://your-domain.com/ | grep -c 'srcset='
```

返回 `0` 即生效。关闭后 `?width=` 请求仍返回 200，但直接给原图，不会破图。

## 四、给 OpenResty 挂载附件目录

OpenResty 容器默认看不到 Halo 的附件目录。

1Panel：应用商店 → 已安装 → openresty → 参数 → 勾选「编辑 compose 文件」，在 `services.openresty.volumes` 追加：

```yaml
      - /opt/1panel/apps/halo/halo/data/attachments:/halo-attachments:ro
```

保存后点「重建」。

验证：

```bash
docker exec 1Panel-openresty-xxxx ls /halo-attachments
# 应看到 upload、thumbnails

docker exec 1Panel-openresty-xxxx ls /halo-attachments/upload | head
```

权限：

```bash
chmod -R o+r /opt/1panel/apps/halo/halo/data/attachments
```

## 五、Nginx 配置

编辑站点配置：

```
/opt/1panel/apps/openresty/openresty/conf/conf.d/your-domain.com.conf
```

在 `server_name your-domain.com` 的 server 块内、`listen 443 ssl http2;` 之后加入：

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

要点：

- `$file` 默认是原图路径，不能为空，否则 `try_files` 直接 404
- `$base` 不含扩展名，`$ext` 是原扩展名
- AVIF 文件必须同名、同目录，扩展名为 `.avif`
- `Vary: Accept` 必须保留，否则缓存会把一种格式发给所有客户端
- 同一 server 内不要保留多份 `/upload/` location

校验并重载：

```bash
docker exec 1Panel-openresty-xxxx openresty -t
docker exec 1Panel-openresty-xxxx openresty -s reload
```

## 六、验证

```bash
# 支持 AVIF
curl -sI -H 'Accept: image/avif' https://your-domain.com/upload/example.png \
  | grep -iE 'HTTP/|content-type|vary'

# 不支持 AVIF
curl -sI https://your-domain.com/upload/example.png \
  | grep -iE 'HTTP/|content-type'
```

期望：

```
HTTP/2 200
content-type: image/avif
vary: Accept
```

```
HTTP/2 200
content-type: image/png
```

浏览器验证：无痕窗口打开页面 → 开发者工具 → Network：

- 勾选「类型」列，显示 `avif`
- 同一张图只有一条请求
- 响应标头 `content-type: image/avif`

URL 仍是 `.png` 属正常，格式由响应头决定。

## 七、生成 AVIF

主题仓库提供转换脚本：

```bash
node tools/png-to-avif.mjs /opt/1panel/apps/halo/halo/data/attachments/upload \
  --recursive --quality 50
```

无 Node 环境时用 Docker：

```bash
docker run --rm \
  -v /opt/1panel/apps/halo/halo/data/attachments/upload:/data \
  -v /opt/avif:/app -w /app node:22 \
  bash -lc "npm i sharp --no-save && node png-to-avif.mjs /data --recursive --quality 50"
```

| 参数 | 说明 |
| --- | --- |
| `--quality` | 1–100，默认 55 |
| `--effort` | 0–9，默认 4 |
| `--recursive` | 递归子目录 |
| `--overwrite` | 覆盖已有 `.avif` |
| `--dry` | 只预览 |

## 八、主题侧设置

Nginx 生效后，主题的 AVIF 开关应全部关闭，避免重复请求：

- 性能优化 → 全站优先使用 AVIF：关闭
- 文章列表 → 封面优先使用 AVIF：关闭

## 九、排查记录

### 1. 页面图片全部带 `?width=` 与 `srcset`

| 项 | 内容 |
| --- | --- |
| 现象 | 所有 `<img>` 被追加 `srcset`，含主题静态资源；已有 `width` 参数的地址被二次追加 |
| 原因 | Halo 核心 `ThumbnailImgTagPostProcessor` 在渲染后统一处理 |
| 误判 | 曾以为是旧主题残留，关闭旧主题图片优化后仍存在 |
| 处理 | 启动参数 `--halo.attachment.thumbnail.disabled=true` |
| 结论 | 2.25.3 起该开关被完整尊重（PR #10103），2.27.1 已包含 |

### 2. 关闭缩略图后仍有少量 `width=`

| 项 | 内容 |
| --- | --- |
| 现象 | 页面源码搜索仍有 `width=` |
| 原因 | `grep 'width='` 会命中 `width="26"`、`stroke-width=`、`width=device-width` |
| 处理 | 用 `grep -oE '/upload/[^"]+width=[0-9]+'` 精确匹配 |
| 结论 | 多为误报；正文中确实存在的参数属已保存内容，需单独清理 |

### 3. 正文存量 `?width=` 清理

| 项 | 内容 |
| --- | --- |
| 原因 | 参数写在正文 HTML 中，主题与开关都不会改写已保存内容 |
| 处理 | 编辑文章删除参数；或使用清理脚本 |
| 注意 | 修改正文需重新发布，仅保存草稿前台不更新 |

### 4. Nginx 已配置但返回 PNG 或 404

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 返回 PNG | location 写进了 80 端口 server | 移到 `listen 443` 所在 server |
| 全部 404 | `root` 写成宿主机路径，容器内不存在 | 改为挂载点 `/halo-attachments/upload` |
| 全部 404 | 容器未挂载附件目录 | compose 增加 volume 后重建 |
| 全部 404 | `root` 少写 `upload` 一层 | 指向 `attachments/upload` |
| 带 Accept 才 404 | `try_files` 第一个参数为空 | 先给 `$file` 赋原图路径再条件替换 |
| 带 Accept 才 404 | AVIF 文件名拼成 `xxx.png.avif` | 用 `$base` 去掉扩展名 |
| 脚本 404 | 主题文件已更新但模板缓存未刷新 | 控制台重载主题后强刷 |

### 5. 同一张图同时请求 PNG 与 AVIF

| 项 | 内容 |
| --- | --- |
| 原因 | 主题前端探测到 `.avif` 后替换 `src`，但浏览器已发出原图请求 |
| 触发条件 | 主题 AVIF 策略为「全部替换」 |
| 处理 | 关闭主题 AVIF 开关，交由 Nginx 协商 |
| 结论 | 前端探测必然有竞态，无法做到零重复 |

### 6. 目录与移动端导航失效

| 项 | 内容 |
| --- | --- |
| 现象 | 目录为空、移动端菜单点不开 |
| 原因 | 页面引用的 `layout-*.js` 返回 404，所有脚本未加载 |
| 处理 | 重载主题或重启 Halo，确认资源返回 200 |
| 根因 | 主题文件替换后模板缓存仍是旧版本，引用了已被替换的哈希文件名 |

### 7. 菜单图标保存报「服务器内部错误」

| 项 | 内容 |
| --- | --- |
| 原因 | 菜单图标注解使用 `iconify` 表单组件，保存时服务端校验异常 |
| 处理 | 注解字段改为普通文本，填写 `ri:home-4-line` 这类名称 |
| 说明 | 主题同时支持 `data:`、`<svg>`、`http(s)` 形式的图标值 |

### 8. 字数统计偏大

| 项 | 内容 |
| --- | --- |
| 原因一 | 统计的是正文源码长度，含标签与空白 |
| 原因二 | 英文按字母计数，技术文章数值偏大 |
| 处理 | 改为统计中文字符 + 英文单词，并按文章名去重 |
| 结果 | 示例站点由 33 万降至约 4 万 |

## 十、待验证清单

以下项目本地已验证，生产环境仍需确认：

1. **友链插件读取**
   - 场景：安装「链接管理」插件后，友链页应读取插件数据并按分组展示
   - 验证：`/friends` 选择「自动检测」后能显示分组；若页面中断，记录日志首行

2. **菜单图标自定义保存**
   - 场景：改为文本字段后，线上保存 `ri:*` 是否仍报 500
   - 验证：编辑菜单项 → 菜单图标 → 填 `ri:link` → 提交

3. **主题包隐私审计**
   - 场景：最终打包后重新扫描是否含本地路径、账号、域名
   - 验证：解压 zip 搜索本地绝对路径、内网地址、账号名与凭据文件名

4. **AVIF 双开关状态**
   - 场景：Nginx 已接管，主题两个 AVIF 开关应保持关闭
   - 验证：页面 `data-avif` 属性不应为 `on`

5. **移动端目录与导航**
   - 场景：真机点击目录按钮、有子菜单的导航项
   - 验证：目录抽屉可打开，子菜单可展开，与回到顶部按钮不重叠

6. **文档与实现一致性**
   - 场景：AVIF 全局开关、友链数据源等新增设置是否已写入 README
   - 验证：README 的「主题设置」「友情链接数据来源」章节与实际字段一致

## 十一、回滚

1. 删除站点配置中的 `/upload/` location
2. 删除 OpenResty compose 中的附件挂载
3. 去掉 `--halo.attachment.thumbnail.disabled=true`
4. 重载 OpenResty，重建容器

回滚后图片恢复由 Halo 直接提供，行为与改造前一致。

## 十二、命令速查

```bash
# 校验配置
docker exec 1Panel-openresty-xxxx openresty -t

# 重载
docker exec 1Panel-openresty-xxxx openresty -s reload

# 查看生效配置
docker exec 1Panel-openresty-xxxx openresty -T 2>/dev/null | less

# 容器日志
docker logs 1Panel-openresty-xxxx --tail 50

# 站点错误日志
docker exec 1Panel-openresty-xxxx cat /www/sites/<站点>/log/your-domain.com.error.log

# 检查挂载是否仍在
docker exec 1Panel-openresty-xxxx openresty -T 2>/dev/null | grep -c 'halo-attachments'
```
