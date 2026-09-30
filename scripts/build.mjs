import { build } from "esbuild";
import { mkdir, writeFile, readFile } from "node:fs/promises";
await mkdir("lib", { recursive: true });
await build({
  entryPoints: ["src/index.ts"],
  outfile: "lib/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
});
await build({
  entryPoints: ["src/vite.ts"],
  outfile: "lib/vite.js",
  bundle: true,
  packages: "external",
  platform: "node",
  format: "esm",
  target: "node22",
});
await build({
  entryPoints: ["src/inspector.ts"],
  outfile: "lib/inspector.js",
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  minify: true,
  legalComments: "inline",
});
const inspectorSource = await readFile("lib/inspector.js", "utf8");
const client = await build({
  entryPoints: ["src/client/index.tsx"],
  write: false,
  bundle: true,
  platform: "browser",
  format: "cjs",
  target: "es2022",
  minify: true,
  external: ["react"],
  loader: { ".css": "text" },
  legalComments: "inline",
  plugins: [
    {
      name: "embedded-inspector",
      setup(build) {
        build.onResolve({ filter: /^virtual:visual-edit-inspector$/ }, () => ({
          path: "inspector",
          namespace: "embedded",
        }));
        build.onLoad({ filter: /.*/, namespace: "embedded" }, () => ({
          contents: `export default ${JSON.stringify(inspectorSource)}`,
          loader: "js",
        }));
      },
    },
  ],
});
const output = `window.__ModuleLoader__.load({id:"dsh-visual-edit",factory(require){const module={exports:{}};const exports=module.exports;\n${client.outputFiles[0].text}\nreturn module.exports;}});\n`;
const bytes = Buffer.byteLength(output);
if (bytes > 262144)
  throw new Error(`DSH client bundle exceeds 256 KiB: ${bytes} bytes`);
await writeFile("lib/client.js", output);
await writeFile(
  "lib/vite.d.ts",
  `import type { Plugin } from 'vite';\nexport interface VisualEditOptions { allowedOrigins?: string[] }\nexport declare function visualEdit(options?: VisualEditOptions): Plugin;\nexport default visualEdit;\n`,
);
const version = JSON.parse(await readFile("package.json", "utf8")).version;
console.log(
  `dsh-visual-edit ${version}: client ${bytes} bytes; host, Vite bridge and inspector built.`,
);
