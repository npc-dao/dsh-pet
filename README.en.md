# @deepseek-ai/dsh-pet

English | [中文](README.md)

> This repository is currently private. The source code is MIT-licensed, while the bundled 小深 whale asset has separate brand-derived asset terms. See [Asset status](assets/dsh/ASSET-LICENSE.md) and [Notices](NOTICE.md).

Pets inside the DSH Web frame. The package ships the version-2 **小深** DeepSeek-blue whale atlas as the always-available DSH default, discovers locally installed Codex-compatible atlases, serves one opaque Host catalog, renders the selected atlas in a draggable browser overlay, and contributes the **Pets** settings section. It has no pet creator, image generator, upload control, or remote-URL installer.

## Usage

The Web application bundle loads this package as one Cordis plugin. 小深 works without Codex Desktop. Open **Settings → Pets** to enable or hide the overlay, select another available preset or imported pet, choose a width from 80 to 224 CSS pixels, or refresh the catalog after changing files under the Codex home. The overlay stays inside the browser viewport; pointer dragging and arrow keys reposition it for the current page.

The pet projects DSH activity onto Codex atlas rows for idle, running, waiting for user input, selected-session failure, and completed output awaiting review. Hover and drag use the compatible jump and directional-running rows. Reduced-motion browsers hold one frame instead of cycling the atlas.

## Configuration

The Cordis plugin accepts two Host resource-discovery keys:

| Key | Default | Behavior |
|---|---|---|
| `codexHome` | `$CODEX_HOME`, then `~/.codex` | Directory containing modern `pets/` and legacy `avatars/` packages. `~` is expanded by the Host. An explicitly configured missing path or non-directory fails plugin startup. |
| `appAsarPath` | Platform discovery | Explicit Codex Desktop `app.asar` used for built-in atlases. An explicitly configured unreadable or malformed archive fails plugin startup instead of hiding the configuration error. |

Platform discovery checks `/Applications/ChatGPT.app/Contents/Resources/app.asar` on macOS and `%LOCALAPPDATA%\Programs\ChatGPT\resources\app.asar` on Windows. Other platforms need `appAsarPath` for Codex presets, but 小深 and custom Codex-home packages remain available without it.

```yaml
- id: dsh-pet
  config:
    codexHome: ~/.codex
    appAsarPath: /Applications/ChatGPT.app/Contents/Resources/app.asar
```

The `dsh-pet` settings namespace stores browser preferences independently of those Host paths:

| Setting | Default | Behavior |
|---|---|---|
| `enabled` | `true` | Shows or hides the Web-frame overlay. |
| `selectedId` | `dsh` | Selects the bundled DSH id, a Codex preset id, or the opaque `custom:<directory>` id assigned during discovery. |
| `size` | `112` | Sprite width in CSS pixels, validated from 80 through 224. |

The normal local settings provider persists these fields in `$DSH_HOME/settings.yaml`. Loopback browsers may write them through the Host settings API and read the local pet catalog; remote browser authorities receive `403` from the pet catalog and asset routes because those responses project Host-local files.

## Import Format

Import is discovery, not copying. Refresh scans `$CODEX_HOME/pets/<directory>/pet.json` and the legacy `$CODEX_HOME/avatars/<directory>/avatar.json`; a modern `pets/` package wins when both roots contain the same directory name. Runtime identity is always `custom:<directory>`, so a manifest cannot replace a built-in id.

The manifest accepts `id`, `displayName`, nullable `description`, `spriteVersionNumber`, and `spritesheetPath`. `spriteVersionNumber` defaults to `1`, while `spritesheetPath` defaults to `spritesheet.webp`. Display names fall back from `displayName` to `id` to the directory name. Unknown fields are ignored. A manifest may contain at most 64 KiB.

Version 1 atlases are 1536×1872 pixels; version 2 atlases are 1536×2288 pixels. Both use 192×208 cells in eight columns and may be static PNG or WebP up to 20 MiB; animated PNG and WebP files are rejected. The Host fully decodes the raster before admitting it. The atlas path must stay inside its pet directory, including after symbolic-link resolution. A malformed, unreadable, oversized, escaping, truncated, or dimensionally incompatible package is omitted without hiding valid siblings.

The preset catalog starts with the package-owned 小深 version-2 WebP, generated from a user-provided DeepSeek icon, then lists the nine Codex identities: Codex, Dewey, Fireball, Hoots, Rocky, Seedy, Stacky, BSOD, and Null Signal. This repository stores the 小深 atlas, but only the ids, labels, and version-2 layout metadata for Codex presets. At runtime the Host locates Codex's hashed atlases in the user's locally installed Codex Desktop `app.asar`; this package does not copy, vendor, or redistribute those OpenAI binary assets. If no compatible local application archive is available, 小深 remains available while the nine Codex rows are unavailable. A successful refresh retains validated compressed preset atlases for that catalog generation, avoiding another full decode for each browser image request; the next refresh reads the Codex archive again.

The browser reads the resources through loopback same-origin HTTP: `GET /dsh-pet/catalog`, `POST /dsh-pet/refresh`, and `GET` or `HEAD /dsh-pet/assets/<opaque-id>`. Every request passes Connection's Host, Origin, and Fetch-Metadata trust check before reaching the catalog. Responses expose catalog metadata and image bytes, never Codex-home filesystem paths or ASAR member names. Initial discovery and route registration finish before the Host plugin reports successful activation. Concurrent refresh requests run in arrival order, and plugin teardown waits for accepted requests to settle after unregistering the route.

## Model Experience

None, as this package discovers and renders browser pets; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **The pet belongs to the DSH Web viewport.** It is not an operating-system desktop overlay, native Codex integration, tray companion, or independently floating window.
- **Codex preset availability depends on a local Codex installation and its private archive layout.** An automatically discovered archive that no longer matches the supported layout makes affected Codex rows unavailable without affecting 小深; it does not justify copying upstream binaries into this package.
- **Creation and distribution stay outside this package.** There is no editor, generator, upload, deep-link installer, or remote image download; prepare a Codex-compatible directory through a separate workflow and refresh this catalog.
- **Host-local pets are loopback-only.** A DSH Web page reached through a non-loopback authority cannot read this package's catalog or atlases, even when another application route accepts that authority.
- **Only the selected session exposes detailed failure state to this projection.** A selected foreground failure can use the failed row, while a completed background session can only use the review signal because the session list does not carry its detailed failure reason.

## Development

The checked-in `lib/` files are the build used by the package exports. Source development currently uses the shared TypeScript and client-bundling presets from the DeepSeek Harness monorepo. Place this repository at `packages/client/pet` in a matching Harness checkout, then run the package tests and `pnpm --filter @deepseek-ai/dsh-pet bundle` there.

## License

Source code is available under the [MIT License](LICENSE). The bundled 小深 spritesheet is excluded; see its [asset-specific status](assets/dsh/ASSET-LICENSE.md). No Codex or OpenAI binary asset is included in this repository.
