// 文章页增强：目录（TOC）与阅读进度条

const content = document.querySelector<HTMLElement>("[data-content]");

function buildToc(): void {
  if (!content) return;

  const lists = Array.from(document.querySelectorAll<HTMLElement>("[data-toc-list]"));
  if (lists.length === 0) return;

  const rawDepth = Number(
    (
      window as unknown as { __STRATA__?: { tocDepth?: number | string } }
    ).__STRATA__?.tocDepth ?? 3,
  );
  const depth = Math.min(4, Math.max(2, Number.isFinite(rawDepth) ? rawDepth : 3));
  const selector = Array.from({ length: depth - 1 }, (_, index) => `h${index + 2}`).join(", ");
  const headings = Array.from(content.querySelectorAll<HTMLHeadingElement>(selector));

  // 没有足够的小标题时，目录没有意义，移除所有目录容器
  if (headings.length < 2) {
    document.querySelectorAll<HTMLElement>("[data-toc], .toc-inline, .toc-mobile, .toc-fab, [data-toc-drawer]").forEach((el) => {
      el.remove();
    });
    return;
  }

  const ids: string[] = headings.map((heading, index) => {
    if (!heading.id) {
      heading.id = `section-${index + 1}`;
    }
    return heading.id;
  });

  const links: HTMLAnchorElement[] = [];

  lists.forEach((list) => {
    headings.forEach((heading, index) => {
      const item = document.createElement("li");
      item.className = `toc-lv${Number(heading.tagName.slice(1))}`;

      const link = document.createElement("a");
      link.href = `#${ids[index]}`;
      link.textContent = heading.textContent?.trim() || `第 ${index + 1} 节`;
      link.dataset.target = ids[index];

      item.appendChild(link);
      list.appendChild(item);
      links.push(link);
    });
  });

  const setActive = (id: string): void => {
    links.forEach((link) => {
      link.classList.toggle("is-active", link.dataset.target === id);
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActive((entry.target as HTMLElement).id);
        }
      });
    },
    { rootMargin: "-84px 0px -70% 0px", threshold: 0 },
  );

  headings.forEach((heading) => observer.observe(heading));
}

function trackProgress(): void {
  if (!content) return;

  const bar = document.querySelector<HTMLElement>("[data-progress]");
  if (!bar) return;

  bar.hidden = false;
  let ticking = false;

  const update = (): void => {
    const rect = content.getBoundingClientRect();
    const viewport = window.innerHeight;
    const span = rect.height - viewport * 0.6;
    const passed = -rect.top + viewport * 0.3;
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - viewport;
    const ratio =
      span > 0
        ? Math.min(1, Math.max(0, passed / span))
        : scrollable > 0
          ? Math.min(1, Math.max(0, window.scrollY / scrollable))
          : 0;
    bar.style.setProperty("--read-progress", String(ratio));
    ticking = false;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  window.addEventListener("resize", update);

  update();
}

buildToc();
trackProgress();

// ---------- 移动端目录抽屉 ----------
function initTocDrawer(): void {
  const fab = document.querySelector<HTMLButtonElement>("[data-toc-fab]");
  const drawer = document.querySelector<HTMLElement>("[data-toc-drawer]");
  const panel = drawer?.querySelector<HTMLElement>(".toc-drawer__panel");
  if (!fab || !drawer || !panel) return;

  let timer = 0;

  const open = (): void => {
    window.clearTimeout(timer);
    drawer.hidden = false;
    fab.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("no-scroll");
    window.requestAnimationFrame(() => {
      drawer.classList.add("is-open");
      panel.focus({ preventScroll: true });
    });
  };

  const close = (): void => {
    drawer.classList.remove("is-open");
    fab.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("no-scroll");
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      drawer.hidden = true;
    }, 240);
    fab.focus({ preventScroll: true });
  };

  fab.addEventListener("click", () => {
    if (drawer.hidden) open();
    else close();
  });

  drawer.querySelectorAll("[data-toc-close]").forEach((el) => {
    el.addEventListener("click", close);
  });

  drawer.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", close);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !drawer.hidden) close();
  });
}

/** 复制文本：优先 Clipboard API，非安全上下文回退到 execCommand */
async function copyText(text: string): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 继续尝试回退方案
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
type StrataLabels = { copy?: string; copied?: string; copyFailed?: string };
function labels(): StrataLabels {
  return (window as unknown as { __STRATA__?: { labels?: StrataLabels } }).__STRATA__?.labels ?? {};
}

// ---------- 代码块复制 ----------
function initCodeCopy(): void {
  if (!content) return;

  content.querySelectorAll<HTMLPreElement>("pre").forEach((pre) => {
    if (pre.closest(".no-copy") || pre.querySelector(".code-copy")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "code-copy";
    button.setAttribute("aria-label", labels().copy ?? "复制代码");
    button.setAttribute("aria-live", "polite");
    button.textContent = labels().copy ?? "复制";

    button.addEventListener("click", () => {
      const code = pre.querySelector("code")?.textContent ?? pre.textContent ?? "";
      const done = (label: string): void => {
        button.textContent = label;
        window.setTimeout(() => {
          button.textContent = labels().copy ?? "复制";
        }, 1600);
      };
      copyText(code).then((ok) => done(ok ? labels().copied ?? "已复制" : labels().copyFailed ?? "复制失败"));
    });

    pre.appendChild(button);
  });
}

initTocDrawer();
initCodeCopy();
// ---------- 点赞 / 收藏 ----------
/** 加入浏览器收藏夹：优先使用宿主提供的 addFavorite，其次兼容旧浏览器 */
function addFavorite(): void {
  const host = window as unknown as {
    addFavorite?: () => void;
    external?: { AddFavorite?: (url: string, title: string) => void };
    sidebar?: { addPanel?: (url: string, title: string) => void };
  };
  if (typeof host.addFavorite === "function" && host.addFavorite !== addFavorite) {
    host.addFavorite();
    return;
  }
  if (host.sidebar?.addPanel) {
    host.sidebar.addPanel(location.href, document.title);
    return;
  }
  if (host.external?.AddFavorite) {
    host.external.AddFavorite(location.href, document.title);
  }
}

function initPostActions(): void {
  const status = document.querySelector<HTMLElement>("[data-post-status]");
  const setStatus = (text: string, state = ""): void => {
    if (!status) return;
    status.textContent = text;
    status.dataset.state = state;
    if (state === "ok") {
      window.setTimeout(() => {
        status.textContent = "";
        status.dataset.state = "";
      }, 2400);
    }
  };

  document.querySelector<HTMLButtonElement>("[data-favorite]")?.addEventListener("click", () => {
    addFavorite();
    setStatus("按 Ctrl/⌘ + D 收藏本文", "ok");
  });

  const button = document.querySelector<HTMLButtonElement>("[data-upvote]");
  const count = document.querySelector<HTMLElement>("[data-upvote-count]");
  if (!button) return;

  const name = button.dataset.name ?? "";
  const key = `strata-upvote:${name}`;
  let voted = false;
  try {
    voted = localStorage.getItem(key) === "1";
  } catch {
    voted = false;
  }
  if (voted) button.setAttribute("aria-pressed", "true");

  button.addEventListener("click", () => {
    if (voted) {
      setStatus("已经点过赞啦", "ok");
      return;
    }
    if (!name) return;

    button.disabled = true;
    fetch("/apis/api.halo.run/v1alpha1/trackers/upvote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        group: "content.halo.run",
        plural: "posts",
        name,
      }),
    })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        voted = true;
        button.setAttribute("aria-pressed", "true");
        try {
          localStorage.setItem(key, "1");
        } catch {
          /* 忽略隐私模式下的写入失败 */
        }
        if (count) count.textContent = String(Number(count.textContent ?? "0") + 1);
        setStatus("感谢点赞", "ok");
      })
      .catch(() => setStatus("点赞失败，请稍后再试"))
      .finally(() => {
        button.disabled = false;
      });
  });
}

initPostActions();