#!/usr/bin/env node
/**
 * PNG / JPEG / WebP 批量转 AVIF。
 *
 * 用法：
 *   node tools/png-to-avif.mjs <目录或文件> [更多路径...] [选项]
 *
 * 选项：
 *   --quality <1-100>   质量，默认 55
 *   --effort <0-9>      压缩强度，默认 4，越高越慢越小
 *   --lossless          无损模式
 *   --recursive         递归子目录
 *   --overwrite         覆盖已存在的 .avif
 *   --out <目录>        输出到指定目录（保持相对路径）
 *   --dry               只统计，不写文件
 *
 * 示例：
 *   node tools/png-to-avif.mjs public/assets/images --recursive
 *   node tools/png-to-avif.mjs D:\covers --quality 50 --effort 6
 */
import { readdir, stat, mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function parseArgs(argv) {
  const options = {
    quality: 55,
    effort: 4,
    lossless: false,
    recursive: false,
    overwrite: false,
    out: "",
    dry: false,
  };
  const paths = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--quality":
        options.quality = Number(argv[++i]);
        break;
      case "--effort":
        options.effort = Number(argv[++i]);
        break;
      case "--lossless":
        options.lossless = true;
        break;
      case "--recursive":
        options.recursive = true;
        break;
      case "--overwrite":
        options.overwrite = true;
        break;
      case "--out":
        options.out = argv[++i];
        break;
      case "--dry":
        options.dry = true;
        break;
      default:
        if (arg.startsWith("-")) {
          throw new Error(`未知参数：${arg}`);
        }
        paths.push(arg);
    }
  }
  if (paths.length === 0) {
    throw new Error(
      "用法：node tools/png-to-avif.mjs <目录或文件> [选项]\n" +
        "例如：node tools/png-to-avif.mjs ./covers --recursive --quality 50",
    );
  }
  if (!Number.isFinite(options.quality) || options.quality < 1 || options.quality > 100) {
    throw new Error("--quality 需要 1-100 之间的数字");
  }
  if (!Number.isFinite(options.effort) || options.effort < 0 || options.effort > 9) {
    throw new Error("--effort 需要 0-9 之间的数字");
  }
  return { options, paths };
}

async function walk(target, recursive) {
  const info = await stat(target);
  if (info.isFile()) return [target];
  const files = [];
  const entries = await readdir(target, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(target, entry.name);
    if (entry.isDirectory()) {
      if (recursive) files.push(...(await walk(full, recursive)));
      continue;
    }
    if (entry.isFile() && EXTS.has(extname(entry.name).toLowerCase())) {
      files.push(full);
    }
  }
  return files;
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const { options, paths } = parseArgs(process.argv.slice(2));
  const targets = new Set();
  for (const path of paths) {
    for (const file of await walk(resolve(path), options.recursive)) {
      targets.add(file);
    }
  }

  const files = [...targets].filter((file) => EXTS.has(extname(file).toLowerCase()));
  if (files.length === 0) {
    console.log("没有找到 PNG / JPEG / WebP 文件。");
    return;
  }

  const outRoot = options.out ? resolve(options.out) : "";
  if (outRoot && options.dry === false) {
    await mkdir(outRoot, { recursive: true });
  }
  const manifest = [];
  let before = 0;
  let after = 0;
  let converted = 0;
  let skipped = 0;
  const failures = [];

  for (const file of files) {
    const base = options.out ? relative(process.cwd(), file) : "";
    const outFile = outRoot
      ? join(outRoot, base.replace(/[/\\][^/\\]+$/, ""), file.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, ".avif"))
      : file.replace(/\.[^.]+$/, ".avif");

    if (!options.overwrite && (await exists(outFile))) {
      skipped++;
      continue;
    }

    try {
      const input = await stat(file);
      let pipeline = sharp(file, { failOn: "error" });
      const meta = await pipeline.metadata();
      if (meta.width && meta.width > 2400) {
        pipeline = pipeline.resize({ width: 2400, withoutEnlargement: true });
      }
      const buffer = await pipeline
        .avif({
          quality: options.quality,
          effort: options.effort,
          lossless: options.lossless,
        })
        .toBuffer();

      before += input.size;
      after += buffer.length;

      if (!options.dry) {
        await mkdir(dirname(outFile), { recursive: true });
        await writeFile(outFile, buffer);
      }

      const saved = input.size > 0 ? (1 - buffer.length / input.size) * 100 : 0;
      console.log(
        `${options.dry ? "[dry] " : ""}${relative(process.cwd(), file)} → ${relative(process.cwd(), outFile)}  ` +
          `${formatKb(input.size)} → ${formatKb(buffer.length)}（省 ${saved.toFixed(0)}%）`,
      );

      if (options.dry === false) {
        manifest.push({
          source: `/upload/${file.replace(/^.*[/\\]/, "")}`,
          avif: `/upload/${outFile.replace(/^.*[/\\]/, "")}`,
        });
      }
      converted++;
    } catch (error) {
      failures.push(`${file}: ${error.message}`);
    }
  }

  console.log("");
  console.log(`完成：${converted} 个${options.dry ? "（预览）" : "已转换"}，跳过 ${skipped} 个`);
  if (before > 0) {
    console.log(
      `合计 ${formatKb(before)} → ${formatKb(after)}，节省 ${((1 - after / before) * 100).toFixed(1)}%`,
    );
  }
  if (failures.length > 0) {
    console.log(`失败 ${failures.length} 个：`);
    for (const failure of failures.slice(0, 20)) console.log("  " + failure);
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(String(error.message ?? error));
    process.exit(1);
  });
}
