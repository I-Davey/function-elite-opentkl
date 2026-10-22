# Function Elite OpenTKL

A community Windows app for the NZXT Function Elite MiniTKL ANSI HE keyboard (firmware 2.2.14): lighting, actuation, rapid trigger, remapping, profiles, macros, analogue controller output and sensor monitoring. Uses stock firmware and Windows HID. Independent of NZXT.

**Beta:** currently supports this keyboard/firmware combination. Firmware flashing and other CAM devices are outside this app's scope; dependency licences and attribution are retained in [NOTICE](NOTICE).

## Install

Download the Windows x64 **Setup.exe** from [Releases](https://github.com/I-Davey/function-elite-opentkl/releases). Setup installs the application, shortcuts and uninstaller, and offers analogue controller support when the ViGEmBus driver is missing. Keyboard configuration uses Windows' built-in HID driver. ViGEmBus is required only for Xbox controller output and is archived upstream.

Exit CAM from its tray menu before opening OpenTKL: both apps require the same keyboard interface. No CAM installation is needed. Software profiles and analogue output require OpenTKL to stay open. Upgrades and uninstall preserve user profiles; uninstall does not remove the shared ViGEmBus driver.

Initial beta installers are unsigned. The bundled official driver installer is unchanged and checksum verified. A portable ZIP is also built; analogue output still requires ViGEmBus.

Closing the window keeps OpenTKL in the system tray. Setup offers an optional **Start with Windows** checkbox; you can also change it by right-clicking the tray icon. The menu opens Profiles, toggles controller output and provides **Quit**. Startup opens quietly in the tray; controller output still starts off. Quit restores temporary key mappings and lighting before exiting.

Onboard settings load when their slot is selected and are reused during that connection. Startup does not cycle through other slots. Rescan reloads the active slot; software profiles load from the local library.

### Built-in updates

OpenTKL checks this repository's published GitHub releases ten seconds after
startup and every six hours. A newer version appears in the app's update bar
and raises a Windows notification. **Check for updates** runs a manual check.
Beta builds include newer published betas; stable builds stay on stable releases.
Drafts, ordinary commits and unpublished local builds do not trigger an alert.

Choose **Download update**, then **Install update**. Downloads are restricted to
this repository's Windows installer and verified against `SHA256SUMS.txt` (and
the GitHub asset digest when present). The app exits through its normal keyboard
cleanup before Setup opens. Pending recovery prevents installation. Setup uses
the current application directory; profiles remain in the separate data folder.
Windows may request administrator approval, and Setup offers to reopen the app.
Cancelled or failed installation reopens the existing app with the saved error.
No update is downloaded or installed automatically. Update checks send no keyboard
profiles or game settings. Network access remains in the desktop host.

## Build and run

Requires Windows, Microsoft C++ build tools, Rust and Node.js 24.16.0+. The first build downloads npm/Cargo dependencies using the committed lockfiles.

```text
npm ci
npm run build
npm start
```

`Start Keyboard.cmd` opens the built app. Close NZXT CAM before connecting. `npm run preview` serves the UI at http://127.0.0.1:4173 with in-memory profiles and no keyboard access. `npm run package` creates a portable app in `dist/releases/`.

Run `npm run installer` after packaging to produce the installer, portable ZIP and `SHA256SUMS.txt` in `dist/installers/`. It downloads checksum-pinned Inno Setup and ViGEmBus dependencies into `.build/`, installs the build compiler there, and compiles Setup; it does not install the app or execute the driver.

## GitHub builds

Pushes to `main`, pull requests and manual workflow runs compile the app on Windows, run offline checks, verify the packaged desktop, build the installer and perform an isolated install/uninstall without the driver or keyboard. Downloads appear in that run's **Function-Elite-OpenTKL-windows-x64** artifact. No personal profiles, local reports or build directories are committed.

Pushing a version tag such as `v0.4.0-beta.1` also creates a **draft prerelease** with the installer, portable ZIP and checksums. A maintainer publishes it after reviewing the build and checking real hardware. Hosted runners do not verify physical keys, game behaviour or kernel-driver installation. Signed production releases need a code-signing certificate; no signing credentials are stored in this repository.

## Source layout

| Directory | Purpose |
| --- | --- |
| `packages/keyboard-ui`, `renderer` | React components, models, desktop shell and composition |
| `packages/application-state`, `renderer-state` | Connection, selection, hydration and edit coordination |
| `packages/desktop`, `contracts` | Electron host, persistence, IPC and public contracts |
| `packages/backend`, `device-client` | Transactions, recovery, wire codecs and Rust process client |
| `packages/sensor-monitor`, `ui-platform` | Sensor views/statistics, translations and logging |
| `native/keyboard-core` | Rust HID library and host executable |
| `native/analog-controller` | Source-built Windows controller output and stale-input watchdog |
| `resources`, `scripts`, `tests` | Keyboard definitions/licences, tooling and regressions |

`dist/`, `.build/`, `reports/` and `node_modules/` are generated locally and excluded from Git. Dependency licences are collected when packaging.

## User data

Development profiles and recovery backups live in the sibling `NZXT-HE-Keyboard-Data` folder; portable builds use Windows application data. Override with `NZXT_HE_DATA_DIR`. Preserve this folder when updating and close the app normally to let transactions finish.

## Checks

`npm run lint` checks source policy; `npm run check` runs offline regressions. `npm run verify:release` uses isolated test data. `npm run verify:live` temporarily changes and restores the physical keyboard; run only intentionally with the normal app closed. `npm run publish:local` requires matching acceptance reports for the candidate. A build alone does not verify behaviour.

Sensor millimetres are estimates, separate from raw ADC readings. Software-profile actuation is acknowledged by firmware, without readback.

`node scripts/verify-release.mjs --source --live --analogue` tests analogue controls in a new software profile using isolated storage, then compares the restored keyboard state. `node tests/analogue-controller-live.cjs` checks all controller axes/buttons through Windows XInput and verifies the stalled-input watchdog; it creates a temporary virtual controller without editing the keyboard. Close the normal app before either live check.

## Profiles

**Export profiles** saves a new timestamped JSON file to Downloads and selects it
in Explorer. It includes keyboard settings, mappings, macros, analogue profiles
and application rules. **Export** on the Analogue page saves just that profile's
analogue mappings and curves. Both show the saved path and preserve existing files.
This replaces the reported broken Save-dialog workflow; live verification of the
22 October source changes is pending.

Select a profile in the parent toolbar; every Customise page edits that profile and autosaves. **Profiles** manages the four onboard slots and software library. Duplication always creates an independent software copy, including mappings, actuation, lighting, brightness, analogue bindings, response curves and feedback. **Copy sections** merges selected sections; **Replace onboard** first keeps a complete software copy of the old slot. App associations stay with the original when duplicating.

**Link app** lists running processes or browses for an executable. Rules can follow the focused app or a running background process. Focused rules take priority; otherwise the configured default applies. Manual selection pins the chosen profile while automatic switching is enabled. Unpin to resume automatic selection. Opening this app preserves the previous profile. Automatic switching and analogue output require this app to remain running.

Analogue data migrates from the legacy standalone file into `profiles.json`; the original file is retained. Exports include analogue settings and application rules. Software switching prepares one original recovery snapshot per session, applies only changed settings and uses native compare/readback checks. Switching an existing slot creates no profile backup. Onboard replacements retain their explicit recovery backups.

## Analogue controls

Select a key in **Analogue controls**, choose an axis/trigger/button, then adjust its travel range and curve. Mappings are saved per keyboard profile. **Import** beside the profile selector accepts the original patch's schema-v2 `analog-settings.json`, including its curves. **Copy curve** and **Paste curve** transfer the travel range, shape, output limits and smoothing between keys. Controller output starts off on each launch.

**Calibrate** beside the travel fields captures steady released/full-press ADC endpoints for that physical key. Output pauses and resumes after applying or cancelling. Endpoint calibration retains the estimated sensor curve; it does not establish a physically measured 0.1 mm threshold.

The **Controller output** dropdown configures a physical chord that toggles all controller controls on/off in-game. The shortcut keeps listening while output is off. After a sensor timeout or output error, the app first restores normal mappings and lighting, then monitors only the shortcut. Release the chord and press it again to retry; slow or failed reads never count as a shortcut press. Failed restoration blocks retry until recovery succeeds. Normal keys restore after release. Choose unmapped shortcut keys: their normal keystrokes still reach the game.

**Lighting → Analogue feedback** controls mode colours, brightness and fade. All three mode colours use the selected brightness independently of key depth; fade smooths colour changes. The analogue page links directly to it. Feedback uses the firmware's live selector FF, with a shared device queue and a recovery journal, and restores the original effects on stop or restart. Other keys retain their effects; the ten-zone firmware limit bounds available feedback modes. With insufficient free zones, feedback reports an error and restores lighting while controller input continues.

**Controller output** creates an Xbox 360 controller through an installed [ViGEmBus driver](https://github.com/nefarius/ViGEmBus). Games must support controller input; simultaneous mouse/keyboard input varies by game. The driver is archived upstream. The bundled MIT-licensed ViGEmClient DLL is the existing CAM patch dependency (SHA-256 `2bf0cb1d809039573c922737d298a1653d4dbc61408060ff45a9bcfde82e97d2`); it does not install a kernel driver.

**Overwrite default key** uses the firmware's RAM mapping table for software profiles, covering both actuation and Fn layers in one bulk update. Profiles that exceed its 2 KB limit and onboard profiles use stored per-key mappings. Originals are journaled before writes and restored on stop, configuration changes or normal exit. After a crash or unplug, reconnect the same keyboard and reopen the app to complete recovery. A changed mapping is never silently overwritten during recovery. Analogue output always starts off; the native watchdog releases controller input if the host stalls. The displayed input rate measures sensor observations, not the keyboard's USB polling rate.
