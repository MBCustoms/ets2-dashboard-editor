import { X } from "lucide-react";
import { useState, type ReactElement, type ReactNode } from "react";

type DocSection =
  | "getting-started"
  | "project-files"
  | "canvas-viewport"
  | "view-modes"
  | "element-library"
  | "inspector"
  | "layers"
  | "templates"
  | "telemetry"
  | "model-viewer"
  | "exporting"
  | "settings"
  | "shortcuts";

const NAV: { id: DocSection; label: string }[] = [
  { id: "getting-started", label: "Başlangıç" },
  { id: "project-files", label: "Proje ve dosyalar" },
  { id: "canvas-viewport", label: "Tuval ve görünüm" },
  { id: "view-modes", label: "Görünüm modları" },
  { id: "element-library", label: "Öğe kütüphanesi" },
  { id: "inspector", label: "Denetçi paneli" },
  { id: "layers", label: "Katmanlar" },
  { id: "templates", label: "Şablonlar" },
  { id: "telemetry", label: "Telemetri" },
  { id: "model-viewer", label: "3B model görüntüleyici" },
  { id: "exporting", label: "Dışa aktarma" },
  { id: "settings", label: "Ayarlar" },
  { id: "shortcuts", label: "Klavye kısayolları" },
];

function mono(light: boolean, children: ReactNode): ReactElement {
  return (
    <code
      className={
        light
          ? "rounded bg-slate-100 px-1 font-mono text-xs text-slate-800"
          : "rounded bg-slate-800 px-1 font-mono text-xs text-slate-200"
      }
    >
      {children}
    </code>
  );
}

function H({ light, children }: { light: boolean; children: ReactNode }): ReactElement {
  return (
    <h3
      className={
        light
          ? "mt-6 border-b border-slate-200 pb-1 text-lg font-bold text-slate-900 first:mt-0"
          : "mt-6 border-b border-slate-700 pb-1 text-lg font-bold text-slate-100 first:mt-0"
      }
    >
      {children}
    </h3>
  );
}

function P({ light, children }: { light: boolean; children: ReactNode }): ReactElement {
  return (
    <p className={light ? "mb-3 text-sm leading-relaxed text-slate-800" : "mb-3 text-sm leading-relaxed text-slate-300"}>
      {children}
    </p>
  );
}

export function DocumentationDialog({
  open,
  onClose,
  light,
}: {
  open: boolean;
  onClose: () => void;
  light: boolean;
}): ReactElement | null {
  const [section, setSection] = useState<DocSection>("getting-started");

  const tableTh = light
    ? "border border-slate-300 px-2 py-2 text-left"
    : "border border-slate-700 px-2 py-2 text-left";
  const tableTd = light
    ? "border border-slate-300 px-2 py-2 font-mono text-xs"
    : "border border-slate-700 px-2 py-2 font-mono text-xs";
  const tableTdPlain = light ? "border border-slate-300 px-2 py-2" : "border border-slate-700 px-2 py-2";

  if (!open) return null;

  const shell = light
    ? "flex h-full min-h-0 flex-col border border-slate-300 bg-white text-slate-900"
    : "flex h-full min-h-0 flex-col border border-slate-700 bg-slate-950 text-slate-100";

  const headerBtn =
    light
      ? "rounded border border-slate-400 bg-white p-1.5 text-slate-800 hover:bg-slate-100"
      : "rounded border border-slate-700 bg-slate-900 p-1.5 text-slate-200 hover:bg-slate-800";

  const navBtn = (id: DocSection) =>
    id === section
      ? "w-full rounded bg-emerald-600 px-3 py-2 text-left text-sm font-medium text-white"
      : light
        ? "w-full rounded px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100"
        : "w-full rounded px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800";

  const content = (() => {
    switch (section) {
      case "getting-started":
        return (
          <>
            <H light={light}>Hoş geldiniz</H>
            <P light={light}>
              ETS2 Dashboard Editor, Euro Truck Simulator 2 ve American Truck Simulator için gösterge
              paneli modları oluşturmanızı ve düzenlemenizi sağlayan görsel bir masaüstü uygulamasıdır.
              Gerçek zamanlı önizleme, canlı telemetri desteği ve tek tıkla mod dışa aktarma özelliklerini
              bir arada sunar.
            </P>
            <H light={light}>İlk adımlar</H>
            <P light={light}>
              {mono(light, "File")} menüsünden {mono(light, "New project…")} ile boş bir proje oluşturun veya{" "}
              {mono(light, "Open…")} ile kayıtlı bir {mono(light, ".json")} proje dosyası açın. Sol kenarda ekranlar,
              öğe kütüphanesi ve şablonlar sekmeleri bulunur. Ortadaki tuvalde öğeleri sürükleyip bırakın; sağdaki
              denetçi panelinden özellikleri düzenleyin.
            </P>
          </>
        );
      case "project-files":
        return (
          <>
            <H light={light}>Yeni proje</H>
            <P light={light}>
              {mono(light, "File → New project…")} ile sihirbazı açın. Mod kimliği, tuval boyutu ve başlangıç ekranı
              gibi alanları doldurun; oluşturulan proje bellekte tutulur ve kaydetmediğiniz sürece diske yazılmaz.
            </P>
            <H light={light}>Açma ve kaydetme</H>
            <P light={light}>
              {mono(light, "File → Open…")} veya {mono(light, "Ctrl+O")} ile {mono(light, ".json")} proje dosyası seçin.
              {mono(light, "Save")} / {mono(light, "Ctrl+S")} mevcut yolu kullanır; ilk kayıtta veya{" "}
              {mono(light, "Save as…")} ile hedef dosyayı seçersiniz. Üst çubuktaki dosya yolu ve &quot;Modified&quot;
              etiketi kayıt durumunu gösterir.
            </P>
            <H light={light}>Son kullanılan dosyalar</H>
            <P light={light}>
              {mono(light, "File")} menüsü, son açılan beş dosyayı listeler; birine tıklayarak hızlıca yeniden
              açabilirsiniz. Liste {mono(light, "Ayarlar")} içindeki son dosya yönetimiyle birlikte çalışır.
            </P>
            <H light={light}>Otomatik kayıt</H>
            <P light={light}>
              Ayarlarda otomatik kayıt aralığı sıfırdan büyükse ve projenin diske bağlı bir yolu varsa, düzenlenmemiş
              değişiklikler belirlediğiniz saniye aralığında arka planda {mono(light, ".json")} dosyasına yazılır.
            </P>
          </>
        );
      case "canvas-viewport":
        return (
          <>
            <H light={light}>Tuval nasıl çalışır</H>
            <P light={light}>
              Aktif ekranın öğeleri tuval üzerinde gerçek zamanlı olarak çizilir. Fareyle öğe seçebilir,
              kenar tutamaçlarıyla boyutlandırabilir ve sürükleyerek taşıyabilirsiniz. Kaydırma tekerleği
              yakınlaştırır; yakınlaştırma imlecin altındaki noktayı sabit tutarak kaydırma ile birlikte
              güncellenir.
            </P>
            <H light={light}>Kaydırma ve gezinme</H>
            <P light={light}>
              Orta fare tuşunu basılı tutarak veya {mono(light, "Space")} tuşunu basılı tutup sürükleyerek tuvali
              kaydırabilirsiniz (pan). Üst araç çubuğundaki kaydırıcı ve düğmeler zoom seviyesini ve &quot;Fit to
              viewport&quot; ile tüm tahtayı görünüme sığdırmayı kontrol eder.
            </P>
            <H light={light}>Izgara ve yapıştırma</H>
            <P light={light}>
              Üst başlıktaki {mono(light, "Grid")} onay kutusu ızgarayı açar/kapatır; {mono(light, "Size")} hücre boyutunu
              SCS piksel cinsinden ayarlar ve ayar deposuna yansır. {mono(light, "Snap")} açıkken sürükleme ve
              yeniden boyutlandırma ızgaraya hizalanır.
            </P>
            <H light={light}>SCS koordinatları</H>
            <P light={light}>
              Köken {mono(light, "sol-alt")} köşededir. {mono(light, "coordsL")}/{mono(light, "coordsR")} yatay,
              {mono(light, "coordsT")}/{mono(light, "coordsB")} dikey kenarlardır; {mono(light, "T")} üst,{" "}
              {mono(light, "B")} alt anlamına gelir. Alt bilgi satırı imlecin SCS konumunu ve tuval boyutlarını gösterir.
            </P>
            <H light={light}>UV overlay</H>
            <P light={light}>
              3B görüntüleyicide bir model yüklediğinizde araç çubuğundaki{" "}
              <span className={light ? "font-medium text-cyan-700" : "font-medium text-cyan-300"}>
                UV
              </span>{" "}
              düğmesi etkinleşir. Bu düğme, modelin UV kenarlarını tuvalin üzerine cyan renkte
              bindirerek fiziksel ekran alanlarını referans olarak gösterir: elemanları bu
              çizgilerin içine yerleştirerek oyundaki fiziksel ekranlarla tam hizalı bir
              dashboard tasarlayabilirsiniz. Tiled (0–1 dışına taşan) UV koordinatları otomatik
              olarak {mono(light, "[0,1]")} aralığına katlanır — yani aynı dashboard içeriği
              fiziksel ekran sayısı kadar tekrar eder. Model kaldırıldığında düğme otomatik
              devre dışı kalır.
            </P>
          </>
        );
      case "view-modes":
        return (
          <>
            <H light={light}>Görünüm modlarına genel bakış</H>
            <P light={light}>
              Tuval araç çubuğunun sağ tarafında {mono(light, "2D")}, {mono(light, "3D")} ve {mono(light, "2D|3D")}{" "}
              düğmeleri bulunur. Bu modlar yalnızca orta düzenin nasıl kullanılacağını değiştirir; sol kenar çubuğu ve
              denetçi paneli her zaman erişilebilir kalır.
            </P>
            <H light={light}>2B tuval</H>
            <P light={light}>
              Varsayılan moddur. Tam genişlikte düzenleyiciyi gösterir; öğe yerleştirme ve düzenleme burada yapılır.
            </P>
            <H light={light}>3B görüntüleyici</H>
            <P light={light}>
              Fiziksel gösterge parçası için {mono(light, "GLB")}/{mono(light, "GLTF")}/{mono(light, "OBJ")} modellerini
              yükleyebileceğiniz Three.js sahnesini gösterir. Kapatma düğmesi yoktur; 2B moduna dönerek görünümü
              değiştirirsiniz.
            </P>
            <H light={light}>Bölünmüş görünüm</H>
            <P light={light}>
              Tuvali ve 3B görüntüleyiciyi yan yana gösterir. Her iki görünüm de aynı anda etkindir: 2B tarafta
              düzenleme yaparken 3B tarafta canlı UV doku önizlemesi güncellenir (aşağıdaki 3B bölümüne bakın).
            </P>
          </>
        );
      case "element-library":
        return (
          <>
            <H light={light}>Öğe türleri</H>
            <P light={light}>
              Şema ve ön ayarlar şu temel türleri kullanır: {mono(light, "window")} (çerçeve / arka plan),{" "}
              {mono(light, "group")}, {mono(light, "text")}, {mono(light, "textCommon")}, {mono(light, "textBar")} ve{" "}
              {mono(light, "gauge")}. Her türün SCS tarafında karşılığı vardır; denetçi panelinde alanlar türe göre
              değişir.
            </P>
            <H light={light}>Kütüphaneden tuvala</H>
            <P light={light}>
              Sol kenarda {mono(light, "Library")} sekmesinde ön ayarlar listelenir. Bir öğeyi tuval üzerine
              sürükleyip bıraktığınızda, bıraktığınız konuma yakın yerleştirilir ve seçim yeni öğeye geçer. Ayrıca
              kütüphane içindeki düğmelerle merkeze yerleştirme gibi kısayollar bulunabilir.
            </P>
          </>
        );
      case "inspector":
        return (
          <>
            <H light={light}>Özellik düzenleme</H>
            <P light={light}>
              Sağdaki denetçi, seçili öğenin adını, ebeveyn/çocuk ilişkilerini, görünürlüğü ve metin / gösterge / çubuk
              alanlarını düzenlemenizi sağlar. Koordinat kutuları doğrudan SCS değerlerini değiştirir; değerler
              proje durumuna yazılır ve geri alınabilir.
            </P>
            <H light={light}>Malzeme ve gösterge</H>
            <P light={light}>
              Metin şablonları ve malzeme referansları burada bağlanır. Gösterge türü için açı, değer aralığı, ofset ve{" "}
              {mono(light, "gaugeMaterial")} gibi alanlar düzenlenebilir.
            </P>
          </>
        );
      case "layers":
        return (
          <>
            <H light={light}>Katman paneli</H>
            <P light={light}>
              Sol alt bölümdeki {mono(light, "Layers")} listesi, aktif ekrandaki öğeleri çizim sırasına göre listeler.
              Sürükleyerek sıralamayı değiştirirsiniz; bu işlem öğenin {mono(light, "layer")} numarasını günceller.
              Görünürlük simgeleriyle öğeleri gizleyip gösterebilirsiniz; çarpışma vurgusu açıkken üst üste binen
              kutular kırmızıya boyanabilir.
            </P>
          </>
        );
      case "templates":
        return (
          <>
            <H light={light}>Metin şablonları</H>
            <P light={light}>
              Şablonlar, SCS metin biçimlendirme mini dilinde saklanan adlandırılmış metin parçalarıdır. Projede{" "}
              {mono(light, "templates")} listesinde tutulurlar; öğeler {mono(light, "lookTemplate")} ile bunlara
              bağlanır.
            </P>
            <H light={light}>SII içe aktarma</H>
            <P light={light}>
              {mono(light, "File → Import templates…")} ile bir {mono(light, ".sii")} şablon dosyası seçin; aynı ada
              sahip şablonlar üzerine yazılır, yeniler eklenir.
            </P>
            <H light={light}>Şablon düzenleyici</H>
            <P light={light}>
              {mono(light, "Templates")} sekmesinde CodeMirror tabanlı düzenleyici ile şablon metnini doğrudan
              düzenleyebilirsiniz. Kaydettiğinizde proje güncellenir ve tuval önizlemesi yenilenir.
            </P>
          </>
        );
      case "telemetry":
        return (
          <>
            <H light={light}>Canlı telemetri</H>
            <P light={light}>
              {mono(light, "Telemetry")} sekmesi ve ayarlardaki eklenti bölümü, SCS SDK eklentisi üzerinden oyundan
              veri almanızı sağlar. {mono(light, "eurotrucks2.exe")} veya {mono(light, "amtrucks.exe")} yolunu seçip
              eklentiyi kurduktan sonra oyunu yeniden başlatın; düzenleyici paylaşılan bellekten değerleri okur.
            </P>
            <H light={light}>Simülasyon modu</H>
            <P light={light}>
              Oyun çalışmıyorken bile göstergelerin hareket etmesi için simüle edilmiş değerler kullanılabilir (Telemetry
              panelindeki ilgili anahtar). Bu, düzen ve animasyonları test etmek içindir.
            </P>
          </>
        );
      case "model-viewer":
        return (
          <>
            <H light={light}>Model yükleme</H>
            <P light={light}>
              3B modunda veya bölünmüş görünümde {mono(light, "Model yükle…")} düğmesiyle{" "}
              {mono(light, "GLB")}, {mono(light, "GLTF")} veya {mono(light, "OBJ")} formatında
              bir 3B model seçin. Model yüklendiğinde dashboard görüntüsü otomatik olarak modele
              uygulanır. Yeni proje oluşturduğunuzda yüklü model temizlenir; aynı oturumda başka bir
              dashboard ile devam edebilirsiniz.
            </P>
            <H light={light}>Kontroller</H>
            <P light={light}>
              Sol sürükleme modeli döndürür, sağ sürükleme kaydırır, fare tekerleği yakınlaştırır.
              Dashboard ekranları aydınlatmasız malzeme ile çizilir: yani tasarladığınız renkler
              birebir gözükür, sahne ışıkları modelin ekran yüzeyini karartmaz / renklendirmez.
            </P>
            <H light={light}>Tiled UV ve dokunun uygulanışı</H>
            <P light={light}>
              ETS2 modellerinde aynı dashboard dokusu birden fazla fiziksel ekrana tekrar ederek
              yayılabilir — UV koordinatları {mono(light, "[0,1]")} aralığının dışına taşar. Editör
              bu durumu otomatik algılar ve dokunun {mono(light, "RepeatWrapping")} ile tekrar
              etmesini sağlar; böylece tüm ekranlar aynı dashboard'u gösterir. Dashboard PNG'sinin
              şeffaf arka planı modelde siyah zemine düzleştirilir, bu da ekran aydınlatması
              kapalıyken gerçek bir panelin görünümüyle eşleşir.
            </P>
            <H light={light}>UV haritası ile seçim yapma</H>
            <P light={light}>
              Üstteki {mono(light, "UV Haritası")} düğmesi, modelin UV kenarlarını dashboard
              önizlemenizin üzerine bindiren bir modal açar. Bu görsel üzerinde{" "}
              <strong>sürükleyerek bir alan seçebilirsiniz</strong>: seçilen dikdörtgenin{" "}
              {mono(light, "L")} / {mono(light, "R")} / {mono(light, "T")} / {mono(light, "B")}{" "}
              değerleri SCS koordinatlarında (sol-alt köken) altta listelenir ve her değer
              tıklanınca panoya kopyalanır — doğrudan Inspector kutularına yapıştırabilirsiniz.
              Seçim, tuval çözünürlüğünüz değiştiğinde otomatik olarak sıfırlanır.
            </P>
            <H light={light}>Tuval üzerinde UV overlay</H>
            <P light={light}>
              Tuval araç çubuğundaki{" "}
              <span className={light ? "font-medium text-cyan-700" : "font-medium text-cyan-300"}>
                UV
              </span>{" "}
              düğmesi, model yüklüyken modelin UV kenarlarını dashboard tuvalinin üzerine cyan
              çizgilerle bindirir. 3B görüntüleyiciye girmeden doğrudan 2B moddayken bile
              elemanları fiziksel ekran alanlarına hizalayabilirsiniz. Model kaldırıldığında
              düğme pasifleşir.
            </P>
            <H light={light}>Canvas ↔ model aspect uyumu</H>
            <P light={light}>
              Tuvalinizin en/boy oranı modelin UV bölgesiyle aynı değilse,{" "}
              <strong>
                3B görüntüleyicide yazı ve ikonlar yatay veya dikey yönde gerinmiş görünür
              </strong>{" "}
              — tuvalde doğru boyutta görünseler bile. UV haritası modal'ı, model yüklüyken
              üstte kırmızı bir uyarı bandı ile bunu bildirir ve {mono(light, "Canvas'ı modele uydur…")}{" "}
              düğmesiyle {mono(light, "File → Canvas size…")} diyaloğunu önerilen aspect ile
              doldurarak açar. Diyalogda {mono(light, "Element koordinatlarını orantılı ölçekle")}
              {" "}seçili bırakılırsa mevcut elemanlarınız yeni tuval boyutuna otomatik olarak
              orantılanır. Düzleştirilmiş ({mono(light, "[0,1]²")} içi) UV'lerde öneri doğrudan UV
              kutusunun oranıdır; tiled (örn. {mono(light, "4×1")}) UV'lerde tek bir tile'ın kare
              (1:1) olacağı varsayılır.
            </P>
            <H light={light}>İpucu</H>
            <P light={light}>
              En iyi sonuç için 3B model tasarım yazılımınızda (Blender gibi) UV haritasını
              dashboard boyutlarına göre düzenleyin. Bölünmüş görünümde ({mono(light, "2D|3D")})
              tuvali ve 3B görüntüyü yan yana izleyebilirsiniz; ortadaki ayırıcıyı sürükleyerek
              iki pencerenin genişliğini ayarlayın. Tuval boyutunu istediğiniz zaman{" "}
              {mono(light, "File → Canvas size…")} ile değiştirebilirsiniz; işlem geri al/yinele
              geçmişine yazılır, bu yüzden ters giderse {mono(light, "Ctrl+Z")} ile anında geri
              alabilirsiniz.
            </P>
          </>
        );
      case "exporting":
        return (
          <>
            <H light={light}>Mod dışa aktarma</H>
            <P light={light}>
              {mono(light, "File → Export mod…")} seçeneği önce projeyi doğrular; hata yoksa kayıt
              penceresi açılır. Varsayılan dosya adı {mono(light, "mod_<modId>.zip")} biçimindedir.
              Oluşturulan ZIP, oyunun beklediği klasör ve dosya yapısını içerir.
            </P>
            <H light={light}>Kurulum</H>
            <P light={light}>
              ZIP içeriğini oyunun mod klasörüne çıkarın veya kullandığınız mod yöneticisine yükleyin.
              Mod kimliği ({mono(light, "modId")}) ve oyun kök klasörünün doğru ayarlandığından emin
              olun. PNG önizleme görselinin oluşturulabilmesi için oyun kök yolunun girilmesi gerekir.
            </P>
          </>
        );
      case "settings":
        return (
          <>
            <H light={light}>Genel ayarlar</H>
            <P light={light}>
              {mono(light, "View → Settings…")} veya menüden ayarlar iletişim kutusu: oyun kök dizini, bir veya daha
              fazla mod kök yolu, ızgara boyutu, yapıştırma, varsayılan yakınlaştırma, otomatik kayıt aralığı ve açık /
              koyu tema seçimi. Köklere göre malzeme ve font çözümlemesi yapılır.
            </P>
            <H light={light}>Projeye oyun kökü</H>
            <P light={light}>
              Ayarlardan kaydettiğiniz oyun yolu, isteğe bağlı olarak açık projeye de uygulanabilir; böylece önizleme ve
              dışa aktarma aynı varlıklarla çalışır.
            </P>
          </>
        );
      case "shortcuts":
        return (
          <>
            <H light={light}>Klavye kısayolları</H>
            <P light={light}>
              Aşağıdaki tablo uygulamadaki tüm kısayolları özetler. macOS kullanıyorsanız{" "}
              {mono(light, "Ctrl")} yerine {mono(light, "Cmd")} tuşunu kullanabilirsiniz.
            </P>
            <div className="overflow-x-auto">
              <table
                className={
                  light
                    ? "w-full border-collapse border border-slate-300 text-sm text-slate-800"
                    : "w-full border-collapse border border-slate-700 text-sm text-slate-200"
                }
              >
                <thead>
                  <tr className={light ? "bg-slate-100" : "bg-slate-800/60"}>
                    <th className={tableTh}>Kısayol</th>
                    <th className={tableTh}>İşlev</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={tableTd}>Ctrl+O</td>
                    <td className={tableTdPlain}>Proje aç</td>
                  </tr>
                  <tr>
                    <td className={tableTd}>Ctrl+S</td>
                    <td className={tableTdPlain}>Projeyi kaydet</td>
                  </tr>
                  <tr>
                    <td className={tableTd}>Ctrl+Z</td>
                    <td className={tableTdPlain}>Geri al (odak metin alanında değilken)</td>
                  </tr>
                  <tr>
                    <td className={tableTd}>Ctrl+Y</td>
                    <td className={tableTdPlain}>Yinele</td>
                  </tr>
                  <tr>
                    <td className={tableTd}>Ctrl+Shift+Z</td>
                    <td className={tableTdPlain}>Yinele</td>
                  </tr>
                  <tr>
                    <td className={tableTd}>Ctrl+C</td>
                    <td className={tableTdPlain}>Seçili öğeleri kopyala (giriş odaklı değilken)</td>
                  </tr>
                  <tr>
                    <td className={tableTd}>Ctrl+V</td>
                    <td className={tableTdPlain}>Yapıştır</td>
                  </tr>
                  <tr>
                    <td className={tableTd}>Ctrl+X</td>
                    <td className={tableTdPlain}>Kes</td>
                  </tr>
                  <tr>
                    <td className={tableTd}>Ctrl+A</td>
                    <td className={tableTdPlain}>Aktif ekrandaki tüm öğeleri seç</td>
                  </tr>
                  <tr>
                    <td className={tableTd}>Ctrl+D</td>
                    <td className={tableTdPlain}>Kopyala ve yapıştır (çoğalt)</td>
                  </tr>
                  <tr>
                    <td className={tableTd}>Delete / Backspace</td>
                    <td className={tableTdPlain}>Seçileni sil</td>
                  </tr>
                  <tr>
                    <td className={tableTd}>Escape</td>
                    <td className={tableTdPlain}>Seçimi temizle</td>
                  </tr>
                  <tr>
                    <td className={tableTd}>Space (basılı)</td>
                    <td className={tableTdPlain}>Tuvalde gezinme (pan) için sürükle</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <P light={light}>
              {mono(light, "Ctrl+O")} ve {mono(light, "Ctrl+S")} metin alanına odaklanmış olsanız
              bile çalışır. Geri al / yinele işlemleri bir metin kutusu veya açılır liste
              odaklanmışken devre dışı bırakılır; şablon düzenleyicisi açıkken tuval kısayolları
              uygulanmaz.
            </P>
          </>
        );
      default:
        return null;
    }
  })();

  return (
    <div className="fixed inset-0 z-[350] flex flex-col" role="dialog" aria-modal="true" aria-labelledby="docs-title">
      <div className={`min-h-0 flex-1 overflow-hidden ${shell}`}>
        <header
          className={
            light
              ? "flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-300 px-4 py-2"
              : "flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-700 px-4 py-2"
          }
        >
          <h2 id="docs-title" className="text-sm font-semibold">
            Documentation
          </h2>
          <button type="button" className={`ml-auto ${headerBtn}`} title="Kapat" onClick={onClose}>
            <X size={16} aria-hidden />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-row">
          <nav
            className={
              light
                ? "w-56 shrink-0 overflow-y-auto border-r border-slate-300 py-2 pl-2 pr-1"
                : "w-56 shrink-0 overflow-y-auto border-r border-slate-700 py-2 pl-2 pr-1"
            }
          >
            {NAV.map((item) => (
              <button key={item.id} type="button" className={navBtn(item.id)} onClick={() => setSection(item.id)}>
                {item.label}
              </button>
            ))}
          </nav>
          <div
            className={
              light ? "min-h-0 flex-1 overflow-y-auto px-5 py-4" : "min-h-0 flex-1 overflow-y-auto px-5 py-4"
            }
          >
            {content}
          </div>
        </div>
      </div>
    </div>
  );
}
