import { toSvg } from "html-to-image";
import type { Annotation, Rect, Snapshot } from "./shared/model";

export const PRIVATE =
  'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[data-private],[data-visual-edit-private]';
export const OVERLAY = "[data-visual-edit-overlay]";
/** HTML divider comments may contain `--`, which is invalid inside an XML comment. */
export function snapshotFilter(node: Node): boolean {
  return (
    node.nodeType !== Node.COMMENT_NODE &&
    (!(node instanceof Element) ||
      !node.matches(`${PRIVATE},${OVERLAY},script`))
  );
}
export const STYLE_KEYS = [
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
];
export function styles(node: Element): Record<string, string> {
  const css = getComputedStyle(node);
  return Object.fromEntries(
    STYLE_KEYS.map((k) => [k, (css[k as any] ?? "").slice(0, 250)]),
  );
}
export async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
export function documentRect(node: Element): Rect {
  const r = node.getBoundingClientRect();
  return {
    x: r.x + scrollX,
    y: r.y + scrollY,
    width: r.width,
    height: r.height,
  };
}
export function originalRegion(target: Snapshot): Rect {
  return (
    target.annotation?.region ?? {
      ...target.rect,
      x: Math.max(0, target.rect.x + (target.scroll?.x ?? 0)),
      y: Math.max(0, target.rect.y + (target.scroll?.y ?? 0)),
      width: Math.max(1, target.rect.width),
      height: Math.max(1, target.rect.height),
    }
  );
}
function intersects(a: Rect, b: Rect) {
  return (
    a.x < b.x + b.width &&
    a.y < b.y + b.height &&
    a.x + a.width > b.x &&
    a.y + a.height > b.y
  );
}
export function unionRegions(regions: Rect[]): Rect {
  const x = Math.min(...regions.map((r) => r.x));
  const y = Math.min(...regions.map((r) => r.y));
  return {
    x,
    y,
    width: Math.max(...regions.map((r) => r.x + r.width)) - x,
    height: Math.max(...regions.map((r) => r.y + r.height)) - y,
  };
}
export function paddedRegion(region: Rect, padding = 8): Rect {
  const x = Math.max(0, region.x - padding),
    y = Math.max(0, region.y - padding);
  return {
    x,
    y,
    width: region.x + region.width + padding - x,
    height: region.y + region.height + padding - y,
  };
}
/** Expand to visible content blocks, never to page-wide layout ancestors. */
export function regionElements(region: Rect): HTMLElement[] {
  const found = new Set<HTMLElement>();
  for (const el of Array.from(
    document.body.querySelectorAll<HTMLElement>("*"),
  ).slice(0, 5000)) {
    if (
      el.closest(`${PRIVATE},${OVERLAY},script,style,head`) ||
      !intersects(documentRect(el), region)
    )
      continue;
    const css = getComputedStyle(el);
    if (
      css.visibility !== "visible" ||
      css.display === "none" ||
      css.opacity === "0"
    )
      continue;
    const text = Array.from(el.childNodes).some(
      (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
    );
    if (!text && !el.matches("img,svg,canvas,video,button")) continue;
    const block =
      el.closest<HTMLElement>(
        "h1,h2,h3,h4,h5,h6,p,li,button,a,label,td,th,pre,svg",
      ) ?? el;
    if (
      !(block instanceof HTMLElement) ||
      block === document.body ||
      block.closest(`${PRIVATE},${OVERLAY}`)
    )
      continue;
    const bounds = documentRect(block);
    if (bounds.width > 0 && bounds.height > 0 && intersects(bounds, region))
      found.add(block);
    if (found.size >= 24) break;
  }
  return [...found].filter(
    (el) => ![...found].some((parent) => parent !== el && parent.contains(el)),
  );
}
export function mapAnnotation(
  annotation: Annotation,
  before: Rect,
  after: Rect,
): Annotation {
  const sx = after.width / Math.max(1, before.width),
    sy = after.height / Math.max(1, before.height);
  const point = (p: { x: number; y: number }) => ({
    x: Math.max(0, after.x + (p.x - before.x) * sx),
    y: Math.max(0, after.y + (p.y - before.y) * sy),
  });
  const region = {
    ...point(annotation.region),
    width: Math.max(1, annotation.region.width * sx),
    height: Math.max(1, annotation.region.height * sy),
  };
  if (annotation.kind === "region") return { kind: "region", region };
  const from = point(annotation.from),
    to = point(annotation.to);
  return {
    kind: "arrow",
    region: unionRegions([
      region,
      { ...from, width: 1, height: 1 },
      { ...to, width: 1, height: 1 },
    ]),
    from,
    to,
  };
}
/** Fingerprints only the selected subtree/region; unrelated clocks do not start captures. */
export function visualFacts(
  node: HTMLElement | undefined,
  region?: Rect,
): string {
  const root = region ? document.body : node;
  if (!root) return "missing";
  const records: unknown[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (el) =>
      (el as Element).matches(`${PRIVATE},${OVERLAY},script,style,link,meta`)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  let current: Node | null = root;
  let visited = 0;
  while (current && visited++ < 5000 && records.length < 1000) {
    const el = current as HTMLElement;
    const rect = documentRect(el);
    if (
      !el.closest(`${PRIVATE},${OVERLAY}`) &&
      rect.width &&
      rect.height &&
      (!region || intersects(rect, region))
    ) {
      // Direct text avoids including content outside a rectangular selection via an ancestor.
      const text = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent)
        .join(" ")
        .slice(0, 2000);
      const css = getComputedStyle(el);
      records.push([
        el.tagName,
        text,
        rect,
        styles(el),
        css.border,
        css.boxShadow,
        css.opacity,
        css.transform,
        css.clipPath,
        css.backgroundImage,
        el instanceof HTMLImageElement ? el.currentSrc : "",
      ]);
    }
    current = walker.nextNode();
  }
  return JSON.stringify([innerWidth, innerHeight, records]);
}
export function regionText(region: Rect): string {
  const nodes = Array.from(document.body.querySelectorAll<HTMLElement>("*"));
  return nodes
    .slice(0, 5000)
    .filter(
      (el) =>
        !el.closest(`${PRIVATE},${OVERLAY},script,style`) &&
        intersects(documentRect(el), region),
    )
    .flatMap((el) =>
      Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent),
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);
}
export function drawArrow(
  context: CanvasRenderingContext2D,
  annotation: Extract<Annotation, { kind: "arrow" }>,
) {
  const { from, to, region } = annotation;
  const x1 = from.x - region.x,
    y1 = from.y - region.y,
    x2 = to.x - region.x,
    y2 = to.y - region.y;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  context.lineWidth = 3;
  context.strokeStyle = "#4265e8";
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.moveTo(
    x2 - 12 * Math.cos(angle - 0.5),
    y2 - 12 * Math.sin(angle - 0.5),
  );
  context.lineTo(x2, y2);
  context.lineTo(
    x2 - 12 * Math.cos(angle + 0.5),
    y2 - 12 * Math.sin(angle + 0.5),
  );
  context.stroke();
}
export async function regionImage(
  region: Rect,
  annotation?: Annotation,
): Promise<string> {
  const root = document.documentElement;
  const width = Math.max(root.clientWidth, root.scrollWidth);
  const height = Math.max(root.clientHeight, root.scrollHeight);
  // Crop the clone into a small canvas while preserving the original page's layout dimensions.
  const svg = await toSvg(root, {
    width: Math.ceil(region.width),
    height: Math.ceil(region.height),
    skipFonts: true,
    cacheBust: false,
    backgroundColor: getComputedStyle(document.body).backgroundColor,
    filter: snapshotFilter,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      margin: "0",
      transformOrigin: "0 0",
      transform: `translate(${-region.x}px, ${-region.y}px)`,
    },
  });
  // A cloned CSS entrance animation would restart at opacity:0 inside the SVG.
  // Freeze the already-computed appearance instead of rendering a blank card.
  const svgDocument = new DOMParser().parseFromString(
    decodeURIComponent(svg.slice(svg.indexOf(",") + 1)),
    "image/svg+xml",
  );
  if (svgDocument.querySelector("parsererror"))
    throw new Error("snapshotUnavailable");
  for (const el of svgDocument.querySelectorAll("foreignObject *")) {
    el.setAttribute(
      "style",
      `${el.getAttribute("style") ?? ""};animation:none!important;transition:none!important;caret-color:transparent!important;`,
    );
  }
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("snapshotUnavailable")),
      8000,
    );
    image.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error("snapshotUnavailable"));
    };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svgDocument))}`;
  });
  const ratio = Math.min(1, 1600 / region.width, 1600 / region.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(region.width * ratio));
  canvas.height = Math.max(1, Math.floor(region.height * ratio));
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  ctx.scale(canvas.width / region.width, canvas.height / region.height);
  if (annotation?.kind === "arrow") drawArrow(ctx, { ...annotation, region });
  else if (annotation?.kind === "region") {
    ctx.strokeStyle = "#4265e8";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      annotation.region.x - region.x,
      annotation.region.y - region.y,
      annotation.region.width,
      annotation.region.height,
    );
  }
  return canvas.toDataURL("image/png");
}
