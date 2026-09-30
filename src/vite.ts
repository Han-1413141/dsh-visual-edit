import { parse } from "@babel/parser";
import MagicString from "magic-string";
import { readFileSync } from "node:fs";
import { relative, isAbsolute, sep } from "node:path";
import type { Plugin } from "vite";

export interface VisualEditOptions {
  allowedOrigins?: string[];
}
const ASSET = "/@dsh-visual-edit/inspector.js";
export const DEFAULT_ORIGINS = [
  "http://127.0.0.1:3080",
  "http://localhost:3080",
  "http://[::1]:3080",
];
export function instrumentSource(code: string, id: string, root: string) {
  const filename = id.split("?")[0];
  if (
    !/\.[jt]sx$/.test(filename) ||
    filename.split(/[\\/]/).includes("node_modules")
  )
    return;
  const file = relative(root, filename).split(sep).join("/");
  if (!file || file.startsWith("../") || isAbsolute(file)) return;
  const ast = parse(code, {
    sourceType: "unambiguous",
    plugins: [
      "jsx",
      ...(filename.endsWith(".tsx") ? ["typescript" as const] : []),
    ],
  });
  const result = new MagicString(code);
  let changes = 0;
  const visit = (node: any): void => {
    if (!node || typeof node !== "object") return;
    if (
      node.type === "JSXOpeningElement" &&
      node.name.type === "JSXIdentifier" &&
      /^[a-z]/.test(node.name.name) &&
      !node.attributes.some((a: any) => a.name?.name === "data-dsh-ve-source")
    ) {
      const location = JSON.stringify({
        file,
        line: node.loc.start.line,
        column: node.loc.start.column + 1,
      });
      result.appendLeft(
        node.name.end,
        ` data-dsh-ve-source={${JSON.stringify(location)}}`,
      );
      changes++;
    }
    for (const [key, value] of Object.entries(node)) {
      if (["loc", "start", "end", "comments", "tokens"].includes(key)) continue;
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    }
  };
  visit(ast.program);
  return changes
    ? {
        code: result.toString(),
        map: result.generateMap({
          hires: true,
          source: filename,
          includeContent: true,
        }),
      }
    : undefined;
}
/** Dev-only bridge. It neither proxies the application nor modifies source files. */
export function visualEdit(options: VisualEditOptions = {}): Plugin {
  let root = process.cwd();
  let inspector: string;
  const origins = options.allowedOrigins ?? DEFAULT_ORIGINS;
  if (
    !origins.length ||
    origins.some((origin) => {
      try {
        const u = new URL(origin);
        return (
          u.origin !== origin ||
          !["http:", "https:"].includes(u.protocol) ||
          !!u.username ||
          !!u.password
        );
      } catch {
        return true;
      }
    })
  )
    throw new Error(
      "visualEdit.allowedOrigins must contain exact HTTP(S) origins, without paths or wildcards.",
    );
  return {
    name: "dsh-visual-edit",
    apply: "serve",
    enforce: "pre",
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      inspector = readFileSync(
        new URL("./inspector.js", import.meta.url),
        "utf8",
      );
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== ASSET) return next();
        if (req.method !== "GET" && req.method !== "HEAD") {
          res.statusCode = 405;
          res.end();
          return;
        }
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.end(req.method === "HEAD" ? "" : inspector);
      });
    },
    transformIndexHtml() {
      return [
        {
          tag: "script",
          attrs: { src: ASSET, "data-origins": JSON.stringify(origins) },
          injectTo: "body",
        },
      ];
    },
    transform(code, id) {
      return instrumentSource(code, id, root);
    },
  };
}
export default visualEdit;
