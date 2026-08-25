#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // SQLite do catálogo/outbox e store da sessão. O SQL cru e as chaves
        // ficam no frontend (@nerp/core/sqlite, tauri-session-storage); aqui só
        // registramos os plugins para as APIs ficarem disponíveis na webview.
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o app Tauri");
}
