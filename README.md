# ARKEMX AI Studio

ARKEMX ve sonraki yazılım projeleri için AI ekip yönetim uygulaması.

## İlk sürüm: Ekibim

- Beş başlangıç profili: Ece, Ada, Deniz, Bora ve Selin.
- Arama, bölüm filtresi, kart ve liste görünümü.
- Profil oluşturma, düzenleme, duraklatma ve arşivleme.
- CV: tanımlanan görev ve yetkinlikler; doğrulanmış iş deneyimleri ayrı.
- SQLite ile sunucu tarafında kalıcı kayıt; değişiklik geçmişi ve sürüm çakışması kontrolü.
- Aynı ekip kayıtlarını okuyan yerel, salt okunur MCP sunucusu.

AI modelleri, otomatik görev yürütme, sohbet ve toplantılar henüz bağlanmadı. Hazır profil, çalışan veya bağlı ajan anlamına gelmez. Başlangıç profillerinin gerçek iş deneyimi bulunmaz.

## Çalıştırma

Node.js 24 veya üzeri gerekir. Node.js'in yerleşik SQLite özelliği kullanılır; bazı sürümlerde deneysel özellik bildirimi görülebilir.

```bash
npm ci
npm run dev
```

Uygulama: http://127.0.0.1:3100

Üretim derlemesini yerelde denemek için:

```bash
npm run build
npm start
```

## Kontroller

```bash
npm run typecheck
npm test
```

Testler geçici ve ayrı veritabanları kullanır; çalışma alanının ekip kayıtlarını değiştirmez.

## Veri ve çalışma kapsamı

Veriler proje kökündeki `data/studio.sqlite` dosyasında saklanır. `data/`, ortam dosyaları ve bağımlılıklar Git'e eklenmez. Tarayıcıdaki yerel depolama ana veri kaynağı değildir.

Bu sürüm yerel, tek kullanıcılı geliştirme içindir. Sunucu yalnız `127.0.0.1:3100` adresinde dinler; API isteklerinde Host ve değişikliklerde Origin kontrol edilir. Çok kullanıcılı veya internet üzerinden erişilen sürüm için kimlik doğrulama, sahiplik denetimleri ve PostgreSQL deposu ayrıca uygulanacaktır. SQLite verisini geçici diskli bir barındırma ortamına taşımak kalıcı veritabanı sağlamaz.

Arşivleme satırı silmez; arşivlenen profil ve değişiklik kaydı veritabanında korunur. İlk ekran arşiv listesini henüz sunmaz.

## MCP

Yerel STDIO sunucusu:

```bash
npm run mcp
```

MCP istemcisinde sunucuyu eklerken `cwd` değerini bu projenin mutlak yoluna ayarlayın. Doğrudan Node ile çalıştırmak için `node_modules/tsx/dist/cli.mjs` ve `src/mcp/server.ts` dosyalarının mutlak yollarını kullanın. Sunucu varsayılan veritabanı yolunu kendi proje konumundan belirler; farklı çalışma dizinleri ikinci bir veri deposu oluşturmaz.

İsteğe bağlı `ARKEMX_STUDIO_DATA_DIR`, hem uygulama hem MCP sürecinde aynı **mutlak** klasör yoluna ayarlanabilir. Next.js ortam dosyalarını yükler; bağımsız MCP sürecine bu değer istemci yapılandırmasından ayrıca verilmelidir.

GitHub MCP ve ARKEMX kayıt köprüsü gelecekte ajan çalışma katmanına bağlanacaktır. Bu sohbetteki araç erişimi uygulamaya otomatik taşınmaz. İlk sürümde dış hesap bağlantısı veya gizli anahtar gerekmez.

## Kod düzeni

```text
src/app/             Sayfa ve HTTP uçları
src/components/      Ekip arayüzü
src/domain/          Veri tipleri ve başlangıç profilleri
src/server/          Doğrulama, iş kuralları ve SQLite deposu
src/mcp/             Ortak servise bağlanan salt okunur MCP erişimi
tests/               Kalıcılık, erişim sınırları ve MCP kontrolleri
```

Arayüz ve MCP aynı servisleri kullanır. Model bağlantısı ve iş deneyimi, profil düzenleme isteğiyle taklit edilemez. İleride her çalıştırma, çalışan kimliği ile kullanılan model/talimat sürümüne bağlanacaktır.


## Ece ile sesli sohbet

`/ece` sayfasında **Mikrofonla konuş** düğmesine basın ve tarayıcının mikrofon iznini verin. Türkçe konuşma tanıma tamamlanınca yalnızca kesinleşen metin mevcut sohbet API'sine gönderilir. Ece yanıtı metin olarak kaydeder ve Türkçe Emel sesiyle okur. Yeni konuşma için düğmeye yeniden basılır; mikrofon kendiliğinden yeniden açılmaz.

**Dinlemeyi bitir ve gönder**, tanımanın son sonucunu bekler; **İptal**, konuşmayı göndermez. Sekme gizlendiğinde veya sayfadan çıkıldığında dinleme iptal edilir. Bir dinleme en fazla 60 saniye sürer. Yazılı taslak varken sesli giriş kapalıdır; mevcut taslak korunur.

Tarayıcıda `SpeechRecognition` veya `webkitSpeechRecognition` desteği gerekir. Tanıma Türkçe (`tr-TR`) olarak yapılandırılmıştır. Destek bulunamazsa ekranda yazıyla devam seçeneği belirtilir. Bazı tarayıcılar sesi çevrimiçi tanıma servisine gönderir; bu özellik çevrimdışı ya da tamamen yerel tanıma garantisi vermez. Uygulama mikrofon ses dosyasını kendi sunucusuna kaydetmez; tanınan metin mevcut sohbet geçmişinin bir parçasıdır. [SpeechRecognition davranışı](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).

Tarayıcı otomatik yanıt sesini engellerse mesajdaki **Yanıtı dinle** düğmesi kullanılabilir. Gerçek mikrofon kalitesi ve tanıma servisinin erişilebilirliği kullanıcının tarayıcısında ayrıca denenmelidir.
