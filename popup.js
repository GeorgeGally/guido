const injectable = value => {
  try {
    const url = new URL(value);
    return ["http:", "https:", "file:"].includes(url.protocol) && url.hostname !== "chromewebstore.google.com" && !(url.hostname === "chrome.google.com" && url.pathname.startsWith("/webstore"));
  } catch {
    return false;
  }
};
const send = async message => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) return false;
    try { await chrome.tabs.sendMessage(tab.id, message); return true; } catch {}
    if (!injectable(tab.url)) return false;
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      await chrome.tabs.sendMessage(tab.id, message);
      return true;
    } catch { return false; }
  } catch { return false; }
};

const rulersButton = document.querySelector("#rulers");
const guidesButton = document.querySelector("#guides");
const mirrorButton = document.querySelector("#mirror");
const separateInput = document.querySelector("#separate");
const swatches = [...document.querySelectorAll(".swatch")];
let rulersEnabled = false;
let guidesVisible = true;
let mirrorEnabled = false;
let palette = "orange";

const render = () => {
  rulersButton.setAttribute("aria-pressed", String(rulersEnabled));
  guidesButton.setAttribute("aria-pressed", String(guidesVisible));
  mirrorButton.setAttribute("aria-pressed", String(mirrorEnabled));
  swatches.forEach(swatch => swatch.setAttribute("aria-pressed", String(swatch.dataset.palette === palette)));
};

rulersButton.addEventListener("click", async () => {
  if (await send({ type: "toggle" })) { rulersEnabled = !rulersEnabled; render(); }
});
guidesButton.addEventListener("click", async () => {
  if (await send({ type: "toggle-guides" })) { guidesVisible = !guidesVisible; render(); }
});
mirrorButton.addEventListener("click", async () => {
  if (await send({ type: "toggle-mirror" })) { mirrorEnabled = !mirrorEnabled; render(); }
});
document.querySelector("#clear").addEventListener("click", () => send({ type: "clear-guides" }));
separateInput.addEventListener("change", () => {
  chrome.storage.local.set({ separate: separateInput.checked });
  send({ type: "set-separate", separate: separateInput.checked });
});
swatches.forEach(swatch => swatch.addEventListener("click", () => {
  palette = swatch.dataset.palette;
  chrome.storage.local.set({ palette });
  send({ type: "set-palette", palette });
  render();
}));

chrome.storage.local.get(["overlayEnabled", "guidesVisible", "separate", "mirror", "palette", "guideColor"], result => {
  rulersEnabled = result.overlayEnabled === true;
  guidesVisible = result.guidesVisible !== false;
  mirrorEnabled = result.mirror === true;
  separateInput.checked = result.separate === true;
  palette = ["orange", "cyan", "pink", "green", "blue"].includes(result.palette) ? result.palette : "orange";
  if (result.palette !== palette) chrome.storage.local.set({ palette });
  if (result.guideColor) chrome.storage.local.remove("guideColor");
  render();
});
