// The Live2D model inspector: draws a ModelReport (model.ts) in the frame
// Studio gives it, in Studio's light or dark theme and its locale. Textures
// are shown from their bytes through blob: URLs, which the frame's CSP allows.

import {type Locale, type ModelReport, type Problem} from "./model.ts";

const en = {
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
    notImage: "{0} is not a PNG or JPEG image",
  },
};

const zh: typeof en = {
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
    notImage: "{0} 不是 PNG 或 JPEG 圖片",
  },
};

type Strings = typeof en;
const strings: Record<Locale, Strings> = {"en": en, "zh-TW": zh};
type Key = Exclude<keyof Strings, "problem">;

const format = (template: string, ...values: (string | number)[]) =>
  template.replace(/\{(\d)\}/gu, (_, index: string) => String(values[Number(index)] ?? ""));

const style = `
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

/** A tiny element builder: `el("div", {class: "row"}, child, "text")`. */
function el(tag: string, attributes: Record<string, string> = {}, ...children: (Node | string | null | undefined | false)[]): HTMLElement {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  for (const child of children) if (child !== null && child !== undefined && child !== false) element.append(child);
  return element;
}

/** Text with a line-break opportunity after each "/", so long paths wrap at folders. */
const breakable = (text: string): (string | Node)[] =>
  text.split("/").flatMap((part, index, parts) => (index < parts.length - 1 ? [`${part}/`, document.createElement("wbr")] : [part]));
const fileName = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const bytes = (size: number) => (size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(0)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`);
const seconds = (value: number) => `${value.toFixed(value < 10 ? 1 : 0)} s`;

export class ModelInspector {
  private readonly urls: string[] = [];
  private readonly root: HTMLElement;
  private readonly text: Strings;

  constructor(root: HTMLElement, locale: Locale) {
    this.root = root;
    this.text = strings[locale] ?? strings.en;
    root.replaceChildren(el("style", {}, style), el("div", {class: "status"}, this.text.loading));
  }

  private t(key: Key, ...values: (string | number)[]): string {
    return format(this.text[key], ...values);
  }

  private count(parameters: number): string {
    return parameters === 1 ? this.t("param") : this.t("params", parameters);
  }

  private problem(problem: Problem): string {
    return format(this.text.problem[problem.kind], problem.path, "detail" in problem ? problem.detail : "");
  }

  fail(error: unknown): void {
    this.root.replaceChildren(el("style", {}, style),
      el("div", {class: "status bad-text"}, this.t("failed", error instanceof Error ? error.message : String(error))));
  }

  render(report: ModelReport): void {
    const {summary} = report;
    const section = (title: string, aside: string | null, ...body: (Node | null | false)[]) =>
      el("section", {}, el("h2", {}, el("span", {}, title), aside === null ? null : el("span", {}, aside)), ...body);
    // A row: the key (with a status dot and a note on the right) over its value;
    // the inspector is often under 300 px wide, so nothing sits side by side.
    const row = (key: string, value: Node | string, aside?: string, dot?: string) =>
      el("div", {class: "row"},
        el("div", {class: "line"}, dot ? el("span", {class: `dot ${dot}`}) : null, el("span", {class: "k"}, key),
          aside ? el("span", {class: "n"}, aside) : null),
        value instanceof HTMLElement && value.classList.contains("chips") ? (value.classList.add("v"), value) : el("div", {class: "v"}, value));

    const head = el("div", {class: "head"},
      el("div", {class: "title"}, el("h1", {}, summary.name),
        report.moc?.cubism ? el("span", {class: "badge"}, this.t("cubism", report.moc.cubism)) : null),
      el("div", {class: "path mono"}, summary.path));

    const problems = report.problems.length === 0 ? null : el("div", {class: "problems", role: "alert", "aria-label": this.t("problems")},
      ...report.problems.map((problem) => el("div", {}, el("span", {}, "!"), el("span", {}, this.problem(problem)))));

    const files = section(this.t("files"), null, el("div", {class: "rows"},
      row(this.t("moc"), el("span", {class: "mono"}, report.moc ? fileName(report.moc.path) : summary.moc ? fileName(summary.moc) : "-"),
        report.moc ? [report.moc.version === null ? null : this.t("mocVersion", report.moc.version), bytes(report.moc.size)].filter(Boolean).join(" · ") : undefined,
        report.moc && report.moc.version !== null ? "ok" : "bad")));

    const textures = section(this.t("textures"), String(report.textures.length),
      report.textures.length === 0 ? el("p", {class: "note"}, this.t("noTextures")) :
        el("div", {class: "thumbs"}, ...report.textures.map((texture) => this.thumbnail(texture))));

    const motionTotal = report.motions.reduce((sum, group) => sum + group.motions.length, 0);
    const motions = section(this.t("motions"), report.motions.length ? this.t("groups", report.motions.length, motionTotal) : null,
      report.motions.length === 0 ? el("p", {class: "note"}, this.t("noMotions")) :
        el("div", {class: "rows"}, ...report.motions.map((group) => row(group.group,
          el("span", {class: "chips"}, ...group.motions.map((motion) => el("span", {class: "chip", title: motion.file},
            motion.duration === null ? fileName(motion.file) : seconds(motion.duration),
            motion.loop ? el("small", {title: this.t("loop")}, "↻") : null))),
          String(group.motions.length)))));

    const expressions = section(this.t("expressions"), report.expressions.length ? String(report.expressions.length) : null,
      report.expressions.length === 0 ? el("p", {class: "note"}, this.t("noExpressions")) :
        el("div", {class: "chips"}, ...report.expressions.map((entry) => el("span", {class: "chip mono", title: entry.file}, entry.name))));

    const optional = (file: {path: string; ok: boolean} | null) => file === null
      ? {text: this.t("none"), dot: ""}
      : file.ok ? {text: this.t("notRun"), dot: "warn"} : {text: this.t("broken"), dot: "bad"};
    const physics = optional(report.physics);
    const pose = optional(report.pose);
    const features = section(this.t("features"), null, el("div", {class: "rows"},
      row(this.t("physics"), physics.text, report.physics ? fileName(report.physics.path) : undefined, physics.dot || undefined),
      row(this.t("pose"), pose.text, report.pose ? fileName(report.pose.path) : undefined, pose.dot || undefined),
      row(this.t("blink"), summary.eyeBlink.length ? this.count(summary.eyeBlink.length) : this.t("none"), undefined, summary.eyeBlink.length ? "ok" : undefined),
      row(this.t("lipSync"), summary.lipSync.length ? this.count(summary.lipSync.length) : this.t("lipSyncHint"), undefined, summary.lipSync.length ? "ok" : undefined)));

    const list = report.parameters.parameters;
    const parameters = section(this.t("parameters"), null, list.length === 0 ? el("p", {class: "note"}, this.t("noParameters")) :
      el("details", {}, el("summary", {}, report.parameters.source === "cdi3" && summary.displayInfo
        ? this.t("fromCdi", list.length, fileName(summary.displayInfo)) : this.t("fromUsed", list.length)),
      el("div", {class: "chips"}, ...list.map((parameter) => el("span", {class: "chip", title: parameter.name || parameter.id},
        el("span", {class: "mono"}, parameter.id), parameter.name ? el("small", {}, parameter.name) : null)))));

    const core = section(this.t("core"), null,
      el("p", {class: "note"}, this.t("coreIntro")),
      el("div", {class: "rows"}, ...report.core.map((status) => row(status.platform,
        status.found ? el("span", {class: "mono"}, ...breakable(status.found))
          : el("span", {class: "warn-text"}, ...breakable(this.t("coreMissing", status.name, status.expected))),
        undefined, status.found ? "ok" : "warn"))),
      el("p", {class: "note"}, this.t("coreEnv")));

    this.root.replaceChildren(el("style", {}, style),
      el("div", {class: "l2"}, head, problems, files, textures, motions, expressions, features, parameters, core));
  }

  private thumbnail(texture: ModelReport["textures"][number]): HTMLElement {
    const name = fileName(texture.path);
    if (texture.bytes === null || texture.type === null)
      return el("figure", {title: texture.path}, el("div", {class: "img gone"}, "!"), el("figcaption", {class: "mono"}, name));
    const url = URL.createObjectURL(new Blob([texture.bytes as Uint8Array<ArrayBuffer>], {type: texture.type}));
    this.urls.push(url);
    const caption = el("figcaption", {class: "mono"}, name);
    const image = el("img", {src: url, alt: name}) as HTMLImageElement;
    image.addEventListener("load", () => {
      caption.textContent = `${image.naturalWidth}×${image.naturalHeight}`;
      caption.title = name;
    });
    return el("figure", {title: texture.path}, el("div", {class: "img"}, image), caption);
  }

  dispose(): void {
    for (const url of this.urls.splice(0)) URL.revokeObjectURL(url);
  }
}
