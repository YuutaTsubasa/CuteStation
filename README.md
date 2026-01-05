# CuteStation

A 2D platformer action game built with modern cross-platform technologies.

## Tech Stack

- **Tauri V2** - Cross-platform desktop and mobile application framework
- **Svelte 5** - Modern reactive UI framework
- **TypeScript** - Type-safe JavaScript
- **Rust** - Backend runtime for Tauri

## Supported Platforms

| Platform | Status | Output |
|----------|--------|--------|
| Windows | Supported | `.exe` / `.msi` |
| Android | Supported | `.apk` / `.aab` |
| iOS | Supported | `.ipa` (requires macOS) |

## Prerequisites

### All Platforms

- [Node.js](https://nodejs.org/) 18, 20, or 22+
- [Rust](https://rustup.rs/) (latest stable)
- npm (comes with Node.js)

### Windows

- [Visual Studio Build Tools 2019+](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
  - Select "Desktop development with C++"

### Android

- [Android Studio](https://developer.android.com/studio) or Android SDK
- Android NDK (install via SDK Manager)
- JDK 17+ (recommend [Eclipse Temurin](https://adoptium.net/))

Set environment variables:
```bash
ANDROID_HOME=<path-to-android-sdk>
NDK_HOME=<path-to-android-ndk>
JAVA_HOME=<path-to-jdk>
```

Add Rust Android targets:
```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

### iOS (macOS only)

- macOS with [Xcode](https://developer.apple.com/xcode/) (latest version)
- Apple Developer Account (for distribution)

Add Rust iOS targets:
```bash
rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim
```

## Installation

```bash
# Clone the repository
git clone https://github.com/YuutaTsubasa/CuteStation.git
cd CuteStation

# Install dependencies
npm install
```

## Development

```bash
# Desktop development (hot-reload)
npm run tauri dev

# Android development (requires device/emulator)
npm run tauri android dev

# iOS development (macOS only, requires simulator)
npm run tauri ios dev
```

## Build

### Windows

```bash
npm run tauri build
```

Output:
- `src-tauri/target/release/bundle/msi/cutestation_*.msi`
- `src-tauri/target/release/bundle/nsis/cutestation_*-setup.exe`

### Android

```bash
# Build for all architectures
npm run tauri android build

# Build for ARM64 only (recommended)
npm run tauri android build -- --target aarch64
```

Output:
- `src-tauri/gen/android/app/build/outputs/apk/universal/release/*.apk`
- `src-tauri/gen/android/app/build/outputs/bundle/universalRelease/*.aab`

### iOS (macOS only)

```bash
npm run tauri ios build
```

Output:
- `src-tauri/gen/apple/build/arm64/*.app`

## Project Structure

```
CuteStation/
├── src/                          # Svelte frontend source
│   ├── routes/                   # SvelteKit routes
│   │   ├── +layout.ts
│   │   └── +page.svelte          # Main page
│   └── app.html                  # HTML template
├── src-tauri/                    # Tauri Rust backend
│   ├── src/
│   │   ├── lib.rs                # Library entry
│   │   └── main.rs               # Application entry
│   ├── gen/                      # Generated platform projects
│   │   └── android/              # Android project
│   ├── icons/                    # Application icons
│   ├── capabilities/             # Tauri capabilities config
│   ├── Cargo.toml                # Rust dependencies
│   └── tauri.conf.json           # Tauri configuration
├── static/                       # Static assets
├── package.json                  # Node.js dependencies
├── svelte.config.js              # Svelte configuration
├── vite.config.js                # Vite configuration
└── tsconfig.json                 # TypeScript configuration
```

## IDE Setup

Recommended extensions for VS Code:
- [Svelte for VS Code](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode)
- [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## License

MIT
