import type { TranslationMap } from "./en";

const tr: TranslationMap = {
  // ── Uygulama ──
  app_title: "ETS2 Dashboard Editörü",

  // ── Menüler ──
  menu_file: "Dosya",
  menu_view: "Görünüm",
  menu_help: "Yardım",

  // Dosya menüsü
  file_new: "Yeni proje\u2026",
  file_open: "Aç\u2026",
  file_save: "Kaydet",
  file_save_as: "Farklı kaydet\u2026",
  file_canvas_size: "Tuval boyutu\u2026",
  file_import_sii: "SII içe aktar\u2026",
  file_import_templates: "Şablonları içe aktar\u2026",
  file_export_mod: "Modu dışa aktar\u2026",

  // Görünüm menüsü
  view_sii_preview: "SII önizleme\u2026",
  view_settings: "Ayarlar\u2026",

  // Yardım menüsü
  help_documentation: "Belgelendirme\u2026",
  help_about: "Hakkında\u2026",

  // ── Üst araç çubuğu ──
  toolbar_undo: "Geri al",
  toolbar_redo: "İleri al",
  toolbar_cut: "Kes",
  toolbar_copy: "Kopyala",
  toolbar_paste: "Yapıştır",
  toolbar_screen: "Ekran",
  toolbar_grid: "Izgara",
  toolbar_size: "Boyut",
  toolbar_snap: "Yapıştır",
  undo_nothing: "Geri alınacak bir şey yok",
  redo_nothing: "İleri alınacak bir şey yok",
  undo_history: "Geçmiş",
  redo_next: "Sonraki",

  // ── Durum çubuğu ──
  status_origin: "başlangıç sol-alt",
  status_zoom: "Yakınlık",
  status_selected: "Seçili",
  status_file: "Dosya",
  status_unsaved: "(kaydedilmemiş)",
  status_modified: "Değiştirildi",
  status_saved: "Kaydedildi",

  // ── Ortak düğmeler ──
  btn_close: "Kapat",
  btn_cancel: "İptal",
  btn_save: "Kaydet",
  btn_create: "Oluştur",
  btn_browse: "Gözat\u2026",
  btn_remove: "Kaldır",
  btn_add_folder: "Klasör ekle\u2026",

  // ── Kaydedilmemiş değişiklikler ──
  unsaved_exit: "Kaydedilmemiş değişiklikler var. Kaydetmeden çıkmak istiyor musunuz?",

  // ── Hakkında iletişim kutusu ──
  about_description: "Euro Truck Simulator 2 & ATS dashboard modları için görsel editör.",
  about_created_by: "Geliştirici",

  // ── Ayarlar iletişim kutusu ──
  settings_title: "Ayarlar",
  settings_tab_general: "Genel",
  settings_tab_plugin: "Eklenti",
  settings_game_root: "Oyun kurulum dizini",
  settings_game_root_apply: "Mevcut projeye de uygula (sprite seçici / önizleme)",
  settings_mod_workspace: "Mod çalışma klasörleri (isteğe bağlı)",
  settings_mod_workspace_note:
    ".mat, fontlar ve canlı önizleme için oyun yolundan önce çözümlenir.",
  settings_grid_size: "Izgara boyutu",
  settings_default_zoom: "Varsayılan yakınlık",
  settings_snap: "Izgaraya yapıştır",
  settings_autosave: "Otomatik kayıt aralığı (saniye, 0 = kapalı)",
  settings_theme: "Tema",
  settings_theme_dark: "Koyu",
  settings_theme_light: "Açık",
  settings_theme_system: "Sistem",
  settings_language: "Dil",
  settings_recent_files: "Son açılan proje dosyaları",
  settings_persist_note:
    "Tauri uygulama yapılandırma dizininde settings.json olarak saklanır. Izgara, yapıştırma ve yakınlık Kaydet'e basılınca uygulanır.",

  // ── Eklenti bölümü ──
  plugin_title: "SCS Telemetri Eklentisi",
  plugin_desc:
    "Canlı telemetriyi etkinleştirir. eurotrucks2.exe & amtrucks.exe dosyasını seçin ve yükleyin \u2014 scsdashboardeditor.dll oyunun plugins/ klasörüne kopyalanır (DLL dosyasını editör yürütülebilir dosyasının yanına veya geliştirme için proje köküne koyun).",
  plugin_exe_label: "eurotrucks2.exe & amtrucks.exe yolu",
  plugin_install: "Eklentiyi yükle",
  plugin_installed_msg: "Eklenti yüklendi. Etkinleştirmek için ETS2'yi yeniden başlatın.",
  plugin_select_first: "Önce EuroTrucks2.exe dosyasını seçin.",

  // ── Yeni proje iletişim kutusu ──
  new_project_title: "Yeni proje",
  new_project_desc:
    "Elektrik arkaplanlarıyla (id 10 / 20) bir ana ekran (100) ve paylaşılan ekran (950) oluşturur. Dışa aktarma, eski projeler için eksik parçaları ekler.",
  new_project_mod_id: "Mod kimliği",
  new_project_filename: "Dashboard dosya adı (.sii olmadan)",
  new_project_unit_name: "Pencere birim adı",
  new_project_canvas_size: "Tuval boyutu",
  new_project_width: "Genişlik (px)",
  new_project_height: "Yükseklik (px)",

  // ── Mod dışa aktarma iletişim kutusu ──
  export_title: "Modu dışa aktar (ZIP)",
  export_desc:
    "Doğrulamak için dışa aktar'a tıklayın, bir yol seçin, ardından ui/dashboard/*.sii ve ui/template/dashboard_text.*.sii dosyalarını zip köküne yazın (SCS mod düzeni).",
  export_working: "İşleniyor\u2026",
  export_no_project: "Yüklü proje yok.",
  export_run_validate: "Projeyi doğrulamak için dışa aktarın.",
  export_warnings_only: "Doğrulama yalnızca uyarılarla geçti.",
  export_validate_zip: "Doğrula ve ZIP seç\u2026",
  export_wrote: "Yazıldı",
  export_files_to: "dosya hedefine",
  export_warnings: "uyarı",

  // ── Sol kenar çubuğu ──
  sidebar_screens: "Ekranlar",
  sidebar_library: "Kütüphane",
  sidebar_templates: "Şablonlar",
  sidebar_files: "Dosyalar",
  sidebar_telemetry: "Telemetri",
  sidebar_layers: "Katmanlar",

  // ── Oyun kök dizini uyarısı ──
  warning_game_root_title: "Oyun dizini ayarlanmamış",
  warning_game_root_desc:
    "DDS dokular ve fontlar yüklenmeyecek. ETS2/ATS kurulum yolunu Ayarlar \u2192 Oyun dizini'nden ayarlayın.",
  warning_dismiss: "Kapat",

  // ── Tuval araç çubuğu ──
  zoom_out: "Uzaklaştır",
  zoom_in: "Yakınlaştır",
  zoom_level: "Yakınlık seviyesi",
  zoom_actual: "Gerçek piksel (1:1)",
  zoom_fit: "Görünüme sığdır",
  zoom_actual_desc: "Yakınlığı %100'e sıfırlayın ve panı uygun bir varsayılana ayarlayın.",
  zoom_fit_desc: "Tuvali, tüm tahta editör alanına sığacak şekilde ölçeklendirir ve ortalar.",
  layer_label: "Katman",
  bring_forward: "Öne getir",
  bring_forward_desc: "Seçili öğeleri bir katman yukarı taşı (aynı ekranda diğerlerinin önünde çizilir).",
  send_backward: "Arkaya gönder",
  send_backward_desc: "Seçili öğeleri bir katman aşağı taşı (aynı ekranda diğerlerinin arkasında).",
  align_label: "Hizala",
  align_left: "Sola hizala",
  align_left_desc: "Tüm seçili öğelerin sol kenarlarını hizala.",
  align_right: "Sağa hizala",
  align_right_desc: "Tüm seçili öğelerin sağ kenarlarını hizala.",
  align_top: "Üste hizala",
  align_top_desc: "Tüm seçili öğelerin üst kenarlarını hizala.",
  align_bottom: "Alta hizala",
  align_bottom_desc: "Tüm seçili öğelerin alt kenarlarını hizala.",
  align_center_h: "Yatay ortala",
  align_center_h_desc: "Her seçimi yatay aralığı içinde yatay olarak ortala.",
  align_center_v: "Dikey ortala",
  align_center_v_desc: "Her seçimi dikey aralığı içinde dikey olarak ortala.",
  dist_h: "Yatay dağıt",
  dist_h_desc: "Üç veya daha fazla seçili öğenin merkezlerini X ekseninde eşit aralıklara dağıt.",
  dist_v: "Dikey dağıt",
  dist_v_desc: "Üç veya daha fazla seçili öğenin merkezlerini Y ekseninde eşit aralıklara dağıt.",
  show_all: "Tümünü göster",
  show_all_desc: "Aktif ekrandaki tüm öğeleri görünür yap.",
  hide_all: "Tümünü gizle",
  hide_all_desc: "Aktif ekrandaki tüm öğeleri gizle (görünürlük bayrağı).",
  wireframe_on: "Tel kafes görünümü",
  wireframe_on_desc: "Düzen çalışması için yalnızca öğe dikdörtgenlerini çiz.",
  wireframe_off: "Görsel önizleme",
  wireframe_off_desc: "Dokular ve fontlarla tam Rust destekli önizlemeye dön.",
  collision: "Çakışma vurgusu",
  collision_desc: "Aynı katmandaki çakışan öğeleri kırmızıyla vurgula.",
  selection_chrome_show: "Seçim çerçevesini göster",
  selection_chrome_show_desc: "Seçim taslağını, tutamaçları ve etiketleri tekrar göster.",
  selection_chrome_hide: "Seçim çerçevesini gizle",
  selection_chrome_hide_desc: "Sarı taslak, yeniden boyutlandırma tutamaçları ve yüzen ad etiketlerini gizle.",
  uv_no_model: "UV katmanı (model yok)",
  uv_no_model_desc: "3B görüntüleyicide bir model yükleyin; UV haritası otomatik olarak kullanılabilir olur.",
  uv_show: "UV katmanını göster",
  uv_show_desc: "Yüklü 3B modelin UV kenarlarını dashboard tuvali üzerine cyan çizgilerle bindirin.",
  uv_hide: "UV katmanını gizle",
  export_png: "PNG olarak dışa aktar",
  export_png_desc: "Aktif ekranı Rust motoru ile oluşturun ve PNG olarak kaydedin (oyun dizini gerektirir).",
  export_png_no_root: "PNG dışa aktarma için oyun dizinini ayarlayın",
  view_2d: "2B Tuval",
  view_2d_desc: "Dashboard tuval editörünü göster.",
  view_3d: "3B Görüntüleyici",
  view_3d_desc: "Fiziksel dashboard parçası için 3B model görüntüleyiciyi göster.",
  view_split: "Bölünmüş görünüm",
  view_split_desc: "Dashboard tuvalini ve 3B görüntüleyiciyi yan yana göster.",

  // ── Açılış ekranı ──
  splash_loading: "Yükleniyor\u2026",
};

export default tr;
