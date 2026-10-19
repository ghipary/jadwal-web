// Halaman berkas: simpan/muat proyek (JSON), ekspor CSV, reset data.

import { useRef, useState } from 'react';
import { DAYS } from '../types';
import { parseProyek, useProject } from '../store';
import { bacaBerkasExcel, bacaWorkbook, buatTemplateXlsx } from '../excel';
import { downloadXlsx } from '../xlsx';
import { Banner, Btn, Card, Icon, Modal } from '../ui';
import { download, downloadCSV } from '../utils';

export function HalBerkas() {
  const { project, loadProject, resetDemo, set } = useProject();
  const fileRef = useRef<HTMLInputElement>(null);
  const xlsxRef = useRef<HTMLInputElement>(null);
  const [pesan, setPesan] = useState<{ tone: 'sukses' | 'bahaya'; teks: string } | null>(null);
  const [over, setOver] = useState(false);
  const [bukaHapus, setBukaHapus] = useState(false);
  const [kunciHapus, setKunciHapus] = useState('');

  const namaFile = (ekst: string) => {
    const tgl = new Date().toISOString().slice(0, 10);
    const nama = project.info.nama.replace(/[^\w]+/g, '-').toLowerCase() || 'sekolah';
    return `jadwal-${nama}-${tgl}.${ekst}`;
  };

  const unduhJSON = () => {
    download(namaFile('json'), JSON.stringify(project, null, 2), 'application/json');
    setPesan({ tone: 'sukses', teks: 'Berkas proyek berhasil diunduh. Simpan sebagai cadangan.' });
  };

  const muatFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const teks = await f.text();
      const data = parseProyek(JSON.parse(teks));
      if (!data) {
        setPesan({ tone: 'bahaya', teks: 'Berkas tidak dikenali — struktur proyek tidak sesuai.' });
        return;
      }
      if (!window.confirm('Ganti seluruh data saat ini dengan isi berkas ini?')) return;
      loadProject(data);
      setPesan({ tone: 'sukses', teks: `Proyek “${data.info.nama}” berhasil dimuat (${data.jadwal.length} jam terjadwal).` });
    } catch {
      setPesan({ tone: 'bahaya', teks: 'Gagal membaca berkas — pastikan berkas JSON asli hasil unduhan aplikasi ini.' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const eksporGuru = () =>
    downloadCSV('data-guru.csv', [
      ['Kode', 'Nama', 'Mata Pelajaran', 'Maks Jam/Minggu', 'Maks Jam/Hari', 'Slot Dilarang'],
      ...project.guru.map((g) => [
        g.kode,
        g.nama,
        g.mapelIds.map((id) => project.mapel.find((m) => m.id === id)?.nama ?? '?').join('; '),
        g.maxJam,
        g.maxPerHari,
        g.slotDilarang.length,
      ]),
    ]);

  const eksporKelas = () =>
    downloadCSV('data-kelas.csv', [
      ['Nama', 'Tingkat', 'Wali Kelas', 'Jumlah Siswa'],
      ...project.kelas.map((c) => [
        c.nama,
        c.tingkat,
        project.guru.find((g) => g.id === c.waliKelasId)?.nama ?? '',
        c.jumlahSiswa,
      ]),
    ]);

  const eksporSiswa = () =>
    downloadCSV('data-siswa.csv', [
      ['Nama', 'Kelas', 'Pilihan Mapel'],
      ...project.siswa.map((s) => [
        s.nama,
        project.kelas.find((c) => c.id === s.kelasId)?.nama ?? '',
        s.pilihan.map((id) => project.mapel.find((m) => m.id === id)?.nama ?? '?').join('; '),
      ]),
    ]);

  const eksporMapel = () =>
    downloadCSV('data-mapel.csv', [
      ['Kode', 'Nama', 'Tipe Ruang', 'Mapel Pilihan'],
      ...project.mapel.map((m) => [m.kode, m.nama, m.tipeRuang, m.pilihan ? 'Ya' : 'Tidak']),
    ]);

  const eksporRuang = () =>
    downloadCSV('data-ruang.csv', [
      ['Nama', 'Tipe', 'Kapasitas'],
      ...project.ruang.map((r) => [r.nama, r.tipe, r.kapasitas]),
    ]);

  const eksporKebutuhan = () =>
    downloadCSV('kebutuhan-jam.csv', [
      ['Kelas', 'Mata Pelajaran', 'Guru', 'Ruang', 'Jam/Minggu'],
      ...project.kebutuhan.map((k) => [
        project.kelas.find((c) => c.id === k.kelasId)?.nama ?? '',
        project.mapel.find((m) => m.id === k.mapelId)?.nama ?? '',
        project.guru.find((g) => g.id === k.guruId)?.nama ?? '',
        project.ruang.find((r) => r.id === k.ruangId)?.nama ?? 'Otomatis',
        k.jumlahJam,
      ]),
    ]);

  const eksporJadwal = () => {
    const urutPer = new Map(project.periode.map((p, i) => [p.id, i]));
    const sorted = [...project.jadwal].sort(
      (a, b) =>
        a.hari - b.hari ||
        (urutPer.get(a.periodeId) ?? 99) - (urutPer.get(b.periodeId) ?? 99) ||
        a.kelasId.localeCompare(b.kelasId),
    );
    downloadCSV('jadwal-lengkap.csv', [
      ['Hari', 'Jam', 'Waktu', 'Kelas', 'Mata Pelajaran', 'Guru', 'Ruang', 'Tetap'],
      ...sorted.map((j) => {
        const per = project.periode.find((p) => p.id === j.periodeId);
        return [
          DAYS[j.hari] ?? '',
          per?.nama ?? '',
          `${per?.mulai ?? ''}-${per?.selesai ?? ''}`,
          project.kelas.find((c) => c.id === j.kelasId)?.nama ?? '',
          project.mapel.find((m) => m.id === j.mapelId)?.nama ?? '',
          project.guru.find((g) => g.id === j.guruId)?.nama ?? '',
          project.ruang.find((r) => r.id === j.ruangId)?.nama ?? '',
          j.tetap ? 'Ya' : 'Tidak',
        ];
      }),
    ]);
  };

  const unduhTemplate = () => {
    const slug = project.info.nama.replace(/[^\w-]+/g, '_').toLowerCase() || 'sekolah';
    const tgl = new Date().toISOString().slice(0, 10);
    downloadXlsx(`template-jadwal-${slug}-${tgl}.xlsx`, buatTemplateXlsx(project));
    setPesan({
      tone: 'sukses',
      teks: 'Template Excel diunduh — 8 sheet (Guru, Kelas, Siswa, Mata Pelajaran, Ruang, Jam Pelajaran, Kebutuhan Jam, Batasan). Isi datanya lalu unggah kembali ke sini.',
    });
  };

  const imporExcel = async (f: File | undefined) => {
    if (!f) return;
    try {
      const wb = await bacaBerkasExcel(f);
      const hasil = bacaWorkbook(wb, project);
      if (!hasil) {
        setPesan({
          tone: 'bahaya',
          teks: 'Tidak ditemukan sheet yang dikenali. Gunakan “Download Template Excel” sebagai acuan format.',
        });
        return;
      }
      const j = hasil.jumlah;
      const ringkas = `Guru ${j.guru} · Kelas ${j.kelas} · Siswa ${j.siswa} · Mapel ${j.mapel} · Ruang ${j.ruang} · Jam ${j.periode} · Kebutuhan ${j.kebutuhan} · Batasan ${j.blokir}`;
      const konfirmasi =
        `Impor data dari “${f.name}”?\n\n` +
        ringkas +
        (hasil.dilewati ? `\n${hasil.dilewati} baris dilewati (referensi tidak ditemukan).` : '') +
        '\n\nData saat ini akan diganti; jadwal lama dikosongkan karena id referensi berubah — jalankan ulang Generator setelah impor.';
      if (!window.confirm(konfirmasi)) return;
      loadProject(hasil.project);
      setPesan({
        tone: 'sukses',
        teks: `Impor Excel berhasil — ${ringkas}${
          hasil.dilewati ? ` (${hasil.dilewati} baris dilewati)` : ''
        }.`,
      });
    } catch {
      setPesan({
        tone: 'bahaya',
        teks: 'Gagal membaca berkas Excel — pastikan berkas .xlsx hasil template aplikasi ini.',
      });
    }
  };

  const hapusSemua = () => {
    set({
      periode: [],
      guru: [],
      kelas: [],
      siswa: [],
      mapel: [],
      ruang: [],
      kebutuhan: [],
      jadwal: [],
      blokir: [],
    });
    setBukaHapus(false);
    setKunciHapus('');
    setPesan({
      tone: 'sukses',
      teks: 'Seluruh data aplikasi telah dihapus. Muat berkas JSON/template Excel atau mulai dari nol.',
    });
  };

  const tombolEksporMaster = [
    { label: 'Guru', icon: 'guru', fn: eksporGuru },
    { label: 'Kelas', icon: 'kelas', fn: eksporKelas },
    { label: 'Siswa', icon: 'siswa', fn: eksporSiswa },
    { label: 'Mapel', icon: 'mapel', fn: eksporMapel },
    { label: 'Ruang', icon: 'ruang', fn: eksporRuang },
  ];
  const tombolEksporJadwal = [
    { label: 'Kebutuhan Jam', icon: 'daftar', fn: eksporKebutuhan },
    { label: 'Jadwal Lengkap', icon: 'jadwal', fn: eksporJadwal },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Berkas & Data</h1>
          <p>
            Data tersimpan otomatis di browser ini. Unduh berkas JSON sebagai cadangan, muat kembali di
            perangkat lain, atau ekspor ke CSV untuk Excel/Google Sheets.
          </p>
        </div>
      </div>

      {pesan ? (
        <Banner
          tone={pesan.tone}
          icon={pesan.tone === 'sukses' ? 'cek' : 'konflik'}
          action={
            <Btn size="sm" variant="ghost" onClick={() => setPesan(null)}>
              Tutup
            </Btn>
          }
        >
          {pesan.teks}
        </Banner>
      ) : null}

      <div className="grid-2">
        <Card>
          <div className="card-title">Cadangan Proyek (JSON)</div>
          <div className="card-sub">
            Berisi seluruh data + jadwal + opsi. Format ini juga yang dibagikan lewat tautan publikasi.
          </div>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <Btn variant="primary" icon="unduh" onClick={unduhJSON}>
              Unduh JSON
            </Btn>
            <Btn variant="ghost" icon="unggah" onClick={() => fileRef.current?.click()}>
              Muat dari Berkas
            </Btn>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden-input"
              onChange={(e) => void muatFile(e.target.files?.[0])}
            />
          </div>
        </Card>

        <Card>
          <div className="card-title">Ekspor CSV</div>
          <div className="card-sub">Satu berkas CSV per jenis data (UTF-8, siap dibuka Excel).</div>
          <div className="field" style={{ gap: 8 }}>
            <div className="card-sub" style={{ margin: 0 }}>Data Master</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 9 }}>
              {tombolEksporMaster.map((t) => (
                <Btn key={t.label} variant="soft" size="sm" icon={t.icon} onClick={t.fn}>
                  {t.label}
                </Btn>
              ))}
            </div>
          </div>
          <div className="field" style={{ gap: 8, marginTop: 4 }}>
            <div className="card-sub" style={{ margin: 0 }}>Data Jadwal</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 9 }}>
              {tombolEksporJadwal.map((t) => (
                <Btn key={t.label} variant="soft" size="sm" icon={t.icon} onClick={t.fn}>
                  {t.label}
                </Btn>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="card-title">Excel Massal (Template & Impor)</div>
        <div className="card-sub">
          Unduh template berisi 8 sheet — <b>Guru</b>, <b>Kelas</b>, <b>Siswa</b>,{' '}
          <b>Mata Pelajaran</b>, <b>Ruang</b>, <b>Jam Pelajaran</b>, <b>Kebutuhan Jam</b>, dan{' '}
          <b>Batasan</b> — isi datanya di Excel, lalu seret berkasnya ke kotak berikut untuk
          mengimpor seluruh data sekaligus.
        </div>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 12 }}>
          <Btn variant="primary" icon="unduh" onClick={unduhTemplate}>
            Download Template Excel
          </Btn>
          <Btn variant="ghost" icon="unggah" onClick={() => xlsxRef.current?.click()}>
            Pilih Berkas Excel
          </Btn>
          <input
            ref={xlsxRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden-input"
            onChange={(e) => {
              void imporExcel(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        <div
          className={`dropzone ${over ? 'over' : ''}`}
          role="button"
          tabIndex={0}
          title="Seret berkas Excel ke sini"
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void imporExcel(e.dataTransfer.files?.[0]);
          }}
          onClick={() => xlsxRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') xlsxRef.current?.click();
          }}
        >
          <Icon name="unggah" size={24} />
          <b>Seret &amp; letakkan berkas Excel (.xlsx) di sini</b>
          <span className="hint">
            Semua sheet akan dibaca otomatis dan langsung masuk ke database aplikasi.
          </span>
        </div>
      </Card>

      <Card>
        <div className="card-title">Zona Berbahaya</div>
        <div className="card-sub">
          Reset mengembalikan data contoh sekolah; <b>Hapus Semua Data</b> menghapus seluruh data
          dengan konfirmasi ganda (ketik “HAPUS”). Keduanya tidak memengaruhi berkas yang sudah Anda
          unduh.
        </div>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <Btn
            variant="ghost"
            icon="putar"
            onClick={() => {
              if (window.confirm('Kembalikan seluruh data ke contoh sekolah bawaan?'))
                resetDemo();
            }}
          >
            Reset ke Data Contoh
          </Btn>
          <Btn
            variant="danger"
            icon="hapus"
            onClick={() => {
              setKunciHapus('');
              setBukaHapus(true);
            }}
          >
            Hapus Semua Data
          </Btn>
        </div>
      </Card>

      <Card>
        <div className="card-title">Cetak Jadwal</div>
        <div className="card-sub">
          Buka halaman <b>Jadwal</b>, pilih kelas/guru/ruang yang ingin dicetak, lalu tekan tombol{' '}
          <b>Cetak</b> — navigasi akan disembunyikan otomatis saat dicetak.
        </div>
        <Btn
          variant="ghost"
          icon="cetak"
          onClick={() => {
            window.location.hash = '#/jadwal';
          }}
        >
          Buka Halaman Jadwal
        </Btn>
      </Card>

      {/* --- Modal konfirmasi ganda: hapus semua data --- */}
      <Modal
        open={bukaHapus}
        title="Hapus Semua Data"
        desc="Konfirmasi ganda diminta: ketik “HAPUS” untuk mengaktifkan tombol hapus."
        lebar="sm"
        onClose={() => setBukaHapus(false)}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setBukaHapus(false)}>
              Batal
            </Btn>
            <Btn
              variant="danger"
              icon="hapus"
              disabled={kunciHapus.trim() !== 'HAPUS'}
              onClick={hapusSemua}
            >
              Ya, Hapus Semua
            </Btn>
          </>
        }
      >
        <Banner tone="bahaya" icon="konflik">
          Seluruh data akan dihapus permanen: guru, kelas, siswa, mata pelajaran, ruang, jam
          pelajaran, kebutuhan jam, jadwal, dan batasan. Tindakan ini tidak bisa dibatalkan.
        </Banner>
        <div className="field">
          <label htmlFor="kunci-hapus">
            Ketik <b>HAPUS</b> untuk melanjutkan
          </label>
          <input
            id="kunci-hapus"
            className="input"
            autoComplete="off"
            placeholder="HAPUS"
            value={kunciHapus}
            onChange={(e) => setKunciHapus(e.target.value)}
          />
          <span className="hint">
            Tombol hapus baru aktif bila teks sama persis dengan “HAPUS” (huruf kapital).
          </span>
        </div>
      </Modal>
    </>
  );
}
