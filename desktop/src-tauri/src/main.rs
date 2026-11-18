// CT Gruppenhierarchie – Desktop-App (Tauri).
// Zeigt die Weboberfläche aus web/ in einem eigenen Fenster. Anfragen an CT laufen über das
// HTTP-Plugin, damit die CORS-Regel des Browsers nicht greift (keine Freigabe durch einen
// CT-Admin nötig). Links zu CT öffnen sich im normalen Browser (Opener-Plugin).

// Unter Windows kein zusätzliches Konsolenfenster öffnen
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("CT Gruppenhierarchie konnte nicht gestartet werden");
}
