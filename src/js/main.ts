import "../css/main.css";

type Scheme = "light" | "dark" | "system";

const STORAGE_KEY = "strata-scheme";
const ORDER: Scheme[] = ["light", "dark", "system"];
const LABEL: Record<Scheme, string> = {
  light: "当前：浅色，点击切换到深色",
  dark: "当前：深色，点击切换到跟随系统",
  system: "当前：跟随系统，点击切换到浅色",
};

const root = document.documentElement;
const media = window.matchMedia("(prefers-color-scheme: dark)");

function currentScheme(): Scheme {
  const value = root.dataset.scheme;
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

function apply(scheme: Scheme): void {
  const dark = scheme === "dark" || (scheme === "system" && media.matches);
  root.dataset.scheme = scheme;
  root.dataset.theme = dark ? "dark" : "light";
  // 兼容按 class 判断主题的插件（shiki 代码高亮、评论组件等）
  root.classList.toggle("dark", dark);
  root.classList.toggle("light", !dark);
}

function save(scheme: Scheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, scheme);
  } catch {
    /* 隐私模式下忽略 */
  }
}

function resolveInitial(): Scheme {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    saved = null;
  }
  const candidate = saved ?? root.dataset.schemeDefault ?? "system";
  return candidate === "light" || candidate === "dark" || candidate === "system"
    ? candidate
    : "system";
}

apply(resolveInitial());

media.addEventListener("change", () => {
  if (currentScheme() === "system") {
    apply("system");
  }
});

type SwitchMode = "circle" | "fade" | "none";

/** 主题切换：圆形扩散 / 淡入淡出 / 立即切换，时长由 --switch-dur 控制 */
function applyWithTransition(next: Scheme, origin: { x: number; y: number }): void {
  const mode = (strataConfig().switchAnim ?? "circle") as SwitchMode;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => { finished: Promise<void> };
  };

  if (mode === "none" || reduce || typeof doc.startViewTransition !== "function") {
    apply(next);
    return;
  }

  root.style.setProperty("--vt-x", `${Math.round(origin.x)}px`);
  root.style.setProperty("--vt-y", `${Math.round(origin.y)}px`);
  root.style.setProperty("--vt-anim", mode === "circle" ? "strata-vt-circle" : "strata-vt-fade");

  const transition = doc.startViewTransition(() => apply(next));
  transition.finished.finally(() => {
    root.style.removeProperty("--vt-anim");
  });
}

document.querySelectorAll<HTMLButtonElement>("[data-scheme-toggle]").forEach((button) => {
  button.setAttribute("aria-label", LABEL[currentScheme()]);
  button.addEventListener("click", (event) => {
    const next = ORDER[(ORDER.indexOf(currentScheme()) + 1) % ORDER.length] ?? "system";
    const rect = button.getBoundingClientRect();
    save(next);
    applyWithTransition(next, {
      x: event.clientX || rect.left + rect.width / 2,
      y: event.clientY || rect.top + rect.height / 2,
    });
    button.setAttribute("aria-label", LABEL[next]);
  });
});

// 移动端导航展开 / 收起
const siteHead = document.querySelector<HTMLElement>("[data-site-head]");
const navToggle = document.querySelector<HTMLButtonElement>("[data-nav-toggle]");

if (siteHead && navToggle) {
  navToggle.addEventListener("click", () => {
    const open = siteHead.dataset.navOpen === "true";
    siteHead.dataset.navOpen = open ? "false" : "true";
    navToggle.setAttribute("aria-expanded", open ? "false" : "true");
  });
}

// 视口变宽后复位移动端菜单状态，避免桌面端残留展开态
window.addEventListener("resize", () => {
  if (!siteHead || !navToggle) return;
  if (window.innerWidth > 720 && siteHead.dataset.navOpen === "true") {
    siteHead.dataset.navOpen = "false";
    navToggle.setAttribute("aria-expanded", "false");
  }
});

// ---------- 顶部加载进度条：加载期间显示，完成后淡出 ----------
function initLoadBar(): void {
  const bar = document.querySelector<HTMLElement>("[data-loadbar]");
  if (!bar) return;

  bar.hidden = false;
  let progress = 0.1;
  bar.style.transform = `scaleX(${progress})`;

  const timer = window.setInterval(() => {
    progress = Math.min(0.9, progress + (0.9 - progress) * 0.22);
    bar.style.transform = `scaleX(${progress})`;
  }, 200);

  let guard = 0;
  const finish = (): void => {
    window.clearInterval(timer);
    window.clearTimeout(guard);
    bar.style.transform = "scaleX(1)";
    window.setTimeout(() => {
      bar.style.opacity = "0";
    }, 240);
    window.setTimeout(() => {
      bar.remove();
    }, 720);
  };

  if (document.readyState === "complete") {
    finish();
  } else {
    window.addEventListener("load", finish, { once: true });
  }
  guard = window.setTimeout(finish, 8000);
}

// ---------- 图片懒加载：给未声明的图片补上 loading/decoding ----------
type StrataConfig = {
  spotlight?: boolean;
  switchAnim?: "circle" | "fade" | "none";
  perf?: { prefetch?: boolean; lazyImages?: boolean };
  labels?: { loading?: string; end?: string; copy?: string; copied?: string; copyFailed?: string };
};

function strataConfig(): StrataConfig {
  return (window as unknown as { __STRATA__?: StrataConfig }).__STRATA__ ?? {};
}

function hydrateImages(scope: ParentNode): void {
  if (strataConfig().perf?.lazyImages === false) return;
  scope.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    if (!img.hasAttribute("loading")) img.loading = "lazy";
    if (!img.hasAttribute("decoding")) img.decoding = "async";
  });
}

// ---------- 列表页滚动加载 ----------
function initInfiniteScroll(): void {
  const host = document.querySelector<HTMLElement>("[data-infinite]");
  const container = document.querySelector<HTMLElement>("[data-infinite-container]");
  if (!host || !container) return;

  let nextUrl = host.dataset.next ?? "";
  let loading = false;
  let done = nextUrl === "";
  if (done) return;

  const status = document.createElement("div");
  status.className = "infinite-status";
  const dot = document.createElement("span");
  dot.className = "infinite-dot";
  const label = document.createElement("span");
  status.append(dot, label);
  container.after(status);

  const sentinel = document.createElement("div");
  sentinel.setAttribute("aria-hidden", "true");
  status.after(sentinel);

  const setState = (state: string, text = ""): void => {
    status.dataset.state = state;
    label.textContent = text;
  };

  const loadMore = async (): Promise<void> => {
    if (loading || done || !nextUrl) return;
    loading = true;
    setState("loading", strataConfig().labels?.loading ?? "加载中…");
    try {
      const res = await fetch(nextUrl, {
        headers: { "X-Requested-With": "fetch" },
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(String(res.status));

      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      const fresh = doc.querySelector<HTMLElement>("[data-infinite-container]");
      const freshHost = doc.querySelector<HTMLElement>("[data-infinite]");
      if (!fresh || fresh.children.length === 0) {
        done = true;
        setState("end", strataConfig().labels?.end ?? "已经到底了");
        return;
      }

      const frag = document.createDocumentFragment();
      Array.from(fresh.children).forEach((el) => frag.appendChild(el));
      container.appendChild(frag);
      hydrateImages(container);

      nextUrl = freshHost?.dataset.next ?? "";
      if (!nextUrl) {
        done = true;
        setState("end", strataConfig().labels?.end ?? "已经到底了");
      } else {
        setState("idle");
      }
    } catch {
      setState("error", "加载失败，继续滚动可重试");
    } finally {
      loading = false;
    }
  };

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadMore();
      }
    },
    { rootMargin: "600px 0px" },
  );
  observer.observe(sentinel);
}

// ---------- 全局搜索（依赖 PluginSearchWidget） ----------
declare global {
  interface Window {
    SearchWidget?: { open: () => void };
  }
}

function initSearch(): void {
  const open = (): void => window.SearchWidget?.open();
  document.querySelectorAll<HTMLElement>("[data-search-open]").forEach((button) => {
    button.addEventListener("click", open);
  });
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      open();
    }
  });
}

// 卡片高光：事件委托，滚动加载出来的新卡片同样生效
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

function initSpotlight(): void {
  if (!finePointer.matches) return;

  // 只更新坐标，不在离开时重置：重置会把高光瞬移到顶部居中，
  // 而透明度还在过渡，看起来就像「高光跳到顶部」而不是原地淡出。
  document.addEventListener(
    "pointermove",
    (event) => {
      const target = (event.target as Element | null)?.closest<HTMLElement>(
        "[data-spotlight]",
      );
      if (!target) return;
      const rect = target.getBoundingClientRect();
      target.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      target.style.setProperty("--my", `${event.clientY - rect.top}px`);
    },
    { passive: true },
  );
}

// ---------- 菜单：父项点击只展开，不跳转 ----------
function initMenu(): void {
  const parents = document.querySelectorAll<HTMLButtonElement>("[data-menu-parent]");

  /**
   * 把子菜单居中到父项正下方，并按视口左右夹取，避免超出屏幕。
   * 子菜单是父项的绝对定位子元素，所以 left 用相对父项计算。
   */
  const placeSubmenu = (li: HTMLElement): void => {
    const panel = li.querySelector<HTMLElement>(".submenu");
    if (!panel) return;

    const parentRect = li.getBoundingClientRect();
    const width = panel.offsetWidth;
    if (width === 0) return;

    const viewport = document.documentElement.clientWidth;
    const margin = 12;
    const centered = parentRect.left + parentRect.width / 2 - width / 2;
    const left = Math.min(Math.max(centered, margin), viewport - width - margin);
    panel.style.left = `${Math.round(left - parentRect.left)}px`;
  };

  const closeOthers = (keep: HTMLElement): void => {
    document.querySelectorAll<HTMLElement>(".site-nav li[data-open='true']").forEach((li) => {
      if (li === keep) return;
      li.dataset.open = "false";
      li.querySelector<HTMLButtonElement>("[data-menu-parent]")?.setAttribute(
        "aria-expanded",
        "false",
      );
    });
  };

  parents.forEach((button) => {
    button.addEventListener("click", () => {
      const li = button.closest<HTMLElement>("li");
      if (!li) return;
      const open = li.dataset.open === "true";
      li.dataset.open = open ? "false" : "true";
      button.setAttribute("aria-expanded", open ? "false" : "true");
      if (!open) {
        closeOthers(li);
        placeSubmenu(li);
      }
    });
  });

  const repositionOpen = (): void => {
    document
      .querySelectorAll<HTMLElement>('.site-nav li[data-open="true"]')
      .forEach((li) => placeSubmenu(li));
  };
  window.addEventListener("resize", repositionOpen);

  const closeAllSubmenus = (): void => {
    document.querySelectorAll<HTMLElement>('.site-nav li[data-open="true"]').forEach((li) => {
      li.dataset.open = "false";
      li.querySelector<HTMLButtonElement>("[data-menu-parent]")?.setAttribute(
        "aria-expanded",
        "false",
      );
    });
  };

  const closeMobileNav = (): void => {
    if (siteHead?.dataset.navOpen !== "true") return;
    siteHead.dataset.navOpen = "false";
    navToggle?.setAttribute("aria-expanded", "false");
  };

  // 点击空白处：收起子菜单与移动端菜单
  document.addEventListener("click", (event) => {
    const target = event.target as Element | null;
    if (!target?.closest(".site-nav li.has-children")) closeAllSubmenus();
    if (!target?.closest(".site-head")) closeMobileNav();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeAllSubmenus();
    closeMobileNav();
  });
}

// ---------- 图片放大 ----------
function initLightbox(): void {
  const box = document.querySelector<HTMLElement>("[data-lightbox]");
  const image = box?.querySelector<HTMLImageElement>("[data-lightbox-img]");
  if (!box || !image) return;

  const duration = (): number => {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--lb-dur")
      .trim();
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : 220;
  };

  const animated = (): boolean =>
    document.documentElement.dataset.lightboxAnim !== "off" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const open = (src: string, alt: string): void => {
    image.src = src;
    image.alt = alt;
    box.hidden = false;
    document.documentElement.classList.add("no-scroll");
    if (animated()) {
      window.requestAnimationFrame(() => box.classList.add("is-open"));
    } else {
      box.classList.add("is-open");
    }
  };

  let closeTimer = 0;
  const close = (): void => {
    window.clearTimeout(closeTimer);
    box.classList.remove("is-open");
    document.documentElement.classList.remove("no-scroll");
    if (animated()) {
      closeTimer = window.setTimeout(() => {
        box.hidden = true;
        image.removeAttribute("src");
      }, duration() + 20);
    } else {
      box.hidden = true;
      image.removeAttribute("src");
    }
  };

  document.addEventListener("click", (event) => {
    const trigger = (event.target as Element | null)?.closest<HTMLElement>(
      "[data-lightbox-src]",
    );
    if (trigger) {
      event.preventDefault();
      const src = trigger.dataset.lightboxSrc ?? "";
      if (!src) return;
      open(src, trigger.getAttribute("aria-label") ?? "");
      return;
    }
    // 正文图片点击放大
    const proseImage = (event.target as Element | null)?.closest("[data-content] img");
    if (proseImage instanceof HTMLImageElement && !proseImage.closest("a")) {
      const src = proseImage.currentSrc || proseImage.src;
      if (!src) return;
      event.preventDefault();
      open(src, proseImage.alt);
      return;
    }
    if (!box.hidden && box.contains(event.target as Node)) close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !box.hidden) close();
  });
}

// ---------- 外链跳转提示 ----------
interface ExternalConfig {
  enabled: boolean;
  newWindow: boolean;
  message: string;
  delay: number;
  whitelist: string;
}

function initExternalLinks(): void {
  const config = (window as unknown as { __STRATA__?: { external?: ExternalConfig } })
    .__STRATA__?.external;
  if (!config?.enabled) return;

  const modal = document.querySelector<HTMLElement>("[data-ext-modal]");
  if (!modal) return;

  const messageEl = modal.querySelector<HTMLElement>("[data-ext-message]");
  const urlEl = modal.querySelector<HTMLElement>("[data-ext-url]");
  const hintEl = modal.querySelector<HTMLElement>("[data-ext-hint]");
  const goEl = modal.querySelector<HTMLAnchorElement>("[data-ext-go]");
  if (!goEl) return;

  const patterns = (config.whitelist || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return new RegExp(line);
      } catch {
        return null;
      }
    })
    .filter((re): re is RegExp => re !== null);

  let timer = 0;

  const clearTimer = (): void => {
    if (timer) window.clearInterval(timer);
    timer = 0;
  };

  const close = (): void => {
    clearTimer();
    modal.hidden = true;
    if (hintEl) hintEl.hidden = true;
  };

  const openModal = (url: string): void => {
    if (messageEl) messageEl.textContent = config.message || "即将离开本站，前往外部站点。";
    if (urlEl) urlEl.textContent = url;
    goEl.href = url;
    if (config.newWindow) {
      goEl.target = "_blank";
      goEl.rel = "noopener noreferrer";
    } else {
      goEl.removeAttribute("target");
    }
    modal.hidden = false;

    if (config.delay > 0) {
      let left = config.delay;
      if (hintEl) {
        hintEl.hidden = false;
        hintEl.textContent = `${left} 秒后自动打开`;
      }
      timer = window.setInterval(() => {
        left -= 1;
        if (left <= 0) {
          clearTimer();
          if (hintEl) hintEl.hidden = true;
          window.open(url, config.newWindow ? "_blank" : "_self", "noopener");
          close();
          return;
        }
        if (hintEl) hintEl.textContent = `${left} 秒后自动打开`;
      }, 1000);
    }
  };

  modal.querySelectorAll<HTMLElement>("[data-ext-cancel]").forEach((el) => {
    el.addEventListener("click", close);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) close();
  });

  document.addEventListener("click", (event) => {
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
    if (!link) return;
    const href = link.getAttribute("href") ?? "";
    if (!/^https?:\/\//i.test(href)) return;
    if (link.hasAttribute("data-ext-skip")) return;
    if (link.hostname === window.location.hostname) return;
    if (patterns.some((re) => re.test(href))) return;
    if (!modal.hidden) return;

    event.preventDefault();
    openModal(href);
  });
}

// ---------- 统计：运行时间（5 秒刷新）与总字数 ----------
function initStats(): void {
  const uptimes = document.querySelectorAll<HTMLElement>("[data-uptime]");
  if (uptimes.length > 0) {
    const render = (): void => {
      const now = Date.now();
      uptimes.forEach((node) => {
        const start = Date.parse(node.dataset.start ?? "");
        if (Number.isNaN(start)) {
          node.textContent = "—";
          return;
        }
        const days = Math.max(0, Math.floor((now - start) / 86_400_000));
        node.textContent = String(days);
      });
    };
    render();
    window.setInterval(render, 5000);
  }

  const total = document.querySelector<HTMLElement>("[data-word-total]");
  if (!total) return;
  const lengths = Array.from(
    document.querySelectorAll<HTMLElement>("[data-word-len]"),
  );
  if (lengths.length === 0) {
    total.textContent = "—";
    return;
  }
  const seen = new Map<string, number>();
  for (const el of lengths) {
    const key = el.dataset.wordName ?? String(seen.size);
    if (!seen.has(key)) {
      seen.set(key, Number(el.textContent?.trim() || "0"));
    }
  }
  const sum = [...seen.values()].reduce((acc, value) => acc + value, 0);
  const { text, unit } = formatWordCount(sum);
  total.textContent = "";
  total.append(document.createTextNode(text));
  if (unit) {
    const unitNode = document.createElement("span");
    unitNode.className = "stats__unit";
    unitNode.textContent = unit;
    total.append(unitNode);
  }
}

// 字数按量级换算单位：千 / 万 / 十万 / 百万
function formatWordCount(value: number): { text: string; unit: string } {
  if (!Number.isFinite(value) || value <= 0) return { text: "0", unit: "" };
  const units: Array<[number, string]> = [
    [1_000_000, "百万"],
    [10_000, "万"],
    [1_000, "千"],
  ];
  for (const [base, unit] of units) {
    if (value >= base) {
      const scaled = value / base;
      const text =
        scaled < 10
          ? scaled.toFixed(1).replace(/\.0$/, "")
          : String(Math.round(scaled));
      return { text, unit };
    }
  }
  return { text: String(Math.round(value)), unit: "" };
}

// ---------- 背景动态效果：星光 / 动态电路 / 落叶 ----------
interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
  drift: number;
}

interface Point {
  x: number;
  y: number;
}

interface Trace {
  points: Point[];
  length: number;
}

interface Pulse {
  trace: Trace;
  distance: number;
  speed: number;
  size: number;
  forward: boolean;
}

interface Leaf {
  x: number;
  y: number;
  size: number;
  angle: number;
  spin: number;
  sway: number;
  phase: number;
  speed: number;
}

function initBackgroundEffect(): void {
  const canvas = document.querySelector<HTMLCanvasElement>("[data-bg-effect]");
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;

  const kind = canvas.dataset.bgEffect ?? "stars";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const dark = (): boolean => document.documentElement.dataset.theme === "dark";
  const tone = (alpha: number): string =>
    dark() ? `rgba(255, 255, 255, ${alpha})` : `rgba(24, 24, 26, ${alpha})`;

  let stars: Star[] = [];
  let traces: Trace[] = [];
  let pulses: Pulse[] = [];
  let leaves: Leaf[] = [];
  let width = 0;
  let height = 0;
  let frame = 0;

  const random = (min: number, max: number): number => min + Math.random() * (max - min);

  const build = (): void => {
    stars = [];
    traces = [];
    pulses = [];
    leaves = [];

    if (kind === "stars") {
      const count = Math.max(36, Math.min(140, Math.round((width * height) / 14000)));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: random(0.4, 1.6),
        phase: Math.random() * Math.PI * 2,
        speed: random(0.4, 1.5),
        drift: random(0.01, 0.04),
      }));
      return;
    }

    if (kind === "circuit") {
      const grid = 48;
      const count = Math.max(8, Math.min(26, Math.round((width * height) / 60000)));
      const snap = (value: number): number => Math.round(value / grid) * grid;

      const makeTrace = (): Trace => {
        const points: Point[] = [];
        let x = snap(random(0, width));
        let y = snap(random(0, height));
        points.push({ x, y });

        const segments = Math.floor(random(2, 5));
        let horizontal = Math.random() > 0.5;
        for (let i = 0; i < segments; i++) {
          const length = snap(random(grid * 2, grid * 7));
          if (horizontal) {
            x += Math.random() > 0.5 ? length : -length;
          } else {
            y += Math.random() > 0.5 ? length : -length;
          }
          points.push({ x, y });

          // 45° 折角，让走线更接近真实布线
          if (Math.random() > 0.62) {
            const diagonal = snap(random(grid, grid * 2));
            x += Math.random() > 0.5 ? diagonal : -diagonal;
            y += Math.random() > 0.5 ? diagonal : -diagonal;
            points.push({ x, y });
          }

          horizontal = !horizontal;
        }

        let length = 0;
        for (let i = 1; i < points.length; i++) {
          length += Math.hypot(
            points[i].x - points[i - 1].x,
            points[i].y - points[i - 1].y,
          );
        }
        return { points, length };
      };

      for (let i = 0; i < count; i++) {
        const trace = makeTrace();
        traces.push(trace);
        const pulseCount = Math.random() > 0.6 ? 2 : 1;
        for (let p = 0; p < pulseCount; p++) {
          pulses.push({
            trace,
            distance: Math.random() * trace.length,
            speed: random(26, 64),
            size: random(1.3, 2.2),
            forward: Math.random() > 0.3,
          });
        }
      }
      return;
    }

    if (kind === "leaves") {
      const count = Math.max(8, Math.min(18, Math.round(width / 90)));
      leaves = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: random(6, 13),
        angle: Math.random() * Math.PI * 2,
        spin: random(-0.012, 0.012),
        sway: random(16, 46),
        phase: Math.random() * Math.PI * 2,
        speed: random(10, 26),
      }));
    }
  };

  const resize = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  };

  const drawStars = (time: number): void => {
    const maxAlpha = dark() ? 0.85 : 0.5;
    for (const star of stars) {
      if (!reduce.matches) {
        star.y += star.drift;
        if (star.y > height + 2) {
          star.y = -2;
          star.x = Math.random() * width;
        }
      }
      const twinkle = reduce.matches
        ? 0.6
        : 0.35 + 0.65 * Math.abs(Math.sin((time / 1000) * star.speed + star.phase));
      const alpha = maxAlpha * twinkle;
      if (dark() && star.r > 1.2) {
        ctx.beginPath();
        ctx.fillStyle = tone(alpha * 0.14);
        ctx.arc(star.x, star.y, star.r * 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.fillStyle = tone(alpha);
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  /** 沿折线取某段距离的坐标 */
  const pointAt = (trace: Trace, distance: number): Point => {
    let remaining = Math.max(0, Math.min(distance, trace.length));
    for (let i = 1; i < trace.points.length; i++) {
      const from = trace.points[i - 1];
      const to = trace.points[i];
      const segment = Math.hypot(to.x - from.x, to.y - from.y);
      if (remaining <= segment || i === trace.points.length - 1) {
        const ratio = segment === 0 ? 0 : remaining / segment;
        return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio };
      }
      remaining -= segment;
    }
    return trace.points[0];
  };

  const drawCircuit = (): void => {
    ctx.lineWidth = 1;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = tone(dark() ? 0.1 : 0.07);
    for (const trace of traces) {
      ctx.beginPath();
      trace.points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    }

    // 焊盘与过孔
    for (const trace of traces) {
      const pads = [trace.points[0], trace.points[trace.points.length - 1]];
      ctx.fillStyle = tone(dark() ? 0.18 : 0.12);
      for (const pad of pads) {
        ctx.beginPath();
        ctx.arc(pad.x, pad.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = tone(dark() ? 0.09 : 0.06);
      for (let i = 1; i < trace.points.length - 1; i++) {
        ctx.beginPath();
        ctx.arc(trace.points[i].x, trace.points[i].y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 信号脉冲：沿折线移动，带一小段拖尾
    for (const pulse of pulses) {
      if (!reduce.matches) {
        pulse.distance += (pulse.forward ? 1 : -1) * pulse.speed / 60;
        if (pulse.distance > pulse.trace.length) {
          pulse.distance = 0;
          pulse.forward = true;
        } else if (pulse.distance < 0) {
          pulse.distance = pulse.trace.length;
          pulse.forward = false;
        }
      }

      const direction = pulse.forward ? 1 : -1;
      const head = pointAt(pulse.trace, pulse.distance);
      const tail = pointAt(pulse.trace, pulse.distance - direction * 24);
      const gradient = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
      gradient.addColorStop(0, tone(0));
      gradient.addColorStop(1, tone(dark() ? 0.5 : 0.32));

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(head.x, head.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.fillStyle = tone(dark() ? 0.72 : 0.48);
      ctx.arc(head.x, head.y, pulse.size, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawLeaves = (time: number): void => {
    for (const leaf of leaves) {
      if (!reduce.matches) {
        leaf.y += leaf.speed / 60;
        leaf.x += Math.sin((time / 1400) + leaf.phase) * 0.35;
        leaf.angle += leaf.spin;
        if (leaf.y > height + leaf.size * 2) {
          leaf.y = -leaf.size * 2;
          leaf.x = Math.random() * width;
        }
      }

      ctx.save();
      ctx.translate(leaf.x, leaf.y);
      ctx.rotate(leaf.angle);
      ctx.fillStyle = tone(dark() ? 0.22 : 0.16);
      ctx.strokeStyle = tone(dark() ? 0.34 : 0.22);
      ctx.lineWidth = 0.8;
      const s = leaf.size;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.quadraticCurveTo(s * 0.75, -s * 0.2, 0, s);
      ctx.quadraticCurveTo(-s * 0.75, -s * 0.2, 0, -s);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(0, s);
      ctx.stroke();
      ctx.restore();
    }
  };

  const paint = (time: number): void => {
    ctx.clearRect(0, 0, width, height);
    if (kind === "circuit") drawCircuit();
    else if (kind === "leaves") drawLeaves(time);
    else drawStars(time);
  };

  const loop = (time: number): void => {
    paint(time);
    frame = reduce.matches ? 0 : window.requestAnimationFrame(loop);
  };

  const start = (): void => {
    window.cancelAnimationFrame(frame);
    resize();
    frame = window.requestAnimationFrame(loop);
  };

  const stop = (): void => {
    window.cancelAnimationFrame(frame);
    frame = 0;
  };

  start();

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(start, 200);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  reduce.addEventListener("change", start);

  new MutationObserver(() => {
    if (reduce.matches) paint(performance.now());
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

initLoadBar();
hydrateImages(document);
initInfiniteScroll();
initSearch();
initSpotlight();
initSurfaceSpotlight();
// ---------- AVIF：同目录存在同名 .avif 时优先使用（封面或全站） ----------
function initAvifCovers(): void {
  if (document.documentElement.dataset.avif !== "on") return;

  const scope = document.documentElement.dataset.avifScope ?? "cover";
  const mode = document.documentElement.dataset.avifMode ?? "lazy";
  const selector = scope === "all" ? "img[src]" : "img[data-avif-cover]";
  const cache = new Map<string, string | null>();
  const covers = Array.from(document.querySelectorAll<HTMLImageElement>(selector));

  covers.forEach((image) => {
    const source = image.getAttribute("src") ?? "";
    if (!source) return;
    if (!/^(https?:)?\//.test(source)) return;
    if (/\.(svg|gif|avif)(\?.*)?$/i.test(source)) return;

    // lazy 策略：只替换尚未开始加载的懒加载图，避免原图与 AVIF 各下载一次
    if (mode === "lazy") {
      if (image.loading !== "lazy") return;
      if (image.complete && image.naturalWidth > 0) return;
      if (image.getBoundingClientRect().top < window.innerHeight) return;
    }

    // AVIF 文件不带 Halo 的缩放参数，去掉查询串
    const candidate = source.split("?")[0].replace(/\.(png|jpe?g|webp)$/i, ".avif");
    if (candidate === source) return;

    const apply = (url: string): void => {
      const original = image.getAttribute("srcset");
      image.removeAttribute("srcset");
      image.setAttribute("sizes", "");
      image.addEventListener(
        "error",
        () => {
          if (original) image.setAttribute("srcset", original);
          image.setAttribute("src", source);
        },
        { once: true },
      );
      image.src = url;
    };

    const cached = cache.get(candidate);
    if (cached) {
      apply(cached);
      return;
    }
    if (cached === null) return;

    fetch(candidate, { method: "HEAD" })
      .then((response) => {
        if (!response.ok) {
          cache.set(candidate, null);
          return;
        }
        cache.set(candidate, candidate);
        apply(candidate);
      })
      .catch(() => cache.set(candidate, null));
  });
}

// ---------- 旧页面缓存引用了已删除的哈希资源时，自动刷新一次 ----------
function initAssetReload(): void {
  window.addEventListener("load", () => {
    try {
      const links = Array.from(
        document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href*="/themes/"]'),
      );
      if (links.length === 0 || links.every((link) => link.sheet)) return;
      const key = "strata-asset-reload";
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last < 10_000) return;
      sessionStorage.setItem(key, String(Date.now()));
      const url = new URL(location.href);
      url.searchParams.set("v", String(Date.now()));
      location.replace(url.toString());
    } catch {
      /* 忽略存储或 URL 异常 */
    }
  });
}
initAvifCovers();
initAssetReload();
initMenu();
initLightbox();
initExternalLinks();
initStats();
initBackgroundEffect();
initCoverFallback();
initLinkPreviews();
initPrefetch();
initToTop();
initGuestbookMarquee();
initCoverFallback();
initLinkPreviews();

// ---------- 友情链接：提交表单写入待审核评论 ----------
function initFriendForm(): void {
  const section = document.querySelector<HTMLElement>("[data-friend-form]");
  if (!section) return;

  const form = section.querySelector<HTMLFormElement>("form");
  const status = section.querySelector<HTMLElement>("[data-friend-status]");
  const button = section.querySelector<HTMLButtonElement>("button[type='submit']");
  const page = section.dataset.page ?? "";
  if (!form || !status || !button || !page) return;

  const setStatus = (text: string, state = ""): void => {
    status.textContent = text;
    status.dataset.state = state;
  };

  const escapeHtml = (value: string): string =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const read = (name: string): string => {
    const field = form.elements.namedItem(name);
    return field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement
      ? field.value.trim()
      : "";
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = read("name");
    const url = read("url");
    const email = read("email");
    const avatar = read("avatar");
    const description = read("description");
    const rss = read("rss");

    if (!name || !url) {
      setStatus("请填写网站名称和网站地址", "error");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setStatus("网站地址需要以 http:// 或 https:// 开头", "error");
      return;
    }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setStatus("邮箱格式看起来不对", "error");
      return;
    }

    const rows = [
      ["名称", name],
      ["网址", url],
      ["邮箱", email],
      ["头像", avatar],
      ["RSS", rss],
      ["简介", description],
    ].filter(([, value]) => value);

    const html =
      "<p><strong>友链申请</strong></p><ul>" +
      rows.map(([label, value]) => `<li>${label}：${escapeHtml(value)}</li>`).join("") +
      "</ul>";
    const raw =
      "友链申请\n" + rows.map(([label, value]) => `- ${label}：${value}`).join("\n");

    const payload = {
      raw,
      content: html,
      allowNotification: true,
      hidden: false,
      subjectRef: { group: "content.halo.run", kind: "SinglePage", name: page, version: "v1alpha1" },
      owner: { displayName: name, email: email || undefined, website: url },
    };

    button.disabled = true;
    setStatus("提交中…");

    const endpoint =
      "/apis/api.halo.run/v1alpha1/comments" +
      `?group=content.halo.run&kind=SinglePage&name=${encodeURIComponent(page)}&version=v1alpha1`;

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((response) => {
        if (response.ok) {
          setStatus("提交成功，等待站长审核", "ok");
          form.reset();
          return;
        }
        if (response.status === 403) {
          setStatus("本站暂未开放匿名提交，请通过邮件联系站长", "error");
          return;
        }
        setStatus("提交失败（" + response.status + "），请稍后再试", "error");
      })
      .catch(() => setStatus("网络异常，请稍后再试", "error"))
      .finally(() => {
        button.disabled = false;
      });
  });
}

initFriendForm();
// ---------- 站内链接预取 ----------
function initPrefetch(): void {
  if (strataConfig().perf?.prefetch === false) return;

  const seen = new Set<string>();
  const prefetch = (href: string): void => {
    if (seen.has(href) || seen.size >= 6) return;
    seen.add(href);
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "document";
    link.href = href;
    document.head.appendChild(link);
  };

  document.addEventListener("pointerover", (event) => {
    const anchor = (event.target as Element | null)?.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return;
    if (anchor.origin !== location.origin) return;
    if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
    prefetch(anchor.pathname + anchor.search);
  });
}

initPrefetch();
// ---------- 留言板：最新留言滚动 ----------
function initGuestbookMarquee(): void {
  const section = document.querySelector<HTMLElement>("[data-marquee]");
  const groups = section?.querySelectorAll<HTMLElement>("[data-marquee-group]");
  const page = section?.dataset.page;
  if (!section || !groups || groups.length === 0 || !page) return;

  const escapeHtml = (value: string): string =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const url =
    "/apis/api.halo.run/v1alpha1/comments" +
    `?group=content.halo.run&kind=SinglePage&name=${encodeURIComponent(page)}&version=v1alpha1&page=1&size=10&withReplies=false`;

  fetch(url, { headers: { Accept: "application/json" } })
    .then((response) => (response.ok ? response.json() : null))
    .then((data: { items?: Array<{ owner?: { displayName?: string; avatar?: string }; spec?: { raw?: string } }> } | null) => {
      const items = data?.items ?? [];
      if (items.length === 0) return;

      const html = items
        .map((comment) => {
          const name = escapeHtml(comment.owner?.displayName || "访客");
          const avatar = comment.owner?.avatar ?? "";
          const text = escapeHtml((comment.spec?.raw ?? "").replace(/<[^>]*>/g, "").slice(0, 80));
          const avatarTag = avatar
            ? `<img class="marquee__avatar" src="${escapeHtml(avatar)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
            : "";
          return `<li class="marquee__item">${avatarTag}<div class="marquee__body"><span class="marquee__name">${name}</span><p class="marquee__text">${text}</p></div></li>`;
        })
        .join("");

      groups.forEach((group) => {
        group.innerHTML = html;
      });
      section.hidden = false;
    })
    .catch(() => undefined);
}

initGuestbookMarquee();
// ---------- 浅色模式：夜间自动调暗 ----------
function initNightDim(): void {
  type NightConfig = { enabled?: boolean; start?: number; end?: number };
  const config = (window as unknown as { __STRATA__?: { nightDim?: NightConfig } }).__STRATA__?.nightDim;
  if (!config?.enabled) return;

  const start = Number(config.start ?? 20);
  const end = Number(config.end ?? 6);

  const apply = (): void => {
    const hour = new Date().getHours();
    const night = start <= end ? hour >= start && hour < end : hour >= start || hour < end;
    document.documentElement.dataset.night = night ? "1" : "0";
  };

  apply();
  window.setInterval(apply, 60_000);
  document.addEventListener("visibilitychange", apply);
}

initNightDim();
// ---------- 回到顶部 ----------
function initToTop(): void {
  const button = document.querySelector<HTMLButtonElement>("[data-to-top]");
  if (!button) return;

  const update = (): void => {
    button.hidden = window.scrollY < 480;
  };

  window.addEventListener("scroll", update, { passive: true });
  update();

  button.addEventListener("click", () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  });
}

initToTop();

// ---------- 链接卡片封面加载失败时回退到文字占位 ----------
function initCoverFallback(): void {
  document.addEventListener(
    "error",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement)) return;
      if (!target.closest(".link-card__cover")) return;
      target.remove();
    },
    true,
  );
}

// ---------- 链接卡片：常用平台的预览图 ----------
function derivePreviewUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    const parts = url.pathname.split("/").filter(Boolean);
    if (host === "github.com") {
      if (parts.length >= 2) {
        return `https://opengraph.githubassets.com/1/${parts[0]}/${parts[1]}`;
      }
      if (parts.length === 1) {
        return `https://github.com/${parts[0]}.png?size=400`;
      }
    }
    return "";
  } catch {
    return "";
  }
}

function initLinkPreviews(): void {
  const grid = document.querySelector<HTMLElement>("[data-auto-preview]");
  if (!grid) return;

  const endpoint = grid.dataset.previewEndpoint ?? "";

  const upgrade = (src: string): string =>
    src.startsWith("http://") ? `https://${src.slice(7)}` : src;

  const appendCover = (cover: HTMLElement, src: string): void => {
    if (!src || cover.querySelector("img")) return;
    const image = document.createElement("img");
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.src = upgrade(src);
    cover.appendChild(image);
  };

  grid.querySelectorAll<HTMLElement>(".link-card[data-url]").forEach((card) => {
    const cover = card.querySelector<HTMLElement>(".link-card__cover");
    if (!cover || cover.querySelector("img")) return;

    const target = card.dataset.url ?? "";

    if (endpoint && target.startsWith("http")) {
      fetch(`${endpoint}?url=${encodeURIComponent(target)}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { ok?: boolean; image?: string; description?: string } | null) => {
          if (!data?.ok) return;
          if (data.image) appendCover(cover, data.image);
          const body = card.querySelector(".link-card__body");
          if (!card.querySelector(".link-card__desc") && data.description) {
            const paragraph = document.createElement("p");
            paragraph.className = "link-card__desc";
            paragraph.textContent = String(data.description).slice(0, 120);
            body?.appendChild(paragraph);
          }
        })
        .catch(() => undefined);
      return;
    }

    appendCover(cover, derivePreviewUrl(target));
  });
}
// ---------- 非常规比例封面的自适应 ----------
function initCoverFit(): void {
  const mode = document.documentElement.dataset.coverMode ?? "auto";
  if (mode === "cover") return;

  const apply = (image: HTMLImageElement): void => {
    if (!image.naturalWidth || !image.naturalHeight) return;
    const ratio = image.naturalWidth / image.naturalHeight;
    const box = image.closest<HTMLElement>(".post-card__cover, .post-hero");
    if (!box) return;

    if (mode === "contain") {
      image.style.objectFit = "contain";
      applyLetterboxStyle(image, box);
      return;
    }

    // auto：封面高度跟着图片比例走，并夹在合理区间内
    const cover = image.closest<HTMLElement>(".post-card__cover");
    if (!cover) {
      // 文章 Banner：图片居中，两侧用同图高斯模糊填充
      image.style.objectFit = "contain";
      applyLetterboxStyle(image, box);
      return;
    }

    const card = image.closest<HTMLElement>(".post-card");
    const configured = (card?.dataset.ratio ?? "4:3").split(":");
    const target = Number(configured[0]) / Number(configured[1]) || 4 / 3;
    if (!Number.isFinite(target) || Math.abs(ratio - target) / target < 0.08) return;

    // 无缝贴边：封面铺满卡片高度，图片裁剪填满，四边都不留空
    if (card?.dataset.fit === "flush") {
      const column = getComputedStyle(card).flexDirection === "column";
      box.classList.remove("is-letterboxed");
      image.style.objectFit = "cover";
      cover.style.aspectRatio = "auto";
      cover.style.height = "auto";
      // 上下堆叠时高度由图片比例决定，夹在 96–360px，避免竖图把卡片撑得太高
      cover.style.minHeight = column ? "96px" : "0";
      cover.style.maxHeight = column ? "360px" : "none";
      cover.style.alignSelf = "stretch";
      return;
    }

    box.classList.remove("is-letterboxed");
    image.style.objectFit = "cover";
    cover.style.aspectRatio = String(ratio);
    cover.style.height = "auto";
    cover.style.minHeight = "96px";
    cover.style.maxHeight = "360px";
    cover.style.alignSelf = "center";
  };

  document
    .querySelectorAll<HTMLImageElement>(".post-card__cover img, .post-hero__bg")
    .forEach((image) => {
      if (image.complete) apply(image);
      else image.addEventListener("load", () => apply(image), { once: true });
    });

  // 无限滚动 / 懒加载后新增的封面
  document.addEventListener(
    "load",
    (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;
      if (image.closest(".post-card__cover") || image.classList.contains("post-hero__bg")) {
        apply(image);
      }
    },
    true,
  );
}

initCoverFit();
// 完整显示的封面：给容器加模糊底图，避免两侧/上下出现硬边空白
function applyLetterboxStyle(image: HTMLImageElement, box: HTMLElement): void {
  const src = image.currentSrc || image.src;
  if (!src) return;
  box.classList.add("is-letterboxed");
  box.style.setProperty("--cover-src", `url("${src}")`);
}
// ---------- 自定义内容里的卡片：指针高光 ----------
function initSurfaceSpotlight(): void {
  if (!strataConfig().spotlight) return;

  const mark = (): void => {
    document
      .querySelectorAll<HTMLElement>(".raw-page .surface:not([data-spotlight])")
      .forEach((card) => card.setAttribute("data-spotlight", "on"));
  };

  mark();
  // 插件可能异步插入卡片
  document.addEventListener("halo:comment-loaded", mark);
}