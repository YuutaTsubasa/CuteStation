# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CuteStation is a 2D platformer action game built with Tauri V2 (Rust backend) and Svelte 5 (frontend). It targets multiple platforms: Windows desktop, Android, and iOS.

## Common Development Commands

### Development (Hot Reload)
```bash
# Desktop development
npm run tauri dev

# Android development (requires device/emulator)
npm run tauri android dev

# iOS development (macOS only, requires simulator)
npm run tauri ios dev

# Frontend only (without Tauri)
npm run dev
```

### Building for Production
```bash
# Windows desktop
npm run tauri build
# Output: src-tauri/target/release/bundle/msi/*.msi and src-tauri/target/release/bundle/nsis/*-setup.exe

# Android (all architectures)
npm run tauri android build
# Android (ARM64 only, recommended)
npm run tauri android build -- --target aarch64
# Output: src-tauri/gen/android/app/build/outputs/apk/universal/release/*.apk

# iOS (macOS only)
npm run tauri ios build
# Output: src-tauri/gen/apple/build/arm64/*.app
```

### Type Checking and Linting
```bash
# Run Svelte type checking
npm run check

# Watch mode for type checking
npm run check:watch

# Build frontend only (for testing SvelteKit build)
npm run build
```

### Testing Frontend
```bash
# Preview production build
npm run preview
```

## Architecture

### Frontend-Backend Communication

The app uses Tauri's IPC (Inter-Process Communication) system to invoke Rust functions from the frontend:

- **Frontend**: Uses `invoke()` from `@tauri-apps/api/core` to call Rust commands
- **Backend**: Rust functions decorated with `#[tauri::command]` macro
- **Command Registration**: Commands registered in `src-tauri/src/lib.rs` via `invoke_handler(tauri::generate_handler![...])`

Example flow:
1. Frontend calls `await invoke("greet", { name })`
2. Tauri routes to Rust function `greet(name: &str) -> String` in `src-tauri/src/lib.rs:3`
3. Function returns serialized JSON response to frontend

### SPA Mode Configuration

The app runs in SPA (Single Page Application) mode because Tauri doesn't support SSR:

- `svelte.config.js:12`: Uses `adapter-static` with `fallback: "index.html"`
- `src/routes/+layout.ts:5`: Sets `ssr = false` to disable server-side rendering
- Vite builds static files to `build/` directory, which Tauri serves via `tauri.conf.json:10`

### Mobile Architecture

The project uses conditional compilation for mobile platforms:

- `src-tauri/src/lib.rs:7`: Entry point decorated with `#[cfg_attr(mobile, tauri::mobile_entry_point)]`
- `src-tauri/gen/android/`: Generated Android project with Gradle build files
- Android uses custom Rust plugin at `src-tauri/gen/android/buildSrc/src/main/java/com/user/cutestation/kotlin/RustPlugin.kt`

### Development Server Configuration

Vite development server (defined in `vite.config.js:16-31`):
- Runs on fixed port `1420` (required by Tauri)
- HMR (Hot Module Reload) on port `1421` when using `TAURI_DEV_HOST`
- Ignores `src-tauri/` directory to prevent watch conflicts

## Platform-Specific Notes

### Android Development

**Initial Setup** (first time only):
```bash
npm run tauri android init
```

**Environment Variables** (required):
- `ANDROID_HOME`: Path to Android SDK
- `NDK_HOME`: Path to Android NDK (install via Android Studio SDK Manager)
- `JAVA_HOME`: Path to JDK 17+

**Rust Targets** (install once):
```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

### iOS Development

**Rust Targets** (macOS only, install once):
```bash
rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim
```

**Note**: iOS builds are NOT in CI due to certificate requirements. Build locally on macOS with Xcode.

### Windows Development

Requires Visual Studio Build Tools 2019+ with "Desktop development with C++" workload.

## Key Configuration Files

- `src-tauri/tauri.conf.json`: Tauri app configuration (window size, bundle settings, build commands)
- `src-tauri/Cargo.toml`: Rust dependencies and library configuration (note: lib name is `cutestation_lib` to avoid Windows conflicts)
- `package.json`: Node.js dependencies and npm scripts
- `svelte.config.js`: Configures adapter-static for SPA mode
- `vite.config.js`: Vite configuration for Tauri development
- `src-tauri/capabilities/default.json`: Tauri capability/permission configuration

## Adding New Tauri Commands

1. Define command in `src-tauri/src/lib.rs`:
```rust
#[tauri::command]
fn your_command(param: &str) -> Result<String, String> {
    // implementation
}
```

2. Register in `invoke_handler` at `src-tauri/src/lib.rs:11`:
```rust
.invoke_handler(tauri::generate_handler![greet, your_command])
```

3. Call from frontend:
```typescript
import { invoke } from "@tauri-apps/api/core";
const result = await invoke("your_command", { param: "value" });
```

## CI/CD

- `.github/workflows/build-android.yml`: Builds Android APK for ARM64 on push/PR
- `.github/workflows/build-windows.yml`: Builds Windows MSI/EXE installers on push/PR
- Both workflows cache Rust dependencies via `Swatinem/rust-cache@v2`
- Build artifacts retained for 7 days
