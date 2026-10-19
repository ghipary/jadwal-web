// Halaman Petunjuk: tutorial penggunaan aplikasi langkah demi langkah,
// lengkap dengan contoh nyata dan bukti penerapan di dunia sekolah.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../store';
import { checkConflicts } from '../scheduler';
import { periodeAktifHari } from '../types';
import { Banner, Btn, Card, Icon, PageHead, Tabs } from '../ui';

// ---------------------------------------------------------------------------
// Model langkah tutorial
// ---------------------------------------------------------------------------

interface Contoh {
  /** Judul contoh kasus. */
  judul: string;
  /** Penjelasan singkat contoh. */
  teks: string;
}

interface Langkah {
  id: string;
  /** Urutan langkah (1, 2, 3, …). */
  no: number;
  judul: string;
  tujuan: string;
  /** Rute halaman terkait langkah ini (bila ada). */
  rute?: string;
  /** Perintah yang harus dilakukan pengguna. */
  aksi: string[];
  /** Contoh nyata yang bisa ditiru persis. */
  contoh: Contoh;
  /** Bukti / hasil yang muncul bila langkah dikerjakan benar. */
  bukti: string;
  /** Tips tambahan (opsional). */
  tips?: string;
}

interface Bab {
  id: string;
  label: string;
  ikon: string;
  ringkas: string;
  langkah: Langkah[];
}

// ---------------------------------------------------------------------------
// Isi tutorial
// ---------------------------------------------------------------------------

const BAB: Bab[] = [
  {
    id: 'mulai',
    label: 'Persiapan Awal',
    ikon: 'home',
    ringkas: 'Kenali aplikasi dan siapkan identitas sekolah sebelum menyusun jadwal.',
    langkah: [
      {
        id: 'kenalan',
        no: 1,
        judul: 'Kenali menu utama aplikasi',
        tujuan: 'Memahami peta aplikasi agar tidak tersesat saat menyusun jadwal.',
        rute: '/',
        aksi: [
          'Masuk dengan akun Anda, lalu buka halaman Dashboard (menu Utama).',
          'Perhatikan enam kartu ringkasan: Guru, Kelas, Siswa, Mata Pelajaran, Ruang, dan Jam/Minggu Dibutuhkan.',
          'Lihat bilah kiri: grup "Utama" (Generator, Grid Jadwal, Pemeriksa Konflik), "Data Sekolah", dan "Hasil".',
        ],
        contoh: {
          judul: 'Contoh: dashboard sekolah SMAN 1 Nusantara',
          teks:
            'Saat pertama dibuka, aplikasi otomatis memuat data contoh: sekolah dengan 6 hari aktif, 16 guru, 6 kelas, beberapa mapel, dan ratusan jam kebutuhan sudah terisi. Anda bisa langsung mencoba Generate, atau hapus data contoh dan mulai dari nol.',
        },
        bukti:
          'Dashboard menampilkan angka statistik sesuai data Anda, dan progres penjadwalan "0 dari N jam" bila jadwal masih kosong.',
        tips: 'Data tersimpan otomatis di perangkat ini. Tombol "Keluar" ada di kanan atas.',
      },
      {
        id: 'identitas',
        no: 2,
        judul: 'Isi identitas sekolah',
        tujuan: 'Nama sekolah, kepala sekolah, dan tahun ajaran dipakai pada kop cetak & publikasi.',
        rute: '/sekolah',
        aksi: [
          'Buka menu Data Sekolah → Identitas Sekolah.',
          'Isi Nama Sekolah, Tahun Ajaran, dan Nama Kepala Sekolah.',
          'Tekan Simpan.',
        ],
        contoh: {
          judul: 'Contoh isian nyata',
          teks:
            'Nama Sekolah: "SMA Negeri 1 Nusantara", Tahun Ajaran: "2025/2026", Kepala Sekolah: "Dra. Kartika Wulandari, M.Pd."',
        },
        bukti:
          'Nama sekolah muncul di bawah logo pada bilah kiri dan di kop hasil cetak matriks.',
        tips: 'Nama sekolah juga jadi awalan nama berkas saat mengunduh JSON/Excel.',
      },
      {
        id: 'urutan-kerja',
        no: 3,
        judul: 'Pahami urutan kerja yang benar',
        tujuan: 'Urutan data menentukan keberhasilan generator — data dulu, baru generate.',
        aksi: [
          'Ikuti urutan: Jam Pelajaran → Guru → Ruang → Mata Pelajaran → Kelas → Siswa → Kebutuhan Jam → Batasan → Generate.',
          'Jangan meng-generate sebelum HARI dan JAM PELAJARAN selesai, karena semua data lain mengacu ke sana.',
        ],
        contoh: {
          judul: 'Contoh kasus: mengapa urutan penting?',
          teks:
            'Seorang operator langsung menekan Generate tanpa mengisi Jam Pelajaran. Hasilnya kosong, karena generator tidak punya satu pun slot jam untuk mengisi pelajaran. Setelah Jam Pelajaran diisi 8 baris, generate berhasil menempatkan semua jam.',
        },
        bukti:
          'Halaman Generator menampilkan jumlah "slot aktif" lebih besar dari 0 dan tombol Generate tidak lagi nonaktif.',
        tips: 'Anda boleh mulai dari template Excel (menu Hasil → Berkas & Data) bila ingin isi data massal.',
      },
    ],
  },
  {
    id: 'data',
    label: 'Mengisi Data Sekolah',
    ikon: 'kelas',
    ringkas: 'Masukkan jam, hari, guru, kelas, mapel, ruang, dan kebutuhan jam.',
    langkah: [
      {
        id: 'hari',
        no: 4,
        judul: 'Atur Hari & Jam Pelajaran',
        tujuan:
          'Hari dan jam adalah kerangka waktu jadwal; tiap hari bisa beda jumlah JP dan jam istirahat.',
        rute: '/jam',
        aksi: [
          'Buka Data Sekolah → Jam Pelajaran.',
          'Tambahkan baris jam: nama (mis. "Jam 1"), jam mulai, jam selesai, dan tipe (Pelajaran / Istirahat / Apel / Kustom).',
          'Pada field "Aktif pada Hari", centang hari-hari tempat jam ini berlaku. Kosong = aktif semua hari.',
          'Kembali ke bilah kiri, pada bagian atas daftar Hari tekan "+ Tambah Hari" untuk menambah hari, atau ikon pensil untuk mengubah nama hari.',
          'Di modal Hari, atur Batas Maksimal JP bila perlu. Slot non-aktif kini jarang dipakai karena tiap jam sudah bisa dibatasi per hari.',
        ],
        contoh: {
          judul: 'Contoh nyata jam berbeda per hari',
          teks:
            'Senin–Kamis memakai J4 (09:20–10:00). Khusus Jumat, istirahat maju ke 09:00–09:20 dan pulang lebih awal, sehingga J4 hanya dicentang untuk Senin–Kamis (bukan Jumat). Cukup satu daftar jam — tanpa perlu mengakali slot non-aktif.',
        },
        bukti:
          'Kolom "Hari Aktif" menampilkan "Semua hari" atau daftar hari. Grid & matriks hanya menampilkan jam pada hari yang dicentang; Jumat otomatis memakai istirahatnya sendiri dan jumlah JP-nya berkurang.',
        tips: 'Maksimal JP 0 berarti tanpa batas. Untuk jam yang hanya berlaku beberapa hari (mis. istirahat Jumat), cukup atur "Aktif pada Hari" — lebih mudah daripada mematikan slot satu per satu.',
      },
      {
        id: 'guru',
        no: 5,
        judul: 'Input data guru',
        tujuan: 'Guru menentukan siapa pengajar tiap jam; batas jam mencegah beban berlebih.',
        rute: '/guru',
        aksi: [
          'Buka Data Sekolah → Guru, tekan Tambah.',
          'Isi Nama, Kode, Warna kartu, Mata Pelajaran yang diampu, Maks Jam/Minggu, dan Maks Jam/Hari.',
          'Bila ada, isi Pola Distribusi JP (mis. "2, 1") untuk mata pelajaran blok.',
          'Bila perlu, atur slot diinginkan/dilarang pada pemilih slot.',
        ],
        contoh: {
          judul: 'Contoh guru & pola JP',
          teks:
            'Guru "Budi Santoso" mengampu Bahasa Indonesia, Maks Jam/Minggu 24, Maks Jam/Hari 6, dengan pola JP "2, 1" → tiap 3 JP dipecah menjadi blok 2 JP berurutan + 1 JP tunggal. Guru bahasa cenderung ingin semua kelas Bahasa Indonesia.',
        },
        bukti:
          'Guru muncul di tabel dan kartunya di dashboard beban jam; angka jam terjadwal bertambah saat generator berjalan.',
        tips: 'Kode guru dipakai saat mengimpor dari Excel — buat kode unik & konsisten (mis. "BDI" untuk Budi).',
      },
      {
        id: 'ruang',
        no: 6,
        judul: 'Daftarkan ruang & mapel',
        tujuan: 'Ruang dan mapel memastikan pelajaran ditempatkan di tempat yang tepat.',
        rute: '/ruang',
        aksi: [
          'Buka Data Sekolah → Ruang, isi Nama, Tipe (Reguler / Lab Komputer / Lab Sains / Lapangan), dan Kapasitas.',
          'Buka Data Sekolah → Mata Pelajaran, isi Kode, Nama, dan Tipe Ruang yang dibutuhkan (mis. "Lab Komputer" untuk TIK).',
          'Tandai mapel pilihan bila termasuk mata pelajaran pilihan siswa.',
        ],
        contoh: {
          judul: 'Contoh ruang & mapel',
          teks:
            'Ruang "Lab Komputer 1" bertipe Lab Komputer dengan kapasitas 36. Mapel "Informatika" bertipe Lab Komputer → generator hanya menempatkan Informatika di lab komputer, bukan di ruang reguler.',
        },
        bukti:
          'Saat opsi "Wajib ruang sesuai tipe & kapasitas" aktif, jadwal Informatika selalu berada di ruang lab.',
        tips: 'Kapasitas ruang diuji terhadap Jumlah Siswa kelas — ruang yang terlalu kecil akan dilaporkan sebagai konflik kapasitas.',
      },
      {
        id: 'kelas',
        no: 7,
        judul: 'Buat kelas & siswa',
        tujuan: 'Kelas adalah baris utama pada grid jadwal; siswa dipakai untuk jam pilihan.',
        rute: '/kelas',
        aksi: [
          'Buka Data Sekolah → Kelas, isi Nama (mis. "X-1"), Tingkat, Wali Kelas, dan Jumlah Siswa.',
          'Buka Data Sekolah → Siswa untuk menambahkan siswa beserta kelas dan pilihan mapelnya bila ada mapel pilihan.',
        ],
        contoh: {
          judul: 'Contoh kelas',
          teks:
            'Kelas "X-1" tingkat "X" dengan 32 siswa dan wali kelas "Rina Susanti". Total 6 kelas: X-1 s.d. XII-2.',
        },
        bukti:
          'Kelas muncul di Grid Jadwal sebagai kolom/pilihan dan di bagian "Kebutuhan per Kelas" pada dashboard.',
        tips: 'Jumlah siswa wajib diisi agar pemeriksa kapasitas ruang bekerja.',
      },
      {
        id: 'kebutuhan',
        no: 8,
        judul: 'Tentukan Kebutuhan Jam',
        tujuan: 'Inilah daftar pesanan: mapel apa, berapa jam, di kelas mana, oleh guru siapa.',
        rute: '/kebutuhan',
        aksi: [
          'Buka Data Sekolah → Kebutuhan Jam.',
          'Untuk tiap kelas, tambahkan baris: Kelas, Mata Pelajaran, Guru, jumlah Jam/Minggu, dan Ruang (kosongkan untuk otomatis).',
          'Isi kolom Pola JP bila mapel ini diajarkan sebagai blok berurutan.',
        ],
        contoh: {
          judul: 'Contoh kebutuhan nyata',
          teks:
            'X-1 · Matematika · Ahmad Fauzi · 4 jam/minggu · pola "2, 2". X-1 · Bahasa Indonesia · Budi Santoso · 4 jam · pola "2, 2". X-1 · Informatika · Sari Rahmawati · 2 jam · ruang Lab Komputer.',
        },
        bukti:
          'Dashboard menampilkan "Jam/Minggu Dibutuhkan" bertambah sesuai isian, dan Generator siap dijalankan.',
        tips: 'Gunakan tombol salin jadwal/isi masal bila banyak kelas mengambil mapel yang sama.',
      },
      {
        id: 'batasan',
        no: 9,
        judul: 'Pasang batasan & blokir (opsional)',
        tujuan: 'Blokir mengunci slot agar generator tidak menaruh pelajaran di waktu tertentu.',
        rute: '/batasan',
        aksi: [
          'Buka Data Sekolah → Batasan & Blokir.',
          'Tambahkan blokir untuk kelas, guru, atau ruang pada hari & jam tertentu beserta alasannya.',
        ],
        contoh: {
          judul: 'Contoh blokir nyata',
          teks:
            'Guru "Dewi Lestari" tidak bisa mengajar Jumat jam 5–6 karena tugas luar, dan "Lapangan" diblokir Sabtu untuk kegiatan ekstrakurikuler.',
        },
        bukti:
          'Generator menghindari slot terblokir; bila tetap dilanggar, Pemeriksa Konflik menandainya sebagai "Slot Terblokir Dilanggar".',
      },
    ],
  },
  {
    id: 'generate',
    label: 'Menjana & Merapikan',
    ikon: 'generate',
    ringkas: 'Jalankan generator, periksa konflik, rapikan, lalu kunci jadwal tetap.',
    langkah: [
      {
        id: 'generate',
        no: 10,
        judul: 'Jalankan Generator Jadwal',
        tujuan: 'Menyusun seluruh jadwal otomatis dari daftar kebutuhan.',
        rute: '/generate',
        aksi: [
          'Buka menu Utama → Generator Jadwal.',
          'Periksa Ringkasan: total kebutuhan jam, jadwal tetap, dan slot aktif.',
          'Sesuaikan opsi (sebar rata, hindari jam ujung, wajib ruang) dan jumlah percobaan (5–15).',
          'Tekan tombol besar Generate Jadwal dan tunggu hingga selesai.',
        ],
        contoh: {
          judul: 'Contoh: hasil generate',
          teks:
            'Setelah menekan Generate, aplikasi mencoba 5 kombinasi berbeda dan laporan menampilkan "Semua 206 jam pelajaran berhasil dijadwalkan" dalam kurang dari 1 detik. Bila ada yang gagal, laporan menyebutkan kelas, mapel, guru, dan alasannya.',
        },
        bukti:
          'Laporan Hijau muncul dengan jumlah jam ditempatkan sama dengan total kebutuhan; Grid Jadwal kini terisi.',
        tips:
          'Bila ada jam yang gagal ditempatkan (biasanya karena slot kurang atau blokir terlalu ketat), tambah hari/jam atau longgarkan batasan lalu Generate Ulang.',
      },
      {
        id: 'konflik',
        no: 11,
        judul: 'Periksa & selesaikan konflik',
        tujuan: 'Memastikan tidak ada bentrok kelas, guru, ruang, atau batasan.',
        rute: '/konflik',
        aksi: [
          'Buka menu Utama → Pemeriksa Konflik.',
          'Lihat kartu Konflik Keras & Peringatan; klik untuk melihat rincian.',
          'Tekan tombol besar "Selesaikan Semua Konflik" untuk memperbaiki otomatis.',
          'Baca notifikasi hasil perbaikan.',
        ],
        contoh: {
          judul: 'Contoh: bentrok yang sering terjadi',
          teks:
            'Guru "Ahmad Fauzi" terjadwal di X-1 dan XI-1 pada Senin jam 2 sekaligus. Auto-fix mencari slot kosong lain atau menukar posisi, lalu melaporkan "Berhasil menyelesaikan 3 konflik, 0 tersisa".',
        },
        bukti:
          'Badge pada menu Pemeriksa Konflik (angka merah) hilang, dan dashboard menampilkan "Jadwal aktif tanpa konflik keras".',
        tips:
          'Jadwal bertanda "tetap" (terkunci) tidak akan diubah auto-fix. Untuk konflik yang sulit, tambah slot/hari atau longgarkan blokir.',
      },
      {
        id: 'grid',
        no: 12,
        judul: 'Rapikan di Grid Jadwal',
        tujuan: 'Menyesuaikan hasil generator agar cocok dengan pertimbangan manusiawi.',
        rute: '/jadwal',
        aksi: [
          'Buka menu Utama → Grid Jadwal.',
          'Pilih tampilan per Kelas, Guru, atau Ruang.',
          'Seret / klik sel untuk memindahkan pelajaran, atau kunci pelajaran dengan menandainya "tetap".',
          'Gunakan tombol salin jadwal untuk meniru pola antar kelas bila perlu.',
        ],
        contoh: {
          judul: 'Contoh penguncian nyata',
          teks:
            'Kepala sekolah meminta "Upacara" tiap Senin jam 1 (sudah berupa baris Apel) dan Matematika di X-1 pagi hari. Operator menggeser Matematika ke jam 1 Senin lalu menguncinya sebagai tetap sebelum menyusun kelas lain.',
        },
        bukti:
          'Sel berubah posisi sesuai seret, blok JP berurutan tampil menyatu, dan jam terkunci bertanda khusus serta tidak diubah saat Generate Ulang.',
        tips: 'Blok JP dari pola tampil menyatu (merge) agar mudah dibaca; jangan pindahkan satu-satu agar blok tetap utuh.',
      },
    ],
  },
  {
    id: 'hasil',
    label: 'Cetak & Bagikan',
    ikon: 'berkas',
    ringkas: 'Cetak matriks jadwal, ekspor ke Excel, dan bagikan tautan publikasi.',
    langkah: [
      {
        id: 'matriks',
        no: 13,
        judul: 'Cetak Matriks Jadwal',
        tujuan: 'Menghasilkan lembar jadwal resmi untuk ditempel di kelas & ruang guru.',
        rute: '/jadwal-matriks',
        aksi: [
          'Buka menu Hasil → Matriks & Cetak.',
          'Pilih kelas lalu tekan Cetak (Ctrl+P) atau unduh Excel.',
          'Sesuaikan pengurutan sebelum cetak; baris di luar JP aktif ditandai.',
        ],
        contoh: {
          judul: 'Contoh penggunaan nyata',
          teks:
            'Operator mencetak matriks 6 kelas dalam format A4 landscape untuk ditempel di depan setiap kelas, plus satu salinan Excel untuk papan pengumuman ruang guru.',
        },
        bukti:
          'Halaman cetak bersih tanpa menu, dengan kop sekolah, legenda warna guru, dan tabel menyatu untuk blok JP.',
        tips: 'Ukuran kertas A4 landscape diatur otomatis pada saat mencetak.',
      },
      {
        id: 'excel',
        no: 14,
        judul: 'Ekspor Excel & impor massal',
        tujuan: 'Memindahkan data ke spreadsheet atau memuat data dari berkas Excel.',
        rute: '/berkas',
        aksi: [
          'Buka menu Hasil → Berkas & Data.',
          'Unduh "Download Template Excel" untuk template resmi, atau "Ekspor Data ke Excel" untuk data Anda.',
          'Untuk memasukkan data massal, seret berkas .xlsx ke kotak unggah.',
          'Bila ada data wajib kosong, impor akan dibatalkan dan masalahnya dilaporkan.',
        ],
        contoh: {
          judul: 'Contoh impor nyata',
          teks:
            'Operator menerima daftar guru dari staf TU dalam Excel. Ia mengisi template, mengunggahnya, dan seluruh guru + mata pelajaran langsung masuk tanpa mengetik satu-satu. Beberapa baris tanpa kode guru ditolak dan disebutkan agar diperbaiki.',
        },
        bukti:
          'Notifikasi hijau "Impor Excel berhasil" dengan ringkasan jumlah baris tiap jenis data; bila bermasalah, muncul pesan impor dibatalkan.',
        tips:
          'Sheet "Jam Pelajaran" punya kolom "hariAktif" — isi nama hari dipisah titik-koma (contoh: Senin; Selasa; Rabu; Kamis; Sabtu). Kosong berarti aktif semua hari. Tombol "Jadwal (Excel)" mengekspor tabel rapi beserta kop sekolah di baris teratas.',
      },
      {
        id: 'publikasi',
        no: 15,
        judul: 'Bagikan jadwal ke siswa & guru',
        tujuan: 'Menerbitkan jadwal sebagai tautan yang bisa dibuka siapa saja (read-only).',
        rute: '/publikasi',
        aksi: [
          'Buka menu Hasil → Publikasi.',
          'Salin tautan publikasi yang dihasilkan.',
          'Bagikan lewat grup WhatsApp sekolah atau tempel di situs sekolah.',
        ],
        contoh: {
          judul: 'Contoh penerapan nyata',
          teks:
            'Sekolah membagikan satu tautan publikasi ke grup wali murid; siswa dapat membuka jadwal dari ponsel tanpa membuat akun dan tanpa bisa mengubah data.',
        },
        bukti:
          'Tautan membuka tampilan jadwal penuh (tanpa sidebar) yang hanya bisa dilihat, bukan diedit.',
        tips: 'Perbarui isi desktop, lalu bagikan ulang tautan yang sudah Anda unduh sebagai JSON bila ingin versi terbaru.',
      },
      {
        id: 'rutin',
        no: 16,
        judul: 'Simpan cadangan & perbarui setiap semester',
        tujuan: 'Menjaga data aman dan proses siap diulang di semester berikutnya.',
        rute: '/berkas',
        aksi: [
          'Di Berkas & Data, tekan "Unduh JSON" untuk cadangan lengkap (termasuk jadwal).',
          'Simpan berkas di drive sekolah agar bisa dimuat kembali kapan saja.',
          'Setiap semester: ubah kebutuhan jam, Generate Ulang, periksa konflik, cetak, bagikan.',
        ],
        contoh: {
          judul: 'Contoh operasional rutin',
          teks:
            'Di awal semester ganjil, tim kurikulum menyimpan cadangan semester lalu dengan nama "jadwal-2024-2025-ganjil.json", membuat perubahan guru & mapel, lalu menjalankan ulang proses penjadwalan dari langkah 8.',
        },
        bukti:
          'Berkas JSON tersimpan di komputer dan bisa dimuat kembali lewat tombol "Muat dari Berkas" tanpa kehilangan data.',
        tips: 'Zona Berbahaya di halaman yang sama dapat mengembalikan data contoh atau menghapus semua data dengan konfirmasi ganda.',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Kartu satu langkah
// ---------------------------------------------------------------------------

function KartuLangkah({
  langkah,
  buka,
  onToggle,
  onBuka,
  bisaDibuka,
}: {
  langkah: Langkah;
  buka: boolean;
  onToggle: () => void;
  onBuka: () => void;
  bisaDibuka: boolean;
}) {
  return (
    <Card className={`pt-step ${buka ? 'buka' : ''}`}>
      <button className="pt-step-head" onClick={onToggle} aria-expanded={buka}>
        <span className="pt-step-no">{langkah.no}</span>
        <span className="pt-step-judul">
          <b>{langkah.judul}</b>
          <span className="pt-step-tujuan">{langkah.tujuan}</span>
        </span>
        <span className={`pt-step-chev ${buka ? 'buka' : ''}`}>
          <Icon name="bawah" size={16} />
        </span>
      </button>

      {buka ? (
        <div className="pt-step-body">
          <div className="pt-blok">
            <div className="pt-blok-head">
              <Icon name="daftar" size={14} />
              Langkah yang dilakukan
            </div>
            <ol className="pt-aksi">
              {langkah.aksi.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ol>
          </div>

          <div className="pt-cont">
            <div className="pt-blok-head">
              <Icon name="info" size={14} />
              Contoh nyata
            </div>
            <div className="pt-contoh-judul">{langkah.contoh.judul}</div>
            <p className="pt-contoh-teks">{langkah.contoh.teks}</p>
          </div>

          <div className="pt-bukti">
            <div className="pt-bukti-head">
              <Icon name="cek" size={14} />
              Bukti berhasil
            </div>
            <p>{langkah.bukti}</p>
          </div>

          {langkah.tips ? (
            <div className="pt-tips">
              <Icon name="info" size={14} />
              <span>{langkah.tips}</span>
            </div>
          ) : null}

          {langkah.rute && bisaDibuka ? (
            <div className="pt-aksi-tombol">
              <Btn variant="primary" icon="kanan" onClick={onBuka}>
                Buka halaman ini
              </Btn>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Halaman
// ---------------------------------------------------------------------------

export function HalPetunjuk() {
  const { project } = useProject();
  const navigate = useNavigate();
  const [bab, setBab] = useState(BAB[0].id);
  const [buka, setBuka] = useState<Set<string>>(() => new Set([BAB[0].langkah[0].id]));

  const babAktif = BAB.find((b) => b.id === bab) ?? BAB[0];

  // Ringkasan kesiapan data proyek — sebagai "bukti nyata" kondisi saat ini.
  const konflik = useMemo(() => checkConflicts(project), [project]);
  const jumlahError = konflik.filter((k) => k.tingkat === 'error').length;
  const totalKebutuhan = project.kebutuhan.reduce((a, r) => a + r.jumlahJam, 0);
  const slotAktif = useMemo(
    () => project.hari.reduce((a, _, h) => a + periodeAktifHari(project, h).length, 0),
    [project],
  );

  const kesiapan = [
    { label: 'Hari diatur', nilai: project.hari.length, target: 'minimal 1', ok: project.hari.length > 0 },
    { label: 'Jam pelajaran', nilai: project.periode.filter((p) => p.tipe === 'pelajaran').length, target: 'minimal 1', ok: project.periode.some((p) => p.tipe === 'pelajaran') },
    { label: 'Guru', nilai: project.guru.length, target: 'minimal 1', ok: project.guru.length > 0 },
    { label: 'Kelas', nilai: project.kelas.length, target: 'minimal 1', ok: project.kelas.length > 0 },
    { label: 'Mapel', nilai: project.mapel.length, target: 'minimal 1', ok: project.mapel.length > 0 },
    { label: 'Kebutuhan jam', nilai: totalKebutuhan, target: 'lebih dari 0', ok: totalKebutuhan > 0 },
    { label: 'Slot aktif per kelas', nilai: slotAktif, target: 'cukup untuk kebutuhan', ok: slotAktif >= totalKebutuhan },
    { label: 'Jadwal terisi', nilai: project.jadwal.length, target: 'sama dengan kebutuhan', ok: project.jadwal.length === totalKebutuhan && totalKebutuhan > 0 },
    { label: 'Konflik keras', nilai: jumlahError, target: '0', ok: jumlahError === 0 },
  ];

  const toggle = (id: string) =>
    setBuka((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      <PageHead
        title="Petunjuk Penggunaan"
        desc="Panduan langkah demi langkah menyusun jadwal pelajaran — dari menyiapkan data, menjalankan generator, sampai mencetak dan membagikan jadwal. Setiap langkah disertai contoh nyata dan bukti keberhasilan."
        actions={
          <>
            <Btn
              variant="ghost"
              icon="daftar"
              onClick={() => setBuka(new Set(babAktif.langkah.map((l) => l.id)))}
            >
              Buka Semua Langkah
            </Btn>
            <Btn variant="ghost" icon="tutup" onClick={() => setBuka(new Set())}>
              Tutup Semua
            </Btn>
          </>
        }
      />

      <div className="pt-hero">
        <div className="pt-hero-ic">
          <Icon name="info" size={26} />
        </div>
        <div>
          <h2>Dari nol sampai jadwal siap cetak, dalam 16 langkah</h2>
          <p>
            Ikuti tab di bawah berurutan. Setiap langkah memuat daftar perintah, satu contoh yang bisa
            Anda tiru persis, dan bukti yang menandakan langkah itu berhasil. Anda juga bisa langsung
            melompat ke halaman terkait lewat tombol di dalam setiap langkah.
          </p>
        </div>
        <div className="pt-hero-stat">
          <div>
            <b>{BAB.reduce((a, b) => a + b.langkah.length, 0)}</b>
            <span>langkah</span>
          </div>
          <div>
            <b>{BAB.length}</b>
            <span>tahap</span>
          </div>
        </div>
      </div>

      <Card className="pt-kesiapan">
        <div className="card-title">Bukti Nyata: Kesiapan Data Anda Sekarang</div>
        <div className="card-sub">
          Ini kondisi proyek Anda saat ini. Semakin banyak tanda centang hijau, semakin siap jadwal
          disusun &amp; dicetak.
        </div>
        <div className="pt-kesiapan-grid">
          {kesiapan.map((k) => (
            <div key={k.label} className={`pt-ks ${k.ok ? 'ok' : ''}`}>
              <span className="pt-ks-ic">
                <Icon name={k.ok ? 'cek' : 'info'} size={14} />
              </span>
              <div>
                <div className="pt-ks-nilai">{k.nilai}</div>
                <div className="pt-ks-label">{k.label}</div>
                <div className="pt-ks-target">harus {k.target}</div>
              </div>
            </div>
          ))}
        </div>
        {jumlahError > 0 ? (
          <Banner tone="bahaya" icon="konflik" action={
            <Btn size="sm" variant="ghost" onClick={() => navigate('/konflik')}>
              Periksa Konflik
            </Btn>
          }>
            Ada <b>{jumlahError}</b> konflik keras pada jadwal. Ikuti langkah 11 untuk menyelesaikannya.
          </Banner>
        ) : project.jadwal.length > 0 && totalKebutuhan > 0 && project.jadwal.length === totalKebutuhan ? (
          <Banner tone="sukses" icon="cek">
            Jadwal tampak lengkap dan bebas konflik keras. Lanjutkan ke langkah 13 untuk mencetak.
          </Banner>
        ) : null}
      </Card>

      <Tabs
        items={BAB.map((b) => ({ id: b.id, label: b.label, icon: b.ikon }))}
        value={bab}
        onChange={setBab}
      />

      <div className="pt-bab-ringkas">
        <Icon name={babAktif.ikon} size={16} />
        {babAktif.ringkas}
      </div>

      <div className="pt-steps">
        {babAktif.langkah.map((l) => (
          <KartuLangkah
            key={l.id}
            langkah={l}
            buka={buka.has(l.id)}
            onToggle={() => toggle(l.id)}
            onBuka={() => l.rute && navigate(l.rute)}
            bisaDibuka={Boolean(l.rute)}
          />
        ))}
      </div>

      <Card className="pt-peta">
        <div className="card-title">Peta Alur Kerja</div>
        <div className="card-sub">Gambaran singkat urutan 4 tahap besar penjadwalan.</div>
        <div className="pt-peta-alur">
          {BAB.map((b, i) => (
            <div key={b.id} className="pt-peta-item">
              <span className="pt-peta-no">{i + 1}</span>
              <div>
                <b>{b.label}</b>
                <span>{b.ringkas}</span>
              </div>
              <span className="pt-peta-jml">{b.langkah.length} langkah</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
