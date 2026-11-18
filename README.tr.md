# NEP Guard

### Tarayıcılar AI ajanınızın skill'lerindeki riskli kodu bulur. NEP Guard onu düzeltir ve düzeltilmiş halde tutar.

**Claude Code için sıfır güven otomatik düzeltme katmanı.** NEP Guard kurduğunuz her skill'i, plugin'i ve claude.ai bağlayıcısını tarar. Her bulguyu kodda doğrular ve gerçek riski, *skill'in amacını bozmadan* ortadan kaldırır. Düzeltmeyi her güncellemeden sonra yeniden uygular. Her değişiklik yedeklenir, kayda geçer ve tek komutla geri alınabilir.

[NVIDIA SkillSpector](https://github.com/NVIDIA/SkillSpector) ile çalışır. Yerel çalışır, ücretsizdir ve hiçbir şey bilgisayarınızdan dışarı çıkmaz.

[English](README.md)

---

## Farkı ne?

Çoğu araç rapor vermekle ya da engellemekle yetinir. NEP Guard bir adım daha ileri gider.

| | Bulguyu raporlar | Engeller / karantinaya alır | **Kodu düzeltir ve düzeltilmiş tutar** |
|---|:---:|:---:|:---:|
| Tipik tarayıcılar | ✅ | bazen | ❌ |
| **NEP Guard** | ✅ | ✅ (bağlayıcılar) | ✅ |

- **İşaretlemekle kalmaz, düzeltir.** Skill o kod olmadan çalışıyorsa tehlikeli ya da veri sızdıran kod silinir; çalışmıyorsa küçük bir koruma ile etkisizleştirilir. Riskli kalıplar içeren geliştirici test dosyaları kaldırılır.
- **Düzeltmeler güncellemelere dayanır.** Düzeltmeler *yama paketi* olarak yazılır ve her oturum açılışında yeniden uygulanır. Bir plugin güncellemesi riski sessizce geri getiremez. Kaynak kod değiştiyse yama tahmin yürütmez; atlanır ve raporlanır.
- **Sıfır güven.** Birinci taraf skill ve bağlayıcılar dahil hiçbir kaynağa varsayılan olarak güvenilmez.
- **Sizin kurallarınız araç talimatlarının önündedir.** Her oturuma bir politika katmanı eklenir. Örneğin *"ücretli araçtan önce sor"* kuralı, *"yalnızca uzun işlerde onay iste"* diyen bir bağlayıcının önüne geçer. Bağlayıcı talimatları güvenilmez veri sayılır.
- **claude.ai'yi de kapsar.** claude.ai'den senkronlanan skill'ler ve uzak bağlayıcılar da envantere alınır ve incelenir.
- **Başında beklemenize gerek yok.** Bir şey kurulduğu anda tarama başlar; oturum açılışında yeni ya da değişen her şey yakalanır. Sizin komut çalıştırmanız gerekmez.

## Neden güvenebilirsiniz

| Güvence | Nasıl |
|---|---|
| **Geri alınabilir** | İlk değişiklikten önce orijinaller yedeklenir. `rollback <paket>` geri yükler ve paketi devre dışı bırakır. |
| **Denetlenebilir** | Her düzenleme, silme, geri alma ve bağlayıcı engeli `~/.nep-guard/changes.log` dosyasına yazılır. |
| **Tahmin yok** | Yamalar birebir metin çapası kullanır. Kod değiştiyse yama atlanır ve uyarı verilir. |
| **Sınırlı** | Bir yama paketi kendi plugin klasörü dışındaki dosyalara dokunamaz (test edilmiştir). |
| **Sabitlenmiş incelemeler** | İncelenen skill içerik hash'iyle sabitlenir. Bir bayt değişirse uyarı geri gelir. |
| **Yerel ve ücretsiz** | Taramalar `--no-llm` ile çalışır; dosya içerikleri hiçbir modele ya da servise gönderilmez. |
| **Test edilmiş** | `node test/selftest.js` yukarıdaki her güvenceyi sınar. |

### Kendimizi de tarıyoruz

NEP Guard, her şeye uyguladığı motorla kendisini de tarar. Bu deponun şu anki sonucu: **MEDIUM (38/100), 0 yüksek, 0 kritik.**
Kalan bulgular gizli bir davranışı değil, aracın tasarım gereği yaptığı işi anlatıyor:

| Bulgu | Neden var |
|---|---|
| Kendi kendine karar verme | Sormadan düzeltir; ürünün kendisi bu. `"autoRemediate": false` ile kapatılabilir. |
| Oturumlar arası kalıcılık | Düzeltmeler yama paketi olarak saklanır ve her oturumda yeniden uygulanır, güncellemeler onları geri alamaz. |
| Skill listeleme | Taramak için kurulu skill'lerinizi listelemesi gerekir. |
| Paketle gelen hook'lar | Komut beklemeden çalışmasını SessionStart ve PostToolUse hook'ları sağlar. |

Kendiniz doğrulayın: `skillspector scan . --no-llm`

## Kurulum

1. Tarama motorunu bir kez kurun (ücretsiz, [uv](https://docs.astral.sh/uv/) gerekir):

   ```bash
   uv tool install --python 3.13 "skillspector[mcp] @ git+https://github.com/NVIDIA/skillspector.git"
   ```

2. NEP Guard'ı Claude Code'a ekleyin:

   ```bash
   claude plugin marketplace add eminhanpehlivan/nep-guard
   ```

   ```bash
   claude plugin install nep-guard@nep-guard
   ```

3. Yeni bir Claude Code oturumu açın. NEP Guard arka planda tarar ve sonuçları oturumda bildirir.

Türkçe mesajlar için `~/.nep-guard/policy.json` dosyasına `{"language": "tr"}` yazın.

## Dürüst sınırlar

- **Uzak bağlayıcılar başkasının sunucusunda çalışır.** NEP Guard ajanın okuduğu talimatları ve araç açıklamalarını inceler, gerekirse bağlayıcıyı engeller. Ama sunucunun kendisinin ne yaptığını göremez.
- **Yalnızca Claude Code.** claude.ai web ya da mobil sohbetleri kapsam dışıdır.
- **Yeni bir düzeltme için oturum gerekir.** Tespit ve bilinen düzeltmelerin yeniden uygulanması otomatiktir. *Yeni* bir düzeltmeye bir sonraki oturumda Claude karar verir. Oturum açık değilken hiçbir şey kodu değiştirmez.
- **İsteğe bağlı özellikler kapanabilir.** Tek işi veriyi dışarı göndermek olan bir özellik açık bir mesajla kapatılır; skill'in asıl işi çalışmaya devam eder.

## Lisans

Apache License 2.0. Ayrıntılar için [LICENSE](LICENSE) ve [NOTICE](NOTICE) dosyalarına bakın. NEP Guard; NVIDIA, Anthropic ya da Snyk ile bağlantılı değildir ve onlar tarafından onaylanmamıştır.
