// Content/Extensions/live2d-cubism/studio/inspector.ts
var en = {
  loading: "Reading the model...",
  failed: "Could not read this model: {0}",
  files: "Files",
  moc: "Moc",
  mocVersion: "moc3 v{0}",
  cubism: "Cubism {0}",
  textures: "Textures",
  noTextures: "The model names no textures.",
  motions: "Motions",
  noMotions: "No motions. live2d.motion and the idle group have nothing to play.",
  groups: "{0} groups, {1} motions",
  loop: "loop",
  expressions: "Expressions",
  noExpressions: "No expressions.",
  features: "Features",
  physics: "Physics",
  pose: "Pose",
  blink: "Eye blink",
  lipSync: "Lip sync",
  notRun: "present, not run by this extension yet",
  none: "none",
  broken: "named, but missing or broken",
  params: "{0} parameters",
  param: "1 parameter",
  lipSyncHint: "drive it with live2d.param",
  parameters: "Parameters",
  fromCdi: "{0} from {1}",
  fromUsed: "{0} used by its motions and expressions (no cdi3.json)",
  noParameters: "No parameter ids found.",
  core: "Cubism Core",
  coreIntro: "pack and run copy it from NativeUserFiles/ beside the plugin.",
  coreMissing: "missing: put {0} at {1}",
  coreEnv: "A folder in PRISMATIX_NATIVE_USER_FILES also works; Studio cannot see those. Live2D's license applies to Core.",
  problems: "Problems",
  problem: {
    notJson: "{0} is not valid JSON ({1})",
    noMoc: "{0} names no FileReferences.Moc",
    missing: "{0} is missing",
    notMoc3: "{0} is not a .moc3 file",
    notImage: "{0} is not a PNG or JPEG image"
  }
};
var zh = {
  loading: "正在讀取模型…",
  failed: "無法讀取這個模型：{0}",
  files: "檔案",
  moc: "Moc",
  mocVersion: "moc3 v{0}",
  cubism: "Cubism {0}",
  textures: "貼圖",
  noTextures: "模型沒有列出貼圖。",
  motions: "動作",
  noMotions: "沒有動作，live2d.motion 與待機群組無可播放。",
  groups: "{0} 個群組，{1} 個動作",
  loop: "循環",
  expressions: "表情",
  noExpressions: "沒有表情。",
  features: "功能",
  physics: "物理",
  pose: "姿勢",
  blink: "眨眼",
  lipSync: "對嘴",
  notRun: "有，但本擴充尚未執行",
  none: "無",
  broken: "有列出，但檔案缺少或損壞",
  params: "{0} 個參數",
  param: "1 個參數",
  lipSyncHint: "用 live2d.param 驅動",
  parameters: "參數",
  fromCdi: "{0} 個，來自 {1}",
  fromUsed: "{0} 個，取自動作與表情（沒有 cdi3.json）",
  noParameters: "找不到參數 id。",
  core: "Cubism Core",
  coreIntro: "pack 與 run 會把它從 NativeUserFiles/ 複製到外掛旁。",
  coreMissing: "缺少：把 {0} 放在 {1}",
  coreEnv: "也可以放在 PRISMATIX_NATIVE_USER_FILES 列出的資料夾，Studio 看不到那裡。Core 適用 Live2D 的授權條款。",
  problems: "問題",
  problem: {
    notJson: "{0} 不是有效的 JSON（{1}）",
    noMoc: "{0} 沒有 FileReferences.Moc",
    missing: "缺少 {0}",
    notMoc3: "{0} 不是 .moc3 檔",
    notImage: "{0} 不是 PNG 或 JPEG 圖片"
  }
};
var strings = { "en": en, "zh-TW": zh };
var format = (template, ...values) => template.replace(/\{(\d)\}/gu, (_, index) => String(values[Number(index)] ?? ""));
var style = `
:root{--fg:#ededed;--muted:#a1a1a1;--faint:#7c7c7c;--edge:#1f1f1f;--edge-strong:#2e2e2e;--chip:#111;--ok:#45c47a;--warn:#f5b544;--bad:#ff6166;--accent:#52a8ff;--check:#161616}
:root[data-theme="light"]{--fg:#171717;--muted:#666;--faint:#8f8f8f;--edge:#eaeaea;--edge-strong:#d4d4d4;--chip:#f5f5f5;--ok:#1a7f45;--warn:#a35200;--bad:#d8262d;--accent:#0068d6;--check:#ececec}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;color:var(--fg);font:12px/1.45 "Geist Variable","Geist",system-ui,"Microsoft JhengHei UI","PingFang TC",sans-serif;-webkit-font-smoothing:antialiased}
#root{height:100%;overflow:auto}
.l2{padding:10px 12px 14px;display:flex;flex-direction:column;gap:12px}
.mono{font-family:"Geist Mono Variable","Geist Mono",ui-monospace,"Cascadia Mono",Consolas,monospace;font-size:11px}
.head{display:flex;flex-direction:column;gap:2px}
.title{display:flex;align-items:center;gap:6px;min-width:0}
.title h1{margin:0;font-size:14px;font-weight:600;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.path{color:var(--faint);overflow-wrap:anywhere}
.badge{flex:none;border:1px solid var(--edge-strong);border-radius:999px;padding:0 6px;font-size:10.5px;color:var(--muted)}
section{display:flex;flex-direction:column;gap:6px}
h2{margin:0;display:flex;justify-content:space-between;gap:8px;font-size:11px;font-weight:500;color:var(--faint)}
h2 span+span{font-weight:400}
.rows{display:flex;flex-direction:column;border:1px solid var(--edge);border-radius:6px}
.row{display:flex;flex-direction:column;gap:2px;padding:6px 8px;min-width:0}
.row+.row{border-top:1px solid var(--edge)}
.line{display:flex;align-items:center;gap:6px;min-width:0}
.row .k{min-width:0;color:var(--muted);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.row .n{margin-left:auto;flex:none;color:var(--faint);font-variant-numeric:tabular-nums}
.row .v{min-width:0;overflow-wrap:anywhere}
.row .v.chips{margin-top:2px}
.empty{color:var(--faint)}
.thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:6px}
figure{margin:0;display:flex;flex-direction:column;gap:3px;min-width:0}
.img{aspect-ratio:1;border:1px solid var(--edge);border-radius:6px;overflow:hidden;background:repeating-conic-gradient(var(--check) 0 25%,transparent 0 50%) 0 0/12px 12px;display:flex;align-items:center;justify-content:center}
.img img{max-width:100%;max-height:100%;display:block}
.img.gone{background:none;color:var(--bad);font-size:16px}
figcaption{color:var(--faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chips{display:flex;flex-wrap:wrap;gap:4px}
.chip{border:1px solid var(--edge);background:var(--chip);border-radius:4px;padding:0 5px;line-height:18px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chip small{color:var(--faint);font-size:10.5px;margin-left:3px}
details summary{cursor:pointer;color:var(--muted);list-style:none;user-select:none}
details summary::-webkit-details-marker{display:none}
details summary::before{content:"\\25B8";display:inline-block;width:12px;color:var(--faint);transition:transform .15s}
details[open] summary::before{transform:rotate(90deg)}
details>.chips{margin-top:6px}
.dot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--faint);align-self:center}
.dot.ok{background:var(--ok)}.dot.warn{background:var(--warn)}.dot.bad{background:var(--bad)}
.warn-text{color:var(--warn)}.bad-text{color:var(--bad)}
.problems{border:1px solid color-mix(in srgb,var(--bad) 35%,transparent);background:color-mix(in srgb,var(--bad) 8%,transparent);border-radius:6px;padding:6px 8px;display:flex;flex-direction:column;gap:3px}
.problems div{display:flex;gap:6px;color:var(--bad);overflow-wrap:anywhere}
.note{color:var(--faint);margin:0}
.status{padding:12px;color:var(--muted)}
`;
function el(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  for (const child of children) if (child !== null && child !== void 0 && child !== false) element.append(child);
  return element;
}
var breakable = (text2) => text2.split("/").flatMap((part, index, parts) => index < parts.length - 1 ? [`${part}/`, document.createElement("wbr")] : [part]);
var fileName = (path) => path.slice(path.lastIndexOf("/") + 1);
var bytes = (size) => size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(0)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;
var seconds = (value) => `${value.toFixed(value < 10 ? 1 : 0)} s`;
var ModelInspector = class {
  urls = [];
  root;
  text;
  constructor(root, locale) {
    this.root = root;
    this.text = strings[locale] ?? strings.en;
    root.replaceChildren(el("style", {}, style), el("div", { class: "status" }, this.text.loading));
  }
  t(key, ...values) {
    return format(this.text[key], ...values);
  }
  count(parameters) {
    return parameters === 1 ? this.t("param") : this.t("params", parameters);
  }
  problem(problem) {
    return format(this.text.problem[problem.kind], problem.path, "detail" in problem ? problem.detail : "");
  }
  fail(error) {
    this.root.replaceChildren(
      el("style", {}, style),
      el("div", { class: "status bad-text" }, this.t("failed", error instanceof Error ? error.message : String(error)))
    );
  }
  render(report) {
    const { summary } = report;
    const section = (title, aside, ...body) => el("section", {}, el("h2", {}, el("span", {}, title), aside === null ? null : el("span", {}, aside)), ...body);
    const row = (key, value, aside, dot) => el(
      "div",
      { class: "row" },
      el(
        "div",
        { class: "line" },
        dot ? el("span", { class: `dot ${dot}` }) : null,
        el("span", { class: "k" }, key),
        aside ? el("span", { class: "n" }, aside) : null
      ),
      value instanceof HTMLElement && value.classList.contains("chips") ? (value.classList.add("v"), value) : el("div", { class: "v" }, value)
    );
    const head = el(
      "div",
      { class: "head" },
      el(
        "div",
        { class: "title" },
        el("h1", {}, summary.name),
        report.moc?.cubism ? el("span", { class: "badge" }, this.t("cubism", report.moc.cubism)) : null
      ),
      el("div", { class: "path mono" }, summary.path)
    );
    const problems = report.problems.length === 0 ? null : el(
      "div",
      { class: "problems", role: "alert", "aria-label": this.t("problems") },
      ...report.problems.map((problem) => el("div", {}, el("span", {}, "!"), el("span", {}, this.problem(problem))))
    );
    const files = section(this.t("files"), null, el(
      "div",
      { class: "rows" },
      row(
        this.t("moc"),
        el("span", { class: "mono" }, report.moc ? fileName(report.moc.path) : summary.moc ? fileName(summary.moc) : "-"),
        report.moc ? [report.moc.version === null ? null : this.t("mocVersion", report.moc.version), bytes(report.moc.size)].filter(Boolean).join(" · ") : void 0,
        report.moc && report.moc.version !== null ? "ok" : "bad"
      )
    ));
    const textures = section(
      this.t("textures"),
      String(report.textures.length),
      report.textures.length === 0 ? el("p", { class: "note" }, this.t("noTextures")) : el("div", { class: "thumbs" }, ...report.textures.map((texture) => this.thumbnail(texture)))
    );
    const motionTotal = report.motions.reduce((sum, group) => sum + group.motions.length, 0);
    const motions = section(
      this.t("motions"),
      report.motions.length ? this.t("groups", report.motions.length, motionTotal) : null,
      report.motions.length === 0 ? el("p", { class: "note" }, this.t("noMotions")) : el("div", { class: "rows" }, ...report.motions.map((group) => row(
        group.group,
        el("span", { class: "chips" }, ...group.motions.map((motion) => el(
          "span",
          { class: "chip", title: motion.file },
          motion.duration === null ? fileName(motion.file) : seconds(motion.duration),
          motion.loop ? el("small", { title: this.t("loop") }, "↻") : null
        ))),
        String(group.motions.length)
      )))
    );
    const expressions = section(
      this.t("expressions"),
      report.expressions.length ? String(report.expressions.length) : null,
      report.expressions.length === 0 ? el("p", { class: "note" }, this.t("noExpressions")) : el("div", { class: "chips" }, ...report.expressions.map((entry) => el("span", { class: "chip mono", title: entry.file }, entry.name)))
    );
    const optional = (file) => file === null ? { text: this.t("none"), dot: "" } : file.ok ? { text: this.t("notRun"), dot: "warn" } : { text: this.t("broken"), dot: "bad" };
    const physics = optional(report.physics);
    const pose = optional(report.pose);
    const features = section(this.t("features"), null, el(
      "div",
      { class: "rows" },
      row(this.t("physics"), physics.text, report.physics ? fileName(report.physics.path) : void 0, physics.dot || void 0),
      row(this.t("pose"), pose.text, report.pose ? fileName(report.pose.path) : void 0, pose.dot || void 0),
      row(this.t("blink"), summary.eyeBlink.length ? this.count(summary.eyeBlink.length) : this.t("none"), void 0, summary.eyeBlink.length ? "ok" : void 0),
      row(this.t("lipSync"), summary.lipSync.length ? this.count(summary.lipSync.length) : this.t("lipSyncHint"), void 0, summary.lipSync.length ? "ok" : void 0)
    ));
    const list2 = report.parameters.parameters;
    const parameters = section(this.t("parameters"), null, list2.length === 0 ? el("p", { class: "note" }, this.t("noParameters")) : el(
      "details",
      {},
      el("summary", {}, report.parameters.source === "cdi3" && summary.displayInfo ? this.t("fromCdi", list2.length, fileName(summary.displayInfo)) : this.t("fromUsed", list2.length)),
      el("div", { class: "chips" }, ...list2.map((parameter) => el(
        "span",
        { class: "chip", title: parameter.name || parameter.id },
        el("span", { class: "mono" }, parameter.id),
        parameter.name ? el("small", {}, parameter.name) : null
      )))
    ));
    const core = section(
      this.t("core"),
      null,
      el("p", { class: "note" }, this.t("coreIntro")),
      el("div", { class: "rows" }, ...report.core.map((status) => row(
        status.platform,
        status.found ? el("span", { class: "mono" }, ...breakable(status.found)) : el("span", { class: "warn-text" }, ...breakable(this.t("coreMissing", status.name, status.expected))),
        void 0,
        status.found ? "ok" : "warn"
      ))),
      el("p", { class: "note" }, this.t("coreEnv"))
    );
    this.root.replaceChildren(
      el("style", {}, style),
      el("div", { class: "l2" }, head, problems, files, textures, motions, expressions, features, parameters, core)
    );
  }
  thumbnail(texture) {
    const name = fileName(texture.path);
    if (texture.bytes === null || texture.type === null)
      return el("figure", { title: texture.path }, el("div", { class: "img gone" }, "!"), el("figcaption", { class: "mono" }, name));
    const url = URL.createObjectURL(new Blob([texture.bytes], { type: texture.type }));
    this.urls.push(url);
    const caption = el("figcaption", { class: "mono" }, name);
    const image = el("img", { src: url, alt: name });
    image.addEventListener("load", () => {
      caption.textContent = `${image.naturalWidth}×${image.naturalHeight}`;
      caption.title = name;
    });
    return el("figure", { title: texture.path }, el("div", { class: "img" }, image), caption);
  }
  dispose() {
    for (const url of this.urls.splice(0)) URL.revokeObjectURL(url);
  }
};

// Content/Extensions/live2d-cubism/src/model3.ts
function resolvePath(base, relative) {
  const parts = base === "" ? [] : base.split("/").filter((part) => part !== "");
  for (const part of relative.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}
function folderOf(path) {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? "" : path.slice(0, slash);
}

// Content/Extensions/live2d-cubism/studio/model.ts
var EXTENSION_ID = "live2d-cubism";
var CORE_FILES = [
  { platform: "win32-x64", name: "Live2DCubismCore.dll" },
  { platform: "linux-x64", name: "libLive2DCubismCore.so" },
  { platform: "darwin-x64", name: "libLive2DCubismCore.dylib" },
  { platform: "darwin-arm64", name: "libLive2DCubismCore.dylib" },
  { platform: "android-arm64", name: "libLive2DCubismCore.so" }
];
var NATIVE_USER_FILES = "NativeUserFiles";
var record = (value) => value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
var list = (value) => Array.isArray(value) ? value : [];
var text = (value) => typeof value === "string" && value !== "" ? value : void 0;
var finite = (value) => typeof value === "number" && Number.isFinite(value) ? value : null;
var errorText = (error) => error instanceof Error ? error.message : String(error);
function modelName(path) {
  const file = path.slice(path.lastIndexOf("/") + 1);
  return file.replace(/\.model3\.json$/iu, "") || file;
}
function summarizeModel3(source, path) {
  const empty = {
    path,
    name: modelName(path),
    version: null,
    moc: null,
    textures: [],
    motions: [],
    expressions: [],
    physics: null,
    pose: null,
    displayInfo: null,
    eyeBlink: [],
    lipSync: []
  };
  let json;
  try {
    json = record(JSON.parse(source));
    if (!json) throw new Error("not a JSON object");
  } catch (error) {
    return { ...empty, problems: [{ kind: "notJson", path, detail: errorText(error) }] };
  }
  const folder = folderOf(path);
  const at = (relative) => {
    const value = text(relative);
    return value === void 0 ? null : resolvePath(folder, value);
  };
  const references = record(json.FileReferences) ?? {};
  const moc = at(references.Moc);
  const motions = Object.entries(record(references.Motions) ?? {}).map(([group2, entries]) => ({
    group: group2,
    files: list(entries).map((entry) => at(record(entry)?.File)).filter((file) => file !== null)
  }));
  const expressions = list(references.Expressions).flatMap((entry) => {
    const name = text(record(entry)?.Name);
    const file = at(record(entry)?.File);
    return name === void 0 || file === null ? [] : [{ name, file }];
  });
  const group = (name) => list(json.Groups).map(record).filter((entry) => entry?.Target === "Parameter" && entry.Name === name).flatMap((entry) => list(entry?.Ids).filter((id) => typeof id === "string"));
  return {
    ...empty,
    version: finite(json.Version),
    moc,
    textures: list(references.Textures).map(at).filter((file) => file !== null),
    motions,
    expressions,
    physics: at(references.Physics),
    pose: at(references.Pose),
    displayInfo: at(references.DisplayInfo),
    eyeBlink: group("EyeBlink"),
    lipSync: group("LipSync"),
    problems: moc === null ? [{ kind: "noMoc", path }] : []
  };
}
function readMotionMeta(source) {
  const json = record(JSON.parse(source)) ?? {};
  const meta = record(json.Meta) ?? {};
  const parameterIds = list(json.Curves).map(record).filter((curve) => curve?.Target === "Parameter").map((curve) => text(curve?.Id)).filter((id) => id !== void 0);
  return { duration: finite(meta.Duration), loop: meta.Loop === true, parameterIds: [...new Set(parameterIds)] };
}
function expressionParameterIds(source) {
  const json = record(JSON.parse(source)) ?? {};
  return [...new Set(list(json.Parameters).map((entry) => text(record(entry)?.Id)).filter((id) => id !== void 0))];
}
function displayInfoParameters(source) {
  const json = record(JSON.parse(source)) ?? {};
  return list(json.Parameters).flatMap((entry) => {
    const id = text(record(entry)?.Id);
    return id === void 0 ? [] : [{ id, name: text(record(entry)?.Name) ?? "" }];
  });
}
var cubismOfMoc = { 1: "3.0", 2: "3.3", 3: "4.0", 4: "4.2", 5: "5.0" };
function mocVersion(bytes2) {
  if (bytes2.length < 5 || bytes2[0] !== 77 || bytes2[1] !== 79 || bytes2[2] !== 67 || bytes2[3] !== 51) return null;
  const version = bytes2[4];
  return { version, cubism: cubismOfMoc[version] ?? null };
}
function imageType(bytes2) {
  if (bytes2.length >= 8 && bytes2[0] === 137 && bytes2[1] === 80 && bytes2[2] === 78 && bytes2[3] === 71) return "image/png";
  if (bytes2.length >= 3 && bytes2[0] === 255 && bytes2[1] === 216 && bytes2[2] === 255) return "image/jpeg";
  return null;
}
function bracketLength(value, start) {
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) escaped = false;
    else if (character === "\\" && quote !== "") escaped = true;
    else if (quote !== "") {
      if (character === quote) quote = "";
    } else if (character === '"' || character === "'") quote = character;
    else if (character === "[") depth += 1;
    else if (character === "]" && --depth === 0) return index - start + 1;
  }
  return void 0;
}
function words(value) {
  const result = [];
  let index = 0;
  while (index < value.length) {
    while (index < value.length && /\s/u.test(value[index])) index += 1;
    const start = index;
    let quote = "";
    let escaped = false;
    let depth = 0;
    for (; index < value.length; index += 1) {
      const character = value[index];
      if (escaped) escaped = false;
      else if (character === "\\" && quote !== "") escaped = true;
      else if (quote !== "") {
        if (character === quote) quote = "";
      } else if (character === '"' || character === "'") quote = character;
      else if (character === "[" || character === "{") depth += 1;
      else if (character === "]" || character === "}") depth -= 1;
      else if (/\s/u.test(character) && depth <= 0) break;
    }
    if (index > start) result.push(value.slice(start, index));
  }
  return result;
}
function unquote(raw) {
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
    try {
      const value = JSON.parse(raw);
      return typeof value === "string" ? value : raw.slice(1, -1);
    } catch {
      return raw.slice(1, -1);
    }
  }
  if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1).replace(/\\'/gu, "'").replace(/\\\\/gu, "\\");
  return raw;
}
function findShows(source) {
  const shows = [];
  source.split("\n").forEach((line, index) => {
    if (line.trim().startsWith(";")) return;
    for (let at = line.indexOf("[live2d.show"); at >= 0; at = line.indexOf("[live2d.show", at + 1)) {
      const after = line[at + "[live2d.show".length];
      if (after !== void 0 && after !== "]" && !/\s/u.test(after)) continue;
      const length = bracketLength(line, at);
      if (length === void 0) continue;
      const args = /* @__PURE__ */ new Map();
      for (const word of words(line.slice(at + "[live2d.show".length, at + length - 1))) {
        const equals = word.indexOf("=");
        if (equals > 0) args.set(word.slice(0, equals), unquote(word.slice(equals + 1)));
      }
      const id = args.get("id");
      const model = normalizeModelPath(args.get("model"));
      if (id !== void 0 && id !== "" && model !== null) shows.push({ id, model, line: index + 1 });
    }
  });
  return shows;
}
function normalizeModelPath(value) {
  if (typeof value !== "string") return null;
  const path = unquote(value.trim()).replaceAll("\\", "/").replace(/^(?:\.\/)+/u, "");
  if (path === "" || path.includes(":") || path.startsWith("/") || path.split("/").includes("..")) return null;
  return path;
}
var skipped = /* @__PURE__ */ new Set(["node_modules", "dist", NATIVE_USER_FILES.toLowerCase()]);
var maxFiles = 2e4;
async function findFiles(project, test, root = "", options = {}) {
  const found = [];
  let seen = 0;
  const walk = async (dir, depth) => {
    if (depth > 16 || seen > maxFiles) return;
    const entries = await project.list(dir).catch(() => []);
    seen += entries.length;
    const folders = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.kind === "directory") {
        if (options.includeSkipped || !skipped.has(entry.name.toLowerCase())) folders.push(entry.path);
      } else if (test(entry.name)) found.push(entry.path);
    }
    await Promise.all(folders.map((folder) => walk(folder, depth + 1)));
  };
  await walk(root, 0);
  return found.sort();
}
var isModel3 = (name) => /\.model3\.json$/iu.test(name);
var isStory = (name) => /\.pxstory$/iu.test(name);
var findModels = (project) => findFiles(project, isModel3);
async function modelsShownAs(project, id) {
  const stories = await findFiles(project, isStory);
  const texts = await Promise.all(stories.map((story) => project.readText(story).catch(() => "")));
  const models = texts.flatMap((source) => findShows(source).filter((show) => show.id === id).map((show) => show.model));
  return [...new Set(models)];
}
async function modelsFor(project, parameters) {
  const own = normalizeModelPath(parameters.model);
  if (own !== null) return { paths: [own], certain: true };
  const id = typeof parameters.id === "string" ? unquote(parameters.id.trim()) : "";
  if (id !== "") {
    const shown = await modelsShownAs(project, id);
    if (shown.length > 0) return { paths: shown, certain: shown.length === 1 };
  }
  return { paths: await findModels(project), certain: false };
}
function mergeChoices(sources, certain) {
  const merged = /* @__PURE__ */ new Map();
  for (const source of sources)
    for (const item of source.items) {
      const entry = merged.get(item.value) ?? { models: [], ...item.label === void 0 ? {} : { label: item.label } };
      if (!entry.models.includes(modelName(source.model))) entry.models.push(modelName(source.model));
      merged.set(item.value, entry);
    }
  return [...merged].map(([value, { label, models }]) => {
    if (certain) return label ? { value, label } : { value };
    return { value, label: `${label ?? value} · ${models.join(", ")}` };
  });
}
async function summaries(project, paths) {
  const read = await Promise.all(paths.map(async (path) => {
    try {
      return summarizeModel3(await project.readText(path), path);
    } catch {
      return null;
    }
  }));
  return read.filter((summary) => summary !== null && !summary.problems.some((problem) => problem.kind === "notJson"));
}
var motionCount = (count, locale) => locale === "zh-TW" ? `${count} 個動作` : `${count} motion${count === 1 ? "" : "s"}`;
async function modelChoices(project) {
  return (await findModels(project)).map((path) => ({ value: path }));
}
async function motionChoices(project, parameters, locale) {
  const { paths, certain } = await modelsFor(project, parameters);
  const models = await summaries(project, paths);
  return mergeChoices(models.map((model) => ({
    model: model.path,
    items: model.motions.map((group) => ({ value: group.group, label: `${group.group} · ${motionCount(group.files.length, locale)}` }))
  })), certain);
}
async function expressionChoices(project, parameters) {
  const { paths, certain } = await modelsFor(project, parameters);
  const models = await summaries(project, paths);
  return mergeChoices(models.map((model) => ({ model: model.path, items: model.expressions.map((entry) => ({ value: entry.name })) })), certain);
}
async function modelParameters(project, model) {
  if (model.displayInfo !== null) {
    try {
      const parameters = displayInfoParameters(await project.readText(model.displayInfo));
      if (parameters.length > 0) return { source: "cdi3", parameters };
    } catch {
    }
  }
  const ids = /* @__PURE__ */ new Set([...model.eyeBlink, ...model.lipSync]);
  const files = [...model.motions.flatMap((group) => group.files), ...model.expressions.map((entry) => entry.file)];
  await Promise.all(files.map(async (file) => {
    try {
      const source = await project.readText(file);
      const used = /\.exp3\.json$/iu.test(file) ? expressionParameterIds(source) : readMotionMeta(source).parameterIds;
      for (const id of used) ids.add(id);
    } catch {
    }
  }));
  return { source: "used", parameters: [...ids].sort().map((id) => ({ id, name: "" })) };
}
async function parameterChoices(project, parameters) {
  const { paths, certain } = await modelsFor(project, parameters);
  const models = await summaries(project, paths);
  const lists = await Promise.all(models.map(async (model) => ({
    model: model.path,
    items: (await modelParameters(project, model)).parameters.map(({ id, name }) => name ? { value: id, label: name } : { value: id })
  })));
  return mergeChoices(lists, certain);
}
function coreStatus(files) {
  const present = new Set(files);
  return CORE_FILES.map(({ platform, name }) => {
    const candidates = [`${EXTENSION_ID}/${platform}/${name}`, `${platform}/${name}`, name].map((path) => `${NATIVE_USER_FILES}/${path}`);
    return { platform, name, found: candidates.find((path) => present.has(path)) ?? null, expected: candidates[0] };
  });
}
async function inspectModel(project, path) {
  const problems = [];
  let summary;
  try {
    summary = summarizeModel3(await project.readText(path), path);
  } catch {
    summary = summarizeModel3("{}", path);
    problems.push({ kind: "missing", path });
  }
  if (!problems.length) problems.push(...summary.problems);
  const missing = (file) => problems.push({ kind: "missing", path: file });
  const json = async (file) => {
    try {
      const source = await project.readText(file);
      JSON.parse(source);
      return source;
    } catch (error) {
      if (error instanceof SyntaxError) problems.push({ kind: "notJson", path: file, detail: error.message });
      else missing(file);
      return null;
    }
  };
  const moc = summary.moc === null ? Promise.resolve(null) : project.readFile(summary.moc).then((bytes2) => {
    const version = mocVersion(bytes2);
    if (version === null) problems.push({ kind: "notMoc3", path: summary.moc });
    return { path: summary.moc, size: bytes2.length, version: version?.version ?? null, cubism: version?.cubism ?? null };
  }, () => {
    missing(summary.moc);
    return null;
  });
  const textures = Promise.all(summary.textures.map((texture) => project.readFile(texture).then((bytes2) => {
    const type = imageType(bytes2);
    if (type === null) problems.push({ kind: "notImage", path: texture });
    return { path: texture, bytes: type === null ? null : bytes2, type };
  }, () => {
    missing(texture);
    return { path: texture, bytes: null, type: null };
  })));
  const motions = Promise.all(summary.motions.map(async (group) => ({
    group: group.group,
    motions: await Promise.all(group.files.map(async (file) => {
      const source = await json(file);
      const meta = source === null ? null : readMotionMeta(source);
      return { file, duration: meta?.duration ?? null, loop: meta?.loop ?? false };
    }))
  })));
  const expressions = Promise.all(summary.expressions.map(async (entry) => {
    await json(entry.file);
    return entry;
  }));
  const optional = async (file) => file === null ? null : { path: file, ok: await json(file) !== null };
  const nativeFiles = findFiles(project, () => true, NATIVE_USER_FILES, { includeSkipped: true });
  const report = {
    summary,
    moc: await moc,
    textures: await textures,
    motions: await motions,
    expressions: await expressions,
    physics: await optional(summary.physics),
    pose: await optional(summary.pose),
    parameters: summary.displayInfo !== null && await json(summary.displayInfo) === null ? await modelParameters(project, { ...summary, displayInfo: null }) : await modelParameters(project, summary),
    core: coreStatus(await nativeFiles)
  };
  return { ...report, problems: dedupe(problems) };
}
function dedupe(problems) {
  const seen = /* @__PURE__ */ new Set();
  return problems.filter((problem) => {
    const key = `${problem.kind}|${problem.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Content/Extensions/live2d-cubism/studio.ts
var activate = (studio) => {
  const project = studio.project;
  studio.inspectors.register("live2d.model", {
    async mount(element, ctx) {
      const inspector = new ModelInspector(element, ctx.locale);
      mounted?.dispose();
      mounted = inspector;
      try {
        inspector.render(await inspectModel(project, ctx.asset.path));
      } catch (error) {
        inspector.fail(error);
      }
    },
    unmount() {
      mounted?.dispose();
      mounted = null;
    }
  });
  studio.parameterOptions.register("models", () => modelChoices(project));
  studio.parameterOptions.register("motions", (ctx) => motionChoices(project, ctx.parameters, ctx.locale));
  studio.parameterOptions.register("expressions", (ctx) => expressionChoices(project, ctx.parameters));
  studio.parameterOptions.register("parameters", (ctx) => parameterChoices(project, ctx.parameters));
};
var mounted = null;
export {
  activate
};
