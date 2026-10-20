async function toggle(tab) {
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "toggle" });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    await chrome.tabs.sendMessage(tab.id, { type: "toggle" });
  }
}

chrome.commands.onCommand.addListener(async command => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (command === "toggle-overlay") return toggle(tab);
  if (!tab?.id) return;
  try { await chrome.tabs.sendMessage(tab.id, { type: command }); }
  catch { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }); chrome.tabs.sendMessage(tab.id, { type: command }); }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "toggle-from-popup") toggle(sender.tab);
});
