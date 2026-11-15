// Loads the unpacked extension in Chrome for Testing and checks that guides render.
// Run: node test/guides-visible.mjs   (CHROME=/path/to/chrome to pick a binary)
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const extensionId = createHash("sha256").update(root).digest("hex").slice(0, 32).replace(/./g, c => String.fromCharCode(97 + parseInt(c, 16)));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const findChrome = () => {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = join(homedir(), "Library/Caches/ms-playwright");
  const builds = existsSync(cache) ? readdirSync(cache).filter(name => /^chromium-\d+$/.test(name)).sort().reverse() : [];
  for (const build of builds) {
    for (const arch of ["chrome-mac-arm64", "chrome-mac"]) {
      const bin = join(cache, build, arch, "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
      if (existsSync(bin)) return bin;
    }
    const linux = join(cache, build, "chrome-linux/chrome");
    if (existsSync(linux)) return linux;
  }
  throw new Error("No Chrome for Testing found; set CHROME. Branded Chrome ignores --load-extension.");
};

const server = createServer((req, res) => {
  const file = join(root, req.url === "/" ? "demo/index.html" : req.url.split("?")[0]);
  if (!file.startsWith(root) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  const types = { xml: "application/xml", svg: "image/svg+xml", txt: "text/plain" };
  res.writeHead(200, { "content-type": types[file.split(".").pop()] || "text/html" }); res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const profile = mkdtempSync(join(tmpdir(), "guido-test-"));
const chrome = spawn(findChrome(), [
  "--headless=new", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0",
  `--user-data-dir=${profile}`, `--disable-extensions-except=${root}`, `--load-extension=${root}`,
  "--window-size=1200,900", "about:blank"
], { stdio: ["ignore", "ignore", "pipe"] });
const wsUrl = await new Promise((resolve, reject) => {
  let log = "";
  chrome.stderr.on("data", chunk => { log += chunk; const match = log.match(/DevTools listening on (ws:\S+)/); if (match) resolve(match[1]); });
  chrome.on("exit", code => reject(new Error(`Chrome exited ${code}\n${log}`)));
});

const ws = new WebSocket(wsUrl);
await new Promise(resolve => ws.addEventListener("open", resolve, { once: true }));
let nextId = 0;
const pending = new Map();
ws.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
    message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
  }
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++nextId; pending.set(id, { resolve, reject });
  setTimeout(() => { if (pending.delete(id)) reject(new Error(`${method} timed out`)); }, 10000);
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});

let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` ${detail}`}`); if (!ok) failures++; };

try {
  const openPopup = async () => {
    let worker;
    for (let i = 0; i < 50 && !worker; i++) {
      const { targetInfos } = await send("Target.getTargets");
      worker = targetInfos.find(target => target.type === "service_worker" && target.url === `chrome-extension://${extensionId}/background.js`);
      if (!worker) await sleep(100);
    }
    if (!worker) throw new Error("extension service worker not found ");
    const { targetId } = await send("Target.createTarget", { url: new URL("popup.html", worker.url).href });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    await sleep(300);
    return sessionId;
  };
  let popup = await openPopup();
  const extension = async expression => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, popup)).result.value;
  const setStorage = values => extension(`chrome.storage.local.clear().then(() => chrome.storage.local.set(${JSON.stringify(values)})).then(() => true)`);

  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId: page } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, page);
  const errors = [];
  ws.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.sessionId !== page) return;
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") errors.push(JSON.stringify(message.params.args));
    if (message.method === "Log.entryAdded" && message.params.entry.level === "error") errors.push(message.params.entry.text);
  });
  await send("Runtime.enable", {}, page);
  await send("Log.enable", {}, page);

  const load = async path => { await send("Page.navigate", { url: origin + path }, page); await sleep(800); };
  const overlay = async () => {
    const { root: doc } = await send("DOM.getDocument", { depth: -1, pierce: true }, page);
    const nodes = [];
    const walk = node => { nodes.push(node); (node.children || []).forEach(walk); (node.shadowRoots || []).forEach(walk); };
    walk(doc);
    const cls = node => { const attrs = node.attributes || []; const i = attrs.indexOf("class"); return i < 0 ? "" : attrs[i + 1]; };
    const id = node => { const attrs = node.attributes || []; const i = attrs.indexOf("id"); return i < 0 ? "" : attrs[i + 1]; };
    const guides = nodes.filter(node => /\bguide\b/.test(cls(node)));
    return {
      rulers: nodes.some(node => id(node) === "top" && !/\bhidden\b/.test(cls(node))),
      rulerSets: nodes.filter(node => id(node) === "top").length,
      guides: guides.length,
      visible: guides.filter(node => !/\bhidden\b/.test(cls(node))).length
    };
  };
  const drag = async (fromX, fromY, toX, toY) => {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: fromX, y: fromY }, page);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: fromX, y: fromY, button: "left", buttons: 1, clickCount: 1 }, page);
    for (let step = 1; step <= 5; step++) await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: fromX + (toX - fromX) * step / 5, y: fromY + (toY - fromY) * step / 5, button: "left", buttons: 1 }, page);
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: toX, y: toY, button: "left", buttons: 0, clickCount: 1 }, page);
    await sleep(200);
  };

  for (const path of ["/", "/test/index.html"]) {
    await setStorage({ overlayEnabled: true, guidesVisible: true, "guides:shared": [{ axis: "v", position: 300 }, { axis: "h", position: 200 }] });
    await load(path);
    let state = await overlay();
    check(`${path} rulers show`, state.rulers, JSON.stringify(state));
    check(`${path} saved guides render`, state.guides === 2 && state.visible === 2, JSON.stringify(state));
    await drag(500, 10, 500, 400);
    state = await overlay();
    check(`${path} dragging from the ruler adds a visible guide`, state.guides === 3 && state.visible === 3, JSON.stringify(state));
  }

  // Guides hidden (Alt+Shift+R or "Guides visible" off) is remembered across sessions.
  // Dragging a new guide out of a ruler must bring the guides back, not create an invisible one.
  await setStorage({ overlayEnabled: true, guidesVisible: false, "guides:shared": [{ axis: "v", position: 300 }] });
  await load("/");
  let state = await overlay();
  check("hidden guides stay hidden on load", state.guides === 1 && state.visible === 0, JSON.stringify(state));
  await drag(500, 10, 500, 400);
  state = await overlay();
  check("dragging from the ruler while hidden shows every guide", state.guides === 2 && state.visible === 2, JSON.stringify(state));
  check("guides visible is saved", (await extension("chrome.storage.local.get('guidesVisible').then(r => r.guidesVisible)")) === true);

  await setStorage({ overlayEnabled: true, guidesVisible: false, "guides:shared": [] });
  await load("/");
  await drag(8, 10, 400, 300);
  state = await overlay();
  check("dragging from the corner while hidden shows the new pair", state.guides === 2 && state.visible === 2, JSON.stringify(state));

  // Sitemaps, SVG files and plain text are not HTML pages: Guido must stay out and log nothing.
  await setStorage({ overlayEnabled: true, guidesVisible: true, "guides:shared": [{ axis: "v", position: 300 }] });
  for (const path of ["/test/sitemap.xml", "/test/image.svg", "/test/plain.txt", "/"]) {
    errors.length = 0;
    await load(path);
    await extension(`chrome.tabs.query({}).then(tabs => Promise.all(tabs.filter(tab => tab.url.startsWith(${JSON.stringify(origin)})).map(tab => chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }).catch(e => String(e))))).then(() => true)`);
    await sleep(300);
    check(`${path} loads without errors`, errors.length === 0, JSON.stringify(errors));
  }

  // Reloading Guido (chrome://extensions reload button) cuts off the copy running in open tabs.
  // That copy must remove itself instead of throwing "Extension context invalidated", and the tab gets a live copy.
  await setStorage({ overlayEnabled: true, guidesVisible: true, "guides:shared": [{ axis: "v", position: 300 }] });
  await load("/");
  errors.length = 0;
  const { targetId: extensionsPage } = await send("Target.createTarget", { url: "chrome://extensions" });
  const { sessionId: extensions } = await send("Target.attachToTarget", { targetId: extensionsPage, flatten: true });
  await sleep(1000);
  await send("Runtime.evaluate", { expression: "chrome.developerPrivate.updateProfileConfiguration({ inDeveloperMode: true })", awaitPromise: true }, extensions);
  await send("Runtime.evaluate", { expression: `chrome.developerPrivate.reload(${JSON.stringify(extensionId)}, { failQuietly: true })`, awaitPromise: true }, extensions);
  await send("Target.closeTarget", { targetId: extensionsPage });
  await sleep(1000);
  popup = await openPopup();
  await send("Target.activateTarget", { targetId });
  await sleep(200);
  await send("Emulation.setDeviceMetricsOverride", { width: 1000, height: 800, deviceScaleFactor: 1, mobile: false }, page);
  await send("Emulation.clearDeviceMetricsOverride", {}, page);
  await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 400, y: 300, deltaX: 0, deltaY: 200 }, page);
  await drag(500, 10, 500, 400);
  await sleep(300);
  state = await overlay();
  check("after reloading Guido an open tab logs no errors", errors.length === 0, JSON.stringify(errors));
  check("after reloading Guido an open tab has one live set of rulers", state.rulerSets === 1 && state.rulers && state.guides === 2, JSON.stringify(state));
} catch (error) {
  console.error(error); failures++;
} finally {
  ws.close(); chrome.kill(); server.close();
  await sleep(300); rmSync(profile, { recursive: true, force: true });
}
process.exit(failures ? 1 : 0);
