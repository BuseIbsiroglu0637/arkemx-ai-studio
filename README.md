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


## Ece ile sesli görüşme

`/ece` sayfasında **Sesli görüşmeyi başlat** düğmesine basın ve tarayıcının mikrofon iznini verin. Türkçe konuşma tamamlanınca kesinleşen metin mevcut sohbet API'sine gönderilir. Ece yanıtını kaydeder, Türkçe Emel sesiyle okur; sesin `ended` olayı gelince mikrofon yeniden açılır. Mikrofon ve yanıt sesi aynı anda çalışmaz.

**Sözümü bitirdim** son tanıma sonucunu bekler. Ece konuşurken **Söz al** sesi kesip dinlemeyi başlatır. **Görüşmeyi bitir**, sekmeyi gizleme ve sayfadan çıkma mikrofonu ve oynatımı durdurur. Gecikmiş bir yanıt görüşmeyi yeniden açamaz. Hata veya sessizlikte otomatik yeniden deneme yapılmaz; kullanıcı yeniden başlatır. Her dinleme en fazla 60 saniyedir.

Tarayıcıda `SpeechRecognition` veya `webkitSpeechRecognition` desteği gerekir; dil `tr-TR` olarak ayarlanır. Bazı tarayıcılar sesi çevrimiçi tanıma servisine gönderir; bu özellik tamamen yerel tanıma garantisi vermez. Uygulama ham mikrofon ses dosyası kaydetmez; tanınan metin sohbet geçmişine eklenir. [SpeechRecognition davranışı](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).

Tarayıcı otomatik yanıt sesini engellerse görüşme durur; mesajdaki **Yanıtı dinle** düğmesi kullanılabilir. Gerçek mikrofon ve konuşma tanıma erişimi kullanıcının tarayıcısında ayrıca denenmelidir.

## Ofis ve hafıza paneli

Ana sayfa ve `/ece` aynı masa başı 3D sahnesini kullanır. Hafıza düğmesi, son 50 aktif kaydı salt okunur `/api/agents/ece/knowledge` uç noktasından getirir. Panelde arama yapılabilir. **Sohbette düzenle** yalnızca düzenleme komutunu mesaj taslağına taşır; kullanıcı yeni içeriği yazıp gönderince mevcut hafıza komutu uygulanır. Kayıtlı bilgi, onaylanmış proje kararı olarak etiketlenmez.


### Sesli yanıt süresi ve iptal

Yalnızca selamlama içeren mesajlar (`Merhaba`, `Selam Ece` gibi) yerel bir karşılama yanıtı kullanır; soru veya hafıza komutu içeren mesajlar bu kısa yola girmez. Normal yazılı sohbet yapılandırması korunur. `mode: "voice"` istekleri kısa Türkçe yanıt profili ve kurulu `qwen3:1.7b` modeli kullanır; `ECE_VOICE_MODEL` ile sunucudan değiştirilebilir. Bu daha küçük model, kapsamlı yazılı modelle aynı yanıt kalitesini garanti etmez.

Yerel model isteği sesli kipte en fazla 45 saniye, yazılı kipte 120 saniye beklenir. Tarayıcıda ek koruyucu süreler 55/130 saniyedir. TTS üretim süresi bunlardan ayrıdır. **Görüşmeyi bitir** veya **Bekleyen isteği durdur** hem oynatımı hem devam eden sohbet isteğini durdurur; iptal sinyali yerel modele aktarılır. Başarısız veya iptal edilen mesaj taslakta korunur. **Taslağı temizle** ile klavye kullanmadan yeni görüşme başlatılabilir.
