# Builds the Live2D Cubism native extension for the platform you run on:
#   cmake -S native -B build
#   cmake --build build
# or for Android (arm64-v8a, API 26) with the NDK's toolchain file:
#   cmake -S native -B build-android -G Ninja -DCMAKE_BUILD_TYPE=Release \
#     -DCMAKE_TOOLCHAIN_FILE=$ANDROID_NDK_HOME/build/cmake/android.toolchain.cmake \
#     -DANDROID_ABI=arm64-v8a -DANDROID_PLATFORM=android-26
#   cmake --build build-android --target px_live2d
# The libraries land in extension/native/<platform>/ where the manifest expects them.
cmake_minimum_required(VERSION 3.21)
project(px_live2d C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_C_VISIBILITY_PRESET hidden)
if(MSVC)
    # No dependency on the Visual C++ redistributable for a plugin loaded into someone else's process.
    set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
endif()

# The folder that holds Engine/Native/PxPluginAbi.h. Defaults to the copy in
# vendor/ (see vendor/NOTICE.md); point it at <engine>/PrismatiXEngine to build
# against a PrismatiXEngine checkout instead.
set(PX_ENGINE_INCLUDE "${CMAKE_CURRENT_SOURCE_DIR}/vendor" CACHE PATH "Folder containing Engine/Native/PxPluginAbi.h")
if(NOT EXISTS "${PX_ENGINE_INCLUDE}/Engine/Native/PxPluginAbi.h")
    message(FATAL_ERROR "PX_ENGINE_INCLUDE (${PX_ENGINE_INCLUDE}) does not contain Engine/Native/PxPluginAbi.h")
endif()

# The platform name the manifest uses. Detected, or set with -DPX_PLATFORM=...
# (CI builds darwin-x64 on an Apple Silicon runner with -DCMAKE_OSX_ARCHITECTURES=x86_64).
set(PX_PLATFORM "" CACHE STRING "Manifest platform: win32-x64, linux-x64, darwin-x64, darwin-arm64 or android-arm64")
if(NOT PX_PLATFORM)
    if(ANDROID)
        if(NOT ANDROID_ABI STREQUAL "arm64-v8a")
            message(FATAL_ERROR "The Android Player loads arm64-v8a libraries only; set -DANDROID_ABI=arm64-v8a")
        endif()
        set(PX_PLATFORM "android-arm64")
    elseif(WIN32)
        set(PX_PLATFORM "win32-x64")
    elseif(APPLE)
        if(CMAKE_OSX_ARCHITECTURES MATCHES "x86_64")
            set(PX_PLATFORM "darwin-x64")
        elseif(CMAKE_OSX_ARCHITECTURES MATCHES "arm64" OR CMAKE_SYSTEM_PROCESSOR MATCHES "arm64|aarch64")
            set(PX_PLATFORM "darwin-arm64")
        else()
            set(PX_PLATFORM "darwin-x64")
        endif()
    else()
        set(PX_PLATFORM "linux-x64")
    endif()
endif()
# $<1:...> keeps multi-config generators (Visual Studio) from adding a Release/ folder.
set(PX_OUTPUT "$<1:${CMAKE_CURRENT_SOURCE_DIR}/../extension/native/${PX_PLATFORM}>")

add_library(px_live2d SHARED px_live2d_plugin.c cubism_bridge.c)
target_include_directories(px_live2d PRIVATE "${PX_ENGINE_INCLUDE}")
target_link_libraries(px_live2d PRIVATE ${CMAKE_DL_LIBS})
if(NOT WIN32)
    target_link_libraries(px_live2d PRIVATE m)
endif()
set_target_properties(px_live2d PROPERTIES
    LIBRARY_OUTPUT_DIRECTORY "${PX_OUTPUT}"
    RUNTIME_OUTPUT_DIRECTORY "${PX_OUTPUT}"
    PREFIX "lib")
if(WIN32)
    set_target_properties(px_live2d PROPERTIES PREFIX "")
endif()
if(ANDROID)
    # 16 KB pages: Google Play requires it for Android 15 targets. The plugin is
    # C only, so there is no C++ runtime to link. The NDK compiles with -g even
    # for Release, and nothing strips a library a .pxext carries, so strip it here.
    target_link_options(px_live2d PRIVATE "-Wl,-z,max-page-size=16384" "$<$<CONFIG:Release>:-Wl,--strip-debug>")
endif()
if(MSVC)
    target_compile_options(px_live2d PRIVATE /W4)
else()
    target_compile_options(px_live2d PRIVATE -Wall -Wextra -Wpedantic)
endif()

# Run this against your own Core and a real .moc3 before using the plugin.
add_executable(cubism_smoke cubism_smoke.c cubism_bridge.c)
target_link_libraries(cubism_smoke PRIVATE ${CMAKE_DL_LIBS})
if(NOT WIN32)
    target_link_libraries(cubism_smoke PRIVATE m)
endif()

option(PX_LIVE2D_TESTS "Build the mock Core and the plugin harness" OFF)
if(PX_LIVE2D_TESTS)
    add_library(mock_cubism_core SHARED test/mock_cubism_core.c)
    set_target_properties(mock_cubism_core PROPERTIES PREFIX "lib")
    add_executable(plugin_harness test/plugin_harness.c)
    target_include_directories(plugin_harness PRIVATE "${PX_ENGINE_INCLUDE}")
    target_link_libraries(plugin_harness PRIVATE ${CMAKE_DL_LIBS})
endif()
