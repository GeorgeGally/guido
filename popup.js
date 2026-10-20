const send = async message => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return;
  try { await chrome.tabs.sendMessage(tab.id, message); }
  catch { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }); await chrome.tabs.sendMessage(tab.id, message); }
};
document.querySelector("#toggle").addEventListener("click", () => send({ type: "toggle" }));
document.querySelector("#clear").addEventListener("click", () => send({ type: "clear-guides" }));
document.querySelector("#color").addEventListener("input", event => send({ type: "set-color", color: event.target.value }));
