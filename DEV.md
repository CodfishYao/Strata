# 本地开发说明

本文档说明主题的本地调试与构建流程。

## 环境要求

| 组件 | 要求 |
| --- | --- |
| Halo | 2.27.x，JAR 方式运行 |
| Node.js | 18 及以上 |
| pnpm | 10 及以上 |

## 环境搭建

下文以 `<halo-home>` 表示 Halo 安装目录，`<theme>` 表示主题目录。

1. 将主题目录挂载到 Halo 的主题目录：

   ```powershell
   mklink /J <halo-home>\themes\strata <theme>
   ```

2. 在 `application.yaml` 中关闭模板缓存：

   ```yaml
   spring:
     thymeleaf:
       cache: false
   ```

3. 启动 Halo：

   ```powershell
   powershell -ExecutionPolicy Bypass -File <halo-home>\start-halo.ps1
   ```

4. 访问 `http://localhost:8090`；控制台为 `http://localhost:8090/console`。

停止 Halo：

```powershell
powershell -ExecutionPolicy Bypass -File <halo-home>\stop-halo.ps1
```

日志位于 `<halo-home>\logs\out.log`。

## 开发与构建

```powershell
cd <theme>
pnpm dev          # 监听 src/，修改后自动重建 templates/
pnpm build-only   # 仅构建，不打包
pnpm check        # 格式化、lint 与类型检查
pnpm build        # 构建并生成 dist/strata-<version>.zip
```

模板缓存关闭时，修改源码后刷新浏览器即可查看效果，无需重启 Halo。

Halo 读取的是 `templates/` 目录，不要直接修改该目录中的文件。

## 路由检查

| 路由 | 预期结果 |
| --- | --- |
| `/` | 200 |
| `/archives` | 200 |
| `/archives/{slug}` | 200 |
| `/categories`、`/categories/{slug}` | 200 |
| `/tags`、`/tags/{slug}` | 200 |
| 独立页面 `/{slug}` | 200 |
| 不存在的路径 | 404 |
