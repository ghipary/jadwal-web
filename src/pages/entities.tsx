// Halaman-halaman data: Guru, Kelas, Siswa, Mapel, Jam.

import { useState } from 'react';
import {
  HARI_KONFIG_BAWAAN,
  PALET_GURU,
  konfigHari,
  parseSlotKey,
  periodeAktifHari,
  slotKey,
  TIPE_WAKTU_OPTIONS,
  labelTipeWaktu,
} from '../types';
import type {
  HariKonfig,
  Period,
  Project,
  SchoolClass,
  SlotKey,
  Student,
  Subject,
  Teacher,
} from '../types';
import { useProject } from '../store';
import { Btn, Icon, Modal, type FieldDef } from '../ui';
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
      polaJP: [],
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
        label: 'Pola JP',
        render: (r) =>
          r.polaJP.length ? (
            <span className="badge badge-biru">{r.polaJP.join(' + ')}</span>
          ) : (
            <span className="hint">—</span>
          ),
      },
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
      {
        key: 'polaJP',
        label: 'Pola Distribusi JP (Block Scheduling)',
        type: 'pola',
        placeholder: 'Contoh: 2, 1',
        hint: 'Pecah JP guru menjadi blok berurutan, mis. 2, 1 = 3 JP dijadwalkan 2 JP menyambung lalu 1 JP. Kosongkan bila tidak perlu.',
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
    desc: 'Rombongan belajar: nama kelas, tingkat, wali kelas, dan jumlah siswa.',
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
    desc: 'Daftar mata pelajaran beserta kode dan tanda mapel pilihan.',
    ikon: 'mapel',
    placeholderCari: 'Cari nama / kode mapel…',
    labelHapus: (r) => r.nama,
    judulForm: (r) => (r?.id ? 'Ubah Mata Pelajaran' : 'Tambah Mata Pelajaran'),
    blank: () => ({
      id: uid('m'),
      nama: '',
      kode: '',
      pilihan: false,
    }),
    kolom: [
      { label: 'Kode', render: (r) => <span className="badge badge-abu">{r.kode || '—'}</span> },
      {
        label: 'Nama Mapel',
        render: (r) => <b>{r.nama}</b>,
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

/**
 * Peta ulang indeks hari pada `periode.hariAktif` (mis. saat hari
 * dihapus/diurutkan) agar periode tetap menempel pada hari yang benar.
 */
function petaHariPeriode(
  periode: Period[],
  peta: (h: number) => number | null,
): Period[] {
  return periode.map((p) => ({
    ...p,
    hariAktif: [...new Set((p.hariAktif ?? []).map(peta).filter((x): x is number => x !== null))].sort(
      (a, b) => a - b,
    ),
  }));
}

/** Susun konfigurasi hari sejajar `project.hari` (bawaan bila belum ada). */
function konfigLengkap(project: Project): HariKonfig[] {
  return project.hari.map((_, i) => ({
    ...HARI_KONFIG_BAWAAN,
    ...(project.hariKonfig?.[i] ?? {}),
  }));
}

/** Draft isi Modal Tambah/Ubah Hari. */
interface DraftHari {
  mode: 'tambah' | 'ubah';
  /** Indeks hari yang diubah; -1 untuk tambah. */
  idx: number;
  nama: string;
  maksJP: number;
  slotNonAktif: string[];
}

function HariAktifCard() {
  const { project, set } = useProject();
  const [modal, setModal] = useState<DraftHari | null>(null);

  const jumlahJadwal = (idx: number) =>
    project.jadwal.filter((j) => j.hari === idx).length;

  const jpBaris = project.periode.filter((p) => p.tipe === 'pelajaran');

  const bukaTambah = () =>
    setModal({ mode: 'tambah', idx: -1, nama: '', maksJP: 0, slotNonAktif: [] });

  const bukaUbah = (idx: number) => {
    const k = konfigHari(project, idx);
    setModal({
      mode: 'ubah',
      idx,
      nama: project.hari[idx],
      maksJP: k.maksJP,
      slotNonAktif: [...k.slotNonAktif],
    });
  };

  const toggleSlot = (id: string) =>
    setModal((m) =>
      m
        ? {
            ...m,
            slotNonAktif: m.slotNonAktif.includes(id)
              ? m.slotNonAktif.filter((x) => x !== id)
              : [...m.slotNonAktif, id],
          }
        : m,
    );

  const simpanModal = () => {
    if (!modal) return;
    const nama = modal.nama.trim();
    if (!nama) {
      window.alert('Nama hari tidak boleh kosong.');
      return;
    }
    if (
      project.hari.some(
        (h, i) => i !== modal.idx && h.toLowerCase() === nama.toLowerCase(),
      )
    ) {
      window.alert(`Hari "${nama}" sudah ada.`);
      return;
    }
    const konfig = konfigLengkap(project);
    const baru: HariKonfig = {
      maksJP: Math.max(0, Math.floor(modal.maksJP) || 0),
      slotNonAktif: [...new Set(modal.slotNonAktif)],
    };
    if (modal.mode === 'tambah') {
      set({ hari: [...project.hari, nama], hariKonfig: [...konfig, baru] });
    } else {
      const hari = [...project.hari];
      hari[modal.idx] = nama;
      const hk = [...konfig];
      hk[modal.idx] = baru;
      set({ hari, hariKonfig: hk });
    }
    setModal(null);
  };

  /** Urutkan ulang hari sekaligus memindahkan seluruh referensi indeksnya. */
  const geser = (idx: number, arah: -1 | 1) => {
    const tujuan = idx + arah;
    if (tujuan < 0 || tujuan >= project.hari.length) return;
    const hari = [...project.hari];
    [hari[idx], hari[tujuan]] = [hari[tujuan], hari[idx]];
    const konfig = konfigLengkap(project);
    [konfig[idx], konfig[tujuan]] = [konfig[tujuan], konfig[idx]];
    const peta = (h: number) => (h === idx ? tujuan : h === tujuan ? idx : h);
    set({
      hari,
      hariKonfig: konfig,
      jadwal: project.jadwal.map((j) => ({ ...j, hari: peta(j.hari) })),
      periode: petaHariPeriode(project.periode, peta),
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
    const rincian = [jmlJadwal ? `${jmlJadwal} jadwal` : '']
      .filter(Boolean)
      .join(' dan ');
    if (
      !window.confirm(
        `Hapus hari "${nama}"?${rincian ? ` ${rincian} pada hari ini ikut dihapus.` : ''}\n\nHari setelahnya akan digeser otomatis.`,
      )
    )
      return;

    const hari = project.hari.filter((_, i) => i !== idx);
    const konfig = konfigLengkap(project).filter((_, i) => i !== idx);
    const peta = (h: number): number | null => (h === idx ? null : h > idx ? h - 1 : h);
    set({
      hari,
      hariKonfig: konfig,
      jadwal: project.jadwal
        .filter((j) => j.hari !== idx)
        .map((j) => ({ ...j, hari: peta(j.hari) as number })),
      periode: petaHariPeriode(project.periode, peta),
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
        Tambah, ubah nama &amp; batas JP, urutkan, atau hapus hari. Perubahan otomatis diikuti tab
        hari di halaman Jadwal, grid, matriks, dan generator.
      </div>

      <div className="hari-list">
        {project.hari.map((nama, i) => {
          const jpAktif = periodeAktifHari(project, i).length;
          const konfig = konfigHari(project, i);
          return (
            <div className="hari-item" key={`${i}-${nama}`}>
              <span className="hari-no">{i + 1}</span>
              <b className="hari-nama">{nama}</b>
              <span className="hint">
                {jumlahJadwal(i)} jadwal
              </span>
              <span className={`badge ${jpAktif < jpBaris.length ? 'badge-kuning' : 'badge-abu'}`}>
                {jpAktif} JP aktif
                {konfig.maksJP > 0 ? ` (maks ${konfig.maksJP})` : ''}
              </span>
              <div className="aksi-inline">
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
                <button
                  className="icon-btn"
                  title="Ubah nama & pengaturan JP"
                  onClick={() => bukaUbah(i)}
                >
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
              </div>
            </div>
          );
        })}
      </div>

      <div className="hari-tambah">
        <Btn icon="tambah" onClick={bukaTambah}>
          Tambah Hari
        </Btn>
        <span className="hint">
          Hari baru dibuka lewat modal — lengkapi nama hari dan batas JP khusus hari itu.
        </span>
      </div>

      {/* --- Modal Tambah / Ubah Hari --- */}
      <Modal
        open={modal !== null}
        title={modal?.mode === 'ubah' ? 'Ubah Hari' : 'Tambah Hari'}
        desc={
          modal?.mode === 'ubah'
            ? `Ubah nama dan pengaturan JP untuk hari “${project.hari[modal.idx] ?? ''}”.`
            : 'Tentukan nama hari serta batas JP khusus untuk hari baru.'
        }
        onClose={() => setModal(null)}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setModal(null)}>
              Batal
            </Btn>
            <Btn variant="primary" icon="cek" onClick={simpanModal}>
              Simpan Hari
            </Btn>
          </>
        }
      >
        {modal ? (
          <div className="form-grid">
            <div className="span2 field">
              <label htmlFor="hari-nama">Nama Hari</label>
              <input
                id="hari-nama"
                className="input"
                autoFocus
                placeholder="Contoh: Minggu, Sabtu Khusus…"
                value={modal.nama}
                onChange={(e) => setModal({ ...modal, nama: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') simpanModal();
                }}
              />
              <span className="hint">
                Nama tampil pada tab, grid, matriks cetak, dan ekspor. Nama harus unik.
              </span>
            </div>

            <div className="field">
              <label htmlFor="hari-maksjp">Batas Maks. JP Hari Ini</label>
              <input
                id="hari-maksjp"
                type="number"
                className="input"
                min={0}
                max={jpBaris.length}
                value={modal.maksJP}
                onChange={(e) =>
                  setModal({
                    ...modal,
                    maksJP: Math.max(0, Math.min(jpBaris.length, Number(e.target.value) || 0)),
                  })
                }
              />
              <span className="hint">
                0 = tanpa batas (ikut semua {jpBaris.length} JP). Contoh: Jumat diisi 5 → grid
                berhenti di JP ke-5.
              </span>
            </div>

            <div className="field">
              <label>Ringkasan</label>
              <div className="kv" style={{ border: 'none', padding: '4px 0' }}>
                <b>
                  {Math.max(
                    0,
                    (modal.maksJP > 0 ? modal.maksJP : jpBaris.length) -
                      modal.slotNonAktif.length,
                  )}{' '}
                  JP aktif
                </b>
                <span className="hint">
                  dari {jpBaris.length} baris JP global · {modal.slotNonAktif.length} dimatikan
                </span>
              </div>
            </div>

            <div className="span2 field">
              <label>Slot JP yang Aktif untuk Hari Ini</label>
              <div className="multi">
                {jpBaris.map((p, urut) => {
                  const on = !modal.slotNonAktif.includes(p.id) &&
                    (modal.maksJP === 0 || urut < modal.maksJP);
                  const dimatikan = modal.slotNonAktif.includes(p.id);
                  return (
                    <button
                      type="button"
                      key={p.id}
                      className={`chip ${on ? 'chip-on' : ''}`}
                      title={`${p.nama} (${p.mulai}–${p.selesai})${dimatikan ? ' — dimatikan manual' : on ? '' : ' — di luar batas maks. JP'}`}
                      onClick={() => toggleSlot(p.id)}
                    >
                      {on ? <Icon name="cek" size={12} /> : null}
                      {p.nama}
                      <span className="chip-sub">{p.mulai}</span>
                    </button>
                  );
                })}
              </div>
              <span className="hint">
                Klik slot untuk mematikan/mengaktifkan JP tertentu khusus hari ini. Slot di luar
                batas maks. JP ikut non-aktif dan tidak akan dipakai generator. Untuk jam yang
                hanya berlaku di hari tertentu, lebih mudah mengatur “Aktif pada Hari” di halaman
                Jam Pelajaran.
              </span>
            </div>
          </div>
        ) : null}
      </Modal>
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
    desc: 'Urutan jam sekolah tiap hari. Baris ber-tipe selain “Pelajaran” (istirahat, apel, kustom) tidak akan dipakai generator. Tiap jam bisa dibatasi ke hari tertentu lewat kolom “Aktif pada Hari”. Atur urutan dengan tombol panah.',
    ikon: 'jam',
    placeholderCari: 'Cari jam…',
    labelHapus: (r) => r.nama,
    judulForm: (r) => (r?.id ? 'Ubah Jam Pelajaran' : 'Tambah Jam Pelajaran'),
    descForm: 'Waktu ditulis 24 jam, contoh 07:00. Urutan baris = urutan tampil di grid.',
    blank: () => ({ id: uid('p'), nama: '', mulai: '', selesai: '', tipe: 'pelajaran', tipeKet: '', hariAktif: [] }),
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
      {
        label: 'Hari Aktif',
        render: (r) =>
          !r.hariAktif || r.hariAktif.length === 0 ? (
            <span className="badge badge-abu">Semua hari</span>
          ) : (
            <span className="badge badge-hijau">
              {r.hariAktif
                .slice()
                .sort((a, b) => a - b)
                .map((i) => project.hari[i] ?? '?')
                .join(', ')}
            </span>
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
      {
        key: 'hariAktif',
        label: 'Aktif pada Hari',
        type: 'hari',
        hari: project.hari,
        hint: 'Kosong = aktif semua hari. Klik “Semua Hari” untuk mengembalikan. Contoh: istirahat “09:00–09:20” hanya untuk Jumat, atau J4 hanya Senin–Kamis.',
      } as FieldDef<Period>,
    ],
  };
  return <DataPage cfg={cfg} atas={<HariAktifCard />} />;
}


