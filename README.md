# Live2D for PrismatiX

Show Live2D (Cubism) models in a [PrismatiX](https://github.com/PrisX/PrismatiXEngine)
game: idle animation, motions, expressions, blinking and breathing.

Runs on Windows, macOS, Linux and Android (arm64). It does not run in Web or
iOS builds. Needs PrismatiX Engine from `master` at commit `945b089` or later
(the 0.1.0 release is too old).

## 1. Install the extension

Download the files from [Releases](https://github.com/owenliu0924/prismatix-ext-live2d/releases):
the main package `owenliu0924-live2d-cubism-<version>.pxext` and the
`…-native-<platform>.pxext` for each platform you build for (each release
lists which platforms it has). Keep them in one folder, then in your project:

```sh
prismatix extension add ./owenliu0924-live2d-cubism-0.2.1.pxext --allow-native
```

To build for Android as well, add `--platform win32-x64,android-arm64` (list
every platform you need). The extension contains native code, which is why
`--allow-native` is needed.

## 2. Add Cubism Core

Live2D does not let anyone else redistribute Cubism Core, so you download it
yourself:

1. Download the **Cubism SDK for Native** from
   [live2d.com](https://www.live2d.com/en/sdk/download/native/) and accept its
   license.
2. Copy the Core library for each platform into your project:

| Platform | Copy from the SDK | To your project |
| --- | --- | --- |
| Windows | `Core/dll/windows/x86_64/Live2DCubismCore.dll` | `NativeUserFiles/live2d-cubism/win32-x64/` |
| macOS | `Core/dll/macos/libLive2DCubismCore.dylib` | `NativeUserFiles/live2d-cubism/darwin-arm64/` (and `darwin-x64/`) |
| Linux | `Core/dll/linux/x86_64/libLive2DCubismCore.so` | `NativeUserFiles/live2d-cubism/linux-x64/` |
| Android | `Core/dll/android/arm64-v8a/libLive2DCubismCore.so` | `NativeUserFiles/live2d-cubism/android-arm64/` |

Packing and running the game put Core in the right place for you. Add
`NativeUserFiles/` to your `.gitignore`.

## 3. Add a model

Copy the model's folder (the `.model3.json` with its `.moc3`, textures,
motions and expressions) into your project, for example
`Assets/Live2D/Haru/`.

## 4. Use it in your story

```pxstory
[live2d.show id=haru model="Assets/Live2D/Haru/Haru.model3.json"]
[live2d.motion id=haru group=TapBody]
[live2d.expression id=haru name=F01]
[live2d.move id=haru x=0.3]
[live2d.hide id=haru]
```

| Command | What it does |
| --- | --- |
| `live2d.show` | Shows a model. `id` is your name for it. `x`, `y` place its feet (0.5, 1 is bottom centre), `height` sizes it (1 = screen height), `z` puts it in front of models with a lower `z`. |
| `live2d.motion` | Plays a motion `group` (and `index`). The idle motion resumes afterwards. |
| `live2d.expression` | Sets an expression by `name`; empty clears it. |
| `live2d.param` | Holds a parameter at a `value` (for example `ParamMouthOpenY` for lip sync); `release=true` lets go. |
| `live2d.move` | Moves or resizes a shown model. |
| `live2d.hide` | Removes a model. |

Models are saved with the game, so loading a save and rolling back work.

## In PrismatiX Studio

- Select a `.model3.json` in Assets to see its textures, motions, expressions
  and parameters, and whether Cubism Core is in place for each platform.
- The commands' model, motion, expression and parameter fields become
  dropdowns.

Studio asks once before it runs this part. It can only read your project and
cannot change any files.

## Not supported yet

- Physics (hair and clothes sway) and pose switching. A model whose motions
  don't hide its alternative parts themselves may show them all at once.
- More than 16 masks on one drawable.
- Web and iOS builds.

## License

This extension is MIT licensed (see [LICENSE](LICENSE)).

Cubism Core, the Cubism SDK and Live2D models are licensed by Live2D Inc. and
the models' authors. Read
[Live2D's license terms](https://www.live2d.com/en/sdk/license/) before you
release a game. Companies above a revenue threshold need a publication
license.

To build, test or release the extension itself, see [DEVELOPMENT.md](DEVELOPMENT.md).
