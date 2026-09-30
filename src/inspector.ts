import { version } from "../package.json";
import { toPng } from "html-to-image";
import {
  PRIVATE,
  OVERLAY,
  styles,
  digest,
  documentRect,
  originalRegion,
  visualFacts,
  regionText,
  regionImage,
} from "./annotation";
import {
  MAX_IMAGE,
  PROTOCOL,
  sourceLocation,
  validSnapshot,
  snapshotUrl,
  type Locator,
  type ParentMessage,
  type Snapshot,
  type SelectionMode,
  type Annotation,
  type Point,
  type Rect,
} from "./shared/model";

const script = document.currentScript as HTMLScriptElement | null;
type Boot = {
  kind: "frame" | "webview";
  channel: string;
  key: string;
  pageUrl: string;
  parentOrigin: string;
};
const globals = globalThis as typeof globalThis & {
  __DSH_VE_BOOT__?: Boot;
  __DSH_VE_DISPOSE__?: () => void;
};
const boot = globals.__DSH_VE_BOOT__;
delete globals.__DSH_VE_BOOT__;
if (typeof globals.__DSH_VE_DISPOSE__ === "function")
  globals.__DSH_VE_DISPOSE__();
const allowedOrigins: string[] = boot
  ? [boot.parentOrigin]
  : JSON.parse(script?.dataset.origins ?? "[]");
const events: Record<string, unknown>[] = [];
const SOURCE = "data-dsh-ve-source";
let parentOrigin = "";
let channel = boot?.channel ?? "";
let picking = false;
let disposed = false;
let capturing = false;
let mode: SelectionMode = "element";
let drag: Point | undefined;
let suppressClick = false;
let watching: { id: string; snapshot: Snapshot; key?: string }[] = [];
let watchTimer: ReturnType<typeof setTimeout> | undefined;
const overlay = document.createElement("div");
overlay.setAttribute("data-visual-edit-overlay", "");
overlay.style.cssText =
  "position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #4265e8;background:rgba(66,101,232,.08);display:none;box-sizing:border-box;border-radius:3px;";
document.documentElement.appendChild(overlay);

function send(message: Record<string, unknown>): void {
  if (boot?.kind === "webview" && !disposed) {
    if (events.length < 12)
      events.push({ ...message, protocol: PROTOCOL, channel });
    return;
  }
  if (parentOrigin && channel && !disposed)
    window.parent.postMessage(
      { ...message, protocol: PROTOCOL, channel },
      parentOrigin,
    );
}
function publicUrl(): string {
  return snapshotUrl(boot?.pageUrl ?? location.href);
}
async function pageKey(): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      boot?.kind === "frame" ? boot.pageUrl : location.href,
    ),
  );
  return Array.from(new Uint8Array(bytes), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
function eligible(node: EventTarget | null): node is HTMLElement {
  return (
    node instanceof HTMLElement &&
    node !== overlay &&
    !node.closest("[data-visual-edit-overlay]") &&
    !["HTML", "BODY", "SCRIPT", "STYLE"].includes(node.tagName)
  );
}
function pointTo(node: HTMLElement): void {
  const r = node.getBoundingClientRect();
  overlay.style.display = "block";
  Object.assign(overlay.style, {
    border: "2px solid #4265e8",
    background: "rgba(66,101,232,.08)",
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
  });
}
function selector(node: HTMLElement): string {
  if (
    node.id &&
    node.id.length <= 200 &&
    document.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1
  )
    return `#${CSS.escape(node.id)}`;
  const testId = node.getAttribute("data-testid");
  if (testId && testId.length <= 200) {
    const value = `[data-testid="${CSS.escape(testId)}"]`;
    if (document.querySelectorAll(value).length === 1) return value;
  }
  const parts: string[] = [];
  let el: Element | null = node;
  while (el && el !== document.documentElement && parts.length < 14) {
    const tag = el.tagName.toLowerCase();
    const siblings = el.parentElement
      ? Array.from(el.parentElement.children).filter(
          (s) => s.tagName === el!.tagName,
        )
      : [el];
    parts.unshift(
      siblings.length > 1
        ? `${tag}:nth-of-type(${siblings.indexOf(el) + 1})`
        : tag,
    );
    const value = parts.join(" > ");
    if (document.querySelectorAll(value).length === 1) return value;
    el = el.parentElement;
  }
  throw new Error("elementNotUnique");
}
function locator(node: HTMLElement): Locator {
  let source;
  const raw =
    node.getAttribute(SOURCE) ??
    node.closest(`[${SOURCE}]`)?.getAttribute(SOURCE);
  try {
    source = sourceLocation(JSON.parse(raw ?? "null"));
  } catch {
    /* No source metadata on plain HTML. */
  }
  return {
    selector: selector(node),
    tag: node.tagName.toLowerCase(),
    source,
    ...(node.id && node.id.length <= 200 ? { id: node.id } : {}),
    ...(node.dataset.testid && node.dataset.testid.length <= 200
      ? { testId: node.dataset.testid }
      : {}),
  };
}
function safeText(node: HTMLElement): string {
  if (node.closest(PRIVATE)) return "[private element]";
  const clone = node.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(`${PRIVATE},script,style`)
    .forEach((el) => el.remove());
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 2000);
}
async function snapshot(
  node: HTMLElement,
  annotation?: Annotation,
  fallback?: Snapshot,
): Promise<Snapshot> {
  const key = await pageKey();
  const r = node.getBoundingClientRect();
  const css = getComputedStyle(node);
  const region =
    annotation?.region ?? (fallback ? originalRegion(fallback) : undefined);
  const s: Snapshot = {
    url: publicUrl(),
    pageKey: key,
    capturedAt: new Date().toISOString(),
    viewport: { width: innerWidth, height: innerHeight },
    locator: fallback?.locator ?? locator(node),
    text: region ? regionText(region) : safeText(node),
    styles: fallback ? {} : styles(node),
    rect: region
      ? { ...region, x: region.x - scrollX, y: region.y - scrollY }
      : { width: r.width, height: r.height, x: r.x, y: r.y },
    scroll: { x: scrollX, y: scrollY },
    visualKey: await digest(visualFacts(node, region)),
    ...(annotation ? { annotation } : {}),
    ...(fallback ? { fallbackRegion: true } : {}),
  };
  if (node.closest(PRIVATE)) s.warning = "privateElement";
  else if (
    !region &&
    (!r.width || !r.height || r.width > 1600 || r.height > 1600)
  )
    s.warning = "snapshotSize";
  else {
    try {
      const image =
        region || boot
          ? await regionImage(region ?? documentRect(node), annotation)
          : await toPng(node, {
              pixelRatio: 1,
              skipFonts: true,
              cacheBust: false,
              filter: (element) =>
                !(element instanceof Element) ||
                (!element.matches(PRIVATE) && element !== overlay),
              // html-to-image also applies backgroundColor to the cloned root. Restore
              // the element's own background so colored buttons are not washed out.
              backgroundColor: getComputedStyle(document.body).backgroundColor,
              style: { backgroundColor: css.backgroundColor },
            });
      if (image.length <= MAX_IMAGE) s.image = image;
      else s.warning = "snapshotSize";
    } catch {
      s.warning = "snapshotUnavailable";
    }
  }
  if (!node.isConnected || key !== (await pageKey()))
    throw new Error("pageChanged");
  return s;
}
function resolve(target: Snapshot): HTMLElement {
  let nodes: Element[];
  try {
    nodes = Array.from(document.querySelectorAll(target.locator.selector));
  } catch {
    throw new Error("elementMissing");
  }
  if (nodes.length !== 1 || !(nodes[0] instanceof HTMLElement))
    throw new Error("elementMissing");
  const node = nodes[0];
  const actual = locator(node);
  // Native HTML line numbers move when CSS or markup is added above a unique,
  // non-positional target. They are navigation hints, not that target's identity.
  const stableNativePath =
    !!boot && !/:nth-|:first-|:last-/.test(target.locator.selector);
  if (
    actual.tag !== target.locator.tag ||
    (target.locator.id && node.id !== target.locator.id) ||
    (target.locator.testId && actual.testId !== target.locator.testId) ||
    (target.locator.source &&
      actual.source?.file !== target.locator.source.file) ||
    (target.locator.source &&
      !target.locator.id &&
      !target.locator.testId &&
      !stableNativePath &&
      (actual.source?.line !== target.locator.source.line ||
        actual.source?.column !== target.locator.source.column))
  )
    throw new Error("elementChanged");
  return node;
}
function stopPick(): void {
  picking = false;
  drag = undefined;
  overlay.style.display = "none";
  overlay.replaceChildren();
  send({ type: "pick-ended" });
}
const move = (e: MouseEvent): void => {
  if (!picking) return;
  if (mode === "element" && eligible(e.target)) pointTo(e.target);
  else if (drag) {
    const to = { x: Math.max(0, e.clientX), y: Math.max(0, e.clientY) };
    Object.assign(overlay.style, {
      display: "block",
      left: "0",
      top: "0",
      width: "100%",
      height: "100%",
      border: "0",
      background: "transparent",
    });
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    const shape = document.createElementNS(svg.namespaceURI, "path");
    const a = Math.atan2(to.y - drag.y, to.x - drag.x);
    shape.setAttribute(
      "d",
      mode === "arrow"
        ? `M${drag.x} ${drag.y}L${to.x} ${to.y}M${to.x - 12 * Math.cos(a - 0.5)} ${to.y - 12 * Math.sin(a - 0.5)}L${to.x} ${to.y}L${to.x - 12 * Math.cos(a + 0.5)} ${to.y - 12 * Math.sin(a + 0.5)}`
        : `M${drag.x} ${drag.y}H${to.x}V${to.y}H${drag.x}Z`,
    );
    shape.setAttribute("fill", mode === "region" ? "#4265e814" : "none");
    shape.setAttribute("stroke", "#4265e8");
    shape.setAttribute("stroke-width", "2");
    svg.append(shape);
    overlay.replaceChildren(svg);
  }
};
async function selected(node: HTMLElement, annotation?: Annotation) {
  stopPick();
  capturing = true;
  try {
    send({ type: "selected", snapshot: await snapshot(node, annotation) });
  } catch (error) {
    send({
      type: "error",
      message: error instanceof Error ? error.message : "snapshotUnavailable",
    });
  } finally {
    capturing = false;
    scheduleWatch();
  }
}
const down = (e: MouseEvent) => {
  if (!picking || e.button !== 0 || mode === "element") return;
  e.preventDefault();
  e.stopImmediatePropagation();
  drag = { x: Math.max(0, e.clientX), y: Math.max(0, e.clientY) };
};
const up = (e: MouseEvent) => {
  if (!picking || !drag || mode === "element") return;
  e.preventDefault();
  e.stopImmediatePropagation();
  suppressClick = true;
  setTimeout(() => {
    suppressClick = false;
  }, 100);
  const from = { x: drag.x + scrollX, y: drag.y + scrollY };
  const to = {
    x: Math.max(0, Math.min(innerWidth, e.clientX)) + scrollX,
    y: Math.max(0, Math.min(innerHeight, e.clientY)) + scrollY,
  };
  if (Math.hypot(to.x - from.x, to.y - from.y) < 6) {
    drag = undefined;
    return;
  }
  const node = eligible(e.target) ? e.target : document.body;
  const bounds =
    mode === "arrow" && eligible(node)
      ? documentRect(node)
      : { x: to.x, y: to.y, width: 0, height: 0 };
  const pad = mode === "arrow" ? 16 : 0;
  const x = Math.max(0, Math.min(from.x, to.x, bounds.x) - pad);
  const y = Math.max(0, Math.min(from.y, to.y, bounds.y) - pad);
  const region: Rect = {
    x,
    y,
    width: Math.max(
      1,
      Math.max(from.x, to.x, bounds.x + bounds.width) + pad - x,
    ),
    height: Math.max(
      1,
      Math.max(from.y, to.y, bounds.y + bounds.height) + pad - y,
    ),
  };
  void selected(
    node,
    mode === "arrow"
      ? { kind: "arrow", region, from, to }
      : { kind: "region", region },
  );
};
const click = async (e: MouseEvent): Promise<void> => {
  if (suppressClick) {
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }
  if (!picking) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  if (capturing || mode !== "element" || !eligible(e.target)) return;
  await selected(e.target);
};
const keydown = (e: KeyboardEvent): void => {
  if (picking && e.key === "Escape") {
    e.preventDefault();
    stopPick();
  }
};
function scheduleWatch() {
  if (watchTimer || disposed || !watching.length) return;
  watchTimer = setTimeout(() => {
    watchTimer = undefined;
    if (capturing || picking) {
      scheduleWatch();
      return;
    }
    void checkWatched();
  }, 700);
}
async function checkWatched() {
  const changed: string[] = [];
  const current = watching;
  for (const item of current) {
    if (item.snapshot.pageKey !== (await pageKey())) continue;
    let node: HTMLElement | undefined;
    try {
      node = resolve(item.snapshot);
    } catch {
      /* Capture the original area if removed. */
    }
    const region =
      item.snapshot.annotation?.region ??
      (!node || item.snapshot.fallbackRegion
        ? originalRegion(item.snapshot)
        : undefined);
    const key = await digest(visualFacts(node, region));
    if (key !== item.key) {
      item.key = key;
      changed.push(item.id);
    }
  }
  if (current === watching && changed.length)
    send({ type: "page-changed", ids: changed });
}
const observer = new MutationObserver((records) => {
  if (
    records.some(
      (record) =>
        !(
          record.target instanceof Element
            ? record.target
            : record.target.parentElement
        )?.closest(OVERLAY),
    )
  )
    scheduleWatch();
});
observer.observe(document.documentElement, {
  subtree: true,
  childList: true,
  attributes: true,
  characterData: true,
});
const handle = async (m: ParentMessage): Promise<void> => {
  if (
    !m ||
    m.protocol !== PROTOCOL ||
    typeof m.channel !== "string" ||
    m.channel.length < 16 ||
    m.channel.length > 128 ||
    (boot && m.channel !== boot.channel)
  )
    return;
  if (m.type === "hello") {
    channel = m.channel;
    send({ type: "ready", version });
    return;
  }
  if (m.channel !== channel) return;
  if (m.type === "pick" && typeof m.enabled === "boolean") {
    mode = ["element", "arrow", "region"].includes(m.mode ?? "")
      ? m.mode!
      : "element";
    drag = undefined;
    overlay.replaceChildren();
    picking = m.enabled;
    if (!picking) overlay.style.display = "none";
    return;
  }
  if (m.type === "watch" && Array.isArray(m.targets)) {
    watching = m.targets
      .slice(0, 50)
      .filter(
        (item) =>
          typeof item.id === "string" &&
          item.id.length <= 200 &&
          validSnapshot(item.snapshot),
      )
      .map((item) => ({
        ...item,
        key:
          item.snapshot.visualKey ??
          watching.find((old) => old.id === item.id)?.key,
      }));
    scheduleWatch();
    return;
  }
  if (m.type === "disconnect") {
    stopPick();
    channel = "";
    parentOrigin = "";
    watching = [];
    return;
  }
  if (
    (m.type !== "capture" && m.type !== "highlight") ||
    !validSnapshot(m.snapshot)
  )
    return;
  const requestId =
    m.type === "capture" && typeof m.requestId === "string"
      ? m.requestId.slice(0, 100)
      : undefined;
  try {
    if (
      (await pageKey()) !== m.snapshot.pageKey ||
      (!boot &&
        (innerWidth !== m.snapshot.viewport.width ||
          innerHeight !== m.snapshot.viewport.height))
    )
      throw new Error("pageOrViewportChanged");
    let node: HTMLElement | undefined;
    try {
      node = resolve(m.snapshot);
    } catch (error) {
      if (!boot && !m.snapshot.annotation) throw error;
    }
    if (m.type === "highlight") {
      if (node && !m.snapshot.annotation) {
        node.scrollIntoView({ block: "center" });
        pointTo(node);
      } else {
        const r = originalRegion(m.snapshot);
        window.scrollTo({ top: Math.max(0, r.y - innerHeight / 3) });
        Object.assign(overlay.style, {
          display: "block",
          left: `${r.x - scrollX}px`,
          top: `${r.y - scrollY}px`,
          width: `${r.width}px`,
          height: `${r.height}px`,
          border: "2px solid #4265e8",
          background: "rgba(66,101,232,.08)",
        });
      }
      setTimeout(() => {
        if (!picking) overlay.style.display = "none";
      }, 1400);
      return;
    }
    if (capturing) throw new Error("captureBusy");
    capturing = true;
    try {
      const result = await snapshot(
        node ?? document.body,
        m.snapshot.annotation,
        !node || m.snapshot.fallbackRegion ? m.snapshot : undefined,
      );
      if (
        innerWidth !== m.snapshot.viewport.width ||
        innerHeight !== m.snapshot.viewport.height
      )
        result.viewportChanged = true;
      send({ type: "captured", requestId, snapshot: result });
    } finally {
      capturing = false;
    }
  } catch (error) {
    send({
      type: "error",
      requestId,
      message: error instanceof Error ? error.message : "snapshotUnavailable",
    });
  }
};
const message = (e: MessageEvent): void => {
  if (e.source !== window.parent || !allowedOrigins.includes(e.origin)) return;
  if (boot && e.data?.channel !== boot.channel) return;
  if (e.data?.type === "hello") parentOrigin = e.origin;
  if (parentOrigin !== e.origin) return;
  void handle(e.data);
};
if (boot?.kind !== "webview") window.addEventListener("message", message);
document.addEventListener("mousemove", move, true);
document.addEventListener("mousedown", down, true);
document.addEventListener("mouseup", up, true);
document.addEventListener("click", click, true);
document.addEventListener("keydown", keydown, true);
window.addEventListener("resize", scheduleWatch);
document.addEventListener("load", scheduleWatch, true);
document.addEventListener("transitionend", scheduleWatch, true);
const dispose = () => {
  disposed = true;
  overlay.remove();
  observer.disconnect();
  clearTimeout(watchTimer);
  window.removeEventListener("message", message);
  document.removeEventListener("mousemove", move, true);
  document.removeEventListener("mousedown", down, true);
  document.removeEventListener("mouseup", up, true);
  document.removeEventListener("click", click, true);
  document.removeEventListener("keydown", keydown, true);
  window.removeEventListener("resize", scheduleWatch);
  document.removeEventListener("load", scheduleWatch, true);
  document.removeEventListener("transitionend", scheduleWatch, true);
  window.removeEventListener("pagehide", dispose);
  if (globals.__DSH_VE_DISPOSE__ === dispose) delete globals.__DSH_VE_DISPOSE__;
  if (boot?.kind === "webview") delete (window as any)[boot.key];
};
globals.__DSH_VE_DISPOSE__ = dispose;
if (boot?.kind === "webview")
  (window as any)[boot.key] = {
    command: handle,
    take: () => events.splice(0),
    dispose,
  };
window.addEventListener("pagehide", dispose, { once: true });
