import { version } from "../package.json";
import { toPng } from "html-to-image";
import {
  MAX_IMAGE,
  PROTOCOL,
  sourceLocation,
  validSnapshot,
  type Locator,
  type ParentMessage,
  type Snapshot,
} from "./shared/model";

const script = document.currentScript as HTMLScriptElement | null;
const allowedOrigins: string[] = JSON.parse(script?.dataset.origins ?? "[]");
const PRIVATE =
  'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[data-private],[data-visual-edit-private]';
const SOURCE = "data-dsh-ve-source";
let parentOrigin = "";
let channel = "";
let picking = false;
let disposed = false;
let capturing = false;
const overlay = document.createElement("div");
overlay.setAttribute("data-visual-edit-overlay", "");
overlay.style.cssText =
  "position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #4265e8;background:rgba(66,101,232,.08);display:none;box-sizing:border-box;border-radius:3px;";
document.documentElement.appendChild(overlay);

function send(message: Record<string, unknown>): void {
  if (parentOrigin && channel && !disposed)
    window.parent.postMessage(
      { ...message, protocol: PROTOCOL, channel },
      parentOrigin,
    );
}
function publicUrl(): string {
  return location.origin + location.pathname;
}
async function pageKey(): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(location.href),
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
async function snapshot(node: HTMLElement): Promise<Snapshot> {
  const key = await pageKey();
  const r = node.getBoundingClientRect();
  const css = getComputedStyle(node);
  const styles = Object.fromEntries(
    [
      "color",
      "backgroundColor",
      "fontSize",
      "fontWeight",
      "width",
      "height",
      "padding",
      "borderRadius",
      "display",
      "whiteSpace",
    ].map((k) => [k, css[k as any].slice(0, 250)]),
  );
  const s: Snapshot = {
    url: publicUrl(),
    pageKey: key,
    capturedAt: new Date().toISOString(),
    viewport: { width: innerWidth, height: innerHeight },
    locator: locator(node),
    text: safeText(node),
    styles,
    rect: { width: r.width, height: r.height, x: r.x, y: r.y },
  };
  if (node.closest(PRIVATE)) s.warning = "privateElement";
  else if (!r.width || !r.height || r.width > 1600 || r.height > 1600)
    s.warning = "snapshotSize";
  else {
    try {
      const image = await toPng(node, {
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
  if (
    actual.tag !== target.locator.tag ||
    (target.locator.id && node.id !== target.locator.id) ||
    (target.locator.testId && actual.testId !== target.locator.testId) ||
    (target.locator.source &&
      actual.source?.file !== target.locator.source.file) ||
    (target.locator.source &&
      !target.locator.id &&
      !target.locator.testId &&
      (actual.source?.line !== target.locator.source.line ||
        actual.source?.column !== target.locator.source.column))
  )
    throw new Error("elementChanged");
  return node;
}
function stopPick(): void {
  picking = false;
  overlay.style.display = "none";
  send({ type: "pick-ended" });
}
const move = (e: MouseEvent): void => {
  if (picking && eligible(e.target)) pointTo(e.target);
};
const click = async (e: MouseEvent): Promise<void> => {
  if (!picking || !eligible(e.target)) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  if (capturing) return;
  const node = e.target;
  stopPick();
  capturing = true;
  try {
    send({ type: "selected", snapshot: await snapshot(node) });
  } catch (error) {
    send({
      type: "error",
      message: error instanceof Error ? error.message : "snapshotUnavailable",
    });
  } finally {
    capturing = false;
  }
};
const keydown = (e: KeyboardEvent): void => {
  if (picking && e.key === "Escape") {
    e.preventDefault();
    stopPick();
  }
};
const message = async (e: MessageEvent): Promise<void> => {
  const m = e.data as ParentMessage;
  if (
    e.source !== window.parent ||
    !allowedOrigins.includes(e.origin) ||
    !m ||
    m.protocol !== PROTOCOL ||
    typeof m.channel !== "string" ||
    m.channel.length < 16 ||
    m.channel.length > 128
  )
    return;
  if (m.type === "hello") {
    parentOrigin = e.origin;
    channel = m.channel;
    send({ type: "ready", version });
    return;
  }
  if (e.origin !== parentOrigin || m.channel !== channel) return;
  if (m.type === "pick" && typeof m.enabled === "boolean") {
    picking = m.enabled;
    if (!picking) overlay.style.display = "none";
    return;
  }
  if (m.type === "disconnect") {
    stopPick();
    channel = "";
    parentOrigin = "";
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
      innerWidth !== m.snapshot.viewport.width ||
      innerHeight !== m.snapshot.viewport.height
    )
      throw new Error("pageOrViewportChanged");
    const node = resolve(m.snapshot);
    if (m.type === "highlight") {
      node.scrollIntoView({ block: "center" });
      pointTo(node);
      setTimeout(() => {
        if (!picking) overlay.style.display = "none";
      }, 1400);
      return;
    }
    send({ type: "captured", requestId, snapshot: await snapshot(node) });
  } catch (error) {
    send({
      type: "error",
      requestId,
      message: error instanceof Error ? error.message : "snapshotUnavailable",
    });
  }
};
window.addEventListener("message", message);
document.addEventListener("mousemove", move, true);
document.addEventListener("click", click, true);
document.addEventListener("keydown", keydown, true);
window.addEventListener(
  "pagehide",
  () => {
    disposed = true;
    overlay.remove();
    window.removeEventListener("message", message);
    document.removeEventListener("mousemove", move, true);
    document.removeEventListener("click", click, true);
    document.removeEventListener("keydown", keydown, true);
  },
  { once: true },
);
