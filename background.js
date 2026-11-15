const injectable = tab => {
  try {
    const url = new URL(tab?.url);
    return ["http:", "https:", "file:"].includes(url.protocol) && url.hostname !== "chromewebstore.google.com" && !(url.hostname === "chrome.google.com" && url.pathname.startsWith("/webstore"));
  } catch {
    return false;
  }
};

async function send(tab, message) {
  if (!tab?.id) return false;
  try {
    await chrome.tabs.sendMessage(tab.id, message);
    return true;
  } catch {}
  if (!injectable(tab)) return false;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    await chrome.tabs.sendMessage(tab.id, message);
    return true;
  } catch {
    return false;
  }
}

// Tabs open before an install, update or reload have no live Guido until they get a fresh copy.
chrome.runtime.onInstalled.addListener(async () => {
  for (const tab of await chrome.tabs.query({})) {
    if (injectable(tab)) chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }).catch(() => {});
  }
});

chrome.commands.onCommand.addListener(async command => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    await send(tab, { type: command === "toggle-overlay" ? "toggle" : command });
  } catch {}
});
