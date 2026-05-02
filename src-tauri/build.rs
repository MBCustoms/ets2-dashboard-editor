fn main() {
    let root_ico = std::path::Path::new("../icon.ico");
    let root_png = std::path::Path::new("../icon.png");
    if root_ico.exists() {
        let _ = std::fs::copy(root_ico, "icons/icon.ico");
    }
    if root_png.exists() {
        let _ = std::fs::copy(root_png, "icons/icon.png");
        let _ = std::fs::copy(root_png, "icons/128x128.png");
    }
    tauri_build::build()
}
