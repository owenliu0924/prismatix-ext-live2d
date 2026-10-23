# Live2D (Cubism) for PrismatiX

Shows Live2D Cubism models in a PrismatiX game: `live2d.show`, `live2d.motion`,
`live2d.expression`, `live2d.param`, `live2d.move`, `live2d.hide` and
`live2d.core` Story commands.

**Native code.** The package carries a native library that runs Live2D's
Cubism Core; installing it needs `--allow-native`. It does not contain Core:
download the Cubism SDK for Native from Live2D (read its license) and put the
Core library beside the plugin, or give its path with `live2d.core`.

Desktop only (Windows, macOS, Linux): native extensions do not load in the Web
or Android Players. Source, setup and limits:
https://github.com/owenliu0924/prismatix-ext-live2d
