// Halaman berkas: simpan/muat proyek (JSON), ekspor CSV, reset data.

import { useRef, useState } from 'react';
import { DAYS } from '../types';
import { parseProyek, useProject } from '../store';
import { Banner, Btn, Card, Icon } from '../ui';
import { download, downloadCSV } from '../utils';

export function HalBerkas() {
  const { project, loadProject, resetDemo, set } = useProject();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pesan, setPesan] = useState<{ tone: 'sukses' | 'bahaya'; teks: string } | null>(null);

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

  const kosongkanSemua = () => {
    if (
      !window.confirm(
        'Kosongkan SEMUA data (guru, kelas, siswa, mapel, ruang, kebutuhan, jadwal, batasan)? Tindakan ini tidak bisa dibatalkan.',
      )
    )
      return;
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
    setPesan({ tone: 'sukses', teks: 'Semua data dikosongkan. Muat berkas JSON atau mulai dari nol.' });
  };

  const tombolEkspor = [
    { label: 'Data Guru', icon: 'guru', fn: eksporGuru },
    { label: 'Data Kelas', icon: 'kelas', fn: eksporKelas },
    { label: 'Data Siswa', icon: 'siswa', fn: eksporSiswa },
    { label: 'Data Mapel', icon: 'mapel', fn: eksporMapel },
    { label: 'Data Ruang', icon: 'ruang', fn: eksporRuang },
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
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            {tombolEkspor.map((t) => (
              <Btn key={t.label} variant="soft" size="sm" icon={t.icon} onClick={t.fn}>
                {t.label}
              </Btn>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="card-title">Zona Berbahaya</div>
        <div className="card-sub">
          Reset mengembalikan data contoh sekolah; kosongkan menghapus semuanya. Keduanya tidak memengaruhi
          berkas yang sudah Anda unduh.
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
          <Btn variant="danger" icon="hapus" onClick={kosongkanSemua}>
            Kosongkan Semua Data
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
    </>
  );
}
