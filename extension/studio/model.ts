// What the Studio side knows about a Live2D model, without a DOM: summarising a
// .model3.json and the files it names, finding which model a Story id shows,
// and the choices for the commands' dropdowns. It reaches the project only
// through the reader it is given, so the unit tests run it in plain Node
// against an in-memory project (test/studio.test.ts); studio.ts and
// inspector.ts add Studio and the DOM.

import {folderOf, resolvePath} from "../src/model3.ts";

/** The manifest id: NativeUserFiles/<id>/<platform>/ and Plugins/<id>/ use it. */
export const EXTENSION_ID = "live2d-cubism";

/** Cubism Core per platform, as the manifest's native.libraries.<platform>.userFiles name it (a test keeps them equal). */
export const CORE_FILES: readonly {readonly platform: string; readonly name: string}[] = [
  {platform: "win32-x64", name: "Live2DCubismCore.dll"},
  {platform: "linux-x64", name: "libLive2DCubismCore.so"},
  {platform: "darwin-x64", name: "libLive2DCubismCore.dylib"},
  {platform: "darwin-arm64", name: "libLive2DCubismCore.dylib"},
  {platform: "android-arm64", name: "libLive2DCubismCore.so"},
];

export const NATIVE_USER_FILES = "NativeUserFiles";

/** The part of Studio's project API this module uses (`StudioProject`). */
export interface ProjectReader {
  list(dir?: string): Promise<readonly {readonly name: string; readonly path: string; readonly kind: "file" | "directory"}[]>;
  readText(path: string): Promise<string>;
  readFile(path: string): Promise<Uint8Array>;
}

export type Locale = "zh-TW" | "en";

/** Something wrong with the model or a file it names; the inspector shows each as one line. */
export type Problem =
  | {readonly kind: "notJson"; readonly path: string; readonly detail: string}
  | {readonly kind: "noMoc"; readonly path: string}
  | {readonly kind: "missing"; readonly path: string}
  | {readonly kind: "notMoc3"; readonly path: string}
  | {readonly kind: "notImage"; readonly path: string};

export interface ModelSummary {
  readonly path: string;
  readonly name: string;
  /** model3.json's own `Version`. */
  readonly version: number | null;
  readonly moc: string | null;
  readonly textures: readonly string[];
  readonly motions: readonly {readonly group: string; readonly files: readonly string[]}[];
  readonly expressions: readonly {readonly name: string; readonly file: string}[];
  readonly physics: string | null;
  readonly pose: string | null;
  readonly displayInfo: string | null;
  readonly eyeBlink: readonly string[];
  readonly lipSync: readonly string[];
  readonly problems: readonly Problem[];
}

type Json = Record<string, unknown>;

const record = (value: unknown): Json | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Json : undefined;
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown): string | undefined => (typeof value === "string" && value !== "" ? value : undefined);
const finite = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** "Assets/Haru/haru.model3.json" -> "haru". */
export function modelName(path: string): string {
  const file = path.slice(path.lastIndexOf("/") + 1);
  return file.replace(/\.model3\.json$/iu, "") || file;
}

/** Everything a .model3.json names, resolved to project paths. Never throws: what is wrong is in `problems`. */
export function summarizeModel3(source: string, path: string): ModelSummary {
  const empty = {
    path, name: modelName(path), version: null, moc: null, textures: [], motions: [], expressions: [],
    physics: null, pose: null, displayInfo: null, eyeBlink: [], lipSync: [],
  };
  let json: Json | undefined;
  try {
    json = record(JSON.parse(source));
    if (!json) throw new Error("not a JSON object");
  } catch (error) {
    return {...empty, problems: [{kind: "notJson", path, detail: errorText(error)}]};
  }
  const folder = folderOf(path);
  const at = (relative: unknown): string | null => {
    const value = text(relative);
    return value === undefined ? null : resolvePath(folder, value);
  };
  const references = record(json.FileReferences) ?? {};
  const moc = at(references.Moc);
  const motions = Object.entries(record(references.Motions) ?? {}).map(([group, entries]) => ({
    group,
    files: list(entries).map((entry) => at(record(entry)?.File)).filter((file): file is string => file !== null),
  }));
  const expressions = list(references.Expressions).flatMap((entry) => {
    const name = text(record(entry)?.Name);
    const file = at(record(entry)?.File);
    return name === undefined || file === null ? [] : [{name, file}];
  });
  const group = (name: string): string[] => list(json.Groups)
    .map(record)
    .filter((entry) => entry?.Target === "Parameter" && entry.Name === name)
    .flatMap((entry) => list(entry?.Ids).filter((id): id is string => typeof id === "string"));
  return {
    ...empty,
    version: finite(json.Version),
    moc,
    textures: list(references.Textures).map(at).filter((file): file is string => file !== null),
    motions,
    expressions,
    physics: at(references.Physics),
    pose: at(references.Pose),
    displayInfo: at(references.DisplayInfo),
    eyeBlink: group("EyeBlink"),
    lipSync: group("LipSync"),
    problems: moc === null ? [{kind: "noMoc", path}] : [],
  };
}

export interface MotionMeta {
  readonly duration: number | null;
  readonly loop: boolean;
  /** Parameter ids the motion's curves drive. */
  readonly parameterIds: readonly string[];
}

/** A .motion3.json's Meta and the parameters it moves; throws when it is not JSON. */
export function readMotionMeta(source: string): MotionMeta {
  const json = record(JSON.parse(source)) ?? {};
  const meta = record(json.Meta) ?? {};
  const parameterIds = list(json.Curves).map(record)
    .filter((curve) => curve?.Target === "Parameter")
    .map((curve) => text(curve?.Id))
    .filter((id): id is string => id !== undefined);
  return {duration: finite(meta.Duration), loop: meta.Loop === true, parameterIds: [...new Set(parameterIds)]};
}

/** Parameter ids an .exp3.json sets; throws when it is not JSON. */
export function expressionParameterIds(source: string): string[] {
  const json = record(JSON.parse(source)) ?? {};
  return [...new Set(list(json.Parameters).map((entry) => text(record(entry)?.Id)).filter((id): id is string => id !== undefined))];
}

/** A cdi3.json's parameters with their display names; throws when it is not JSON. */
export function displayInfoParameters(source: string): {id: string; name: string}[] {
  const json = record(JSON.parse(source)) ?? {};
  return list(json.Parameters).flatMap((entry) => {
    const id = text(record(entry)?.Id);
    return id === undefined ? [] : [{id, name: text(record(entry)?.Name) ?? ""}];
  });
}

const cubismOfMoc: Record<number, string> = {1: "3.0", 2: "3.3", 3: "4.0", 4: "4.2", 5: "5.0"};

/** A .moc3's format version (the byte after "MOC3") and the Cubism release that introduced it; null when it is not a moc3. */
export function mocVersion(bytes: Uint8Array): {version: number; cubism: string | null} | null {
  if (bytes.length < 5 || bytes[0] !== 0x4d || bytes[1] !== 0x4f || bytes[2] !== 0x43 || bytes[3] !== 0x33) return null;
  const version = bytes[4]!;
  return {version, cubism: cubismOfMoc[version] ?? null};
}

/** PNG or JPEG by its first bytes; Live2D textures are PNG. */
export function imageType(bytes: Uint8Array): "image/png" | "image/jpeg" | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
}

// ---- Story ------------------------------------------------------------------

export interface ShowCommand {
  readonly id: string;
  readonly model: string;
  /** 1-based. */
  readonly line: number;
}

/** Length of the bracketed group starting at `start`, quote-aware (the Story parser's rule). */
function bracketLength(value: string, start: number): number | undefined {
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const character = value[index]!;
    if (escaped) escaped = false;
    else if (character === "\\" && quote !== "") escaped = true;
    else if (quote !== "") { if (character === quote) quote = ""; }
    else if (character === "\"" || character === "'") quote = character;
    else if (character === "[") depth += 1;
    else if (character === "]" && --depth === 0) return index - start + 1;
  }
  return undefined;
}

/** A command's words, split on unquoted whitespace outside [] and {}. */
function words(value: string): string[] {
  const result: string[] = [];
  let index = 0;
  while (index < value.length) {
    while (index < value.length && /\s/u.test(value[index]!)) index += 1;
    const start = index;
    let quote = "";
    let escaped = false;
    let depth = 0;
    for (; index < value.length; index += 1) {
      const character = value[index]!;
      if (escaped) escaped = false;
      else if (character === "\\" && quote !== "") escaped = true;
      else if (quote !== "") { if (character === quote) quote = ""; }
      else if (character === "\"" || character === "'") quote = character;
      else if (character === "[" || character === "{") depth += 1;
      else if (character === "]" || character === "}") depth -= 1;
      else if (/\s/u.test(character) && depth <= 0) break;
    }
    if (index > start) result.push(value.slice(start, index));
  }
  return result;
}

/** An argument's value as the Story parser reads a string: "json", 'single' or bare. */
function unquote(raw: string): string {
  if (raw.length >= 2 && raw.startsWith("\"") && raw.endsWith("\"")) {
    try {
      const value: unknown = JSON.parse(raw);
      return typeof value === "string" ? value : raw.slice(1, -1);
    } catch {
      return raw.slice(1, -1);
    }
  }
  if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1).replace(/\\'/gu, "'").replace(/\\\\/gu, "\\");
  return raw;
}

/** Every `[live2d.show id=... model=...]` in a .pxstory, skipping `;` comment lines. */
export function findShows(source: string): ShowCommand[] {
  const shows: ShowCommand[] = [];
  source.split("\n").forEach((line, index) => {
    if (line.trim().startsWith(";")) return;
    for (let at = line.indexOf("[live2d.show"); at >= 0; at = line.indexOf("[live2d.show", at + 1)) {
      const after = line[at + "[live2d.show".length];
      if (after !== undefined && after !== "]" && !/\s/u.test(after)) continue;
      const length = bracketLength(line, at);
      if (length === undefined) continue;
      const args = new Map<string, string>();
      for (const word of words(line.slice(at + "[live2d.show".length, at + length - 1))) {
        const equals = word.indexOf("=");
        if (equals > 0) args.set(word.slice(0, equals), unquote(word.slice(equals + 1)));
      }
      const id = args.get("id");
      const model = normalizeModelPath(args.get("model"));
      if (id !== undefined && id !== "" && model !== null) shows.push({id, model, line: index + 1});
    }
  });
  return shows;
}

/** A model argument as a project path, or null for what is not one (empty, `asset:` ids, absolute paths). */
export function normalizeModelPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = unquote(value.trim()).replaceAll("\\", "/").replace(/^(?:\.\/)+/u, "");
  if (path === "" || path.includes(":") || path.startsWith("/") || path.split("/").includes("..")) return null;
  return path;
}

// ---- the project --------------------------------------------------------------

/** Folders no model or Story lives in: hidden ones, packages, build output. */
const skipped = new Set(["node_modules", "dist", NATIVE_USER_FILES.toLowerCase()]);
const maxFiles = 20_000;

/** Project files (project-relative paths, sorted) under `root` whose name passes `test`. */
export async function findFiles(project: ProjectReader, test: (name: string) => boolean, root = "",
  options: {includeSkipped?: boolean} = {}): Promise<string[]> {
  const found: string[] = [];
  let seen = 0;
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > 16 || seen > maxFiles) return;
    const entries = await project.list(dir).catch(() => []);
    seen += entries.length;
    const folders: string[] = [];
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

const isModel3 = (name: string) => /\.model3\.json$/iu.test(name);
const isStory = (name: string) => /\.pxstory$/iu.test(name);

export const findModels = (project: ProjectReader) => findFiles(project, isModel3);

/** The .model3.json files a Story shows with this id, in the order they first appear. */
export async function modelsShownAs(project: ProjectReader, id: string): Promise<string[]> {
  const stories = await findFiles(project, isStory);
  const texts = await Promise.all(stories.map((story) => project.readText(story).catch(() => "")));
  const models = texts.flatMap((source) => findShows(source).filter((show) => show.id === id).map((show) => show.model));
  return [...new Set(models)];
}

/**
 * Which models a command's dropdown should list: the command's own `model`
 * (live2d.show), else the models a Story shows with its `id`, else every
 * model in the project (`certain` false: label each choice with its model).
 */
export async function modelsFor(project: ProjectReader, parameters: Readonly<Record<string, unknown>>):
  Promise<{paths: string[]; certain: boolean}> {
  const own = normalizeModelPath(parameters.model);
  if (own !== null) return {paths: [own], certain: true};
  const id = typeof parameters.id === "string" ? unquote(parameters.id.trim()) : "";
  if (id !== "") {
    const shown = await modelsShownAs(project, id);
    if (shown.length > 0) return {paths: shown, certain: shown.length === 1};
  }
  return {paths: await findModels(project), certain: false};
}

// ---- dropdown choices -----------------------------------------------------------

export interface Option {
  value: string;
  label?: string;
}

interface Choices {
  readonly model: string;
  /** `label`: what the dropdown shows; Studio shows the value beside it, so it need not repeat it. */
  readonly items: readonly {readonly value: string; readonly label?: string}[];
}

/**
 * One list from several models' choices. A value several models share is
 * listed once. When the model is not certain, each label names the models
 * that have the value.
 */
export function mergeChoices(sources: readonly Choices[], certain: boolean): Option[] {
  const merged = new Map<string, {label?: string; models: string[]}>();
  for (const source of sources)
    for (const item of source.items) {
      const entry = merged.get(item.value) ?? {models: [], ...(item.label === undefined ? {} : {label: item.label})};
      if (!entry.models.includes(modelName(source.model))) entry.models.push(modelName(source.model));
      merged.set(item.value, entry);
    }
  return [...merged].map(([value, {label, models}]) => {
    if (certain) return label ? {value, label} : {value};
    return {value, label: `${label ?? value} · ${models.join(", ")}`};
  });
}

async function summaries(project: ProjectReader, paths: readonly string[]): Promise<ModelSummary[]> {
  const read = await Promise.all(paths.map(async (path) => {
    try {
      return summarizeModel3(await project.readText(path), path);
    } catch {
      return null;
    }
  }));
  return read.filter((summary): summary is ModelSummary => summary !== null && !summary.problems.some((problem) => problem.kind === "notJson"));
}

const motionCount = (count: number, locale: Locale) =>
  locale === "zh-TW" ? `${count} 個動作` : `${count} motion${count === 1 ? "" : "s"}`;

/** `models`: the project's .model3.json files (the path is what Studio shows; a label would only crowd it). */
export async function modelChoices(project: ProjectReader): Promise<Option[]> {
  return (await findModels(project)).map((path) => ({value: path}));
}

/** `motions`: motion groups and how many motions each has. */
export async function motionChoices(project: ProjectReader, parameters: Readonly<Record<string, unknown>>, locale: Locale): Promise<Option[]> {
  const {paths, certain} = await modelsFor(project, parameters);
  const models = await summaries(project, paths);
  return mergeChoices(models.map((model) => ({
    model: model.path,
    items: model.motions.map((group) => ({value: group.group, label: `${group.group} · ${motionCount(group.files.length, locale)}`})),
  })), certain);
}

/** `expressions`: expression names. */
export async function expressionChoices(project: ProjectReader, parameters: Readonly<Record<string, unknown>>): Promise<Option[]> {
  const {paths, certain} = await modelsFor(project, parameters);
  const models = await summaries(project, paths);
  return mergeChoices(models.map((model) => ({model: model.path, items: model.expressions.map((entry) => ({value: entry.name}))})), certain);
}

/**
 * A model's parameters: from its cdi3.json (with display names) when it has
 * a readable one, else the ids its motions, expressions and EyeBlink/LipSync
 * groups use, sorted.
 */
export async function modelParameters(project: ProjectReader, model: ModelSummary):
  Promise<{source: "cdi3" | "used"; parameters: {id: string; name: string}[]}> {
  if (model.displayInfo !== null) {
    try {
      const parameters = displayInfoParameters(await project.readText(model.displayInfo));
      if (parameters.length > 0) return {source: "cdi3", parameters};
    } catch {
      // Fall back to the ids the model's files use.
    }
  }
  const ids = new Set<string>([...model.eyeBlink, ...model.lipSync]);
  const files = [...model.motions.flatMap((group) => group.files), ...model.expressions.map((entry) => entry.file)];
  await Promise.all(files.map(async (file) => {
    try {
      const source = await project.readText(file);
      const used = /\.exp3\.json$/iu.test(file) ? expressionParameterIds(source) : readMotionMeta(source).parameterIds;
      for (const id of used) ids.add(id);
    } catch {
      // A missing or broken file adds nothing; the inspector reports it.
    }
  }));
  return {source: "used", parameters: [...ids].sort().map((id) => ({id, name: ""}))};
}

/** `parameters`: parameter ids, labelled with their cdi3 display names (Studio shows the id beside the label). */
export async function parameterChoices(project: ProjectReader, parameters: Readonly<Record<string, unknown>>): Promise<Option[]> {
  const {paths, certain} = await modelsFor(project, parameters);
  const models = await summaries(project, paths);
  const lists = await Promise.all(models.map(async (model) => ({
    model: model.path,
    items: (await modelParameters(project, model)).parameters.map(({id, name}) => (name ? {value: id, label: name} : {value: id})),
  })));
  return mergeChoices(lists, certain);
}

// ---- the inspector's report --------------------------------------------------

export interface CoreStatus {
  readonly platform: string;
  readonly name: string;
  /** Where it was found in NativeUserFiles/, or null. */
  readonly found: string | null;
  /** Where to put it. */
  readonly expected: string;
}

/**
 * Cubism Core per platform in the project's NativeUserFiles/, looked up the
 * way pack does: <id>/<platform>/<name>, <platform>/<name>, then <name>.
 * PRISMATIX_NATIVE_USER_FILES is outside what Studio can see.
 */
export function coreStatus(files: readonly string[]): CoreStatus[] {
  const present = new Set(files);
  return CORE_FILES.map(({platform, name}) => {
    const candidates = [`${EXTENSION_ID}/${platform}/${name}`, `${platform}/${name}`, name].map((path) => `${NATIVE_USER_FILES}/${path}`);
    return {platform, name, found: candidates.find((path) => present.has(path)) ?? null, expected: candidates[0]!};
  });
}

export interface ModelReport {
  readonly summary: ModelSummary;
  readonly moc: {readonly path: string; readonly size: number; readonly version: number | null; readonly cubism: string | null} | null;
  readonly textures: readonly {readonly path: string; readonly bytes: Uint8Array | null; readonly type: string | null}[];
  readonly motions: readonly {readonly group: string; readonly motions: readonly {readonly file: string; readonly duration: number | null; readonly loop: boolean}[]}[];
  readonly expressions: readonly {readonly name: string; readonly file: string}[];
  /** `ok` false: named but missing or broken (also a problem). */
  readonly physics: {readonly path: string; readonly ok: boolean} | null;
  readonly pose: {readonly path: string; readonly ok: boolean} | null;
  readonly parameters: {readonly source: "cdi3" | "used"; readonly parameters: readonly {readonly id: string; readonly name: string}[]};
  readonly core: readonly CoreStatus[];
  readonly problems: readonly Problem[];
}

/** Reads the model and every file it names; whatever is missing or broken becomes a problem, never an exception. */
export async function inspectModel(project: ProjectReader, path: string): Promise<ModelReport> {
  const problems: Problem[] = [];
  let summary: ModelSummary;
  try {
    summary = summarizeModel3(await project.readText(path), path);
  } catch {
    summary = summarizeModel3("{}", path);
    problems.push({kind: "missing", path});
  }
  if (!problems.length) problems.push(...summary.problems);
  const missing = (file: string) => problems.push({kind: "missing", path: file});
  const json = async (file: string): Promise<string | null> => {
    try {
      const source = await project.readText(file);
      JSON.parse(source);
      return source;
    } catch (error) {
      if (error instanceof SyntaxError) problems.push({kind: "notJson", path: file, detail: error.message});
      else missing(file);
      return null;
    }
  };

  const moc = summary.moc === null ? Promise.resolve(null) : project.readFile(summary.moc).then((bytes) => {
    const version = mocVersion(bytes);
    if (version === null) problems.push({kind: "notMoc3", path: summary.moc!});
    return {path: summary.moc!, size: bytes.length, version: version?.version ?? null, cubism: version?.cubism ?? null};
  }, () => {
    missing(summary.moc!);
    return null;
  });
  const textures = Promise.all(summary.textures.map((texture) => project.readFile(texture).then((bytes) => {
    const type = imageType(bytes);
    if (type === null) problems.push({kind: "notImage", path: texture});
    return {path: texture, bytes: type === null ? null : bytes, type};
  }, () => {
    missing(texture);
    return {path: texture, bytes: null, type: null};
  })));
  const motions = Promise.all(summary.motions.map(async (group) => ({
    group: group.group,
    motions: await Promise.all(group.files.map(async (file) => {
      const source = await json(file);
      const meta = source === null ? null : readMotionMeta(source);
      return {file, duration: meta?.duration ?? null, loop: meta?.loop ?? false};
    })),
  })));
  const expressions = Promise.all(summary.expressions.map(async (entry) => {
    await json(entry.file);
    return entry;
  }));
  const optional = async (file: string | null) => (file === null ? null : {path: file, ok: await json(file) !== null});
  const nativeFiles = findFiles(project, () => true, NATIVE_USER_FILES, {includeSkipped: true});

  const report = {
    summary,
    moc: await moc,
    textures: await textures,
    motions: await motions,
    expressions: await expressions,
    physics: await optional(summary.physics),
    pose: await optional(summary.pose),
    parameters: summary.displayInfo !== null && await json(summary.displayInfo) === null
      ? await modelParameters(project, {...summary, displayInfo: null})
      : await modelParameters(project, summary),
    core: coreStatus(await nativeFiles),
  };
  return {...report, problems: dedupe(problems)};
}

function dedupe(problems: readonly Problem[]): Problem[] {
  const seen = new Set<string>();
  return problems.filter((problem) => {
    const key = `${problem.kind}|${problem.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
