# 🚀 Modern Todo

Hesap, sunucu ve internet gerektirmeyen; **tüm verisi telefonda duran**, oyunlaştırılmış ve çok özelleştirilebilir bir görev uygulaması. React Native + Expo ile yazıldı.

<p align="center">
  <img src="./assets/moderntodo.png" width="150" alt="Logo">
</p>

## ✨ Özellikler

**Görevler**
- Başlık, not, öncelik (düşük/normal/yüksek), kategori
- Günlük / haftalık tekrar eden görevler
- Tarih + saat seçimi, saati gelince bildirim (isteğe bağlı "X dk önce" uyarısı)
- Arama, filtreler (Aktif / Bugün / Biten), hızlı ekleme kutusu

**Oyunlaştırma**
- XP, seviye ve günlük seri 🔥
- 51 kupa: bronz 🥉, gümüş 🥈, altın 🥇, elmas 💎

**Özelleştirme**
- 8 tema, 10 vurgu rengi, yazı boyutu, köşe yuvarlaklığı, sıkışık görünüm
- Kendi fotoğrafını arka plan yapma (karartma ayarlı)
- Türkçe / İngilizce
- Kendi kategorilerini ekle/sil

**Veri ve gizlilik**
- Hesap yok, Firebase yok, sunucu yok: veri yalnızca cihazda saklanır
- JSON yedek alma / yedekten yükleme, listeyi metin olarak paylaşma
- Uygulama silinirse veriler de silinir, bu yüzden önce yedek al

## 🔐 İzinler

| İzin | Neden |
|---|---|
| Bildirimler | Görev saati geldiğinde ve günlük hatırlatma için |
| Tam zamanlı alarm (Android) | Bildirimin tam dakikasında gelmesi için |
| Titreşim / açılışta başlat | Bildirim titreşimi ve telefon yeniden başlayınca alarmların korunması |

Fotoğraf seçerken sistemin kendi seçicisi kullanılır, ayrıca depolama izni istenmez.

## 🛠️ Kurulum

```bash
git clone https://github.com/tarcintuzla-tech/ModernTodoApp.git
cd ModernTodoApp
npm install
npx expo install --fix
npx expo start
```

APK almak için:

```bash
npm install -g eas-cli
eas build -p android --profile preview
```

## 📁 Yapı

```
App.js          Ekranlar ve uygulama mantığı
src/i18n.js     Türkçe / İngilizce metinler
src/themes.js   Tema ve renkler
src/trophies.js Kupalar ve seviye hesabı
src/store.js    Kalıcı depolama, yedek alma/yükleme
src/notify.js   Bildirim izni ve planlama
```

## 📥 İndir

Hazır APK için **[Releases](https://github.com/tarcintuzla-tech/ModernTodoApp/releases)** sayfasına bak.

## 👨‍💻 Geliştirici

Merhaba, ben Ümit. Bu benim ilk uygulamam; hata bulursan veya öneride bulunmak istersen:
Instagram: `cw._.u` · TikTok: `cw._.u`

## 📄 Lisans

Lisans dosyası için `LICENSE` bölümüne bak.
