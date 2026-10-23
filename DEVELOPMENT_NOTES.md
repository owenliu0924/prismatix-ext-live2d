# Development notes: friction found while building this extension

Written while the extension lived in PrismatiXEngine's `Samples/` (so items 13
and 19 are about that folder, and file references such as `ScriptRawGraphics.cpp`
are to the engine repository at commit `cf2700e`).

Things that were awkward, surprising or missing in the engine, the SDK or the
workflow while writing the Live2D sample. Each item says what happened, what
the sample did about it, and what a fix in the engine would look like.
Severity: **blocker** (needed a workaround that costs something real),
**friction** (works, but more work than it should be), **doc** (unclear or
unverified, not necessarily a defect).

## Status after engine commit 2534281

The engine fixed most of the raw and native items below in "feat(extensions):
batched raw uploads, mask lists, ctx.random, readBytes and native ABI 1.1".
This extension now uses those features; the items stay as written (what was
awkward at the time), marked here:

| Item | Status |
| --- | --- |
| 1 no binary resource read | **Fixed**: `ctx.assets.readBytes`. The `.b64` step and `base64.ts` are gone. |
| 2 handler fails with a bare status | **Fixed**: `respond_error` (ABI 1.1); the status word in the wire format is gone. |
| 3 no paths for a plugin | **Fixed**: `plugin_directory`; Core is looked up beside the plugin, where `userFiles` now puts it (item 21). |
| 4 upload budget, order of vertices and indices | **Fixed**: `raw.upload([...])` is one upload for any number of meshes, and the rule is documented. The deferral code is gone. |
| 5 masks | **Fixed**: `mask` takes a list (up to 16, united) and `maskInverted` exists. The union-mesh workaround is gone. Masks inside render targets are still unsupported. |
| 6 does an invisible mask still mask | **Documented** ("an invisible mesh still masks"). |
| 7 mesh `transform` | **Used**: placing the model is a mesh transform and uploads nothing. |
| 8 per-vertex work | **Documented** in the raw guide ("where the math goes"). |
| 9 journal of `native.request` in commands | **Documented**; the extension already did what the guide now says. |
| 10 no `TextEncoder`/`atob`/`Math.random` | **Partly fixed**: `ctx.random`, `@prismatix/runtime/text`. The extension keeps a small UTF-8 codec of its own so its pure modules run in plain Node (the SDK is not on npm). |
| 11 mobile and Web | **Fixed for Android** in the next round (below); the Web and iOS still load no native code. |
| 12-20 | Open (no official test doubles, Player not buildable here, `create` exit code, provenance gate, workspace, Core header, Cubism assumptions); 12, 14 and 15 are answered in the next round. |

Fixed since, in engine `e16e850` and Studio `7d1b9a3`: item 24 (`validate`
reports `PXSDKSEM1139`), item 25 (event payloads are objects; `src/frame.ts`
still accepts the old array for older Players) and item 27 (Studio knows the
raw and native capabilities). Items 26, 28, 29 and 30 are open.

New in this round:

### 21. A user-supplied companion library has no place in a package: friction (fixed, below)
`plugin_directory` lets the plugin find Core beside itself, but a package
carries only the files its manifest lists with pinned SHA-256s
(`native.libraries.<platform>.files`), and Core cannot be listed because it
cannot be redistributed. So after `pack`, the user must copy Core into
`Plugins/live2d-cubism/` of the packed game by hand, and I could not find a
way for `prismatix pack`/`run` to do it. *Fix idea:* a manifest entry for an
optional, user-provided file ("`userFiles`": name, platform, expected SHA-256
or version check, where the CLI says to put it).

### 22. A multi-platform release needs every library on one machine: friction
`extension pack` signs each platform's library into the main package, so all
platforms' libraries must be in `extension/native/<platform>/` when it runs;
a missing one is left out. Building on Windows, macOS and Linux runners and
packing once needs a CI step that gathers the artifacts (this repository's
`ci.yml` does), and the CLI is not on npm, so that step checks out and builds
the engine at a pinned commit. *Fix idea:* `extension pack
--add-platform <pack>` to merge a per-OS build into an existing package, and
publish the CLI.

### 23. `pack` writes files into the extension's folder: doc
The first `pack --owner` creates `pxext.json` and `README.md` beside the
manifest. Fine, but surprising in a repository; this repository commits both.

## Status after engine commit ae74e2b (extension 0.2.0)

This round used `userFiles`, native extensions on Android and Studio sides
(`schemaRevision` 2), and for the first time ran the extension in real
Players with Live2D's real Core (Cubism SDK for Native 5-r.5, Core
06.00.0001) and its sample models.

| Item | Status |
| --- | --- |
| 11 mobile | **Fixed for Android.** `libpx_live2d.so` is built with NDK r27 (arm64-v8a, API 26, 16 KB pages); Haru plays with the real arm64 Core on the Android 15 emulator. iOS and the Web still load no native code. |
| 12 the Player | **Answered.** The Windows Player (a packed game, QA build) and the Android Player both run the extension; Haru idles, plays motions and expressions and moves. |
| 14 Core's header | **Checked** against `Live2DCubismCore.h` of SDK 5-r.5. One mismatch: `csmGetDrawableRenderOrders` is gone, replaced by `csmGetRenderOrders` (drawables first, then Cubism 5.3 offscreens), so 0.1.0 could not load a current Core at all. The bridge takes whichever the Core exports. Every other prototype, flag and alignment matched. The bridge now also calls `csmHasMocConsistency` (when exported) before reviving a `.moc3`. `cubism_smoke` passes on all eight sample models (moc3 versions 1, 3, 5 and 6) on Windows and Linux. |
| 15 Cubism assumptions | **Canvas origin: right** (the model stands upright, feet where `x`, `y` say). **Linux:** the SDK does ship `Core/dll/linux/x86_64/libLive2DCubismCore.so`, but it needs libm loaded first (item 28). Whether a mask drawable's own opacity counts: not checked yet. |
| 21 user-supplied companion library | **Fixed**: Core is a `userFiles` entry per platform; `pack` and `run` copy it from `NativeUserFiles/live2d-cubism/<platform>/` into `Plugins/live2d-cubism/`. A game no longer packs without Core for its platform (`PXCLIEXT1106` names the file and the hint). |

New in this round:

### 24. `resourceFilter` on a string parameter: validate accepts it, the Player refuses the manifest: blocker (fixed here)
0.1.0 had `"resourceFilter": "model3.json"` on `live2d.show`'s `model`, a
`string`. `prismatix validate`, `pack` and Studio accept that on a command
parameter, but the Player's `CommandRegistry` refuses it (`PXSCHEMA7017`
"Resource filter requires a resource parameter"), so the whole extension
failed to load (`PXPLAYER5005`, the game does not start). 0.1.0 never loaded
in a real Player. 0.2.0 drops the filter, and a unit test keeps it out.
*Fix idea:* the SDK's semantic check should report it for commands as it
already does for Actions (`PXSDKSEM1118`).

### 25. `frame.update` hands listeners 0 seconds: blocker (worked around here)
`AdvanceScriptFrame` (`Engine/Script/ScriptFrameScheduler.cpp`) emits
`{{"delta", std::to_string(deltaSeconds)}}`, which builds a `Variant` array,
so the payload a script gets is `["delta", "0.016299"]`, not
`{delta: "0.016299"}`. `ctx.frame.onUpdate` and `raw.onFrame` read
`payload.delta`, find nothing and report 0 every frame: no motion, blink or
breath ever advanced in the Player, while the tests (which pass `{delta}`)
were green. `main.ts` now listens with `ctx.events.on("frame.update")` and
`src/frame.ts` reads both shapes. *Fix:* build the payload as a
`VariantObject` and add a Player-side test that a listener gets a positive
`delta`; the workaround can go once the engine is fixed.

### 26. A `resource` parameter changes what the handler receives: friction
Studio offers a file picker only for `type: "resource"`, and the declarative
`optionsFrom: {parameter, pointer}` needs a resource sibling. But the Player
hands a resource parameter to the script as `{id, path}`, not the string
written, so changing `model` would change `main.ts`, the saved scene state
and every save. `model` stays a string; a `models` provider lists the
project's `.model3.json` files instead, and `idle` uses the `motions`
provider, which reads the command's own `model`. *Fix idea:* a file picker
for `string` parameters that name a `resourceFilter` the Player accepts, or
an `editorHint: "resource"` for strings.

### 27. Studio's manifest check does not know `raw.mesh` or `native`: friction (Studio)
Studio's Extensions workspace shows "2 errors" for this extension: unknown
capabilities `raw.mesh` and `native` (Studio's
`src/lib/extensions/manifest.ts` has no `raw.*` or `native` in its capability
list). The engine's schema has them; the Studio side loads and works anyway.

### 28. The Linux Core does not link libm: friction
`libLive2DCubismCore.so` (SDK 5-r.5, linux/x86_64) calls `powf` but lists
only `libc.so.6` as a dependency, so `dlopen` fails with "undefined symbol:
powf" in a process that has not loaded libm globally (`cubism_smoke` did).
The bridge loads `libm.so.6` with `RTLD_GLOBAL` before Core on Linux. The
Android Core lists libm itself.

### 29. A project on another drive than the engine cannot find its pinned CLI: friction (engine)
`prismatix create` of a project on `D:` with the engine on `C:` writes
`link:C:/Users/.../packages/cli` into `package.json`, and pnpm makes the
link relative to the project (a junction to `D:/project/C:/Users/...`), so
every later command fails with `PXCLI0002` "The project's pinned CLI is
missing". Scratch projects here live on the engine's drive.

### 30. Pose is not run, and it can show: friction
`pose3.json` (groups of parts of which one shows at a time, such as Haru's
two arm poses) is not implemented. Haru's own motions set those part
opacities, so she looks right once motions run (item 25), but a model whose
motions do not would show every alternative at once. The inspector says
"present, not run by this extension yet".

## Engine / SDK

### 1. Scripts cannot read binary resources: friction
`ctx.assets.readText(path)` is the only resource reader. A `.moc3` is binary.
*Sample:* `tools/moc-to-text.mjs` stores it as base64 text, `src/base64.ts` decodes
it (+33 % size, a build step the model author must remember).
*Fix idea:* `ctx.assets.readBytes(path): Uint8Array` (capability-gated, size cap).

### 2. A native handler can only fail with a bare status: friction
`PX_ERROR_FAILED` becomes `PXJS7902` without the library's message, so "Core
not found" and "not a valid moc3" look the same to the script.
*Sample:* every response starts with a u32 status; status 1 carries a message
(`px_live2d_plugin.c`, `protocol.ts`). Every native extension will reinvent this.
*Fix idea:* `host->respond_error(response, message)` whose text reaches the
script's error and the Player log.

### 3. `PxHostApi` gives a plugin no paths: friction
There is no data root or plugin folder in `PxHostApi`, so a plugin cannot find
a companion library (here Live2D's proprietary Core) next to itself. `dlopen`
with a bare name only searches the system paths; the Player's `Plugins/<id>/`
is not on them.
*Sample:* the script passes a path, or the user puts Core on the library path.
*Fix idea:* `host->plugin_directory` / `host->data_directory` (UTF-8).

### 4. Raw upload budget (64 calls per frame) is below a model's drawable count: friction
A Cubism model has 100-300 drawables; one mesh per drawable would be 100+
uploads per frame against a limit of 64.
*Sample:* drawables in render order are merged into "runs" that share texture,
blend mode and mask, one mesh and one upload per run (`renderer.ts`). That is
real extra code (batching, re-batching when render order changes) every
mesh-heavy extension will need.
*Fix idea:* a multi-mesh upload call, or counting bytes only, or a batching
helper in `@prismatix/runtime/raw`.

Related, and not in the docs: `UploadIndices` counts as an upload too, and an
index at or past the mesh's current vertex count throws `PXJS7802`, so a mesh
must get its vertices **before** its indices. Setting up one mesh costs two
uploads, so 31 meshes exhaust the frame. The sample uploads vertices first and
spreads a big (re)layout over several frames (`UploadBudget` in `renderer.ts`).
I found this by reading `ScriptRawGraphics.cpp` after the first draft threw
in the fake host; the guide should state both rules.

### 5. Masks: one mask mesh per mesh, none inside render targets, no inversion: friction
Cubism clips a drawable with several masks (union) and some are inverted.
*Sample:* masks with the same texture are merged into one hidden "union" mask
mesh; masks on different texture pages keep only the first page (warns);
inverted masks are drawn unmasked (warns).
*Fix idea:* `mask: string | string[]` with union semantics, `maskInverted`.

### 6. Is an invisible mask mesh still a mask?: doc
`docs/native-extensions.md` says the mask mesh "still draws by itself unless it
is not `visible`", which implies `visible: false` still masks. In
`ScriptRawGraphics.cpp` the mask is drawn by `Draw(mask->second)` outside the
visibility filter, which agrees, but I could not run the Player to confirm.
The sample relies on it. *Fix idea:* say so explicitly and add a test.

### 7. `RawMeshOptions.transform` exists but I did not use it: doc
Placing the model is done natively (`ax, ay, tx, ty` in the update request), so
moving a model resends every vertex. The mesh `transform` would do it with no
re-upload. I only noticed after the protocol was written; worth reworking.

### 8. Per-vertex work is too slow for the sandbox to do itself: friction
Cubism needs ~20k vertices transformed per frame; in QuickJS that is a loop
the sample avoids by having the native side emit finished 8-float vertices.
That is a design the sandbox forces on every mesh-heavy extension.
*Fix idea:* none needed if the native layer is the intended home for it, but say
so in `docs/native-extensions.md`.

### 9. Journaling of `native.request` inside commands: friction
`native.request` inside a command or Action handler is journaled with its
whole response (hex). A model description is hundreds of KB, so creating a
model in a handler would bloat the journal and every save.
*Sample:* handlers only edit saved state (`ctx.state`); a `frame.update`
listener (not journaled) does the native calls and rebuilds resources.
*Fix idea:* a `transient: true` service flag in the manifest, or an explicit
`requestTransient()`.

### 10. The sandbox lacks TextEncoder, TextDecoder, atob, Date, Math.random: friction
The sample re-implements UTF-8 and base64 (`protocol.ts`, `base64.ts`), and a
seeded LCG for blink timing. `@prismatix/runtime/native` already has
`encodeUtf8`/`decodeUtf8`, but a sample that is not in the pnpm workspace
cannot import it in plain Node tests.
*Fix idea:* export a tiny `@prismatix/runtime/text` (utf8, base64) usable in Node
and in the sandbox.

### 11. Platform coverage: blocker for mobile
Native extensions do not load on Android (`PXCLIEXT1102`) or the Web, and
iOS is not mentioned. Live2D is mostly used on mobile, so as built this
sample cannot ship on the platforms Live2D is most used on.
*Fix idea:* Android `.so` loading (the ABI already fits), iOS static linking of
a plugin into the Player.

## Workflow

### 12. The Player cannot be built here: friction
SDL3, FFmpeg and vcpkg make the Player a heavy build, so nothing in this
sample has run inside a real Player. What is tested: the C bridge against a
mock Core, the plugin through a small harness that mimics `PxHostApi`, and the
script side against a fake raw host. What is **not** tested: the real Player,
real Cubism Core, any real model. The first run on a machine with all three is
the real test.
*Fix idea:* a headless `PrismatiXPlayerQA` build artifact in CI that sandboxes
can download.

### 13. Samples are outside the pnpm workspace: friction
`Samples/*` is not a workspace package, so TypeScript in a sample cannot
resolve `@prismatix/runtime` without a `paths` mapping (see
`tsconfig.check.json`). The Starter avoids it because it has no scripts.
*Fix idea:* a `Samples/*` workspace entry, or `prismatix extension create`
output that works in place.

### 14. Core's header was not reachable: environment
`cubism.live2d.com` and `docs.live2d.com` are blocked by this session's network
policy, so the Core function prototypes in `native/cubism_core_api.h` were
written from memory of the public API, not checked against `Live2DCubismCore.h`.
Because Core is loaded with `dlopen`, a wrong prototype compiles and then
misbehaves. `native/cubism_smoke.c` exists to catch that on a machine with the
real Core. Constants (`PX_CSM_*` flag values, the 64/16 byte alignments) carry
the same caveat. *Do this first when you have the SDK.*

### 15. Cubism details I could not verify: doc
- Whether `csmReadCanvasInfo`'s origin is measured from the top-left or
  bottom-left of the canvas (the sample assumes top-left, y up in model space).
- Whether a mask drawable's own opacity should count in the mask (the sample
  ignores it).
- Linux: I believe the SDK ships Core as a static library on Linux, in which
  case there is no `.so` to `dlopen` and you must wrap it yourself.

### 16. No official test double for `EngineRaw` / `EngineNative`: friction
To test the script side without a Player I wrote `FakeRaw` (which re-states
the Player's rules: vertex-before-index, 64 uploads a frame, index range) and
a C harness that mimics `PxHostApi` and serves requests over FIFOs
(`extension/test/support.ts`, `native/test/plugin_harness.c`). Both can drift
from the Player, and every native-extension author needs the same pair.
*Fix idea:* ship them (`@prismatix/runtime/testing`, a `px_plugin_harness`
tool in the engine), and run the engine's own checks against them so they
cannot drift.

### 17. `prismatix extension types` is not `extensionTypeDeclarations()`: doc
Writing `prismatix-extension.d.ts` by calling the SDK's
`extensionTypeDeclarations(manifest)` produced a file the CLI then flagged as
stale (`PXCLIEXT2003`); the file `extension types` writes passed. I did not
find out how they differ. The sample commits the CLI's output.

### 18. `prismatix create` exits with an error after creating the project: friction
Without a Player installed, `create` writes the project, then fails with
`PXCLI1501 RuntimeDiscoveryFailure` and a non-zero exit. The project is
usable (I validated the extension in it), but a script cannot tell success
from failure. *Fix idea:* make the runtime pin a warning, or a distinct exit code.

### 19. The sample provenance gate hashes every file: friction
`pnpm samples:check` wants `SAMPLE_PROVENANCE.json` to list every file under
`Samples/<name>` with its SHA-256, so each edit to a sample needs
`node scripts/check-sample-provenance.mjs --write Samples/<name>` before the
commit. Source-only samples (no art) pay this for little. Build outputs
(`extension/native/*`) are gitignored so they do not enter the inventory.
The generator also writes the Starter's origin text ("Written by `prismatix
create`...") for every text file, so a sample of another origin has to
correct the `origin` fields by hand after each `--write`.
*Fix idea:* a `--check` that only asserts the licence of each file and hashes
only binary assets, or an `ignore` list in the inventory.

### 20. Node 22 and TypeScript 7 details for sample tests: friction
Running the sample's TypeScript tests with plain `node --test` works because
Node strips types, but only for erasable syntax: constructor parameter
properties (`constructor(private x: T)`) and enums fail, so the sample avoids
them and its tsconfig sets `erasableSyntaxOnly`. The repo's TypeScript (7.0)
also no longer accepts `baseUrl`, which most `paths` examples still use.
Relative imports need the `.ts` extension for Node; the CLI's esbuild bundle
accepts them.
