// =========================================================================
// 1. Virtual Intranet & External Link Bridge for Netscape Navigator 3.0
// =========================================================================
import { GUEST_IMAGES, GUEST_IMAGE_TYPE, PAGES, mailAddressOf, wrapHtml32 } from "./guest-pages.js";
import { guestModeFor } from "./guest-display.js";

// =========================================================================
// 2. Initialize v86 Windows 95 Virtual Machine with Snapshot Restore
// =========================================================================
// libv86.js is a classic script that defines the global V86, so the module cannot import it
// (and the bundler must not fold it in); it is inserted once the manifest has named its URL.
function loadClassicScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`${src}: failed to load`));
    document.head.append(script);
  });
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

const powerScreen = document.getElementById("power-screen");
const powerButton = document.getElementById("power-button");

// The guest display as the VM generator built it (tools/vm/display.ts): its depth, VRAM
// size, the mode in the saved state, and the limits on the sizes it can switch to.
const guestDisplay = await fetchJson("/public/vm/modes.json");

// Every other file under /public/vm is fetched at a URL carrying its content hash from
// manifest.json (tools/site/build.ts), which the host revalidates on every load, so a cached
// copy of one release's file is never served to another release's page. v86 derives the disk
// chunk URLs from the configured one and keeps its query string on each chunk, and its
// download-progress filter below needs ".state." to stay in the state's name.
const manifest = await fetchJson("/manifest.json");
function runtimeUrl(name) {
  const hash = manifest[name];
  if (hash === undefined) throw new Error(`manifest.json: no entry for ${name}`);
  return `/public/vm/${name}?v=${hash}`;
}

await loadClassicScript(runtimeUrl("libv86.js"));

const emulator = new V86({
  wasm_path: runtimeUrl("v86.wasm"),
  memory_size: 64 * 1024 * 1024,
  vga_memory_size: guestDisplay.vgaMemorySize,
  screen_container: document.getElementById("screen_container"),
  bios: { url: runtimeUrl("seabios.bin") },
  vga_bios: { url: runtimeUrl("vgabios.bin") },
  hda: {
    url: runtimeUrl("hda/.img"),
    size: 471859200,
    async: true,
    fixed_chunk_size: 256 * 1024,
    use_parts: true,
  },
  hdb: {
    url: runtimeUrl("hdb/.img"),
    size: 8257536,
    async: true,
    fixed_chunk_size: 128 * 1024,
    use_parts: true,
  },
  // The state also carries every disk block the boot after it reads (tools/vm/snapshot.ts),
  // so pressing power reads no chunk over the network.
  initial_state: {
    url: runtimeUrl("win95-netscape.state.bin.zst"),
  },
  disable_mouse: true,
  network_relay_url: "fetch",
  // The guest's NE2000 driver keeps the MAC from the saved state; without this,
  // v86 randomises the card's MAC on load and drops every frame sent to the guest.
  preserve_mac_from_state_image: true,
  autostart: false,
});

window.emulator = emulator;

// Restoring the state re-announces the SB16 playback (the startup sound), which enables
// v86's speaker DAC, and v86 pauses its audio only when a running machine stops; so the
// speaker would pull samples from the powered-off machine, moving the guest's DMA ring and
// raising its end-of-block interrupt before the guest runs. The guest then refills the half
// the card is about to play, losing the sound's start and racing the card on every block.
// The DAC stays off until the power press runs the machine.
emulator.add_listener("emulator-loaded", () => {
  emulator.speaker_adapter.dac.enabled = false;
});

// Guest HTTP from Netscape arrives through the network adapter's fetch hook,
// which v86 creates asynchronously, just before it announces "emulator-loaded".
emulator.add_listener("emulator-loaded", () => {
  emulator.network_adapter.fetch = guestHttpFetch;
});

// Opens a URL in the visitor's browser and leaves Netscape on its page.
function openInHostBrowser(url) {
  // The "noopener" feature makes window.open return null even on success, so
  // the refusal check needs the handle; the opener link is cut by hand.
  const opened = window.open(url, "_blank");
  if (opened) {
    opened.opener = null;
  } else {
    window.location.assign(url);
  }
}

// The guest sites' code loads in the background (preload, below), or when Netscape first asks for
// a site before that has finished.

// http://github.com/ is answered from GitHub's API and raw files (guest-github.js), with its
// Markdown parser.
let githubSite;
function github() {
  githubSite ??= Promise.all([import("./guest-github.js"), highlighter()]).then(([{ GitHubSite }, highlighter]) => new GitHubSite({ fetch: (url) => fetch(url), openHost: openInHostBrowser, highlighter }));
  return githubSite;
}

// http://en.wikipedia.org/ is answered from Wikipedia's public API (guest-wikipedia.js).
let wikipediaSite;
function wikipedia() {
  wikipediaSite ??= Promise.all([import("./guest-wikipedia.js"), highlighter()]).then(([{ WikipediaSite }, highlighter]) => new WikipediaSite({ fetch: (url) => fetch(url), openHost: openInHostBrowser, highlighter }));
  return wikipediaSite;
}

// One syntax highlighter for the sites that show code, so Shiki and each grammar load once.
let sharedHighlighter;
function highlighter() {
  sharedHighlighter ??= import("./guest-highlight.js").then(({ Highlighter }) => new Highlighter());
  return sharedHighlighter;
}

// http://news.ycombinator.com/ is answered from the Hacker News API (guest-hn.js).
let hackerNewsSite;
function hackerNews() {
  hackerNewsSite ??= import("./guest-hn.js").then(({ HackerNewsSite }) => new HackerNewsSite({ fetch: (url) => fetch(url), openHost: openInHostBrowser }));
  return hackerNewsSite;
}

// The images of the guest's home page, by runtime file name, fetched once.
const guestImages = new Map();
function guestImage(name) {
  if (!guestImages.has(name)) {
    guestImages.set(
      name,
      fetch(runtimeUrl(name)).then(async (res) => {
        if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
        return new Uint8Array(await res.arrayBuffer());
      }),
    );
  }
  return guestImages.get(name);
}

/**
 * Grammars loaded ahead of the first code page: the languages of the repositories the desktop
 * shortcuts and bookmarks open (water-rs/waterui, torvalds/linux), and the most common others.
 */
const PRELOADED_LANGUAGES = ["rust", "toml", "kotlin", "swift", "python", "wgsl", "c", "cpp", "asm", "make", "shellscript", "javascript", "typescript", "json"];

// Once the machine's state is in (the power button is ready), everything Netscape may ask the
// page for next loads in the background, concurrently: the guest sites' code, the highlighter
// with its engine, theme and common grammars, and the home page's images.
emulator.add_listener("emulator-loaded", () => {
  Promise.all([github(), wikipedia(), hackerNews(), highlighter().then((h) => h.preload(PRELOADED_LANGUAGES)), ...Object.values(GUEST_IMAGES).map(guestImage)]);
});

async function guestHttpFetch(input) {
  const parsed = new URL(typeof input === "string" ? input : input.url);
  const host = parsed.hostname.toLowerCase();
  if (host === "news.ycombinator.com" || host === "www.news.ycombinator.com") {
    return (await hackerNews()).handle(parsed);
  }
  if (host === "github.com" || host === "www.github.com") {
    return (await github()).handle(parsed);
  }
  if (host === "en.wikipedia.org" || host === "wikipedia.org" || host === "www.wikipedia.org") {
    return (await wikipedia()).handle(parsed);
  }
  if (host === "lexo.cool" || host === "www.lexo.cool") {
    const pathKey = parsed.pathname === "" || parsed.pathname === "/index.html" ? "/" : parsed.pathname;
    const mailAddress = mailAddressOf(parsed.pathname);
    if (mailAddress !== undefined) {
      // Netscape stays on its page; the visitor's own mail client gets the address.
      window.location.assign(`mailto:${mailAddress}`);
      return new Response(null, { status: 204, statusText: "No Content" });
    }
    const image = GUEST_IMAGES[pathKey];
    if (image !== undefined) {
      const bytes = await guestImage(image);
      return new Response(bytes, {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": GUEST_IMAGE_TYPE, "Content-Length": String(bytes.byteLength) },
      });
    }
    const html = PAGES[pathKey];
    const found = html !== undefined;
    const bytes = new TextEncoder().encode(
      found ? html : wrapHtml32("404 Not Found", "404 Not Found", `<P>No page at <TT>${pathKey}</TT>. <A HREF="http://lexo.cool/">Return home</A>.`)
    );
    return new Response(bytes, {
      status: found ? 200 : 404,
      statusText: found ? "OK" : "Not Found",
      headers: {
        "Content-Type": "text/html",
        "Content-Length": String(bytes.byteLength),
      },
    });
  }

  // Any other host: open it in the visitor's browser and keep Netscape on its page.
  const externalUrl = `https://${host}${parsed.pathname}${parsed.search}`;
  openInHostBrowser(externalUrl);
  return new Response(null, { status: 204, statusText: "No Content" });
}


// =========================================================================
// 2b. Custom Pointer & Touch Input Bridge (Fixes v86 outside-click & PS/2 bugs)
// =========================================================================
const screenContainer = document.getElementById("screen_container");
let pointerButtons = [false, false, false]; // [left, middle, right]
let lastClientX = null;
let lastClientY = null;

function sendGuestPointer(clientX, clientY, buttonsChanged) {
  if (!emulator || !emulator.bus) return;
  const rect = screenContainer.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  let dx = 0;
  let dy = 0;
  if (lastClientX !== null && lastClientY !== null) {
    dx = clientX - lastClientX;
    dy = clientY - lastClientY;
  }
  lastClientX = clientX;
  lastClientY = clientY;

  // VBMOUSE needs a tiny PS/2 movement packet (IRQ 12) to wake up and read the 0x5658 absolute queue!
  const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
  const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
  emulator.bus.send("mouse-absolute", [x, y, rect.width, rect.height]);
  if (dx !== 0 || dy !== 0) {
    emulator.bus.send("mouse-delta", [dx, -dy]);
  }
  if (buttonsChanged) {
    emulator.bus.send("mouse-click", [pointerButtons[0], pointerButtons[1], pointerButtons[2]]);
  }
}

function releaseAllPointerButtons() {
  if (pointerButtons[0] || pointerButtons[1] || pointerButtons[2]) {
    pointerButtons = [false, false, false];
    if (emulator && emulator.bus) {
      emulator.bus.send("mouse-click", [false, false, false]);
    }
  }
}

// Touch follows the iPadOS gestures, and only the primary touch counts:
//   tap                      left click
//   swipe                    scrolls the guest window under the finger (momentum after release)
//   long press, lift         right click
//   long press, then move    left-button drag from the long-press point
// Scrolling goes to RESCHG.EXE over COM1, which finds the scrollable window at the point.
const LONG_PRESS_MS = 500;
const LONG_PRESS_SLOP_PX = 8;
const SCROLL_LINE_GUEST_PX = 32; // guest pixels Netscape scrolls per line
const MOMENTUM_TAU_MS = 325; // velocity decay time constant
const MOMENTUM_MIN_GUEST_PX_PER_S = 30;
const VELOCITY_WINDOW_MS = 100; // finger samples that define the release velocity
let guestSize = null; // [w, h] of the guest screen
let touchId = null;
// pending: down, undecided; held: long press fired; drag: long press then moved; scroll: swiped
let touch = null; // { mode, x, y, timer, samples, accX, accY }
let momentum = null; // { frame, x, y, vx, vy, accX, accY, last } guest px and guest px/s
let scrollFrame = null; // animation frame flushing the accumulated scroll

function guestPoint(clientX, clientY) {
  const rect = screenContainer.getBoundingClientRect();
  return [
    Math.round(((clientX - rect.left) / rect.width) * guestSize[0]),
    Math.round(((clientY - rect.top) / rect.height) * guestSize[1]),
  ];
}

function guestPerClientPx() {
  return guestSize[0] / screenContainer.getBoundingClientRect().width;
}

function clickAt(clientX, clientY, button) {
  pointerButtons = [false, false, false];
  sendGuestPointer(clientX, clientY, false);
  pointerButtons[button] = true;
  sendGuestPointer(clientX, clientY, true);
  pointerButtons[button] = false;
  sendGuestPointer(clientX, clientY, true);
}

// Moves `acc` (guest px, positive scrolls down or right) into whole lines for the command.
function sendScroll(command, gx, gy, acc) {
  const lines = Math.trunc(acc / SCROLL_LINE_GUEST_PX);
  if (lines !== 0) emulator.serial0_send(`${command} ${gx} ${gy} ${lines}\n`);
  return acc - lines * SCROLL_LINE_GUEST_PX;
}

function flushScroll() {
  scrollFrame = null;
  const [gx, gy] = guestPoint(touch.startX, touch.startY);
  touch.accY = sendScroll("SCROLL", gx, gy, touch.accY);
  touch.accX = sendScroll("HSCROLL", gx, gy, touch.accX);
}

function stopMomentum() {
  if (!momentum) return;
  cancelAnimationFrame(momentum.frame);
  momentum = null;
}

function stepMomentum(now) {
  const m = momentum;
  const dt = now - m.last;
  m.last = now;
  const decay = Math.exp(-dt / MOMENTUM_TAU_MS);
  m.vx *= decay;
  m.vy *= decay;
  if (Math.hypot(m.vx, m.vy) < MOMENTUM_MIN_GUEST_PX_PER_S) {
    momentum = null;
    return;
  }
  m.accX = sendScroll("HSCROLL", m.x, m.y, m.accX - (m.vx * dt) / 1000);
  m.accY = sendScroll("SCROLL", m.x, m.y, m.accY - (m.vy * dt) / 1000);
  m.frame = requestAnimationFrame(stepMomentum);
}

// Starts momentum from the finger's velocity over the last VELOCITY_WINDOW_MS, in guest px/s.
function startMomentum(t, now) {
  const recent = t.samples.filter((s) => now - s.t <= VELOCITY_WINDOW_MS);
  if (recent.length < 2) return;
  const first = recent[0];
  const last = recent[recent.length - 1];
  const seconds = (last.t - first.t) / 1000;
  if (seconds <= 0) return;
  const k = guestPerClientPx();
  const [x, y] = guestPoint(t.startX, t.startY);
  momentum = {
    x,
    y,
    vx: ((last.x - first.x) * k) / seconds,
    vy: ((last.y - first.y) * k) / seconds,
    accX: t.accX,
    accY: t.accY,
    last: now,
  };
  momentum.frame = requestAnimationFrame(stepMomentum);
}

function touchDown(e) {
  stopMomentum();
  touchId = e.pointerId;
  screenContainer.setPointerCapture(e.pointerId);
  // The guest must have the pointer at the finger before a button event reaches it, or it
  // presses where the pointer was; the time until the tap, long press or drag covers that.
  sendGuestPointer(e.clientX, e.clientY, false);
  touch = { mode: "pending", x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, accX: 0, accY: 0, samples: [] };
  touch.timer = setTimeout(() => {
    touch.mode = "held";
  }, LONG_PRESS_MS);
}

function touchMove(e) {
  const t = touch;
  const moved = Math.hypot(e.clientX - t.startX, e.clientY - t.startY) > LONG_PRESS_SLOP_PX;
  if (t.mode === "pending" && moved) {
    clearTimeout(t.timer);
    t.mode = "scroll";
  } else if (t.mode === "held" && moved) {
    t.mode = "drag";
    sendGuestPointer(t.startX, t.startY, false);
    pointerButtons[0] = true;
    sendGuestPointer(t.startX, t.startY, true);
  }
  if (t.mode === "drag") {
    sendGuestPointer(e.clientX, e.clientY, false);
  } else if (t.mode === "scroll") {
    const k = guestPerClientPx();
    t.accX -= (e.clientX - t.x) * k;
    t.accY -= (e.clientY - t.y) * k;
    t.samples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
    scrollFrame ??= requestAnimationFrame(flushScroll);
  }
  t.x = e.clientX;
  t.y = e.clientY;
}

function touchEnd(e) {
  const t = touch;
  touchId = null;
  touch = null;
  clearTimeout(t.timer);
  if (scrollFrame !== null) {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = null;
  }
  if (e.type === "pointercancel") {
    releaseAllPointerButtons();
    return;
  }
  if (t.mode === "pending") {
    clickAt(e.clientX, e.clientY, 0);
  } else if (t.mode === "held") {
    clickAt(t.startX, t.startY, 2);
  } else if (t.mode === "drag") {
    pointerButtons[0] = false;
    sendGuestPointer(e.clientX, e.clientY, true);
  } else {
    t.x = e.clientX;
    t.y = e.clientY;
    startMomentum(t, e.timeStamp);
  }
}

screenContainer.addEventListener("pointerdown", (e) => {
  window.focus();
  e.preventDefault();
  if (e.pointerType === "touch") {
    if (e.isPrimary) touchDown(e);
    return;
  }
  screenContainer.setPointerCapture(e.pointerId);
  if (e.button === 0) pointerButtons[0] = true;
  else if (e.button === 1) pointerButtons[1] = true;
  else if (e.button === 2) pointerButtons[2] = true;
  sendGuestPointer(e.clientX, e.clientY, true);
});

screenContainer.addEventListener("pointermove", (e) => {
  if (e.pointerType === "touch") {
    if (e.pointerId === touchId) touchMove(e);
    return;
  }
  // Sync button state from e.buttons bitmask in case the release happened outside the window
  const left = (e.buttons & 1) !== 0;
  const right = (e.buttons & 2) !== 0;
  const middle = (e.buttons & 4) !== 0;
  const changed =
    left !== pointerButtons[0] ||
    middle !== pointerButtons[1] ||
    right !== pointerButtons[2];
  pointerButtons = [left, middle, right];
  sendGuestPointer(e.clientX, e.clientY, changed);
});

function endPointer(e) {
  if (e.pointerType === "touch") {
    if (e.pointerId === touchId) touchEnd(e);
    return;
  }
  if (e.type === "pointercancel") {
    releaseAllPointerButtons();
    return;
  }
  const idx = e.button === 0 ? 0 : e.button === 1 ? 1 : 2;
  if (pointerButtons[idx]) {
    pointerButtons[idx] = false;
    sendGuestPointer(e.clientX, e.clientY, true);
  }
}
screenContainer.addEventListener("pointerup", endPointer);
screenContainer.addEventListener("pointercancel", endPointer);

window.addEventListener("blur", releaseAllPointerButtons);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) releaseAllPointerButtons();
});

screenContainer.addEventListener("contextmenu", (e) => e.preventDefault());

// The wheel scrolls like a swipe, through RESCHG.EXE at the wheel's point. Sent as mouse
// input instead, it reaches VBMOUSE.DRV, which scrolls from inside its mouse interrupt
// callback; the USER calls it makes there re-enter whatever program the interrupt stopped,
// which then dies with "This program has performed an illegal operation" or hangs Windows.
const wheelAcc = { x: 0, y: 0 }; // guest px not yet sent as whole lines
screenContainer.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    if (!powered) return;
    const guestPx =
      e.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? guestPerClientPx()
      : e.deltaMode === WheelEvent.DOM_DELTA_LINE ? SCROLL_LINE_GUEST_PX
      : guestSize[1];
    const [gx, gy] = guestPoint(e.clientX, e.clientY);
    wheelAcc.y = sendScroll("SCROLL", gx, gy, wheelAcc.y + e.deltaY * guestPx);
    wheelAcc.x = sendScroll("HSCROLL", gx, gy, wheelAcc.x + e.deltaX * guestPx);
  },
  { passive: false }
);

// The ring follows the saved state, which is nearly all of the download; the files before it
// are small and finish first, so summing them would fill the ring and then drain it.
emulator.add_listener("download-progress", (e) => {
  if (e && e.total > 0 && /\.state\./.test(e.file_name)) {
    powerButton.style.setProperty("--progress", Math.min(100, (e.loaded / e.total) * 100));
  }
});

// =========================================================================
// 3. Automatic Native Resolution Sync via COM1 -> RESCHG.EXE
// =========================================================================
const monitorFrame = document.getElementById("monitor-frame");
let powered = false;
// RESCHG.EXE listens on COM1 in the saved state: the generator only emits modes.json
// after seeing it ready before the snapshot, and it resets the UART when it starts.
if (guestDisplay.reschgInState !== true) throw new Error("modes.json: RESCHG.EXE is not running in the saved state");
let requestedMode = null;

// The frame always takes the guest screen's own aspect ratio, so pixels stay square.
emulator.add_listener("screen-set-size", ([w, h, bpp]) => {
  if (bpp === 0) return; // text mode: columns and rows
  guestSize = [w, h];
  monitorFrame.style.width = `min(100dvw, calc(100dvh * ${w} / ${h}))`;
  monitorFrame.style.height = `min(100dvh, calc(100dvw * ${h} / ${w}))`;
});

function syncGuestResolution() {
  if (!powered) return;
  // The viewport's own size, up to the snapshot mode's pixel count (guest-display.js).
  const [w, h] = guestModeFor(guestDisplay, window.visualViewport.width, window.visualViewport.height);
  if (requestedMode && requestedMode[0] === w && requestedMode[1] === h) return;
  requestedMode = [w, h];
  emulator.serial0_send(`RES ${w} ${h}\n`);
}

// RESCHG.EXE answers each switch with RESCHG_OK or RESCHG_ERR.
let serialLine = "";
emulator.add_listener("serial0-output-byte", (byte) => {
  const c = String.fromCharCode(byte);
  if (c !== "\n") {
    serialLine += c;
    return;
  }
  const line = serialLine;
  serialLine = "";
  if (line === "RESCHG_ERR") {
    console.error(`RESCHG.EXE could not switch the guest to ${requestedMode.join("x")}`);
  }
});

function scheduleResolutionSync() {
  clearTimeout(scheduleResolutionSync.timer);
  scheduleResolutionSync.timer = setTimeout(syncGuestResolution, 180);
}
window.addEventListener("resize", scheduleResolutionSync);
window.visualViewport.addEventListener("resize", scheduleResolutionSync);

function powerOn() {
  powerScreen.hidden = true;
  emulator.speaker_adapter.dac.enabled = true;
  emulator.run();
  powered = true;
  syncGuestResolution();
  // A press made before v86 created its speaker had no audio context to unlock; the
  // visitor's next press inside the machine does it, and the sound starts then.
  const audio = emulator.speaker_adapter.audio_context;
  if (audio.state !== "running") {
    const unlock = () => audio.resume();
    screenContainer.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
  }
}

emulator.add_listener("emulator-loaded", () => {
  powerButton.style.setProperty("--progress", 100);
  if (powerScreen.dataset.state === "pending") {
    powerOn();
  } else {
    powerScreen.dataset.state = "ready";
  }
});

// The press itself unlocks audio: a ready machine runs inside it, and a press during loading
// resumes the speaker's audio context there. v86 creates the speaker only after the wasm and
// BIOS downloads, so a press before that has no context to resume (powerOn handles that).
powerButton.addEventListener("click", (e) => {
  e.stopPropagation();
  const state = powerScreen.dataset.state;
  if (state === "pending") return;
  if (state === "ready") {
    powerOn();
    return;
  }
  powerScreen.dataset.state = "pending";
  powerButton.setAttribute("aria-label", "Starting\u2026");
  emulator.speaker_adapter?.audio_context.resume();
});

// =========================================================================
// 4. Power-off: after Start -> Shut Down, WIN.COM asks the BIOS for an APM power-off,
//    which halts the CPU with interrupts disabled; v86 reports that as
//    "cpu-event-halt". Restart resets the machine and MS-DOS mode returns to a
//    prompt, so neither raises it.
// =========================================================================
const offScreen = document.getElementById("off-screen");
emulator.add_listener("cpu-event-halt", async () => {
  await emulator.stop();
  window.close();
  // A tab the page did not open stays open; tell the user instead.
  offScreen.hidden = false;
});
offScreen.addEventListener("click", () => location.reload());
offScreen.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") location.reload();
});
