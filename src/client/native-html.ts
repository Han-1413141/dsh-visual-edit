import { Parser } from "htmlparser2";
import DOMPurify from "dompurify";
import { pageLabel } from "../shared/model";

/** Add source coordinates to rendered bytes only; never write to the user's HTML. */
export function instrumentHtml(html: string, address: string): string {
  const path = pageLabel(address);
  const file = /^(?:[a-z]:|\/)/i.test(path) ? path.split("/").at(-1)! : path;
  const starts = [0];
  for (let i = 0; i < html.length; i++)
    if (html[i] === "\n") starts.push(i + 1);
  const edits: { index: number; value: string }[] = [];
  const parser = new Parser({
    onopentag(name, attrs, isImplied) {
      if (
        isImplied ||
        ["html", "head", "body", "script", "style", "meta", "link"].includes(
          name,
        ) ||
        attrs["data-dsh-ve-source"]
      )
        return;
      const offset = parser.startIndex;
      if (html[offset] !== "<") return;
      let low = 0,
        high = starts.length;
      while (low + 1 < high) {
        const mid = (low + high) >>> 1;
        if (starts[mid] <= offset) low = mid;
        else high = mid;
      }
      const source = JSON.stringify({
        file,
        line: low + 1,
        column: offset - starts[low] + 1,
      })
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;");
      edits.push({
        index: offset + name.length + 1,
        value: ` data-dsh-ve-source="${source}"`,
      });
    },
  });
  parser.end(html);
  for (const edit of edits.reverse())
    html = html.slice(0, edit.index) + edit.value + html.slice(edit.index);
  return html;
}

export function prepareHtml(
  data: Uint8Array,
  address: string,
  source: string,
  interactive: boolean,
  nonce: string,
): Uint8Array<ArrayBuffer> {
  let html = instrumentHtml(
    new TextDecoder("utf-8", { fatal: true }).decode(data),
    address,
  );
  const script = `<script nonce="${nonce}">${source.replace(/<\/script/gi, "<\\/script")}</script>`;
  if (interactive) return new TextEncoder().encode(html + script);
  // Keep ordinary page scripts, event handlers, network and forms disabled in static mode.
  html = DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true,
    FORBID_TAGS: [
      "noscript",
      "base",
      "link",
      "meta",
      "iframe",
      "frame",
      "object",
      "embed",
      "set",
      "animate",
      "animateMotion",
      "animateTransform",
    ],
    FORBID_ATTR: ["href", "xlink:href"],
  });
  const doc = new DOMParser().parseFromString(html, "text/html");
  const policy = doc.createElement("meta");
  policy.httpEquiv = "Content-Security-Policy";
  policy.content = `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'`;
  doc.head.prepend(policy);
  return new TextEncoder().encode(
    `<!doctype html>${doc.documentElement.outerHTML}${script}`,
  );
}
