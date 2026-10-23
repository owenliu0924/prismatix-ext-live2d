import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";

import {
  CORE_FILES, coreStatus, displayInfoParameters, expressionChoices, expressionParameterIds, findShows, imageType,
  inspectModel, mergeChoices, mocVersion, modelChoices, modelsFor, motionChoices, normalizeModelPath, parameterChoices,
  readMotionMeta, summarizeModel3, type ProjectReader,
} from "../studio/model.ts";

/** An in-memory project for the Studio side: files by project path, folders derived from them. */
function project(files: Record<string, string | Uint8Array>): ProjectReader & {reads: string[]} {
  const reads: string[] = [];
  const fail = (path: string) => Promise.reject(new Error(`Could not read ${path}`));
  return {
    reads,
    async list(dir = "") {
      const prefix = dir === "" ? "" : `${dir}/`;
      const entries = new Map<string, "file" | "directory">();
      for (const path of Object.keys(files)) {
        if (!path.startsWith(prefix)) continue;
        const rest = path.slice(prefix.length).split("/");
        entries.set(rest[0]!, rest.length > 1 ? "directory" : "file");
      }
      if (entries.size === 0 && dir !== "") throw new Error(`Could not list ${dir}`);
      return [...entries].map(([name, kind]) => ({name, path: `${prefix}${name}`, kind}));
    },
    async readText(path) {
      reads.push(path);
      const file = files[path];
      return typeof file === "string" ? file : file === undefined ? fail(path) : new TextDecoder().decode(file);
    },
    async readFile(path) {
      reads.push(path);
      const file = files[path];
      return typeof file === "string" ? new TextEncoder().encode(file) : file === undefined ? fail(path) : file;
    },
  };
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const MOC = new Uint8Array([0x4d, 0x4f, 0x43, 0x33, 5, 0, 0, 0]);

const haru = JSON.stringify({
  Version: 3,
  FileReferences: {
    Moc: "haru.moc3",
    Textures: ["haru.2048/texture_00.png", "haru.2048/texture_01.png"],
    Physics: "haru.physics3.json",
    DisplayInfo: "haru.cdi3.json",
    Motions: {
      Idle: [{File: "motions/idle_00.motion3.json"}, {File: "motions/idle_01.motion3.json"}],
      TapBody: [{File: "motions/tap.motion3.json", FadeInTime: 0.5}],
    },
    Expressions: [{Name: "f01", File: "expressions/f01.exp3.json"}, {Name: "f02", File: "expressions/f02.exp3.json"}],
  },
  Groups: [{Target: "Parameter", Name: "EyeBlink", Ids: ["ParamEyeLOpen", "ParamEyeROpen"]}, {Target: "Parameter", Name: "LipSync", Ids: []}],
});

const motion = (duration: number, loop: boolean, ids: string[]) => JSON.stringify({
  Version: 3, Meta: {Duration: duration, Fps: 30, Loop: loop},
  Curves: [...ids.map((Id) => ({Target: "Parameter", Id, Segments: [0, 0]})), {Target: "PartOpacity", Id: "PartArm", Segments: [0, 1]}],
});

/** Two models, one shown as haru in a Story, and Core for Windows and Android. */
function sampleProject(extra: Record<string, string | Uint8Array> = {}) {
  return project({
    "prismatix.json": "{}",
    "Assets/Live2D/Haru/haru.model3.json": haru,
    "Assets/Live2D/Haru/haru.moc3": MOC,
    "Assets/Live2D/Haru/haru.2048/texture_00.png": PNG,
    "Assets/Live2D/Haru/haru.2048/texture_01.png": PNG,
    "Assets/Live2D/Haru/haru.physics3.json": "{}",
    "Assets/Live2D/Haru/haru.cdi3.json": JSON.stringify({Version: 3, Parameters: [{Id: "ParamAngleX", Name: "Angle X"}, {Id: "ParamMouthOpenY", Name: "Mouth"}]}),
    "Assets/Live2D/Haru/motions/idle_00.motion3.json": motion(4, true, ["ParamAngleX"]),
    "Assets/Live2D/Haru/motions/idle_01.motion3.json": motion(3.25, false, ["ParamAngleY"]),
    "Assets/Live2D/Haru/motions/tap.motion3.json": motion(2, false, ["ParamArmA"]),
    "Assets/Live2D/Haru/expressions/f01.exp3.json": JSON.stringify({Parameters: [{Id: "ParamCheek", Value: 1}]}),
    "Assets/Live2D/Haru/expressions/f02.exp3.json": JSON.stringify({Parameters: [{Id: "ParamBrowLY", Value: -1}]}),
    "Assets/Live2D/Mao/mao.model3.json": JSON.stringify({
      FileReferences: {
        Moc: "mao.moc3",
        Motions: {Idle: [{File: "idle.motion3.json"}], Wave: [{File: "wave.motion3.json"}]},
        Expressions: [{Name: "f01", File: "f01.exp3.json"}, {Name: "angry", File: "angry.exp3.json"}],
      },
    }),
    "Assets/Live2D/Mao/idle.motion3.json": motion(5, true, ["ParamBodyAngleX"]),
    "Assets/Live2D/Mao/wave.motion3.json": motion(1, false, ["ParamArmLA"]),
    "Assets/Live2D/Mao/f01.exp3.json": JSON.stringify({Parameters: [{Id: "ParamEyeLSmile", Value: 1}]}),
    "Assets/Live2D/Mao/angry.exp3.json": JSON.stringify({Parameters: [{Id: "ParamBrowRY", Value: -1}]}),
    "Story/main.pxstory": [
      "*start",
      "[live2d.show id=haru model=\"Assets/Live2D/Haru/haru.model3.json\" x=0.3]",
      "; [live2d.show id=mao model=Assets/Live2D/Haru/haru.model3.json] is a comment",
      "Hello.[live2d.motion id=haru group=TapBody]",
    ].join("\n"),
    "dist/game/Assets/Live2D/Copy/copy.model3.json": haru,
    "NativeUserFiles/live2d-cubism/win32-x64/Live2DCubismCore.dll": "core",
    "NativeUserFiles/android-arm64/libLive2DCubismCore.so": "core",
    ...extra,
  });
}

test("studio: model3.json summary resolves every file it names", () => {
  const model = summarizeModel3(haru, "Assets/Live2D/Haru/haru.model3.json");
  assert.equal(model.name, "haru");
  assert.equal(model.version, 3);
  assert.equal(model.moc, "Assets/Live2D/Haru/haru.moc3");
  assert.deepEqual(model.textures, ["Assets/Live2D/Haru/haru.2048/texture_00.png", "Assets/Live2D/Haru/haru.2048/texture_01.png"]);
  assert.deepEqual(model.motions.map((group) => [group.group, group.files.length]), [["Idle", 2], ["TapBody", 1]]);
  assert.deepEqual(model.expressions.map((entry) => entry.name), ["f01", "f02"]);
  assert.equal(model.physics, "Assets/Live2D/Haru/haru.physics3.json");
  assert.equal(model.pose, null);
  assert.equal(model.displayInfo, "Assets/Live2D/Haru/haru.cdi3.json");
  assert.deepEqual(model.eyeBlink, ["ParamEyeLOpen", "ParamEyeROpen"]);
  assert.deepEqual(model.problems, []);
});

test("studio: a broken model3.json is a problem, not an exception", () => {
  assert.equal(summarizeModel3("{nope", "a.model3.json").problems[0]?.kind, "notJson");
  assert.equal(summarizeModel3("[]", "a.model3.json").problems[0]?.kind, "notJson");
  const odd = summarizeModel3(JSON.stringify({FileReferences: {Textures: "x.png", Motions: {Idle: "no"}, Expressions: [{Name: 3}]}}), "a.model3.json");
  assert.deepEqual(odd.problems, [{kind: "noMoc", path: "a.model3.json"}]);
  assert.deepEqual(odd.textures, []);
  assert.deepEqual(odd.motions, [{group: "Idle", files: []}]);
  assert.deepEqual(odd.expressions, []);
});

test("studio: motion, expression, cdi3 and moc3 readers", () => {
  assert.deepEqual(readMotionMeta(motion(2.5, true, ["ParamA", "ParamA", "ParamB"])), {duration: 2.5, loop: true, parameterIds: ["ParamA", "ParamB"]});
  assert.deepEqual(readMotionMeta("{}"), {duration: null, loop: false, parameterIds: []});
  assert.throws(() => readMotionMeta("not json"));
  assert.deepEqual(expressionParameterIds(JSON.stringify({Parameters: [{Id: "A"}, {Id: "B"}, {Id: "A"}, {}]})), ["A", "B"]);
  assert.deepEqual(displayInfoParameters(JSON.stringify({Parameters: [{Id: "A", Name: "角度"}, {Id: "B"}, {Name: "no id"}]})),
    [{id: "A", name: "角度"}, {id: "B", name: ""}]);
  assert.deepEqual(mocVersion(MOC), {version: 5, cubism: "5.0"});
  assert.deepEqual(mocVersion(new Uint8Array([0x4d, 0x4f, 0x43, 0x33, 9])), {version: 9, cubism: null});
  assert.equal(mocVersion(new Uint8Array([1, 2, 3, 4, 5])), null);
  assert.equal(imageType(PNG), "image/png");
  assert.equal(imageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(imageType(new Uint8Array([0, 1, 2])), null);
});

test("studio: live2d.show is found in Story text the way the Story parser reads it", () => {
  const shows = findShows([
    "[live2d.show id=haru model=\"Assets/A/a.model3.json\"]",
    "  ; [live2d.show id=gone model=Assets/B/b.model3.json]",
    "Line.[live2d.show id='mao' model='Assets/M/m.model3.json' x=0.5][live2d.show id=x model=./Assets/X/x.model3.json]",
    "[live2d.shower id=no model=Assets/N/n.model3.json]",
    "[live2d.show model=Assets/N/no-id.model3.json]",
    "[live2d.show id=asset model=asset:6b0f8f4c-6f43-4a8e-9a5e-0f3b8d0d2c11]",
    "[live2d.show id=\"two words\" model=\"Assets/With Space/s.model3.json\" idle=\"Idle\"]",
  ].join("\r\n"));
  assert.deepEqual(shows.map(({id, model, line}) => [id, model, line]), [
    ["haru", "Assets/A/a.model3.json", 1],
    ["mao", "Assets/M/m.model3.json", 3],
    ["x", "Assets/X/x.model3.json", 3],
    ["two words", "Assets/With Space/s.model3.json", 7],
  ]);
  assert.equal(normalizeModelPath("\"Assets\\\\A\\\\a.model3.json\""), "Assets/A/a.model3.json");
  assert.equal(normalizeModelPath("../a.model3.json"), null);
  assert.equal(normalizeModelPath("C:/a.model3.json"), null);
  assert.equal(normalizeModelPath(""), null);
});

test("studio: which model a command's choices come from", async () => {
  const files = sampleProject();
  assert.deepEqual(await modelsFor(files, {model: "Assets/Live2D/Mao/mao.model3.json", id: "haru"}),
    {paths: ["Assets/Live2D/Mao/mao.model3.json"], certain: true}, "live2d.show's own model wins");
  assert.deepEqual(await modelsFor(files, {id: "haru"}), {paths: ["Assets/Live2D/Haru/haru.model3.json"], certain: true});
  assert.deepEqual(await modelsFor(files, {id: "mao"}), {paths: ["Assets/Live2D/Haru/haru.model3.json", "Assets/Live2D/Mao/mao.model3.json"], certain: false},
    "an id no Story shows (the comment does not count) falls back to every model, outside dist/");
  assert.deepEqual(await modelsFor(files, {}), {paths: ["Assets/Live2D/Haru/haru.model3.json", "Assets/Live2D/Mao/mao.model3.json"], certain: false});

  const twice = sampleProject({"Story/two.pxstory": "[live2d.show id=haru model=Assets/Live2D/Mao/mao.model3.json]"});
  assert.deepEqual((await modelsFor(twice, {id: "haru"})).certain, false, "an id shown with two models is not certain");
});

test("studio: choices are merged across models and labelled with the model when it is not certain", () => {
  const sources = [
    {model: "A/haru.model3.json", items: [{value: "Idle", label: "Idle · 2 motions"}, {value: "TapBody", label: "TapBody · 1 motion"}]},
    {model: "B/mao.model3.json", items: [{value: "Idle", label: "Idle · 1 motion"}, {value: "Wave"}]},
  ];
  assert.deepEqual(mergeChoices(sources, false), [
    {value: "Idle", label: "Idle · 2 motions · haru, mao"},
    {value: "TapBody", label: "TapBody · 1 motion · haru"},
    {value: "Wave", label: "Wave · mao"},
  ]);
  assert.deepEqual(mergeChoices([{model: "A/haru.model3.json", items: [{value: "f01"}]}], true), [{value: "f01"}]);
});

test("studio: the providers' choices", async () => {
  const files = sampleProject();
  assert.deepEqual(await motionChoices(files, {id: "haru"}, "en"), [
    {value: "Idle", label: "Idle · 2 motions"},
    {value: "TapBody", label: "TapBody · 1 motion"},
  ]);
  assert.deepEqual(await motionChoices(files, {model: "Assets/Live2D/Mao/mao.model3.json"}, "zh-TW"), [
    {value: "Idle", label: "Idle · 1 個動作"},
    {value: "Wave", label: "Wave · 1 個動作"},
  ]);
  assert.deepEqual(await expressionChoices(files, {id: "nobody"}), [
    {value: "f01", label: "f01 · haru, mao"},
    {value: "f02", label: "f02 · haru"},
    {value: "angry", label: "angry · mao"},
  ]);
  assert.deepEqual(await parameterChoices(files, {id: "haru"}), [
    {value: "ParamAngleX", label: "Angle X"},
    {value: "ParamMouthOpenY", label: "Mouth"},
  ], "from the cdi3.json");
  assert.deepEqual(await parameterChoices(files, {model: "Assets/Live2D/Mao/mao.model3.json"}),
    ["ParamArmLA", "ParamBodyAngleX", "ParamBrowRY", "ParamEyeLSmile"].map((value) => ({value})),
    "without a cdi3.json: the ids its motions and expressions use");
  assert.deepEqual(await modelChoices(files), [
    {value: "Assets/Live2D/Haru/haru.model3.json"},
    {value: "Assets/Live2D/Mao/mao.model3.json"},
  ]);
  assert.deepEqual(await motionChoices(project({}), {id: "haru"}, "en"), [], "an empty project has no choices");
});

test("studio: the inspector's report of a complete model", async () => {
  const report = await inspectModel(sampleProject(), "Assets/Live2D/Haru/haru.model3.json");
  assert.deepEqual(report.problems, []);
  assert.deepEqual(report.moc, {path: "Assets/Live2D/Haru/haru.moc3", size: 8, version: 5, cubism: "5.0"});
  assert.deepEqual(report.textures.map((texture) => [texture.type, texture.bytes?.length]), [["image/png", 12], ["image/png", 12]]);
  assert.deepEqual(report.motions, [
    {group: "Idle", motions: [
      {file: "Assets/Live2D/Haru/motions/idle_00.motion3.json", duration: 4, loop: true},
      {file: "Assets/Live2D/Haru/motions/idle_01.motion3.json", duration: 3.25, loop: false},
    ]},
    {group: "TapBody", motions: [{file: "Assets/Live2D/Haru/motions/tap.motion3.json", duration: 2, loop: false}]},
  ]);
  assert.deepEqual(report.physics, {path: "Assets/Live2D/Haru/haru.physics3.json", ok: true});
  assert.equal(report.pose, null);
  assert.equal(report.parameters.source, "cdi3");
  assert.deepEqual(report.core.map((status) => [status.platform, status.found]), [
    ["win32-x64", "NativeUserFiles/live2d-cubism/win32-x64/Live2DCubismCore.dll"],
    ["linux-x64", null],
    ["darwin-x64", null],
    ["darwin-arm64", null],
    ["android-arm64", "NativeUserFiles/android-arm64/libLive2DCubismCore.so"],
  ]);
  assert.equal(report.core[1]!.expected, "NativeUserFiles/live2d-cubism/linux-x64/libLive2DCubismCore.so");
});

test("studio: missing and broken files are problems in the report, never exceptions", async () => {
  const files = sampleProject({
    "Assets/Live2D/Haru/haru.model3.json": JSON.stringify({
      FileReferences: {
        Moc: "haru.moc3",
        Textures: ["haru.2048/texture_00.png", "gone.png", "haru.physics3.json"],
        Physics: "missing.physics3.json",
        Pose: "haru.pose3.json",
        DisplayInfo: "broken.cdi3.json",
        Motions: {Idle: [{File: "motions/idle_00.motion3.json"}, {File: "motions/broken.motion3.json"}]},
        Expressions: [{Name: "gone", File: "expressions/gone.exp3.json"}],
      },
    }),
    "Assets/Live2D/Haru/haru.moc3": "not a moc",
    "Assets/Live2D/Haru/haru.pose3.json": "{}",
    "Assets/Live2D/Haru/broken.cdi3.json": "{",
    "Assets/Live2D/Haru/motions/broken.motion3.json": "{\"Meta\":",
  });
  const report = await inspectModel(files, "Assets/Live2D/Haru/haru.model3.json");
  const problems = report.problems.map((problem) => `${problem.kind} ${problem.path.replace("Assets/Live2D/Haru/", "")}`).sort();
  assert.deepEqual(problems, [
    "missing expressions/gone.exp3.json",
    "missing gone.png",
    "missing missing.physics3.json",
    "notImage haru.physics3.json",
    "notJson broken.cdi3.json",
    "notJson motions/broken.motion3.json",
    "notMoc3 haru.moc3",
  ]);
  assert.deepEqual(report.physics, {path: "Assets/Live2D/Haru/missing.physics3.json", ok: false});
  assert.deepEqual(report.pose, {path: "Assets/Live2D/Haru/haru.pose3.json", ok: true});
  assert.equal(report.motions[0]!.motions[1]!.duration, null);
  assert.equal(report.parameters.source, "used", "a broken cdi3.json falls back to the ids in use");
  assert.ok(report.parameters.parameters.some((parameter) => parameter.id === "ParamAngleX"));

  const absent = await inspectModel(project({}), "Assets/nothing.model3.json");
  assert.deepEqual(absent.problems, [{kind: "missing", path: "Assets/nothing.model3.json"}]);
  assert.equal(absent.moc, null);
  assert.ok(absent.core.every((status) => status.found === null), "no NativeUserFiles/ at all");
});

test("studio: Core lookup follows pack's order", () => {
  const status = coreStatus([
    "NativeUserFiles/Live2DCubismCore.dll",
    "NativeUserFiles/live2d-cubism/win32-x64/Live2DCubismCore.dll",
    "NativeUserFiles/libLive2DCubismCore.dylib",
  ]);
  assert.equal(status[0]!.found, "NativeUserFiles/live2d-cubism/win32-x64/Live2DCubismCore.dll");
  assert.equal(status[2]!.found, "NativeUserFiles/libLive2DCubismCore.dylib");
  assert.equal(status[3]!.found, "NativeUserFiles/libLive2DCubismCore.dylib", "one bare name serves both macOS platforms");
});

test("studio: the manifest's userFiles, platforms and providers agree with the Studio side", () => {
  const manifest = JSON.parse(readFileSync(new URL("../live2d-cubism.pxextension", import.meta.url), "utf8"));
  const pxext = JSON.parse(readFileSync(new URL("../pxext.json", import.meta.url), "utf8"));
  const libraries = manifest.native.libraries as Record<string, {userFiles?: {name: string; hint?: string; sha256s?: unknown}[]}>;
  assert.deepEqual(Object.entries(libraries).map(([platform, library]) => ({platform, name: library.userFiles?.[0]?.name})), [...CORE_FILES]);
  assert.deepEqual(manifest.platforms, CORE_FILES.map((file) => file.platform));
  for (const library of Object.values(libraries)) {
    assert.equal(library.userFiles?.length, 1);
    assert.match(library.userFiles![0]!.hint!, /Cubism SDK for Native.*license/);
    assert.equal(library.userFiles![0]!.sha256s, undefined, "Core versions vary");
  }
  const contributed = new Set(manifest.studio.contributes.parameterOptions.map((item: {id: string}) => item.id));
  const used = manifest.commands.flatMap((command: {parameters: {optionsFrom?: {provider?: string}}[]}) =>
    command.parameters.map((parameter) => parameter.optionsFrom?.provider).filter(Boolean)) as string[];
  assert.ok(used.length >= 5);
  for (const provider of used) {
    const [extension, id] = provider.split(":");
    assert.equal(extension, pxext.id, "providers are named by the package id");
    assert.ok(contributed.has(id), `${id} is contributed`);
  }
  // The Player refuses the whole manifest for a resourceFilter on any other type
  // (PXSCHEMA7017), though validate accepts it on a command parameter.
  for (const command of manifest.commands as {id: string; parameters: {name: string; type: string; resourceFilter?: string}[]}[])
    for (const parameter of command.parameters)
      assert.ok(parameter.resourceFilter === undefined || parameter.type === "resource", `${command.id} ${parameter.name}`);
});
