# prismatix-ext-live2d

A Live2D (Cubism) extension for [PrismatiXEngine](https://github.com/PrisX/PrismatiXEngine):
shows a Live2D model in a PrismatiX game, using both lower extension layers
([docs/native-extensions.md](https://github.com/PrisX/PrismatiXEngine/blob/master/docs/native-extensions.md)):

- **Layer 2, a native library** (`native/`) runs Cubism Core, which only
  native code can. It is a thin bridge: it loads Core, revives a `.moc3` and
  answers "describe the model" once and "update it" every frame.
- **Layer 1, raw meshes** (`extension/`) does everything else in TypeScript:
  parses `model3.json`, plays `motion3.json` and `exp3.json`, blinks and
  breathes, batches the drawables into a few meshes and masks them. It uses
  the engine's `ctx.assets.readBytes` (for the `.moc3`), `ctx.random` (blink
  timing), `raw.upload` (one batch per model per frame), mask lists and
  `maskInverted`, and mesh `transform` (placing the model uploads nothing).

```text
Story  [live2d.show id=haru model="Assets/Live2D/Haru/Haru.model3.json"]
  │ commands edit the saved scene state (ctx.state)
  ▼
frame.update ── Live2DScene.update ──► parameters (motion, expression, blink, breath, held)
                      │                       │ native.request("live2d.model.update")
                      │                       ▼
                      │               libpx_live2d ──► Cubism Core
                      │                       │ finished 8-float vertices (canvas pixels) of what changed
                      ▼                       ▼
                 ModelRenderer ──► raw.upload: one batch of meshes (runs of drawables,
                                   one hidden mesh per mask drawable); a mesh transform places the model
```

**Status: a first working draft.** It was built and tested against a mock Core
only; see "What has been tested" before relying on it.

Needs: PrismatiXEngine commit `2534281` or later (native ABI 1.1, batched raw
uploads, mask lists, `ctx.random`, `readBytes`), CMake, a C compiler and
Node.js 22.18+ for the tests. Windows, macOS and Linux Players load the
plugin; the Web and Android Players do not.

Everything a save needs is in the scene state; meshes, Core handles and motion
clocks are rebuilt from it every frame, so load and rollback need no special
cases.

## Layout

| Path | What |
| --- | --- |
| `extension/` | The extension: manifest, `pxext.json`, `main.ts`, `src/*.ts`, tests |
| `native/` | The C bridge (`cubism_bridge.c`), its plugin glue (`px_live2d_plugin.c`), `cubism_smoke`, and a mock Core + plugin harness for tests (`native/test/`) |
| `native/vendor/` | A copy of the engine's `PxPluginAbi.h`, so the plugin builds without an engine checkout |
| `tools/test.sh` | Builds everything and runs the tests (POSIX) |
| `DEVELOPMENT_NOTES.md` | What was awkward while building this, and what the engine has fixed since |

## Try it

1. **Get Cubism Core.** Live2D's license does not let this repository ship it.
   Download the Cubism SDK for Native from Live2D and take the shared library
   (`Live2DCubismCore.dll`, `libLive2DCubismCore.dylib`; Linux may only come as
   a static library, see `DEVELOPMENT_NOTES.md` item 15). Read their license
   before you publish a game with it.
2. **Check your Core against the bridge.** The bridge declares the Core
   functions itself (`native/cubism_core_api.h`), written from the public
   API and not checked against `Live2DCubismCore.h`. Build and run the smoke
   tool on a real `.moc3` first:

   ```sh
   cmake -S native -B build
   cmake --build build
   build/cubism_smoke /path/to/Live2DCubismCore.dll Haru.moc3
   ```

   It prints the model's description and one update, or fails. If it crashes
   or prints nonsense, fix the prototype in `cubism_core_api.h` before going on.
3. **Install the extension**, either way:
   - from a package: `prismatix extension add ./owenliu0924-live2d-cubism-0.1.0.pxext --allow-native`
     (see "Releasing" below; the package for your platform's library must sit
     beside it), or
   - from source: the `cmake --build` above also wrote the plugin into
     `extension/native/<platform>/`. Copy `extension/` to
     `Content/Extensions/live2d-cubism/` in your project and register it:

     ```json
     "extensions": ["Content/Extensions/live2d-cubism/live2d-cubism.pxextension"]
     ```

   Either way builds sign the library with your project's development key
   (`.prismatix/native-development-key.pem`) unless you set another.
4. **Add a model.** Put the model's folder in the project as resources (the
   `.model3.json`, `.moc3`, textures, `.motion3.json`/`.exp3.json`). Nothing
   needs converting: the `.moc3` is read as bytes.
5. **Put Core where the plugin finds it:** beside the plugin library (for a
   packed game, `Plugins/live2d-cubism/` next to the executable's data), or
   pass its path with `live2d.core`.
6. **Show the model:**

   ```pxstory
   [live2d.core path="C:/Live2D/Live2DCubismCore.dll"]   ; only if Core is not beside the plugin
   [live2d.show id=haru model="Assets/Live2D/Haru/Haru.model3.json" x=0.5 y=1 height=0.95]
   [live2d.motion id=haru group=TapBody]
   [live2d.expression id=haru name=f01]
   [live2d.param id=haru param=ParamMouthOpenY value=0.8]
   [live2d.param id=haru param=ParamMouthOpenY release=true]
   [live2d.move id=haru x=0.3]
   [live2d.hide id=haru]
   ```

   Positions are fractions of the screen: `x`, `y` is where the model's feet
   stand (0.5, 1 is bottom centre), `height` is the canvas height.

Commands are listed in the manifest (`extension/live2d-cubism.pxextension`)
and show up in Studio's command picker like any extension command.

## Releasing a `.pxext`

`prismatix extension pack` makes what users install: one `.pxext` for the
extension and one native pack per platform whose library you built.

1. On each OS, build the plugin (`cmake -S native -B build && cmake --build build`);
   it lands in `extension/native/<platform>/`.
2. Gather every platform's library into `extension/native/<platform>/` on one
   machine. The main package pins and signs each library, so pack needs them
   together; a platform whose library is missing is left out of the package
   (warning `PXCLIEXT2006`).
3. Make a signing key once and keep it out of this repository:
   `prismatix extension keygen ~/keys/owen-native.pem`.
4. From a PrismatiX project that lists the extension:

   ```sh
   prismatix extension pack live2d-cubism --owner owenliu0924 --signing-key ~/keys/owen-native.pem
   ```

   This writes `dist/extensions/owenliu0924-live2d-cubism-0.1.0.pxext` and
   `...-0.1.0-native-<platform>.pxext` for each platform. `pxext.json` (in
   `extension/`) holds the package metadata; it names no license yet, so pack
   warns (`PXEXTPKG2003`).
5. Attach all the `.pxext` files to a GitHub release. Users install with
   `prismatix extension add <url or file> --allow-native` (a URL needs
   `--sha256`; the native packs are looked up beside the main package).

`prismatix extension inspect <file>` shows what an installer is asked to
trust, including the native-code warning. Packing, inspecting, installing
(refused without `--allow-native`) and `extension verify` were run for
`linux-x64` in a fresh project; the other platforms were not built.

## What it does and does not do

Does: `.moc3` models of any version the Core you load supports; motions
(parameter and part-opacity curves, Bezier/linear/stepped, fades, loops, an
idle group); expressions (add, multiply, overwrite); breathing; blinking from
the `EyeBlink` group; held parameters (lip sync is a `live2d.param` per frame
from your own script, or fixed values); several models at once; masks with
several clippers, on any texture page, and inverted masks; save, load and
rollback.

Does not: physics (`physics3.json`, hair and clothes sway), pose switching,
motion user-data events, hit areas, the mouse-follow helper, masks with more
than 16 clippers (the first 16 apply, with a warning), and Cubism 5's extra
blend modes. It also does not run on the Web, Android or iOS: native
extensions do not load there (`DEVELOPMENT_NOTES.md` item 11).

Limits to know: the Player caps vertices drawn per frame at 65,536 across all
meshes, which bounds how many high-detail models fit on screen. A model costs
one upload call per frame, so there is room for dozens of models.

## What has been tested

`tools/test.sh` (POSIX; Node 22.18 or newer) builds the bridge, the plugin, a
mock Core and a small harness that mimics `PxHostApi`, then runs 33 tests:

- the wire format, `model3`, motion and expression parsing and evaluation,
  blink and the parameter bank, as plain unit tests;
- the renderer against a fake raw host that enforces the Player's rules
  (batches checked whole, indices inside the vertices, 64 upload calls a frame);
- the whole script side against the **real plugin library** and the mock
  Core: models appear with the right canvas-pixel vertices, UVs, transform,
  blend modes and masks, parameters and motions move vertices, render-order
  changes restack, moving uploads nothing, hide and reshow work, bad Cores and
  bad `.moc3` files are reported once with the plugin's own message, and Core
  is found beside the plugin.

`prismatix validate` accepts the extension in a freshly created project, and
packing and installing it work (see "Releasing").

To type-check against the engine's real SDK types (`@prismatix/runtime` is not
on npm yet), link an engine checkout whose `runtime-sdk` is built and run its `tsc`:

```sh
ln -s /path/to/PrismatiXEngine extension/.engine
/path/to/PrismatiXEngine/node_modules/.bin/tsc -p extension/tsconfig.check.json
```

**Not tested:** the real Player, the real Cubism Core, any real model, any
platform but Linux. The mock Core has four drawables' worth of behaviour, not
a face. Expect the first run against a real model to turn up differences
(`DEVELOPMENT_NOTES.md` items 14 and 15 list the assumptions most likely to
be wrong).

## Licensing

There is no LICENSE file yet; add one before anyone else uses this. The engine
(and the vendored `PxPluginAbi.h`) is MIT. This repository contains no Live2D
code or data: the
Core prototypes in `native/cubism_core_api.h` are written out here as
declarations, and the mock Core is original. Cubism Core, the Cubism SDK and
any Live2D model are licensed by Live2D Inc. and their model authors on their
own terms.
