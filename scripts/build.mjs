import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadTypeScript() {
  const attempts = [
    () => require("typescript"),
    () =>
      process.env.TABBYGUARD_TYPESCRIPT_PATH
        ? require(process.env.TABBYGUARD_TYPESCRIPT_PATH)
        : null,
    () =>
      require("/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js"),
  ];

  for (const attempt of attempts) {
    try {
      const value = attempt();
      if (value) return value;
    } catch {}
  }

  throw new Error(
    "TypeScript is required to build TabbyGuard. Run npm install first, or set TABBYGUARD_TYPESCRIPT_PATH.",
  );
}

const ts = await loadTypeScript();

const srcRoot = path.join(root, "src");
const distRoot = path.join(root, "dist");
const vendorBasePath = path.join(root, "vendor", "runtime-dependencies.js");
const vendorLicensesPath = path.join(root, "vendor", "licenses.txt");

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walk(absolute)));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(absolute);
    }
  }

  return files;
}

const sourceFiles = (await walk(srcRoot)).sort();

const idByFile = new Map(
  sourceFiles.map((file, index) => [path.normalize(file), 99000 + index]),
);

const fileById = new Map([...idByFile].map(([file, id]) => [id, file]));

const externalIds = new Map([
  ["@actions/core", 7484],
  ["@actions/github", 3228],
  ["@axe-core/playwright", 2579],
  // The vendored runtime came from MergeGuard V1 where the Playwright package
  // exports the same Chromium/Page API consumed by the V2 playwright-core imports.
  ["playwright-core", 3219],
  ["zod", 924],
]);

function resolveLocal(fromFile, specifier) {
  const raw = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [];

  if (raw.endsWith(".js")) {
    candidates.push(raw.slice(0, -3) + ".ts");
  }

  if (raw.endsWith(".ts")) {
    candidates.push(raw);
  }

  candidates.push(raw + ".ts", path.join(raw, "index.ts"));

  for (const candidate of candidates) {
    const normalized = path.normalize(candidate);

    if (idByFile.has(normalized)) {
      return idByFile.get(normalized);
    }
  }

  throw new Error(
    `Unable to resolve local module ${specifier} imported by ${path.relative(
      root,
      fromFile,
    )}`,
  );
}

function rewriteRequires(code, fromFile) {
  return code.replace(
    /require\((['"])([^'"]+)\1\)/g,
    (full, quote, specifier) => {
      if (externalIds.has(specifier)) {
        return `__nccwpck_require__(${externalIds.get(specifier)})`;
      }

      if (specifier.startsWith(".")) {
        return `__nccwpck_require__(${resolveLocal(fromFile, specifier)})`;
      }

      if (specifier.startsWith("node:")) {
        return full;
      }

      // Node built-ins may be emitted without the node: prefix.
      if (
        [
          "fs",
          "fs/promises",
          "path",
          "url",
          "util",
          "events",
          "stream",
          "buffer",
          "http",
          "https",
          "crypto",
          "os",
          "tty",
          "assert",
          "child_process",
          "zlib",
          "net",
          "tls",
          "module",
        ].includes(specifier)
      ) {
        return full;
      }

      throw new Error(
        `Unknown external module ${specifier} imported by ${path.relative(
          root,
          fromFile,
        )}`,
      );
    },
  );
}

const moduleBlocks = [];

for (const [id, file] of [...fileById].sort((a, b) => a[0] - b[0])) {
  const source = await fs.readFile(file, "utf8");

  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      sourceMap: false,
      inlineSourceMap: false,
    },
    fileName: file,
    reportDiagnostics: true,
  });

  const errors = (transpiled.diagnostics || []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );

  if (errors.length) {
    throw new Error(
      errors
        .map((diagnostic) =>
          ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
        )
        .join("\n"),
    );
  }

  const code = rewriteRequires(transpiled.outputText, file);

  moduleBlocks.push(
    `\n/***/ ${id}:\n/***/ ((module, exports, __nccwpck_require__) => {\n\n${code}\n/***/ })`,
  );
}

let bundle = await fs.readFile(vendorBasePath, "utf8");

// Normalize Windows CRLF line endings before applying deterministic bundle
// patches. This keeps the build working on Windows, macOS, Linux, and CI.
bundle = bundle.replace(/\r\n/g, "\n");

bundle = bundle.replace(/^require\('\.\/sourcemap-register\.js'\);/, "");

// ncc turns Playwright's dynamic JSON loader into an empty context. Restore only
// the metadata needed for browser startup while retaining native JSON loading as
// a fallback for development-only Playwright paths.
const browsersJson = {
  browsers: [
    {
      name: "chromium",
      revision: "1169",
      installByDefault: true,
      browserVersion: "136.0.7103.25",
    },
    {
      name: "chromium-headless-shell",
      revision: "1169",
      installByDefault: true,
      browserVersion: "136.0.7103.25",
    },
    {
      name: "chromium-tip-of-tree",
      revision: "1320",
      installByDefault: false,
      browserVersion: "137.0.7105.0",
    },
    {
      name: "chromium-tip-of-tree-headless-shell",
      revision: "1320",
      installByDefault: false,
      browserVersion: "137.0.7105.0",
    },
    {
      name: "firefox",
      revision: "1482",
      installByDefault: true,
      browserVersion: "137.0",
    },
    {
      name: "firefox-beta",
      revision: "1477",
      installByDefault: false,
      browserVersion: "137.0b2",
    },
    {
      name: "webkit",
      revision: "2158",
      installByDefault: true,
      browserVersion: "18.4",
    },
    {
      name: "ffmpeg",
      revision: "1011",
      installByDefault: true,
    },
    {
      name: "winldd",
      revision: "1007",
      installByDefault: false,
    },
    {
      name: "android",
      revision: "1001",
      installByDefault: false,
    },
  ],
};

const dynamicContextReplacement = `/***/ 139:
/***/ ((module) => {
function tabbyguardDynamicContext(req) {
  if (String(req).endsWith('browsers.json')) return ${JSON.stringify(
    browsersJson,
  )};
  if (String(req).endsWith('package.json')) return { name: 'playwright-core', version: '1.52.0' };
  try { return require(req); } catch (error) {
    const e = new Error("Cannot find module '" + req + "'");
    e.code = 'MODULE_NOT_FOUND';
    throw e;
  }
}
tabbyguardDynamicContext.keys = () => ([]);
tabbyguardDynamicContext.resolve = (req) => req;
tabbyguardDynamicContext.id = 139;
module.exports = tabbyguardDynamicContext;
/***/ })`;

const dynamicContextPattern =
  /\/\*\*\*\/ 139:\n\/\*\*\*\/ \(\(module\) => \{[\s\S]*?module\.exports = webpackEmptyContext;\n\n\/\*\*\*\/ \}\)/;

if (!dynamicContextPattern.test(bundle)) {
  throw new Error("Could not patch Playwright dynamic JSON context.");
}

bundle = bundle.replace(dynamicContextPattern, dynamicContextReplacement);

bundle = bundle.replace(/\n\/\/# sourceMappingURL=index\.js\.map\s*$/, "\n");

const moduleCloseMarker =
  "\n/***/ })\n\n/******/ \t});\n/************************************************************************/";

const markerIndex = bundle.indexOf(moduleCloseMarker);

if (markerIndex === -1) {
  throw new Error(
    "Could not locate the vendored runtime module-table boundary.",
  );
}

const injected = `${moduleBlocks.join(",")}\n`;

bundle =
  bundle.slice(0, markerIndex + "\n/***/ })".length) +
  "," +
  injected +
  bundle.slice(markerIndex + "\n/***/ })".length);

const entryId = idByFile.get(path.join(srcRoot, "index.ts"));

if (!entryId) {
  throw new Error("src/index.ts was not assigned a module id.");
}

bundle = bundle.replace(
  "var __webpack_exports__ = __nccwpck_require__(9407);",
  `var __webpack_exports__ = __nccwpck_require__(${entryId});`,
);

await fs.rm(distRoot, {
  recursive: true,
  force: true,
});

await fs.mkdir(distRoot, {
  recursive: true,
});

await fs.writeFile(path.join(distRoot, "index.js"), bundle);

await fs.copyFile(vendorLicensesPath, path.join(distRoot, "licenses.txt"));

console.log(
  `Built dist/index.js with ${sourceFiles.length} TabbyGuard source modules.`,
);
