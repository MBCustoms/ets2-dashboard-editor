<div align="center">

# ETS2 Dashboard Editor

**A visual desktop editor for creating custom telemetry dashboard mods for Euro Truck Simulator 2 and American Truck Simulator.**

[![Version](https://img.shields.io/badge/version-0.1.0-blue?style=flat-square)](https://github.com/MBCustoms/ets2-dashboard-editor/releases)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey?style=flat-square&logo=windows)](https://github.com/MBCustoms/ets2-dashboard-editor/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange?style=flat-square&logo=tauri)](https://tauri.app)

[🌐 Website](https://metehanbilal.com) · [📥 Download](https://github.com/MBCustoms/ets2-dashboard-editor/releases/latest) · [📖 Documentation](https://mbcustoms.github.io/ets2-dashboard-editor) · [❤️ Patreon](https://patreon.com/MB3DWorks)

---

*[Türkçe](#türkçe) | [English](#english)*

</div>

---

## English

### What is this?

ETS2 Dashboard Editor lets you design fully custom dashboard mods for **Euro Truck Simulator 2** and **American Truck Simulator** — entirely visually, without writing any code. Drag and drop elements onto a canvas, bind them to live telemetry data, preview on a 3D truck model, and export a game-ready mod ZIP in one click.

### Features

| Feature | Description |
|---------|-------------|
| 🖱️ **Drag & Drop Canvas** | Add, move, resize and layer dashboard elements visually |
| 📡 **Live Telemetry** | Connect to the SCS SDK and see your dashboard update in real-time while driving |
| 🚚 **3D Model Viewer** | Apply your design to a UV-mapped 3D truck model before exporting |
| 🎨 **Custom SVG Support** | Import your own vector graphics and bind them to telemetry channels |
| 📦 **One-Click Mod Export** | Generates a complete game-ready mod ZIP with `dashboard.sii`, textures and fonts |
| 🔄 **SII Import/Export** | Load and edit any existing `dashboard.sii` file |
| ↩️ **Unlimited Undo/Redo** | Full command-history with descriptive labels |
| 🖥️ **Multi-Screen Support** | Manage multiple dashboard screens (100, 800, 900, 950 shared) |
| 📐 **Alignment Tools** | Align, distribute, and snap elements to a configurable grid |
| 🔬 **Simulation Mode** | Test your dashboard with sliders and toggles — no game needed |

### Tech Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Desktop:** Tauri 2 (Rust backend)
- **2D Rendering:** Pixi.js
- **3D Rendering:** Three.js
- **Code Editor:** CodeMirror 6
- **State:** Zustand
- **Drag & Drop:** dnd-kit
- **Styling:** Tailwind CSS

### Download

Download the latest Windows installer from the [Releases page](https://github.com/MBCustoms/ets2-dashboard-editor/releases/latest).

> macOS and Linux builds are planned for a future release.

### Building from Source

#### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (stable toolchain)
- [Tauri CLI v2](https://tauri.app/start/prerequisites/)

```bash
# Clone the repository
git clone https://github.com/MBCustoms/ets2-dashboard-editor.git
cd ets2-dashboard-editor

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build release installer
npm run tauri build
```

The release installer will be generated in `src-tauri/target/release/bundle/`.

### Quick Start

1. Download and install the app.
2. Open **View → Settings** and set your **Game Root Path** (e.g. `C:\...\Euro Truck Simulator 2`).
3. Go to **File → New** to start a blank project.
4. Open the **Library** tab in the left sidebar and drag presets onto the canvas.
5. Select an element and edit its properties in the **Inspector** panel on the right.
6. Switch to **3D view** to preview your design on a truck model.
7. Go to **File → Export mod…** to generate the mod ZIP.
8. Copy the ZIP to `Documents\Euro Truck Simulator 2\mod\` and enable it in the game.

### Project Structure

```
ets2-dashboard-editor/
├── src/                    # React frontend source
│   ├── components/         # UI components
│   ├── store/              # Zustand state management
│   ├── types/              # TypeScript type definitions
│   ├── hooks/              # Custom React hooks
│   └── i18n/               # Translations (EN/TR)
├── src-tauri/              # Tauri / Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri IPC command handlers
│   │   ├── core/           # SII parser, project logic
│   │   └── rendering/      # PNG render engine, DDS/image processing
│   ├── icons/              # App icons
│   └── tauri.conf.json     # Tauri configuration
├── web_landing/            # Landing page (GitHub Pages)
│   ├── index.html
│   ├── documentation.html
│   └── changelog.html
└── public/                 # Static assets
```

### Contributing

Bug reports and feature requests are welcome — please open an [Issue](https://github.com/MBCustoms/ets2-dashboard-editor/issues).

### Support

If this project has been useful to you, consider supporting its development on [Patreon](https://patreon.com/MB3DWorks). Every contribution keeps me motivated.

### License

[MIT](LICENSE) · © 2026 Metehan BİLAL

---

## Türkçe

### Bu nedir?

ETS2 Dashboard Editor, **Euro Truck Simulator 2** ve **American Truck Simulator** için tamamen özel gösterge paneli modları tasarlamanı sağlar — görsel olarak, kod yazmadan. Canvas'a öğeleri sürükle-bırak, canlı telemetri verisiyle bağla, 3D kamyon modelinde önizle ve tek tıkla oyuna hazır mod ZIP olarak dışa aktar.

### Özellikler

| Özellik | Açıklama |
|---------|----------|
| 🖱️ **Sürükle & Bırak Tuval** | Gösterge öğelerini görsel olarak ekle, taşı, yeniden boyutlandır ve katmanla |
| 📡 **Canlı Telemetri** | SCS SDK'ya bağlan ve sürüş sırasında gösterge panosu güncellemelerini gerçek zamanlı gör |
| 🚚 **3D Model Görüntüleyici** | Tasarımını dışa aktarmadan önce UV haritalı 3D kamyon modeline uygula |
| 🎨 **Özel SVG Desteği** | Kendi vektör grafiklerini içe aktar ve telemetri kanallarına bağla |
| 📦 **Tek Tıkla Mod Dışa Aktarma** | `dashboard.sii`, dokular ve fontlarla birlikte tam oyuna hazır mod ZIP'i oluşturur |
| 🔄 **SII İçe/Dışa Aktarma** | Mevcut herhangi bir `dashboard.sii` dosyasını yükle ve düzenle |
| ↩️ **Sınırsız Geri Al/Yinele** | Açıklayıcı etiketlerle tam komut geçmişi |
| 🖥️ **Çoklu Ekran Desteği** | Birden fazla gösterge ekranını yönet (100, 800, 900, 950 paylaşılan) |
| 📐 **Hizalama Araçları** | Öğeleri yapılandırılabilir ızgaraya hizala, dağıt ve yapıştır |
| 🔬 **Simülasyon Modu** | Kaydırıcılar ve geçişlerle dashboard'unu test et — oyuna gerek yok |

### Kaynaktan Derleme

#### Gereksinimler

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (stable)
- [Tauri CLI v2](https://tauri.app/start/prerequisites/)

```bash
# Repoyu klonla
git clone https://github.com/MBCustoms/ets2-dashboard-editor.git
cd ets2-dashboard-editor

# Bağımlılıkları yükle
npm install

# Geliştirme modunda çalıştır
npm run tauri dev

# Release derlemesi
npm run tauri build
```

### Hızlı Başlangıç

1. Uygulamayı indir ve kur.
2. **View → Settings** açıp **Game Root Path**'i ayarla.
3. **File → New** ile yeni proje oluştur.
4. Sol paneldeki **Library** sekmesinden öğeleri canvas'a sürükle.
5. Sağdaki **Inspector** panelinden özellikleri düzenle.
6. **3D görünüme** geç ve tasarımı kamyon modelinde önizle.
7. **File → Export mod…** ile mod ZIP'ini oluştur.
8. ZIP'i `Belgeler\Euro Truck Simulator 2\mod\` klasörüne kopyala ve oyunda etkinleştir.

### Katkı

Hata bildirimi ve öneriler için lütfen bir [Issue](https://github.com/MBCustoms/ets2-dashboard-editor/issues) açın.

### Destek

Destek olmak istersen [Patreon](https://patreon.com/MB3DWorks) üzerinden bir kahve ısmarlayabilirsin. Her katkı güncellemeler için motivasyon sağlıyor.

### Lisans

[MIT](LICENSE) · © 2026 Metehan BİLAL
