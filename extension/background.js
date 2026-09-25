/**
 * Trakt to Infuse - Background Service Worker
 * Handles context menu actions.
 */

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "trakt2infuse-open-link",
    title: "Open in Infuse",
    contexts: ["link"],
    targetUrlPatterns: [
      "https://trakt.tv/movies/*",
      "https://trakt.tv/shows/*",
      "https://app.trakt.tv/movies/*",
      "https://app.trakt.tv/shows/*"
    ]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "trakt2infuse-open-link" && info.linkUrl) {
    chrome.tabs.sendMessage(tab.id, {
      action: "openLinkInInfuse",
      url: info.linkUrl
    });
  }
});
