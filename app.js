const express = require('express');
const axios = require('axios');
const ExcelJS = require('exceljs');

const app = express();
app.use(express.urlencoded({ extended: true })); // Form verilerini okumak için

// ÖNEMLİ: Google Cloud Console'dan alacağınız Places API anahtarınızı buraya girin.
const GOOGLE_API_KEY = "BURAYA_KENDI_API_ANAHTARINIZI_YAZIN";

const HTML_SABLON = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>B2B Veri Bulucu (Node.js)</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
    <div class="container mt-5">
        <h2 class="mb-4">İşletme Verisi Toplama Aracı (Node.js)</h2>
        <div class="card p-4 shadow-sm">
            <form method="POST">
                <div class="mb-3">
                    <label class="form-label">Konum (Örn: Kadıköy, İstanbul)</label>
                    <input type="text" name="konum" class="form-control" required>
                </div>
                <div class="mb-3">
                    <label class="form-label">Sektör / Kategori (Örn: Restoran, Yazılım)</label>
                    <input type="text" name="kategori" class="form-control" required>
                </div>
                <button type="submit" class="btn btn-success w-100">Arama Yap ve Excel Olarak İndir</button>
            </form>
        </div>
    </div>
</body>
</html>
`;

// Ana sayfayı göster
app.get('/', (req, res) => {
    res.send(HTML_SABLON);
});

// Form gönderildiğinde verileri çek ve Excel oluştur
app.post('/', async (req, res) => {
    try {
        const { konum, kategori } = req.body;
        const aramaSorgusu = `${konum} ${kategori}`;
        
        // 1. Google Places Text Search API'ye istek
        const aramaUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(aramaSorgusu)}&key=${GOOGLE_API_KEY}`;
        const aramaCevap = await axios.get(aramaUrl);
        const sonuclar = aramaCevap.data.results.slice(0, 5); // Prototip için ilk 5 sonucu alıyoruz

        const veriler = [];

        // 2. Her bir sonuç için detayları al
        for (const sonuc of sonuclar) {
            const detayUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${sonuc.place_id}&fields=name,formatted_address,formatted_phone_number,website&key=${GOOGLE_API_KEY}`;
            const detayCevap = await axios.get(detayUrl);
            const detay = detayCevap.data.result || {};

            const webSitesi = detay.website || 'Yok';
            let eposta = 'Bulunamadı';

            // Web sitesi varsa sahte/tahmini bir e-posta oluştur
            if (webSitesi !== 'Yok') {
                const temizDomain = webSitesi.replace('https://', '').replace('http://', '').replace('www.', '').split('/')[0];
                eposta = `info@${temizDomain}`;
            }

            veriler.push({
                isim: detay.name || 'Bilinmiyor',
                adres: detay.formatted_address || 'Bilinmiyor',
                telefon: detay.formatted_phone_number || 'Yok',
                webSitesi: webSitesi,
                eposta: eposta
            });
        }

        // 3. Excel Dosyasını Oluştur (ExcelJS kullanarak)
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sonuclar');

        // Excel başlıkları
        worksheet.columns = [
            { header: 'İşletme Adı', key: 'isim', width: 30 },
            { header: 'Adres', key: 'adres', width: 50 },
            { header: 'Telefon', key: 'telefon', width: 20 },
            { header: 'Web Sitesi', key: 'webSitesi', width: 30 },
            { header: 'E-Posta (Tahmini)', key: 'eposta', width: 25 }
        ];

        // Verileri Excel'e ekle
        veriler.forEach(veri => {
            worksheet.addRow(veri);
        });

        // 4. Dosyayı kullanıcıya indirt
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${kategori}_${konum}_sonuclar.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("Bir hata oluştu:", error.message);
        res.status(500).send("İşlem sırasında bir hata oluştu. Lütfen API anahtarınızı kontrol edin.");
    }
});

// Sunucuyu başlat
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Sunucu çalışıyor! Tarayıcınızda http://localhost:${PORT} adresine gidin.`);
});
