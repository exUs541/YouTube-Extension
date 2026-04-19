// ════════════════════════════════════════════════════════════
// BACKGROUND SERVICE WORKER
// ════════════════════════════════════════════════════════════
//
// Dieser Service Worker läuft im Hintergrund und übernimmt Aufgaben,
// die nicht im Popup ausgeführt werden können.
//
// AKTUELL:
//   - Setzt die Deinstallations-URL, die Chrome öffnet wenn der User
//     die Extension deinstalliert. Die Seite erinnert dann daran,
//     die Einstellungen vorher zu exportieren.
//

// Deinstallations-URL setzen (wird von Chrome beim Deinstallieren geöffnet):
chrome.runtime.setUninstallURL('https://forms.gle/ekH8ym617Pa1zcHD7');
// Hinweis: Wir nutzen hier das Feedback-Formular als Abschiedsseite.
// Du kannst diese URL durch eine eigene HTML-Seite ersetzen falls gewünscht.
