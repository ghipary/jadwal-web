// Halaman-halaman data: Guru, Kelas, Siswa, Mapel, Ruang, Jam, Batasan.

import { useState } from 'react';
import {
  LABEL_TIPE_RUANG,
  PALET_GURU,
  parseSlotKey,
  slotKey,
  TIPE_RUANG_KEBUTUHAN,
  TIPE_RUANG_OPTIONS,
  TIPE_WAKTU_OPTIONS,
  labelTipeWaktu,
} from '../types';
import type {
  Block,
  Period,
  SchoolClass,
  SlotKey,
  Student,
  Subject,
  Teacher,
} from '../types';
import { useProject } from '../store';
import { Btn, Icon, type FieldDef } from '../ui';
import { DataPage, EntityConfig } from './DataPage';
import { uid } from '../utils';

// ---------------------------------------------------------------------------
// Guru
// ---------------------------------------------------------------------------

export function HalGuru() {
  const { project } = useProject();
  const namaMapel = (id: string) => project.mapel.find((m) => m.id === id)?.nama ?? '(terhapus)';

  const cfg: EntityConfig<Teacher> = {
    collection: 'guru',
    judul: 'Guru',
    desc: 'Daftar guru, mata pelajaran yang diampu, batas jam mengajar per minggu/hari, dan preferensi jam.',
    ikon: 'guru',
    placeholderCari: 'Cari nama / kode guru…',
    labelHapus: (r) => r.nama || r.kode,
    judulForm: (r) => (r?.id ? 'Ubah Guru' : 'Tambah Guru'),
    descForm: 'Kosongkan kode bila tidak perlu. Batas jam dipakai oleh generator jadwal.',
    blank: () => ({
      id: uid('g'),
      nama: '',
      kode: '',
      warna: PALET_GURU[project.guru.length % PALET_GURU.length],
      mapelIds: [],
      maxJam: 24,
      maxPerHari: 6,
      slotDiinginkan: [],
      slotDilarang: [],
      catatan: '',
    }),
    kolom: [
      { label: 'Kode', render: (r) => <span className="badge badge-abu">{r.kode || '—'}</span> },
      {
        label: 'Nama Guru',
        render: (r) => (
          <div>
            <b>
              <i className="warna-dot" style={{ background: r.warna }} />
              {r.nama}
            </b>
            {r.catatan ? <div className="hint">{r.catatan}</div> : null}
          </div>
        ),
      },
      {
        label: 'Mata Pelajaran',
        render: (r) => (
          <div className="multi">
            {r.mapelIds.length === 0 ? <span className="hint">—</span> : null}
            {r.mapelIds.map((id) => (
              <span key={id} className="chip">
                {namaMapel(id)}
              </span>
            ))}
          </div>
        ),
      },
      {
        label: 'Batas / Minggu',
        render: (r) => (
          <span>
            {project.jadwal.filter((j) => j.guruId === r.id).length} / {r.maxJam}
          </span>
        ),
      },
      { label: 'Batas / Hari', render: (r) => r.maxPerHari },
      {
        label: 'Slot Dilarang',
        render: (r) => <span className="badge badge-abu">{r.slotDilarang.length} slot</span>,
      },
    ],
    fields: [
      { key: 'nama', label: 'Nama Lengkap', type: 'text', placeholder: 'Contoh: Rina Susanti, S.Pd.' },
      { key: 'kode', label: 'Kode', type: 'text', placeholder: 'Contoh: MTH' },
      {
        key: 'warna',
        label: 'Warna Guru',
        type: 'color',
        hint: 'Warna latar kartu jadwal & sel matriks cetak saat guru ini mengajar.',
      },
      {
        key: 'mapelIds',
        label: 'Mata Pelajaran yang Diampu',
        type: 'multi',
        options: project.mapel.map((m) => ({ value: m.id, label: m.nama })),
      },
      {
        key: 'maxJam',
        label: 'Maks. Jam / Minggu',
        type: 'number',
        min: 1,
        max: 40,
        hint: 'Batas total jam mengajar dalam satu minggu.',
      },
      {
        key: 'maxPerHari',
        label: 'Maks. Jam / Hari',
        type: 'number',
        min: 1,
        max: 12,
        hint: 'Batas jam mengajar dalam satu hari.',
      },
      {
        key: 'slotDiinginkan',
        label: 'Slot yang Disukai',
        type: 'slots',
        hint: 'Klik sel untuk memilih — generator akan cenderung menempatkan di slot ini.',
      },
      {
        key: 'slotDilarang',
        label: 'Slot yang Dilarang',
        type: 'slots',
        hint: 'Klik sel untuk memilih — generator tidak akan memakai slot ini.',
      },
      { key: 'catatan', label: 'Catatan', type: 'textarea', placeholder: 'Opsional…' },
    ],
  };
  return <DataPage cfg={cfg} />;
}

// ---------------------------------------------------------------------------
// Kelas
// ---------------------------------------------------------------------------

export function HalKelas() {
  const { project } = useProject();
  const namaGuru = (id: string) => project.guru.find((g) => g.id === id)?.nama.split(',')[0] ?? '—';

  const cfg: EntityConfig<SchoolClass> = {
    collection: 'kelas',
    judul: 'Kelas',
    desc: 'Rombongan belajar: nama kelas, tingkat, wali kelas, dan jumlah siswa (dipakai untuk kapasitas ruang).',
    ikon: 'kelas',
    placeholderCari: 'Cari kelas…',
    labelHapus: (r) => r.nama,
    judulForm: (r) => (r?.id ? 'Ubah Kelas' : 'Tambah Kelas'),
    blank: () => ({
      id: uid('k'),
      nama: '',
      tingkat: 'X',
      waliKelasId: '',
      jumlahSiswa: 36,
    }),
    kolom: [
      { label: 'Nama Kelas', render: (r) => <b>{r.nama}</b> },
      { label: 'Tingkat', render: (r) => <span className="badge badge-biru">{r.tingkat}</span> },
      { label: 'Wali Kelas', render: (r) => namaGuru(r.waliKelasId) },
      { label: 'Jumlah Siswa', render: (r) => `${r.jumlahSiswa} siswa` },
      {
        label: 'Jam / Minggu',
        render: (r) => project.jadwal.filter((j) => j.kelasId === r.id).length,
      },
      {
        label: 'Kebutuhan',
        render: (r) =>
          project.kebutuhan.filter((k) => k.kelasId === r.id).reduce((a, k) => a + k.jumlahJam, 0) +
          ' jam',
      },
    ],
    fields: [
      { key: 'nama', label: 'Nama Kelas', type: 'text', placeholder: 'Contoh: X-1' },
      {
        key: 'tingkat',
        label: 'Tingkat',
        type: 'select',
        options: [
          { value: 'X', label: 'X (Kelas 10)' },
          { value: 'XI', label: 'XI (Kelas 11)' },
          { value: 'XII', label: 'XII (Kelas 12)' },
        ],
      },
      {
        key: 'waliKelasId',
        label: 'Wali Kelas',
        type: 'select',
        options: [
          { value: '', label: '— Belum ditentukan —' },
          ...project.guru.map((g) => ({ value: g.id, label: g.nama })),
        ],
      },
      {
        key: 'jumlahSiswa',
        label: 'Jumlah Siswa',
        type: 'number',
        min: 1,
        max: 80,
        hint: 'Dipakai untuk mengecek kapasitas ruang saat generate.',
      },
    ],
  };
  return <DataPage cfg={cfg} />;
}

// ---------------------------------------------------------------------------
// Siswa
// ---------------------------------------------------------------------------

export function HalSiswa() {
  const { project } = useProject();
  const namaKelas = (id: string) => project.kelas.find((c) => c.id === id)?.nama ?? '—';
  const mapelPilihan = project.mapel.filter((m) => m.pilihan);

  const cfg: EntityConfig<Student> = {
    collection: 'siswa',
    judul: 'Siswa',
    desc: 'Daftar siswa per kelas. Pilihan siswa dipakai pada tampilan jadwal per siswa (mapel pilihan disorot/diredupkan).',
    ikon: 'siswa',
    placeholderCari: 'Cari nama siswa…',
    labelHapus: (r) => r.nama,
    judulForm: (r) => (r?.id ? 'Ubah Siswa' : 'Tambah Siswa'),
    blank: () => ({ id: uid('s'), nama: '', kelasId: project.kelas[0]?.id ?? '', pilihan: [] }),
    kolom: [
      { label: 'Nama Siswa', render: (r) => <b>{r.nama}</b> },
      {
        label: 'Kelas',
        render: (r) => <span className="badge badge-biru">{namaKelas(r.kelasId)}</span>,
      },
      {
        label: 'Pilihan Mapel',
        render: (r) =>
          r.pilihan.length === 0 ? (
            <span className="hint">—</span>
          ) : (
            <div className="multi">
              {r.pilihan.map((id) => (
                <span key={id} className="chip chip-on">
                  {project.mapel.find((m) => m.id === id)?.nama ?? '?'}
                </span>
              ))}
            </div>
          ),
      },
    ],
    fields: [
      { key: 'nama', label: 'Nama Siswa', type: 'text', placeholder: 'Nama lengkap' },
      {
        key: 'kelasId',
        label: 'Kelas',
        type: 'select',
        options: project.kelas.map((c) => ({ value: c.id, label: c.nama })),
      },
      {
        key: 'pilihan',
        label: 'Pilihan Mapel',
        type: 'multi',
        options: mapelPilihan.map((m) => ({ value: m.id, label: m.nama })),
        hint:
          mapelPilihan.length === 0
            ? 'Belum ada mapel bertanda “pilihan”. Tandai dulu di halaman Mapel.'
            : 'Pilih mapel yang diambil siswa ini (untuk kelas dengan peminatan).',
      },
    ],
  };
  return <DataPage cfg={cfg} />;
}

// ---------------------------------------------------------------------------
// Mapel
// ---------------------------------------------------------------------------

export function HalMapel() {
  const { project } = useProject();

  const cfg: EntityConfig<Subject> = {
    collection: 'mapel',
    judul: 'Mata Pelajaran',
    desc: 'Mapel beserta tipe ruang yang disyaratkan (reguler/lab/lapangan), dan tanda mapel pilihan.',
    ikon: 'mapel',
    placeholderCari: 'Cari nama / kode mapel…',
    labelHapus: (r) => r.nama,
    judulForm: (r) => (r?.id ? 'Ubah Mata Pelajaran' : 'Tambah Mata Pelajaran'),
    blank: () => ({
      id: uid('m'),
      nama: '',
      kode: '',
      tipeRuang: 'reguler',
      pilihan: false,
    }),
    kolom: [
      { label: 'Kode', render: (r) => <span className="badge badge-abu">{r.kode || '—'}</span> },
      {
        label: 'Nama Mapel',
        render: (r) => <b>{r.nama}</b>,
      },
      {
        label: 'Tipe Ruang',
        render: (r) => <span className="badge badge-abu">{LABEL_TIPE_RUANG[r.tipeRuang] ?? r.tipeRuang}</span>,
      },
      {
        label: 'Pilihan',
        render: (r) =>
          r.pilihan ? <span className="badge badge-hijau">Mapel Pilihan</span> : <span className="hint">Wajib</span>,
      },
      {
        label: 'Jam / Minggu',
        render: (r) =>
          project.kebutuhan.filter((k) => k.mapelId === r.id).reduce((a, k) => a + k.jumlahJam, 0) +
          ' jam',
      },
      {
        label: 'Pengajar',
        render: (r) => project.guru.filter((g) => g.mapelIds.includes(r.id)).length + ' guru',
      },
    ],
    fields: [
      { key: 'nama', label: 'Nama Mapel', type: 'text', placeholder: 'Contoh: Matematika' },
      { key: 'kode', label: 'Kode', type: 'text', placeholder: 'Contoh: MTK' },
      {
        key: 'tipeRuang',
        label: 'Tipe Ruang yang Disyaratkan',
        type: 'select',
        options: TIPE_RUANG_KEBUTUHAN,
        hint: 'Generator hanya akan menempatkan mapel ini di ruang dengan tipe tersebut.',
      },
      {
        key: 'pilihan',
        label: 'Mapel Pilihan',
        type: 'check',
        hint: 'Tandai sebagai mapel pilihan (siswa boleh memilih tidak mengambilnya).',
      },
    ],
  };
  return <DataPage cfg={cfg} />;
}

// ---------------------------------------------------------------------------
// Ruang
// ---------------------------------------------------------------------------

export function HalRuang() {
  const { project } = useProject();

  const cfg: EntityConfig<(typeof project.ruang)[number]> = {
    collection: 'ruang',
    judul: 'Ruang',
    desc: 'Ruang kelas dan laboratorium beserta kapasitas serta tipenya.',
    ikon: 'ruang',
    placeholderCari: 'Cari ruang…',
    labelHapus: (r) => r.nama,
    judulForm: (r) => (r?.id ? 'Ubah Ruang' : 'Tambah Ruang'),
    blank: () => ({ id: uid('r'), nama: '', kapasitas: 40, tipe: 'reguler' }),
    kolom: [
      { label: 'Nama Ruang', render: (r) => <b>{r.nama}</b> },
      {
        label: 'Tipe',
        render: (r) => <span className="badge badge-biru">{LABEL_TIPE_RUANG[r.tipe] ?? r.tipe}</span>,
      },
      { label: 'Kapasitas', render: (r) => `${r.kapasitas} kursi` },
      {
        label: 'Terpakai',
        render: (r) => `${project.jadwal.filter((j) => j.ruangId === r.id).length} jam/minggu`,
      },
    ],
    fields: [
      { key: 'nama', label: 'Nama Ruang', type: 'text', placeholder: 'Contoh: R-6 / Lab Komputer' },
      { key: 'tipe', label: 'Tipe Ruang', type: 'select', options: [...TIPE_RUANG_OPTIONS] },
      { key: 'kapasitas', label: 'Kapasitas', type: 'number', min: 1, max: 200 },
    ],
  };
  return <DataPage cfg={cfg} />;
}

// ---------------------------------------------------------------------------
// Jam Pelajaran + pengelolaan hari aktif
// ---------------------------------------------------------------------------

/** Peta ulang indeks hari pada daftar slot (mis. saat hari dihapus/diurutkan). */
function petaSlotHari(daftar: SlotKey[], peta: (h: number) => number | null): SlotKey[] {
  const out: SlotKey[] = [];
  for (const k of daftar) {
    const { hari, periodeId } = parseSlotKey(k);
    const baru = peta(hari);
    if (baru !== null) out.push(slotKey(baru, periodeId));
  }
  return [...new Set(out)];
}

function HariAktifCard() {
  const { project, set } = useProject();
  const [baru, setBaru] = useState('');
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editNama, setEditNama] = useState('');

  const jumlahJadwal = (idx: number) =>
    project.jadwal.filter((j) => j.hari === idx).length;
  const jumlahBlokir = (idx: number) =>
    project.blokir.filter((b) => b.hari === idx).length;

  const tambah = () => {
    const nama = baru.trim();
    if (!nama) return;
    if (project.hari.some((h) => h.toLowerCase() === nama.toLowerCase())) {
      window.alert(`Hari "${nama}" sudah ada.`);
      return;
    }
    set({ hari: [...project.hari, nama] });
    setBaru('');
  };

  const mulaiEdit = (idx: number) => {
    setEditIdx(idx);
    setEditNama(project.hari[idx]);
  };

  const simpanEdit = () => {
    if (editIdx === null) return;
    const nama = editNama.trim();
    if (!nama) {
      window.alert('Nama hari tidak boleh kosong.');
      return;
    }
    if (
      project.hari.some(
        (h, i) => i !== editIdx && h.toLowerCase() === nama.toLowerCase(),
      )
    ) {
      window.alert(`Hari "${nama}" sudah ada.`);
      return;
    }
    const hari = [...project.hari];
    hari[editIdx] = nama;
    set({ hari });
    setEditIdx(null);
    setEditNama('');
  };

  /** Urutkan ulang hari sekaligus memindahkan seluruh referensi indeksnya. */
  const geser = (idx: number, arah: -1 | 1) => {
    const tujuan = idx + arah;
    if (tujuan < 0 || tujuan >= project.hari.length) return;
    const hari = [...project.hari];
    [hari[idx], hari[tujuan]] = [hari[tujuan], hari[idx]];
    const peta = (h: number) => (h === idx ? tujuan : h === tujuan ? idx : h);
    set({
      hari,
      jadwal: project.jadwal.map((j) => ({ ...j, hari: peta(j.hari) })),
      blokir: project.blokir.map((b) => ({ ...b, hari: peta(b.hari) })),
      guru: project.guru.map((g) => ({
        ...g,
        slotDiinginkan: petaSlotHari(g.slotDiinginkan, peta),
        slotDilarang: petaSlotHari(g.slotDilarang, peta),
      })),
    });
  };

  const hapus = (idx: number) => {
    if (project.hari.length <= 1) {
      window.alert('Minimal harus ada satu hari aktif.');
      return;
    }
    const nama = project.hari[idx];
    const jmlJadwal = jumlahJadwal(idx);
    const jmlBlokir = jumlahBlokir(idx);
    const rincian = [
      jmlJadwal ? `${jmlJadwal} jadwal` : '',
      jmlBlokir ? `${jmlBlokir} batasan` : '',
    ]
      .filter(Boolean)
      .join(' dan ');
    if (
      !window.confirm(
        `Hapus hari "${nama}"?${rincian ? ` ${rincian} pada hari ini ikut dihapus.` : ''}\n\nHari setelahnya akan digeser otomatis.`,
      )
    )
      return;

    const hari = project.hari.filter((_, i) => i !== idx);
    const peta = (h: number): number | null => (h === idx ? null : h > idx ? h - 1 : h);
    set({
      hari,
      jadwal: project.jadwal
        .filter((j) => j.hari !== idx)
        .map((j) => ({ ...j, hari: peta(j.hari) as number })),
      blokir: project.blokir
        .filter((b) => b.hari !== idx)
        .map((b) => ({ ...b, hari: peta(b.hari) as number })),
      guru: project.guru.map((g) => ({
        ...g,
        slotDiinginkan: petaSlotHari(g.slotDiinginkan, peta),
        slotDilarang: petaSlotHari(g.slotDilarang, peta),
      })),
    });
  };

  return (
    <div className="card">
      <div className="card-title">Hari Aktif</div>
      <div className="card-sub">
        Tambah, ubah nama, urutkan, atau hapus hari. Perubahan otomatis diikuti tab
        hari di halaman Jadwal, grid, matriks, dan generator.
      </div>

      <div className="hari-list">
        {project.hari.map((nama, i) => (
          <div className="hari-item" key={`${i}-${nama}`}>
            <span className="hari-no">{i + 1}</span>
            {editIdx === i ? (
              <input
                className="input"
                autoFocus
                value={editNama}
                onChange={(e) => setEditNama(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') simpanEdit();
                  if (e.key === 'Escape') setEditIdx(null);
                }}
              />
            ) : (
              <b className="hari-nama">{nama}</b>
            )}
            <span className="hint">
              {jumlahJadwal(i)} jadwal
              {jumlahBlokir(i) ? ` · ${jumlahBlokir(i)} batasan` : ''}
            </span>
            <div className="aksi-inline">
              {editIdx === i ? (
                <>
                  <button className="icon-btn" title="Simpan nama" onClick={simpanEdit}>
                    <Icon name="cek" size={15} />
                  </button>
                  <button className="icon-btn" title="Batal" onClick={() => setEditIdx(null)}>
                    <Icon name="tutup" size={15} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="icon-btn"
                    title="Naikkan"
                    disabled={i === 0}
                    onClick={() => geser(i, -1)}
                  >
                    <span style={{ fontSize: 13, lineHeight: 1 }}>↑</span>
                  </button>
                  <button
                    className="icon-btn"
                    title="Turunkan"
                    disabled={i === project.hari.length - 1}
                    onClick={() => geser(i, 1)}
                  >
                    <span style={{ fontSize: 13, lineHeight: 1 }}>↓</span>
                  </button>
                  <button className="icon-btn" title="Ubah nama" onClick={() => mulaiEdit(i)}>
                    <Icon name="ubah" size={15} />
                  </button>
                  <button
                    className="icon-btn"
                    title="Hapus hari"
                    disabled={project.hari.length <= 1}
                    onClick={() => hapus(i)}
                  >
                    <Icon name="hapus" size={15} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="hari-tambah">
        <input
          className="input"
          placeholder="Nama hari baru (mis. Minggu, Sabtu Khusus)…"
          value={baru}
          onChange={(e) => setBaru(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') tambah();
          }}
        />
        <Btn icon="tambah" onClick={tambah} disabled={!baru.trim()}>
          Tambah Hari
        </Btn>
      </div>
    </div>
  );
}

export function HalJam() {
  const { project, set } = useProject();

  const geser = (idx: number, arah: -1 | 1) => {
    const arr = [...project.periode];
    const j = idx + arah;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    set({ periode: arr });
  };

  const cfg: EntityConfig<Period> = {
    collection: 'periode',
    judul: 'Jam Pelajaran',
    desc: 'Urutan jam sekolah tiap hari. Baris ber-tipe selain “Pelajaran” (istirahat, apel, kustom) tidak akan dipakai generator. Atur urutan dengan tombol panah.',
    ikon: 'jam',
    placeholderCari: 'Cari jam…',
    labelHapus: (r) => r.nama,
    judulForm: (r) => (r?.id ? 'Ubah Jam Pelajaran' : 'Tambah Jam Pelajaran'),
    descForm: 'Waktu ditulis 24 jam, contoh 07:00. Urutan baris = urutan tampil di grid.',
    blank: () => ({ id: uid('p'), nama: '', mulai: '', selesai: '', tipe: 'pelajaran', tipeKet: '' }),
    aksiTambahan: (r) => {
      const i = project.periode.findIndex((p) => p.id === r.id);
      return (
        <>
          <button className="icon-btn" title="Naik" disabled={i <= 0} onClick={() => geser(i, -1)}>
            <span style={{ fontSize: 13, lineHeight: 1 }}>↑</span>
          </button>
          <button
            className="icon-btn"
            title="Turun"
            disabled={i >= project.periode.length - 1}
            onClick={() => geser(i, 1)}
          >
            <span style={{ fontSize: 13, lineHeight: 1 }}>↓</span>
          </button>
        </>
      );
    },
    kolom: [
      { label: 'Nama', render: (r) => <b>{r.nama}</b> },
      { label: 'Mulai', render: (r) => r.mulai || '—' },
      { label: 'Selesai', render: (r) => r.selesai || '—' },
      {
        label: 'Tipe Waktu',
        render: (r) =>
          r.tipe === 'pelajaran' ? (
            <span className="badge badge-hijau">Pelajaran</span>
          ) : r.tipe === 'istirahat' ? (
            <span className="badge badge-kuning">Istirahat</span>
          ) : r.tipe === 'apel' ? (
            <span className="badge badge-biru">Apel</span>
          ) : (
            <span className="badge badge-abu">{labelTipeWaktu(r)}</span>
          ),
      },
    ],
    fields: (form) => [
      { key: 'nama', label: 'Nama', type: 'text', placeholder: 'Contoh: Jam ke-1' },
      { key: 'mulai', label: 'Mulai', type: 'text', placeholder: '07:00' },
      { key: 'selesai', label: 'Selesai', type: 'text', placeholder: '07:40' },
      {
        key: 'tipe',
        label: 'Tipe Waktu',
        type: 'select',
        options: [...TIPE_WAKTU_OPTIONS],
        hint: 'Hanya “Pelajaran” yang boleh dipakai menampung pelajaran; tipe lain dianggap di luar jam pelajaran.',
      },
      ...(form.tipe === 'kustom'
        ? [
            {
              key: 'tipeKet',
              label: 'Nama Tipe (Kustom)',
              type: 'text',
              placeholder: 'Contoh: Senam Pagi, Upacara…',
              hint: 'Nama yang tampil di grid & ekspor untuk tipe “Lainnya”.',
            } as FieldDef<Period>,
          ]
        : []),
    ],
  };
  return <DataPage cfg={cfg} atas={<HariAktifCard />} />;
}

// ---------------------------------------------------------------------------
// Batasan (slot terblokir)
// ---------------------------------------------------------------------------

export function HalBlokir() {
  const { project } = useProject();

  const namaRef = (b: Block) =>
    b.jenis === 'kelas'
      ? project.kelas.find((x) => x.id === b.refId)?.nama ?? '(terhapus)'
      : b.jenis === 'guru'
        ? project.guru.find((x) => x.id === b.refId)?.nama ?? '(terhapus)'
        : project.ruang.find((x) => x.id === b.refId)?.nama ?? '(terhapus)';

  const refOptions = (jenis: Block['jenis']) => {
    const list =
      jenis === 'kelas' ? project.kelas : jenis === 'guru' ? project.guru : project.ruang;
    return list.map((x) => ({ value: x.id, label: x.nama }));
  };

  const cfg: EntityConfig<Block> = {
    collection: 'blokir',
    judul: 'Batasan & Slot Terblokir',
    desc: 'Slot yang tidak boleh dipakai kelas/guru/ruang tertentu — misal rapat guru, kelas libur, atau ruang dipakai acara. Generator akan menghormati daftar ini.',
    ikon: 'blokir',
    placeholderCari: 'Cari batasan…',
    labelHapus: (r) => `${r.jenis} ${namaRef(r)}`,
    judulForm: (r) => (r?.id ? 'Ubah Batasan' : 'Tambah Batasan'),
    blank: () => ({
      id: uid('b'),
      jenis: 'kelas',
      refId: project.kelas[0]?.id ?? '',
      hari: 0,
      periodeId: project.periode.find((p) => p.tipe === 'pelajaran')?.id ?? '',
      alasan: '',
    }),
    kolom: [
      {
        label: 'Jenis',
        render: (r) => (
          <span className="badge badge-abu">
            {r.jenis === 'kelas' ? 'Kelas' : r.jenis === 'guru' ? 'Guru' : 'Ruang'}
          </span>
        ),
      },
      { label: 'Objek', render: (r) => <b>{namaRef(r)}</b> },
      { label: 'Hari', render: (r) => project.hari[r.hari] ?? '?' },
      {
        label: 'Jam',
        render: (r) => {
          const p = project.periode.find((x) => x.id === r.periodeId);
          return p ? `${p.nama} (${p.mulai}–${p.selesai})` : '—';
        },
      },
      { label: 'Alasan', render: (r) => r.alasan || <span className="hint">—</span> },
    ],
    fields: (form) => [
      {
        key: 'jenis',
        label: 'Batasan untuk',
        type: 'select',
        options: [
          { value: 'kelas', label: 'Kelas' },
          { value: 'guru', label: 'Guru' },
          { value: 'ruang', label: 'Ruang' },
        ],
      },
      {
        key: 'refId',
        label: 'Objek',
        type: 'select',
        options: refOptions(form.jenis),
      },
      {
        key: 'hari',
        label: 'Hari',
        type: 'select',
        numeric: true,
        options: project.hari.map((d, i) => ({ value: String(i), label: d })),
      },
      {
        key: 'periodeId',
        label: 'Jam ke-',
        type: 'select',
        options: project.periode.map((p) => ({
          value: p.id,
          label: `${p.nama} (${p.mulai}–${p.selesai})${p.tipe === 'pelajaran' ? '' : ` · ${labelTipeWaktu(p).toLowerCase()}`}`,
        })),
      },
      { key: 'alasan', label: 'Alasan (opsional)', type: 'text', placeholder: 'Contoh: Rapat guru' },
    ],
  };
  return <DataPage cfg={cfg} />;
}
