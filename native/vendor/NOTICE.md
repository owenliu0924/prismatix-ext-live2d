# Vendored: PxPluginAbi.h

`Engine/Native/PxPluginAbi.h` is the C ABI header of PrismatiXEngine, copied
unchanged from https://github.com/PrisX/PrismatiXEngine
(`PrismatiXEngine/Engine/Native/PxPluginAbi.h`, last changed in commit c92a052).
It is licensed under the engine's MIT license. It is here so the plugin builds
without an engine checkout; to build against a checkout instead, pass
`-DPX_ENGINE_INCLUDE=<engine>/PrismatiXEngine` to CMake. Replace the copy when
the engine's ABI version changes (`PX_PLUGIN_ABI_MAJOR`).
