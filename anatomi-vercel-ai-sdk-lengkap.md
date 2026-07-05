# Anatomi Lengkap Vercel AI SDK (Update: AI SDK 7, Juni 2026)

> Versi revisi ini melengkapi peta 4 pilar sebelumnya dengan fitur-fitur yang ditambahkan di **AI SDK 6** dan **AI SDK 7** (dirilis 25 Juni 2026), yang mengubah SDK ini dari sekadar toolkit chat menjadi **platform agent produksi** untuk TypeScript. Setiap fitur dijelaskan dengan format yang sama: apa fungsinya dan kapan kamu butuh itu.

---

## PILAR 1: Core Generation API (Otak Utamanya)

Fungsi dasar (*primitives*) untuk berkomunikasi dengan LLM. Wajib dipahami karena memengaruhi bagaimana data dikembalikan ke aplikasi.

### generateText & streamText
- **Apa fungsinya:** Mengirim prompt dan menerima balasan berupa teks biasa (bisa instan atau dicicil kata demi kata/*streaming*).
- **Kapan kamu butuh ini:** Ketika kamu membuat chatbot standar, mesin pembuat artikel, penerjemah bahasa, atau fitur pembuat ringkasan dokumen.

### generateObject & streamObject
- **Apa fungsinya:** Memaksa LLM memberikan jawaban yang wajib berformat JSON yang strukturnya sudah kamu kunci menggunakan skema (seperti Zod).
- **Kapan kamu butuh ini:** Saat kamu ingin AI membuat data terstruktur. Contoh: ekstraksi info dari struk belanja (nama toko, total harga), membuat kuis pilihan ganda otomatis, atau menghasilkan analisis sentimen (`{ sentiment: "positive", score: 0.95 }`) untuk disimpan ke database.

### reasoning (BARU — AI SDK 7)
- **Apa fungsinya:** Opsi `reasoning` yang seragam di `generateText`/`streamText` untuk mengatur level effort reasoning model (mis. none, medium, high), otomatis dipetakan ke setting native tiap provider.
- **Kapan kamu butuh ini:** Saat kamu ingin agent berpikir lebih dalam untuk tugas kompleks (analisis multi-langkah, debugging kode) tanpa menulis konfigurasi berbeda untuk tiap provider model. Kalau butuh kontrol lebih detail lagi, masih bisa fallback ke `providerOptions`.

### uploadFile API (BARU — AI SDK 7)
- **Apa fungsinya:** Upload file besar (PDF, gambar, dataset) sekali, lalu kirim referensi ringan ke pemanggilan model berikutnya alih-alih mengirim ulang seluruh file.
- **Kapan kamu butuh ini:** Untuk agent multi-step yang berulang kali merujuk file besar yang sama—misalnya agent riset yang menganalisis satu dokumen PDF 100 halaman dalam banyak langkah. Menghindari boros bandwidth dan mempercepat inference.

### Strict Mode per-tool (BARU — AI SDK 6)
- **Apa fungsinya:** Strict mode (yang menjamin input tool sama persis dengan skema) kini bisa diaktifkan per tool, bukan berlaku global untuk semua tool sekaligus.
- **Kapan kamu butuh ini:** Saat satu request memakai campuran tool—sebagian punya skema kompatibel dengan strict mode, sebagian tidak. Tanpa fitur ini, satu tool bermasalah bisa membuat seluruh request gagal.

### Input Examples untuk Tool Schema (BARU — AI SDK 6)
- **Apa fungsinya:** Menyisipkan contoh input konkret pada skema tool untuk memperjelas pola yang diharapkan.
- **Kapan kamu butuh ini:** Saat tool punya schema kompleks (nested object, format spesifik seperti nomor telepon atau kode produk) dan deskripsi field saja tidak cukup membuat model menghasilkan input yang benar-benar sesuai pola yang kamu mau.

---

## PILAR 2: Agentic & Tool Calling (Tangan & Kaki AI)

Fitur yang mengubah LLM dari sekadar "pemberi jawaban" menjadi "pekerja otomatis" yang bisa berinteraksi dengan dunia luar.

### tools (Function Calling)
- **Apa fungsinya:** Memberikan LLM kemampuan untuk menjalankan fungsi kode kamu (misal: membaca database, mengecek cuaca, atau mengirim email).
- **Kapan kamu butuh ini:** Jika AI butuh data real-time atau aksi nyata. Contoh: user mengetik "Tolong cek apakah stok sepatu ukuran 42 masih ada?", AI mendeteksi ia butuh tool `cekStokDatabase()`, menjalankannya, lalu menjawab berdasarkan data asli database-mu.

### maxSteps (Multi-Step Loops)
- **Apa fungsinya:** Mengizinkan AI melakukan proses berantai secara mandiri dalam satu kali request (Mikir → Panggil Tool A → Dapat Hasil → Mikir Lagi → Panggil Tool B → Selesai).
- **Kapan kamu butuh ini:** Untuk agen AI yang kompleks. Misal: "Cari harga penerbangan termurah ke Tokyo, lalu buatkan rangkuman hotel terdekat." AI memanggil tool penerbangan dulu, lalu otomatis memanggil tool hotel tanpa menunggu prompt baru dari user.

### Tool Execution Approval / `needsApproval` (BARU — AI SDK 6)
- **Apa fungsinya:** Memberi kontrol human-in-the-loop dengan satu flag `needsApproval: true`, tanpa kode custom. Bisa berupa flag statis atau fungsi yang menilai berdasarkan input, dan bisa menyimpan preferensi approval user untuk pola yang sama di masa depan.
- **Kapan kamu butuh ini:** Sebelum agent menjalankan aksi sensitif seperti menulis ke database, mengirim email, atau menjalankan perintah destruktif (`rm -rf`). Tool aman seperti `ls` bisa auto-approve, sedangkan aksi berisiko butuh review manusia dulu.

### Tool Runtime Context & Tool Execution Context (BARU — AI SDK 7)
- **Apa fungsinya:** Context bertipe yang dikirim khusus ke satu tool (API key, konfigurasi) tanpa membuka akses ke tool lain, plus runtime context yang bisa diakses/diubah di `prepareStep` dan fungsi tool approval.
- **Kapan kamu butuh ini:** Saat kamu memakai tool pihak ketiga yang butuh kredensial atau setting khusus, atau saat membangun agent kompleks lewat `ToolLoopAgent` yang perlu berbagi variabel/logic internal antar langkah tanpa membocorkannya ke tool lain.

### Memory Tool (BARU — AI SDK 6)
- **Apa fungsinya:** Menyimpan dan mengambil informasi lintas percakapan lewat direktori file memori bawaan.
- **Kapan kamu butuh ini:** Untuk asisten yang perlu "mengingat" preferensi atau fakta tentang user di sesi-sesi berikutnya, tanpa kamu membangun sistem memori sendiri dari nol.

### Tool Search — Regex & BM25 (BARU — AI SDK 6)
- **Apa fungsinya:** Memilih tool yang relevan secara dinamis dari daftar besar, baik lewat pola regex maupun query bahasa natural (BM25).
- **Kapan kamu butuh ini:** Saat agent kamu punya puluhan atau ratusan tool terdaftar, dan mengirim semuanya ke model tiap request akan boros token serta membingungkan model dalam memilih tool yang tepat.

### Code Execution Tool (BARU — AI SDK 6)
- **Apa fungsinya:** Menjalankan kode di lingkungan sandbox yang aman, lengkap dengan operasi bash dan file.
- **Kapan kamu butuh ini:** Untuk agent yang perlu menjalankan skrip analisis data, memproses file, atau melakukan kalkulasi kompleks yang lebih efisien dilakukan lewat kode daripada dijawab langsung oleh model.

### Programmatic Tool Calling (BARU — AI SDK 6)
- **Apa fungsinya:** Memungkinkan model (misalnya Claude) memanggil tool kamu langsung dari lingkungan eksekusi kode, sehingga hasil antara tidak perlu masuk ke context percakapan.
- **Kapan kamu butuh ini:** Saat agent melakukan banyak pemanggilan tool berantai dengan hasil data besar (misal loop memproses ratusan baris data)—supaya context window tidak cepat penuh oleh hasil-hasil antara yang sebenarnya tidak perlu dilihat model secara langsung.

### WorkflowAgent (Durable Execution)
- **Apa fungsinya:** Fitur tingkat lanjut untuk menjaga agen AI tetap berjalan meskipun prosesnya memakan waktu berjam-jam, server sempat mati, atau koneksi terputus. Di AI SDK 7 diperkuat dengan tool approvals, timeout, dan sandbox support sebagai bagian native dari runtime.
- **Kapan kamu butuh ini:** Untuk tugas background yang berat. Misal: agent AI yang meriset pasar, membaca 50 artikel kompetitor, lalu membuat laporan PDF. Jika prosesnya butuh 15 menit, server biasa akan timeout—WorkflowAgent memastikan proses berlanjut dengan aman.

### Sandbox Packages (BARU — AI SDK 7)
- **Apa fungsinya:** Paket `@ai-sdk/sandbox-vercel` dan `@ai-sdk/sandbox-just-bash` untuk mengeksekusi tool di lingkungan terisolasi, dikonfigurasi lewat `experimental_sandbox` pada level constructor atau per-step.
- **Kapan kamu butuh ini:** Saat agent menjalankan kode atau perintah yang berpotensi tidak aman kalau langsung jalan di server produksi kamu, dan kamu ingin isolasi tanpa membangun infrastruktur sandbox sendiri.

### Integrasi Harness Eksternal (BARU — AI SDK 7)
- **Apa fungsinya:** Kemampuan memasangkan AI SDK dengan harness agent pihak lain seperti Codex, Claude Code, Deep Agents, OpenCode, atau Pi.
- **Kapan kamu butuh ini:** Saat kamu sudah punya atau ingin memakai harness agent tertentu tapi tetap mau memanfaatkan primitives AI SDK (streaming, tool calling, observabilitas) tanpa terkunci pada satu framework tertutup.

---

## PILAR 3: AI SDK UI (Jembatan Frontend ke Backend)

Bagian yang menangani sinkronisasi rumit antara apa yang terjadi di server AI dengan apa yang dilihat pengguna di layar.

### useChat & useCompletion (React/Vue/Svelte Hooks)
- **Apa fungsinya:** Hook siap pakai yang otomatis mengurus state management obrolan (menyimpan histori chat, status loading, tombol stop, input teks, hingga otomatis scroll ke bawah).
- **Kapan kamu butuh ini:** Agar kamu tidak perlu menulis ratusan baris kode untuk mengelola array percakapan di frontend. Tinggal panggil hook ini, UI chat langsung jadi dalam 5 menit.

### Generative UI & Message-Parts
- **Apa fungsinya:** Kemampuan AI untuk tidak hanya mengirim teks, tapi mengirim komponen UI hidup (seperti kartu UI, grafik interaktif, atau tombol) langsung di tengah-tengah obrolan.
- **Kapan kamu butuh ini:** Jika kamu ingin membuat aplikasi seperti Perplexity atau ChatGPT tingkat lanjut. Misal, saat AI mencari info saham, ia langsung memunculkan komponen grafik batang interaktif, bukan teks angka yang membosankan.

### Terminal UI / TUI (BARU — AI SDK 7)
- **Apa fungsinya:** Antarmuka berbasis terminal untuk memantau dan men-debug agent secara langsung (live).
- **Kapan kamu butuh ini:** Saat kamu sedang mengembangkan agent kompleks dan ingin melihat proses tool call, step, dan output secara real-time tanpa bolak-balik membuka browser atau menulis logger manual.

### DevTools (BARU — AI SDK 6)
- **Apa fungsinya:** Alat bantu pengembangan untuk inspeksi request/response dan siklus tool call secara visual.
- **Kapan kamu butuh ini:** Saat proses debugging butuh melihat detail payload yang dikirim/diterima dari model dan tool, tanpa harus menambahkan console.log manual di banyak tempat.

### Real-time Voice & Video Generation (BARU — AI SDK 7)
- **Apa fungsinya:** Dukungan suara real-time lintas provider dan generasi video, memperluas SDK dari sekadar teks ke agent multimodal penuh (teks, audio, real-time, gambar, video).
- **Kapan kamu butuh ini:** Untuk membangun asisten suara interaktif (voice assistant) atau fitur yang menghasilkan konten video secara otomatis, tanpa harus mengintegrasikan SDK terpisah dari provider lain untuk tiap modalitas.

---

## PILAR 4: Telemetri & Observabilitas (Fitur Monitor)

Fitur untuk memantau kesehatan aplikasi AI kamu saat sudah dipakai oleh orang banyak.

### OpenTelemetry (Tracing bawaan)
- **Apa fungsinya:** Otomatis mencatat setiap prompt yang masuk, durasi kecepatan model menjawab (latensi), dan berapa jumlah token yang dihabiskan.
- **Kapan kamu butuh ini:** Saat aplikasimu sudah di tahap produksi. Kamu butuh ini untuk memantau "Kenapa tagihan bulan ini bengkak?" atau "Model mana yang jalannya paling lambat dan bikin user kesal?"

### Node.js Tracing Channel & Lifecycle Events (BARU — AI SDK 7)
- **Apa fungsinya:** Observabilitas lebih dalam ke siklus hidup agent (mulai step, tool dipanggil, step selesai) plus statistik performa.
- **Kapan kamu butuh ini:** Untuk debugging agent produksi yang kompleks atau saat kamu butuh audit trail detail—misalnya di industri teregulasi yang mengharuskan pencatatan setiap keputusan agent secara lengkap.

---

## PILAR 5 (BARU): Infrastructure & Provider Layer

Bagian yang tidak ada di peta lama, padahal jadi tulang punggung ekosistem AI Vercel saat ini.

### AI Gateway
- **Apa fungsinya:** Layer routing terpadu lintas provider (OpenAI, Anthropic, xAI, Fireworks, dll), menyatukan billing dan observabilitas pemakaian model.
- **Kapan kamu butuh ini:** Saat aplikasimu memakai lebih dari satu provider model dan kamu ingin satu titik kontrol untuk switching, monitoring biaya, dan rate limit—tanpa membangun logic routing manual sendiri.

### Reranking & Image Editing (BARU — AI SDK 6)
- **Apa fungsinya:** Kapabilitas tambahan di luar generate teks/objek: reranking untuk retrieval dan editing gambar berbasis model.
- **Kapan kamu butuh ini:** Untuk sistem RAG (Retrieval-Augmented Generation) yang perlu mengurutkan ulang hasil pencarian berdasarkan relevansi, atau fitur edit foto otomatis (misal hapus background, ubah elemen) tanpa integrasi API terpisah.

### MCP Apps Integration (BARU — AI SDK 7)
- **Apa fungsinya:** Dukungan native untuk Model Context Protocol Apps, memudahkan agent memanggil aplikasi pihak ketiga secara terstruktur.
- **Kapan kamu butuh ini:** Saat agent kamu perlu terhubung ke layanan eksternal seperti Gmail, Slack, atau Asana lewat standar MCP, tanpa menulis integrasi API custom untuk tiap layanan.

### eve (framework terkait, bukan bagian dari AI SDK)
- **Apa fungsinya:** Framework agent open-source Vercel yang dibangun di atas layer yang sama dengan AI SDK; agent didefinisikan sebagai file di direktori `agent/` lalu dikompilasi jadi aplikasi produksi dengan durable execution, sandbox, approval, subagent, dan evals bawaan.
- **Kapan kamu butuh ini:** Saat kamu ingin struktur "Next.js untuk agent"—konvensi berbasis file yang langsung siap deploy ke Vercel Functions—alih-alih merakit sendiri semua primitives dari AI SDK secara manual.

---

## Matriks Cepat: "Saya Ingin Membuat X, Pakai Fitur Apa?"

| Skenario Aplikasi | Fitur AI SDK yang Wajib Dipakai |
| :--- | :--- |
| Chatbot Customer Service Interaktif | `streamText` + `tools` + `useChat` |
| Aplikasi Pembuat Invoice Otomatis dari Foto | `generateObject` (Multimodal) + Skema Zod |
| Sistem Analisis Data Laporan Bulanan | `maxSteps` + `streamObject` + OpenTelemetry |
| Agen Otomatis Pembuat Artikel SEO | `WorkflowAgent` (Durable Execution) |
| Agent yang Butuh Persetujuan Sebelum Aksi Sensitif | `needsApproval` + Tool Execution Approval |
| Agent dengan Kredensial Pihak Ketiga per Tool | Tool Runtime Context / Tool Execution Context |
| Agent yang Perlu Memproses PDF/Dataset Besar Berulang | `uploadFile` API |
| Asisten Suara Real-time | Real-time Voice Support (AI SDK 7) |
| Debugging Agent Kompleks Secara Langsung | Terminal UI (TUI) + DevTools |
| Routing Model Lintas Provider dengan Satu Tagihan | AI Gateway |
| Agent yang Perlu Menjalankan Kode dengan Aman | Code Execution Tool + Sandbox Packages |

---

## Ringkasan Perubahan Paling Signifikan (v6 → v7)

1. Dari "chat primitives" menjadi platform agent produksi lengkap dengan approval, durability, dan observabilitas bawaan.
2. Modalitas meluas dari teks ke audio real-time dan video.
3. Tool kini punya context dan runtime context bertipe, bukan cuma input dari model.
4. Ada jalur migrasi resmi dari v6 ke v7 lewat `npx @ai-sdk/codemod v7` atau skill migrasi khusus.
5. SDK makin terhubung dengan ekosistem lebih besar: AI Gateway untuk routing/billing, dan eve untuk agent framework berbasis file.

---

*Disusun berdasarkan rilis resmi Vercel AI SDK 6 & 7, changelog GitHub, dan blog resmi Vercel per Juli 2026. Karena SDK ini masih aktif dikembangkan (rilis patch hampir harian), cek `pnpm add ai@latest` dan changelog resmi sebelum implementasi produksi.*
