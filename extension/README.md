# Live2D (Cubism) for PrismatiX

Shows Live2D Cubism models in a PrismatiX game: `live2d.show`, `live2d.motion`,
`live2d.expression`, `live2d.param`, `live2d.move`, `live2d.hide` and
`live2d.core` Story commands.

**Native code.** The package carries a native library that runs Live2D's
Cubism Core; installing it needs `--allow-native`. It does not contain Core:
download the Cubism SDK for Native from Live2D (read its license) and put the
Core library for each platform in your project's
`NativeUserFiles/live2d-cubism/<platform>/`; `prismatix pack` and `run` copy
it beside the plugin. `prismatix extension inspect` lists the file names.

Windows, macOS, Linux and Android (arm64); native extensions do not load in
the Web or iOS Players.

**In PrismatiX Studio** it adds an inspector for `.model3.json` files (files,
textures, motions, expressions, parameters, and whether Core is in
`NativeUserFiles/`) and dropdowns for the commands' model, motion group,
expression and parameter. It only reads the project; Studio asks before it
loads it.

Source, setup and limits: https://github.com/owenliu0924/prismatix-ext-live2d
