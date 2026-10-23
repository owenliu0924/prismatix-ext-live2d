# prismatix-ext-live2d

A Live2D (Cubism) extension for [PrismatiXEngine](https://github.com/PrisX/PrismatiXEngine):
shows a Live2D model in a PrismatiX game, using both lower extension layers
([docs/native-extensions.md](https://github.com/PrisX/PrismatiXEngine/blob/master/docs/native-extensions.md)),
and helps you write the Story in PrismatiX Studio:

- **Layer 2, a native library** (`native/`) runs Cubism Core, which only
  native code can. It is a thin bridge: it loads Core, revives a `.moc3` and
  answers "describe the model" once and "update it" every frame.
- **Layer 1, raw meshes** (`extension/`) does everything else in TypeScript:
  parses `model3.json`, plays `motion3.json` and `exp3.json`, blinks and
  breathes, batches the drawables into a few meshes and masks them. It uses
  the engine's `ctx.assets.readBytes` (for the `.moc3`), `ctx.random` (blink
  timing), `raw.upload` (one batch per model per frame), mask lists and
  `maskInverted`, and mesh `transform` (placing the model uploads nothing).
- **The Studio side** (`extension/studio.ts`, see
  [docs/studio-extensions.md](https://github.com/PrisX/PrismatiXEngine/blob/master/docs/studio-extensions.md))
  runs only in Studio, never in a game: an inspector for `.model3.json` files
  and the dropdowns of the commands' motion, expression and parameter names.

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

**Status: a working draft.** It runs Live2D's sample models with the real
Cubism Core in the Windows and Android Players; physics and pose are not
implemented yet. See "What has been tested" before relying on it.

Needs: PrismatiXEngine commit `e16e850` or later (native ABI 1.1, batched raw
uploads, mask lists, `ctx.random`, `readBytes`, `userFiles`, native
extensions on Android, Studio sides in `schemaRevision` 2), PrismatiX Studio
0.1.0 or later for the Studio side, CMake, a C compiler and Node.js 22.18+ for
the tests. Windows, macOS, Linux and Android (arm64) Players load the plugin;
the Web and iOS Players do not.

Everything a save needs is in the scene state; meshes, Core handles and motion
clocks are rebuilt from it every frame, so load and rollback need no special
cases.

## Layout

| Path | What |
| --- | --- |
| `extension/` | The extension: manifest, `pxext.json`, `main.ts`, `src/*.ts`, tests |
| `extension/studio.ts`, `extension/studio/` | The Studio side: `model.ts` (reading models and Stories, the dropdown choices; no DOM), `inspector.ts` (the inspector's page), `sdk.ts` (a copy of `@prismatix/studio-sdk`'s types) |
| `extension/dist/studio.js` | The Studio side as Studio loads it, built from `studio.ts` by `tools/build-studio.sh`; committed so a source copy works in Studio |
| `native/` | The C bridge (`cubism_bridge.c`), its plugin glue (`px_live2d_plugin.c`), `cubism_smoke`, and a mock Core + plugin harness for tests (`native/test/`) |
| `native/vendor/` | A copy of the engine's `PxPluginAbi.h`, so the plugin builds without an engine checkout |
| `tools/test.sh` | Builds everything and runs the tests (POSIX) |
| `tools/build-studio.sh` | Rebuilds `extension/dist/studio.js` and `extension/prismatix-extension.d.ts` with the engine's CLI |
| `DEVELOPMENT_NOTES.md` | What was awkward while building this, and what the engine has fixed since |

## Try it

1. **Get Cubism Core.** Live2D's license does not let this repository ship it.
   Download the Cubism SDK for Native from Live2D and take the shared library
   for each platform you build for:

   | Platform | File | In the SDK |
   | --- | --- | --- |
   | `win32-x64` | `Live2DCubismCore.dll` | `Core/dll/windows/x86_64/` |
   | `linux-x64` | `libLive2DCubismCore.so` | `Core/dll/linux/x86_64/` |
   | `darwin-x64`, `darwin-arm64` | `libLive2DCubismCore.dylib` | `Core/dll/macos/` |
   | `android-arm64` | `libLive2DCubismCore.so` | `Core/dll/android/arm64-v8a/` |

   Read their license before you publish a game with it.
2. **Check your Core against the bridge.** The bridge declares the Core
   functions itself (`native/cubism_core_api.h`), checked against the
   `Live2DCubismCore.h` of the Cubism SDK for Native 5-r.5. With another SDK,
   build and run the smoke tool on a real `.moc3` first:

   ```sh
   cmake -S native -B build
   cmake --build build
   build/cubism_smoke /path/to/Live2DCubismCore.dll Haru.moc3
   ```

   It prints the model's description and one update, or fails. If it crashes
   or prints nonsense, fix the prototype in `cubism_core_api.h` before going on.
3. **Install the extension**, either way:
   - from a package: `prismatix extension add ./owenliu0924-live2d-cubism-0.2.0.pxext --allow-native`
     (see "Releasing" below; the package for your platform's library must sit
     beside it; add `--platform android-arm64` for an Android build), or
   - from source: the `cmake --build` above also wrote the plugin into
     `extension/native/<platform>/`. Copy `extension/` to
     `Content/Extensions/live2d-cubism/` in your project and register it:

     ```json
     "extensions": ["Content/Extensions/live2d-cubism/live2d-cubism.pxextension"]
     ```

   Either way builds sign the library with your project's development key
   (`.prismatix/native-development-key.pem`) unless you set another.
4. **Put Core in the project:** `NativeUserFiles/live2d-cubism/<platform>/<file>`,
   for example `NativeUserFiles/live2d-cubism/win32-x64/Live2DCubismCore.dll`.
   The manifest names Core as a file you supply (`userFiles`), so `prismatix
   pack` and `run` copy it into `Plugins/live2d-cubism/` beside the plugin,
   where the plugin looks first; on Android it travels in the APK and the
   Player copies it out with the plugin. A folder in
   `PRISMATIX_NATIVE_USER_FILES` works too (as `live2d-cubism/<platform>/<file>`,
   `<platform>/<file>` or `<file>`). Packing for a platform fails with
   `PXCLIEXT1106` until its Core is there; `prismatix validate --target desktop
   --platform win32-x64` (or `--target android`) checks it early. Keep
   `NativeUserFiles/` out of version control: Live2D's license applies to it.
5. **Add a model.** Put the model's folder in the project as resources (the
   `.model3.json`, `.moc3`, textures, `.motion3.json`/`.exp3.json`), for example
   with `"resourceIncludes": ["Assets/Live2D"]`. Nothing needs converting: the
   `.moc3` is read as bytes.
6. **Show the model:**

   ```pxstory
   [live2d.show id=haru model="Assets/Live2D/Haru/Haru.model3.json" x=0.5 y=1 height=0.95]
   [live2d.motion id=haru group=TapBody]
   [live2d.expression id=haru name=f01]
   [live2d.param id=haru param=ParamMouthOpenY value=0.8]
   [live2d.param id=haru param=ParamMouthOpenY release=true]
   [live2d.move id=haru x=0.3]
   [live2d.hide id=haru]
   [live2d.core path="C:/Live2D/Live2DCubismCore.dll"]   ; only to use a Core other than the one beside the plugin
   ```

   Positions are fractions of the screen: `x`, `y` is where the model's feet
   stand (0.5, 1 is bottom centre), `height` is the canvas height.

   Without Core, the first model logs one error that says what was tried and
   where Core goes ("Cubism Core was not found: ... Put
   libLive2DCubismCore.so in the project's NativeUserFiles/live2d-cubism/<platform>/
   ..."), and the game goes on without the model.

Commands are listed in the manifest (`extension/live2d-cubism.pxextension`)
and show up in Studio's command picker like any extension command.

## In PrismatiX Studio

The package (and a source copy) has a Studio side. Studio asks each user
before it first loads it; it asks only for `project.read`, so it can read the
project's files and change nothing.

- **Asset type.** `*.model3.json` files show as "Live2D model" in the Assets
  browser.
- **Inspector.** Selecting a model shows its name and the Cubism version its
  `.moc3` was made for; the `.moc3` file and its size; the textures as
  thumbnails with their sizes; the motion groups with each motion's duration
  (from the `motion3.json` `Meta`) and whether it loops; the expressions;
  whether it has physics and pose files (this extension does not run them
  yet); its eye-blink and lip-sync groups; its parameter ids with their names
  from the `cdi3.json` (or, without one, the ids its motions and expressions
  use); and, for every platform the extension supports, whether Cubism Core
  is in `NativeUserFiles/` and where to put it when it is not. A missing or
  broken file the model names is a line under "Problems"; the rest of the
  inspector still shows. It follows Studio's light or dark theme and its
  language (Traditional Chinese or English).
- **Dropdowns.** `live2d.show`'s `model` lists the project's `.model3.json`
  files; `idle` and `live2d.motion`'s `group` list motion groups (with how many
  motions each has), `live2d.expression`'s `name` the expressions, and
  `live2d.param`'s `param` the parameter ids (labelled with their `cdi3.json`
  names). These commands only get the model's `id`, so the choices come from
  the `.model3.json` that a `[live2d.show]` with that `id` names in the
  project's `.pxstory` files. When no Story shows that `id`, or shows it with
  several models, the dropdown lists every model's choices, each labelled with
  the models that have it. Any text can still be typed; the game never checks
  a value against the list.

`live2d.show`'s `model` stays a `string` parameter, not a `resource` one: the
Player hands a resource parameter to the script as an object (`{id, path}`)
where a string parameter arrives as the text written, so making it a resource
would change what `main.ts` receives and what older saves hold. The `models`
dropdown takes the place of Studio's file picker.

The providers are named `owenliu0924/live2d-cubism:<id>`, the package id this
extension is published under; Studio and the engine also accept that name
from a source copy whose manifest id is `live2d-cubism`.

After changing `studio.ts` or anything under `studio/`, rebuild the bundle
Studio loads, and the handler types, with the engine's CLI:

```sh
tools/build-studio.sh /path/to/PrismatiXEngine
```

CI checks that the committed `extension/dist/studio.js` and
`extension/prismatix-extension.d.ts` match their sources.

## Building for Android

The Android Player loads `android-arm64` libraries built with the NDK for
`arm64-v8a`, API 26, with 16 KB page alignment (the CMake file sets it):

```sh
cmake -S native -B build-android -G Ninja -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_TOOLCHAIN_FILE=$ANDROID_NDK_HOME/build/cmake/android.toolchain.cmake \
  -DANDROID_ABI=arm64-v8a -DANDROID_PLATFORM=android-26
cmake --build build-android --target px_live2d
```

The library lands in `extension/native/android-arm64/libpx_live2d.so`. With
Core in `NativeUserFiles/live2d-cubism/android-arm64/`, `prismatix pack
--target android` puts both into the APK's `assets/Plugins/live2d-cubism/`;
the Player copies them to its code cache, and `plugin_directory` (where the
plugin looks for Core) is that folder.

## Releasing a `.pxext`

**Automatically.** `.github/workflows/ci.yml` builds the plugin on Windows,
Linux, macOS (Intel and Apple Silicon) and, with the runner's NDK, Android;
packs and signs everything with the engine's CLI (built from the engine commit
pinned in `ENGINE_REF`, because the CLI is not on npm), installs the result
into a second project as a check, and for a tag creates the GitHub release.
Once:

1. `prismatix extension keygen ~/keys/owen-native.pem`, and keep that file safe:
   users who accepted this key are asked again if it ever changes.
2. In the repository's Settings, Secrets and variables, Actions, add a secret
   `PRISMATIX_SIGNING_KEY` holding the whole PEM.

Then for every release: raise `version` in `extension/live2d-cubism.pxextension`
(and `extension/pxext.json` is read from it), commit, and
`git tag v<version> && git push origin v<version>`. The tag must equal the
manifest version or the run stops. The release is created as a **draft** (set
`RELEASE_DRAFT` to `"false"` in the workflow to publish at once): look it over,
then publish. A tag without the secret fails on purpose; other runs without it
sign with a throwaway key and never publish.

**By hand.** `prismatix extension pack` makes what users install: one `.pxext` for the
extension and one native pack per platform whose library you built.

1. On each OS, build the plugin (`cmake -S native -B build && cmake --build build`;
   Android as above); it lands in `extension/native/<platform>/`.
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

   This writes `dist/extensions/owenliu0924-live2d-cubism-0.2.0.pxext` and
   `...-0.2.0-native-<platform>.pxext` for each platform. Core is never in a
   package: the manifest only names it, per platform, with a hint that says
   where it is in the SDK. `pxext.json` (in `extension/`) holds the package
   metadata; it names no license yet, so pack warns (`PXEXTPKG2003`).
5. Attach all the `.pxext` files to a GitHub release. Users install with
   `prismatix extension add <url or file> --allow-native` (a URL needs
   `--sha256`; the native packs are looked up beside the main package).

`prismatix extension inspect <file>` shows what an installer is asked to
trust: the native-code warning, the Studio side's permission and
contributions, and the Core file to supply for each platform.

## What it does and does not do

Does: `.moc3` models of any version the Core you load supports; motions
(parameter and part-opacity curves, Bezier/linear/stepped, fades, loops, an
idle group); expressions (add, multiply, overwrite); breathing; blinking from
the `EyeBlink` group; held parameters (lip sync is a `live2d.param` per frame
from your own script, or fixed values); several models at once; masks with
several clippers, on any texture page, and inverted masks; save, load and
rollback; Windows, macOS, Linux and Android.

Does not: physics (`physics3.json`, hair and clothes sway), pose switching
(`pose3.json`; a model whose motions do not set its alternative parts'
opacities shows them all at once),
motion user-data events, hit areas, the mouse-follow helper, masks with more
than 16 clippers (the first 16 apply, with a warning), and Cubism 5's extra
blend modes. It does not run on the Web or iOS: native extensions do not load
there. The Studio side shows a model's files and names but does not draw the
model (Studio has no channel to a Player for a preview yet).

Limits to know: the Player caps vertices drawn per frame at 65,536 across all
meshes, which bounds how many high-detail models fit on screen. A model costs
one upload call per frame, so there is room for dozens of models.

## What has been tested

`tools/test.sh` (POSIX; Node 22.18 or newer) builds the bridge, the plugin, a
mock Core and a small harness that mimics `PxHostApi`, then runs 46 tests:

- the wire format, `model3`, motion and expression parsing and evaluation,
  blink, the parameter bank and reading `frame.update`'s delta, as plain unit
  tests;
- the renderer against a fake raw host that enforces the Player's rules
  (batches checked whole, indices inside the vertices, 64 upload calls a frame);
- the whole script side against the **real plugin library** and the mock
  Core: models appear with the right canvas-pixel vertices, UVs, transform,
  blend modes and masks, parameters and motions move vertices, render-order
  changes restack, moving uploads nothing, hide and reshow work, bad Cores and
  bad `.moc3` files are reported once with the plugin's own message, Core is
  found beside the plugin, and without it the error says where Core goes;
- the Studio side's logic against an in-memory project: summarising a
  `model3.json`, motion/expression/`cdi3.json`/`.moc3` readers, finding
  `[live2d.show]` in Story text, which model a dropdown uses, the merged and
  labelled choices, the inspector's report with missing and broken files, the
  Core lookup, and that the manifest's `userFiles` and providers agree with it.

With Live2D's real Core (Cubism SDK for Native 5-r.5, Core 06.00.0001):

- `cubism_smoke` describes and updates all eight sample models of the SDK
  (moc3 versions 1, 3, 5 and 6) on Windows and Linux.
- In the **Windows Player** (a packed game with `Live2DCubismCore.dll` in
  `NativeUserFiles/`), Haru idles, plays a `TapBody` motion with an
  expression, and moves; `pack` copied Core beside the plugin.
- In the **Android Player** (NDK r27 build, APK made by `prismatix pack
  --target android`, Android 15 emulator with arm64 translation) the same
  story runs with the arm64 Core. With a stand-in file in place of Core, the
  plugin loads from the code cache and logs "Cubism Core was not found" with
  what it tried.

`prismatix validate` accepts the extension in a freshly created project
(and, with `--target desktop --platform ...` or `--target android`, reports
the missing Core with its hint), and packing, inspecting and installing it
work (see "Releasing"). The Studio side was tried in Studio with Haru and
another model (inspector in both languages and themes, a missing motion
shown as a problem, the five dropdowns).

To type-check against the engine's real SDK types (`@prismatix/runtime` is not
on npm yet), link an engine checkout whose `runtime-sdk` is built and run its `tsc`:

```sh
ln -s /path/to/PrismatiXEngine extension/.engine
/path/to/PrismatiXEngine/node_modules/.bin/tsc -p extension/tsconfig.check.json
/path/to/PrismatiXEngine/node_modules/.bin/tsc -p extension/tsconfig.studio.json
```

**Not tested:** macOS, Linux in a Player, a real device (only the emulator),
and whether masks and blend modes match Cubism's own renderer pixel for pixel.

**Engine workaround.** Before PrismatiXEngine `e16e850`, `ctx.frame.onUpdate`
reported 0 seconds every frame (`DEVELOPMENT_NOTES.md` item 25), so `main.ts`
reads `frame.update` itself and accepts both payload shapes.

## Licensing

There is no LICENSE file yet; add one before anyone else uses this. The engine
(and the vendored `PxPluginAbi.h`) is MIT. This repository contains no Live2D
code or data: the
Core prototypes in `native/cubism_core_api.h` are written out here as
declarations, and the mock Core is original. Cubism Core, the Cubism SDK and
any Live2D model are licensed by Live2D Inc. and their model authors on their
own terms.
