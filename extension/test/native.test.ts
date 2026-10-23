// The script side against the real plugin library: Core is the mock, the
// Player is native/test/plugin_harness.c, the raw host is FakeRaw. Run through
// tools/test.sh, which builds all three; skipped without LIVE2D_NATIVE_BUILD.

import assert from "node:assert/strict";
import {copyFileSync, mkdtempSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {basename, join} from "node:path";
import {test, type TestContext} from "node:test";

import {Live2DScene, type ModelSpec, type SceneHost, type SceneState} from "../src/scene.ts";
import {VERTEX_FLOATS} from "../src/protocol.ts";
import {FakeRaw, HarnessNative, nativeBuild, screenPosition} from "./support.ts";

const skip = nativeBuild === null || nativeBuild.plugin === "" ? "run tools/test.sh (it builds the plugin, the mock Core and the harness)" : false;

const MOCK_MOC = Buffer.from("MOCK\u0001\u0000\u0000\u0000", "latin1");

const resources = (extra: Record<string, string> = {}): Record<string, string> => ({
  "Assets/Mock/mock.model3.json": JSON.stringify({
    Version: 3,
    FileReferences: {
      Moc: "mock.moc3", Textures: ["tex/page0.png", "tex/page1.png"],
      Motions: {Idle: [{File: "motions/lean.motion3.json", FadeInTime: 0, FadeOutTime: 0}], Wave: [{File: "motions/lean.motion3.json", FadeInTime: 0, FadeOutTime: 0}]},
      Expressions: [{Name: "glow-off", File: "expressions/glow-off.exp3.json"}],
    },
    Groups: [{Target: "Parameter", Name: "EyeBlink", Ids: ["ParamNotInMock"]}],
  }),
  "Assets/Mock/motions/lean.motion3.json": JSON.stringify({
    Meta: {Duration: 5, Loop: true},
    Curves: [{Target: "Parameter", Id: "ParamAngleX", Segments: [0, 20, 0, 5, 20]}],
  }),
  "Assets/Mock/expressions/glow-off.exp3.json": JSON.stringify({
    FadeInTime: 0, Parameters: [{Id: "ParamOpacity", Value: 0, Blend: "Overwrite"}],
  }),
  ...extra,
});

const binaries = (extra: Record<string, Uint8Array> = {}): Record<string, Uint8Array> => ({
  "Assets/Mock/mock.moc3": new Uint8Array(MOCK_MOC),
  ...extra,
});

/** ctx.random.next stand-in: a fixed sequence, so blinking is reproducible. */
function sequence(): () => number {
  let state = 12345;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function spec(overrides: Partial<ModelSpec> = {}): ModelSpec {
  return {
    model: "Assets/Mock/mock.model3.json", x: 0.5, y: 1, height: 1, z: 0, idle: "", breath: false, blink: false,
    motion: null, expression: "", params: {}, ...overrides,
  };
}

function setup(context: TestContext, files = resources(), bytes = binaries(), plugin = nativeBuild!.plugin) {
  const native = new HarnessNative(plugin, nativeBuild!.harness);
  context.after(() => native.close());
  const raw = new FakeRaw();
  const log: string[] = [];
  const host: SceneHost = {
    readText: (path) => {
      const text = files[path];
      if (text === undefined) throw new Error(`no resource ${path}`);
      return text;
    },
    readBytes: (path) => {
      const data = bytes[path];
      if (data === undefined) throw new Error(`no resource ${path}`);
      return data;
    },
    random: sequence(),
    native: (service, payload) => native.request(service, payload),
    raw,
    logicalSize: () => ({w: 1920, h: 1080}),
    log: {info: (m) => log.push(`info ${m}`), warn: (m) => log.push(`warn ${m}`), error: (m) => log.push(`error ${m}`)},
    phase: "after-stage",
  };
  const scene = new Live2DScene(host);
  const state = (models: Record<string, ModelSpec>, core = nativeBuild!.core): SceneState => ({core, models});
  const run = (frames: number, current: SceneState) => {
    for (let frame = 0; frame < frames; frame += 1) {
      raw.beginFrame();
      scene.update(1 / 60, current);
    }
  };
  return {native, raw, log, scene, state, run};
}

/** Leftmost screen x of the Body mesh (the one two units wide), transform applied. */
function bodyLeft(raw: FakeRaw): number {
  for (const mesh of raw.drawn()) {
    const xs = Array.from({length: mesh.vertexCount}, (_, v) => screenPosition(mesh, v)[0]);
    if (Math.max(...xs) - Math.min(...xs) > 500) return Math.round(Math.min(...xs) * 100) / 100; // float32 vertices, double transform
  }
  throw new Error("no Body mesh");
}

test("a model appears with the transform, UVs, blend modes and mask the plugin reported", {skip}, (context) => {
  const {raw, log, scene, state, run} = setup(context);
  run(3, state({haru: spec()}));
  assert.deepEqual(log.filter((line) => line.startsWith("error")), []);
  assert.deepEqual(scene.loaded, ["haru"]);

  const drawn = raw.drawn();
  assert.deepEqual(drawn.map((mesh) => mesh.options.blend), ["normal", "additive", "multiply", "normal"]);
  assert.deepEqual(drawn.map((mesh) => (mesh.options.texture as {path: string}).path),
    ["Assets/Mock/tex/page0.png", "Assets/Mock/tex/page0.png", "Assets/Mock/tex/page1.png", "Assets/Mock/tex/page0.png"]);

  // Canvas 200x400 px, 100 px/unit, origin at the centre. The plugin returns canvas pixels:
  // corner (-1,-2) is (0, 400) and (1,2) is (200, 0) with y down from the top.
  const body = drawn[0]!;
  assert.deepEqual([body.vertexData[0], body.vertexData[1]], [0, 400]);
  assert.deepEqual([body.vertexData[2], body.vertexData[3]], [0, 1], "Cubism's bottom-left UV origin became the Player's top-left");
  assert.deepEqual([body.vertexData[2 * VERTEX_FLOATS], body.vertexData[2 * VERTEX_FLOATS + 1]], [200, 0]);
  assert.equal(body.vertexData[7], 1);
  // The mesh transform places it: height 1 of 1080 px is scale 2.7 with the feet at (960, 1080).
  assert.deepEqual(screenPosition(body, 0).map(Math.round), [690, 1080]);
  assert.deepEqual(screenPosition(body, 2).map(Math.round), [1230, 0]);

  // Glow is masked by the Mask drawable through a hidden union mesh holding its geometry.
  const glow = drawn[1]!;
  assert.equal(glow.options.mask?.length, 1);
  assert.equal(glow.options.maskInverted, false);
  const mask = raw.meshes.get(glow.options.mask![0]!)!;
  assert.equal(mask.options.visible, false);
  assert.equal(mask.vertexCount, 4);
  assert.equal(mask.vertexData[7], 1);
  assert.ok(raw.maxUploadsInAFrame <= 60);
});

test("holding a parameter moves vertices; a render-order change restacks the meshes", {skip}, (context) => {
  const {raw, scene, state, run} = setup(context);
  run(2, state({haru: spec()}));
  assert.equal(bodyLeft(raw), 690);
  const before = raw.drawn().map((mesh) => (mesh.options.texture as {path: string}).path);
  assert.equal(before[0], "Assets/Mock/tex/page0.png");

  raw.beginFrame();
  scene.update(1 / 60, state({haru: spec({params: {ParamAngleX: 20}})}));
  // 20 degrees shift 0.2 units = 54 px, and past 15 the mock draws Cheek under Body.
  assert.equal(bodyLeft(raw), 690 + 54);
  const after = raw.drawn().map((mesh) => (mesh.options.texture as {path: string}).path);
  assert.equal(after[0], "Assets/Mock/tex/page1.png", "Cheek now draws first");
  assert.equal(raw.drawn().length, 3, "Body and Mask are neighbours now, with the same texture and blend: one mesh");
});

test("an unchanged frame uploads nothing, and moving the model uploads nothing either", {skip}, (context) => {
  const {raw, scene, state, run} = setup(context);
  run(3, state({haru: spec()}));
  raw.beginFrame();
  scene.update(1 / 60, state({haru: spec()}));
  assert.equal(raw.uploadsThisFrame, 0);
  raw.beginFrame();
  scene.update(1 / 60, state({haru: spec({x: 0.25})}));
  assert.equal(raw.uploadsThisFrame, 0, "a move is a mesh transform");
  assert.equal(bodyLeft(raw), 690 - 0.25 * 1920);
});

test("an expression and a motion drive parameters through to the vertices", {skip}, (context) => {
  const {raw, scene, state, run} = setup(context);
  run(2, state({haru: spec()}));
  assert.equal(raw.drawn().length, 4);
  raw.beginFrame();
  scene.update(1 / 60, state({haru: spec({expression: "glow-off"})}));
  assert.equal(raw.drawn().length, 3, "ParamOpacity 0 hides Glow");
  raw.beginFrame();
  scene.update(1 / 60, state({haru: spec({expression: ""})}));
  assert.equal(raw.drawn().length, 4);

  raw.beginFrame();
  scene.update(1 / 60, state({haru: spec({motion: {group: "Wave", index: 0, loop: false, serial: 1}})}));
  assert.equal(bodyLeft(raw), 690 + 54, "the motion holds ParamAngleX at 20");
});

test("an idle motion starts by itself", {skip}, (context) => {
  const {raw, state, run} = setup(context);
  run(3, state({haru: spec({idle: "Idle"})}));
  assert.equal(bodyLeft(raw), 690 + 54);
});

test("hiding a model destroys its meshes and releases it; showing it again works", {skip}, (context) => {
  const {raw, scene, state, run} = setup(context);
  run(2, state({haru: spec()}));
  assert.ok(raw.meshes.size >= 5);
  run(1, state({}));
  assert.equal(raw.meshes.size, 0);
  assert.deepEqual(scene.loaded, []);
  run(2, state({haru: spec({x: 0.3})}));
  assert.equal(raw.drawn().length, 4);
  // Replacing it with another model3.json path reloads.
  run(1, state({haru: spec({x: 0.3, model: "Assets/Mock/other.model3.json"})}));
});

test("two models of the same file are independent", {skip}, (context) => {
  const {raw, state, run} = setup(context);
  run(3, state({left: spec({x: 0.25, z: 0}), right: spec({x: 0.75, z: 1, params: {ParamAngleX: 20}})}));
  const drawn = raw.drawn();
  assert.equal(drawn.length, 7, "4 meshes for the left model, 3 for the right one whose Body and Mask merged");
  const lefts = drawn.map((mesh) => mesh.id.split(".")[1]);
  assert.deepEqual([...new Set(lefts)], ["left", "right"], "the lower z draws first");
});

test("a Core that cannot be loaded is reported once and the scene carries on", {skip}, (context) => {
  const {raw, log, run, state} = setup(context);
  run(10, state({haru: spec()}, "/nonexistent/libLive2DCubismCore.so"));
  assert.equal(log.filter((line) => line.startsWith("error")).length, 1);
  assert.match(log.find((line) => line.startsWith("error"))!, /cannot load the Cubism Core library/);
  assert.equal(raw.meshes.size, 0);
});

test("a bad .moc3 or a missing resource is reported once for that model only", {skip}, (context) => {
  const files = resources({
    "Assets/Mock/bad.model3.json": JSON.stringify({FileReferences: {Moc: "bad.moc3", Textures: []}}),
  });
  const bytes = binaries({"Assets/Mock/bad.moc3": new Uint8Array(Buffer.from("NOPE1234"))});
  const {raw, log, run, state} = setup(context, files, bytes);
  run(10, state({bad: spec({model: "Assets/Mock/bad.model3.json"}), gone: spec({model: "Assets/Mock/missing.model3.json"}), good: spec()}));
  const errors = log.filter((line) => line.startsWith("error"));
  assert.equal(errors.length, 2, `${errors.join("\n")}`);
  assert.ok(errors.some((line) => /not a valid \.moc3/.test(line)));
  assert.ok(errors.some((line) => /no resource Assets\/Mock\/missing/.test(line)));
  assert.ok(errors.some((line) => /PXJS7902: The native service 'live2d.model.create' failed: .*not a valid \.moc3/.test(line)), "respond_error's message reaches the script");
  assert.equal(raw.drawn().length, 4, "the good model is unaffected");
});

test("an out-of-range parameter is clamped by the plugin, not rejected", {skip}, (context) => {
  const {raw, state, run} = setup(context);
  run(3, state({haru: spec({params: {ParamAngleX: 9999}})}));
  assert.equal(bodyLeft(raw), 690 + 81, "30 degrees is the mock's maximum: 0.3 units = 81 px");
});

test("with no path, Core is found beside the plugin (plugin_directory)", {skip}, (context) => {
  const folder = mkdtempSync(join(tmpdir(), "px-live2d-beside-"));
  context.after(() => rmSync(folder, {recursive: true, force: true}));
  const plugin = join(folder, basename(nativeBuild!.plugin));
  copyFileSync(nativeBuild!.plugin, plugin);
  const coreName = process.platform === "darwin" ? "libLive2DCubismCore.dylib" : "libLive2DCubismCore.so";
  copyFileSync(nativeBuild!.core, join(folder, coreName));
  const {raw, log, run, state} = setup(context, resources(), binaries(), plugin);
  run(3, state({haru: spec()}, ""));
  assert.deepEqual(log.filter((line) => line.startsWith("error")), []);
  assert.equal(raw.drawn().length, 4);
  assert.ok(log.some((line) => /Cubism Core 0x5000000 loaded/.test(line)));
});

test("with no path and no Core beside the plugin, the error says where Core goes", {skip}, (context) => {
  const folder = mkdtempSync(join(tmpdir(), "px-live2d-alone-"));
  context.after(() => rmSync(folder, {recursive: true, force: true}));
  const plugin = join(folder, basename(nativeBuild!.plugin));
  copyFileSync(nativeBuild!.plugin, plugin);
  const {raw, log, run, state} = setup(context, resources(), binaries(), plugin);
  run(3, state({haru: spec()}, ""));
  const errors = log.filter((line) => line.startsWith("error"));
  assert.equal(errors.length, 1, errors.join("\n"));
  assert.match(errors[0]!, /Cubism Core was not found: cannot load the Cubism Core library '.*px-live2d-alone-.*' \(.+\); /);
  assert.match(errors[0]!, /NativeUserFiles\/live2d-cubism\/<platform>\/ .*live2d\.core/);
  assert.equal(raw.meshes.size, 0);
});

test("blinking uses the random source the host gives", {skip}, (context) => {
  const files = resources({
    "Assets/Mock/mock.model3.json": JSON.stringify({
      FileReferences: {Moc: "mock.moc3", Textures: ["a.png", "b.png"]},
      Groups: [{Target: "Parameter", Name: "EyeBlink", Ids: ["ParamOpacity"]}],
    }),
  });
  const {raw, run, state} = setup(context, files);
  // ParamOpacity doubles as the "eye" here: blinking it to 0 hides Glow for a moment.
  const counts = new Set<number>();
  for (let frame = 0; frame < 600; frame += 1) {
    run(1, state({haru: spec({blink: true})}));
    counts.add(raw.drawn().length);
  }
  assert.ok(counts.has(3) && counts.has(4), `Glow disappeared and came back while blinking: ${[...counts]}`);
});
