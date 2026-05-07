// ════════════════════════════════════════════════════════════
// BACKGROUND SERVICE WORKER
// ════════════════════════════════════════════════════════════
//
// This service worker runs in the background and handles tasks
// that cannot be executed in the popup or content script.
//
// CURRENTLY:
//   - Sets the uninstallation URL that Chrome opens when the user
//     uninstalls the extension. This page serves as a feedback form.
//

// Set the uninstall URL (opened by Chrome upon uninstallation):
chrome.runtime.setUninstallURL('https://forms.gle/ekH8ym617Pa1zcHD7');
// Note: We are using the feedback form as the farewell page.
// You can replace this URL with your own HTML page if desired.
