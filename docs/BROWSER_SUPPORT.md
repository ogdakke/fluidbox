# Browser support policy

Fluidbox targets recent browsers. Legacy compatibility is deferred and must not add mandatory code to the interaction runtime. This is the intended release policy, not a claim that the full matrix has already passed.

## Target window

- Desktop Chrome, Edge, and Firefox: current and previous stable major versions at each package release.
- Safari on macOS and iOS: current and previous OS major releases, using their latest available Safari/system updates. Record exact versions before claiming support; a device model alone does not establish browser compatibility.
- Android Chrome: current and previous stable major versions are targets. Physical Android validation is currently unavailable and remains an explicit coverage gap.
- Embedded webviews, in-app browsers, older ESR releases outside this window, and older browser/OS versions are outside the initial guarantee.

For every public release, publish the exact versions tested. Rolling policy does not silently change the compatibility claims of an already-published package. A capability audit may narrow the proposed window before beta; any exception must be explicit in release documentation.

Playwright's Chromium, Firefox, and WebKit builds provide automated engine coverage. They do not establish that branded Chrome/Edge, shipped Safari, previous stable versions, or physical mobile browsers passed. Keep target, automated, and manually verified coverage distinct.

## Capabilities before version claims

Audit required behavior CSS and browser APIs before finalizing minimum versions. Include native scrolling/snap behavior, Web Animations, `inert`, pointer/touch input, and viewport behavior. CSS `@scope` is not a required capability; selector isolation must work through data attributes and ordinary CSS. Record which capabilities are mandatory and which already have a fallback. Do not equate a feature's availability with correct gesture behavior.

A browser support policy must follow the interaction requirements, not an incidental stylesheet feature. Public data attributes and documented engine-driven CSS variables are the customization contract. Baseline feature availability is useful input, but it is not a substitute for testing the supported browser versions. See [Baseline's coverage limits](https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility).

Before beta, unsupported-browser handling must avoid intercepting a trigger and then leaving an unusable viewer. Demonstrate progressive fallback with ordinary image links where applicable. Do not claim this is implemented for every current custom-element trigger. Programmatic callers need a documented capability result or recoverable failure before a session takes over focus/background interaction.

## Available physical devices

The maintainer has confirmed these devices; no completed test run is implied:

| Device        | Planned checks                                                                                        | Status                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| iPhone 15 Pro | Safari touch/pinch, interruption, orientation/browser chrome, native media controls, VoiceOver        | Available; OS/browser version and results pending           |
| M1 MacBook    | Safari, Chrome, Firefox; built-in trackpad momentum/pinch, keyboard, mouse where available, VoiceOver | Available; macOS/browser versions and results pending       |
| Android phone | Chrome touch/pinch, scrolling, browser chrome, constrained-device media behavior                      | Not available; no purchase required to continue development |

Do not infer a MacBook display refresh rate from “M1” or assume iPhone animations ran at 120 Hz. Record actual device/settings and observed behavior for each run. These devices provide useful validation but do not establish low-end Android performance.

## Manual run record

For each release candidate, record:

1. Package revision, fixture URL, device model, OS, browser/version, refresh-rate setting if known, and accessibility/motion settings.
2. Open/close interruption, drag reversal, pinch-to-pan, zoom boundary ownership, and trackpad momentum after dismissal where applicable.
3. Rapid navigation through a slide-window boundary; slow/failed image loading; missing/recycled origins; close during loading.
4. Rotation/viewport changes, keyboard focus return, screen reader naming/announcements, and reduced motion.
5. Pass/fail per scenario, reproduction steps, and a recording for any discontinuity. Mark unavailable scenarios as untested, not passed.

Image beta can collect feedback before the entire physical matrix is available, with gaps disclosed. Physical Android evidence remains required before claiming verified Android interaction quality for 1.0; borrowing a device or using a device service is sufficient.

## Later compatibility work

Add compatibility support only for a named browser/version and consumer need. Prefer an optional export or documented adapter, with its own bundle budget and behavioral tests. Some missing CSS or input behavior may require build-time transformation or a narrower interaction guarantee; a universal polyfill layer is not promised. Maintain one gesture/portal implementation and avoid shipping a parallel legacy runtime by default.
