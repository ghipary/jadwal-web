// Grid jadwal mingguan — dipakai halaman Jadwal dan Publikasi.

import { DragEvent, useState } from 'react';
import {
  Assignment,
  labelTipeWaktu,
  periodeAktifHari,
  Project,
  slotKey,
} from './types';
import { hexA } from './utils';

export type Scope = 'kelas' | 'guru' | 'ruang' | 'siswa' | 'sekolah';

export function TimetableGrid({
  project,
  items,
  scope,
  editable = false,
  konflik,
  dimMapel,
  focusId,
  judul,
  subjudul,
  hariTampil,
  onOpen,
  onAdd,
  onMove,
}: {
  project: Project;
  items: Assignment[];
  scope: Scope;
  editable?: boolean;
  konflik?: Set<string>;
  dimMapel?: (mapelId: string) => boolean;
  focusId?: string | null;
  /** Judul di atas grid (mis. nama kelas pada tampilan sekolah). */
  judul?: string;
  subjudul?: string;
  /** Bila diisi, grid hanya menampilkan satu hari (indeks pada `project.hari`). */
  hariTampil?: number | null;
  onOpen?: (a: Assignment) => void;
  onAdd?: (hari: number, periodeId: string) => void;
  onMove?: (a: Assignment, hari: number, periodeId: string) => void;
}) {
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const hariList =
    hariTampil !== null && hariTampil !== undefined && hariTampil >= 0 && hariTampil < project.hari.length
      ? [hariTampil]
      : project.hari.map((_, i) => i);

  const mapelM = new Map(project.mapel.map((m) => [m.id, m]));
  const guruM = new Map(project.guru.map((g) => [g.id, g]));
  const kelasM = new Map(project.kelas.map((c) => [c.id, c]));
  const ruangM = new Map(project.ruang.map((r) => [r.id, r]));

  const cells = new Map<string, Assignment[]>();
  for (const a of items) {
    const k = `${a.hari}|${a.periodeId}`;
    const arr = cells.get(k);
    if (arr) arr.push(a);
    else cells.set(k, [a]);
  }
  for (const arr of cells.values()) arr.sort((x, y) => (x.id > y.id ? 1 : -1));

  // --- JP aktif per hari (batas maksimal & slot non-aktif) ----------------
  const aktifPerHari = new Map<number, Set<string>>();
  const lastAktifIdx = new Map<number, number>();
  const idxPeriodeAll = new Map(project.periode.map((p, i) => [p.id, i]));
  for (const h of hariList) {
    const aktif = periodeAktifHari(project, h);
    aktifPerHari.set(h, new Set(aktif.map((x) => x.id)));
    const last = aktif.length ? (idxPeriodeAll.get(aktif[aktif.length - 1].id) ?? -1) : -1;
    lastAktifIdx.set(h, last);
  }

  // Baris tampil bila: baris JP aktif di salah satu hari yang ditampilkan,
  // atau baris non-pelajaran (istirahat/apel/kustom) yang berada sebelum
  // JP terakhir hari itu. Sehingga mis. tampilan Jumat (5 JP) berhenti di JP-5.
  const periodeTampil = project.periode.filter((per, idx) => {
    if (per.tipe === 'pelajaran') {
      return hariList.some((h) => aktifPerHari.get(h)?.has(per.id));
    }
    return hariList.some((h) => (lastAktifIdx.get(h) ?? -1) > idx);
  });
  // Fallback: tak ada satu pun baris relevan (mis. semua JP dimatikan) →
  // tampilkan seluruh baris agar grid tidak kosong.
  const barisPeriode = periodeTampil.length ? periodeTampil : project.periode;

  // --- Deteksi blok pemecahan JP (block scheduling) → sel menyatu ---------
  const cellSolo = (a: Assignment) => {
    const arr = cells.get(`${a.hari}|${a.periodeId}`) ?? [];
    return arr.length === 1 && arr[0].id === a.id;
  };
  const mergeStart = new Map<string, number>(); // key sel awal → rowSpan
  const mergeCover = new Map<string, string>(); // key sel lanjutan → key awal
  {
    const perBlok = new Map<string, Assignment[]>();
    for (const a of items) {
      if (!a.blokId) continue;
      const arr = perBlok.get(a.blokId);
      if (arr) arr.push(a);
      else perBlok.set(a.blokId, [a]);
    }
    for (const arr of perBlok.values()) {
      const perHari = new Map<number, Assignment[]>();
      for (const a of arr) {
        const g = perHari.get(a.hari);
        if (g) g.push(a);
        else perHari.set(a.hari, [a]);
      }
      for (const [hari, list] of perHari) {
        const pos = new Map(periodeAktifHari(project, hari).map((p, i) => [p.id, i]));
        const urut = list
          .filter(cellSolo)
          .filter((a) => pos.has(a.periodeId))
          .sort((x, y) => (pos.get(x.periodeId) ?? 0) - (pos.get(y.periodeId) ?? 0));
        let mulai = 0;
        for (let i = 1; i <= urut.length; i++) {
          const sambung =
            i < urut.length &&
            cellSolo(urut[i]) &&
            pos.get(urut[i].periodeId) === (pos.get(urut[i - 1].periodeId) ?? -2) + 1;
          if (!sambung) {
            const run = urut.slice(mulai, i);
            if (run.length > 1) {
              const kAwal = `${run[0].hari}|${run[0].periodeId}`;
              mergeStart.set(kAwal, run.length);
              for (let j = 1; j < run.length; j++) {
                mergeCover.set(`${run[j].hari}|${run[j].periodeId}`, kAwal);
              }
            }
            mulai = i;
          }
        }
      }
    }
  }

  const namaSingkatGuru = (id: string) => {
    const g = guruM.get(id);
    if (!g) return '(guru terhapus)';
    const n = g.nama.split(',')[0].split(' ');
    return n.length > 2 ? `${n[0]} ${n[n.length - 1]}` : g.nama.split(',')[0];
  };

  const metaFor = (a: Assignment) => {
    if (scope === 'guru')
      return `${kelasM.get(a.kelasId)?.nama ?? '?'} · ${ruangM.get(a.ruangId)?.nama ?? 'tanpa ruang'}`;
    if (scope === 'ruang')
      return `${kelasM.get(a.kelasId)?.nama ?? '?'} · ${namaSingkatGuru(a.guruId)}`;
    return `${namaSingkatGuru(a.guruId)} · ${ruangM.get(a.ruangId)?.nama ?? 'tanpa ruang'}`;
  };

  const onDragStart = (e: DragEvent, a: Assignment) => {
    if (!editable) return;
    e.dataTransfer.setData('text/plain', a.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const cellKey = (hari: number, periodeId: string) => `${hari}|${periodeId}`;

  const renderLes = (a: Assignment) => {
    const m = mapelM.get(a.mapelId);
    // Warna kartu mengikuti guru yang mengajar.
    const warna = guruM.get(a.guruId)?.warna ?? '#94a3b8';
    const kelas = [
      'les',
      a.tetap ? 'les-tetap' : '',
      konflik?.has(a.id) || focusId === a.id ? 'les-konflik' : '',
      dimMapel?.(a.mapelId) ? 'les-redup' : '',
      a.blokId ? 'les-blok' : '',
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <button
        key={a.id}
        type="button"
        className={kelas}
        style={{
          borderLeftColor: warna,
          background: hexA(warna, 0.13),
        }}
        draggable={editable}
        onDragStart={(e) => onDragStart(e, a)}
        onClick={() => onOpen?.(a)}
        title={`${m?.nama ?? '?'} — ${kelasM.get(a.kelasId)?.nama ?? ''} / ${guruM.get(a.guruId)?.nama ?? ''} / ${ruangM.get(a.ruangId)?.nama ?? 'tanpa ruang'}${a.blokId ? ' · bagian blok JP (pola berurutan)' : ''}`}
      >
        <span className="nama">{m?.nama ?? '(mapel terhapus)'}</span>
        <span className="meta">{metaFor(a)}</span>
      </button>
    );
  };

  return (
    <div className={judul ? 'tt-scroll bertitel' : 'tt-scroll'}>
      {judul ? (
        <div className="tt-titel">
          <span className="tt-titel-judul">{judul}</span>
          {subjudul ? <span className="tt-titel-sub">{subjudul}</span> : null}
        </div>
      ) : null}
      <table className="tt">
        <thead>
          <tr>
            <th className="jam-cell">Jam Pelajaran</th>
            {hariList.map((i) => (
              <th key={`${i}-${project.hari[i]}`}>
                {project.hari[i]}
                <span className="sub">Hari ke-{i + 1}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {barisPeriode.map((per) => {
            if (per.tipe !== 'pelajaran') {
              const ikon = per.tipe === 'istirahat' ? '☕' : per.tipe === 'apel' ? '🏳️' : '★';
              return (
                <tr key={per.id} className={`baris-waktu baris-${per.tipe}`}>
                  <th className="jam-cell">
                    {per.nama}
                    <span className="waktu">
                      {per.mulai}–{per.selesai}
                    </span>
                  </th>
                  <td colSpan={hariList.length}>
                    {ikon} {labelTipeWaktu(per)}
                  </td>
                </tr>
              );
            }
            return (
              <tr key={per.id}>
                <th className="jam-cell">
                  {per.nama}
                  <span className="waktu">
                    {per.mulai}–{per.selesai}
                  </span>
                </th>
                {hariList.map((hari) => {
                  const key = cellKey(hari, per.id);
                  // Sel ini tertutup bagian blok JP di atasnya → digabung (rowspan).
                  if (mergeCover.has(key)) return null;
                  const rowSpan = mergeStart.get(key) ?? 0;
                  const list = cells.get(key) ?? [];
                  const aktif = aktifPerHari.get(hari)?.has(per.id) ?? true;
                  const cls = [
                    'cell',
                    dropTarget === key ? 'drag-over' : '',
                    !aktif ? 'cell-libur' : '',
                    rowSpan ? 'cell-blok' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  const handlerDrag = {
                    onDragOver: (e: DragEvent) => {
                      if (!editable) return;
                      e.preventDefault();
                      setDropTarget(key);
                    },
                    onDragLeave: () => setDropTarget((t) => (t === key ? null : t)),
                    onDrop: (e: DragEvent) => {
                      e.preventDefault();
                      setDropTarget(null);
                      if (!editable) return;
                      const id = e.dataTransfer.getData('text/plain');
                      const a = items.find((x) => x.id === id);
                      if (a) onMove?.(a, hari, per.id);
                    },
                  };
                  // Slot non-aktif (di luar batas JP hari ini) tanpa isi →
                  // tampilkan sel mati, tanpa tombol tambah/drag.
                  if (!aktif && list.length === 0 && rowSpan === 0) {
                    return (
                      <td key={key} className={cls} title={`${project.hari[hari]} · ${per.nama} non-aktif pada hari ini`}>
                        <span className="libur-tanda">—</span>
                      </td>
                    );
                  }
                  return (
                    <td
                      key={key}
                      className={cls}
                      rowSpan={rowSpan || undefined}
                      {...(editable && !mergeCover.has(key) ? handlerDrag : {})}
                    >
                      {list.map(renderLes)}
                      {editable && scope === 'kelas' && list.length === 0 && aktif && !rowSpan ? (
                        <button
                          type="button"
                          className="les-tambah"
                          title="Tambah pelajaran"
                          onClick={() => onAdd?.(hari, per.id)}
                        >
                          +
                        </button>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Legenda untuk bawah grid. */
export function Legend() {
  return (
    <div className="tt-legend no-print">
      <span>
        <i className="leg-dot" style={{ background: '#fff', boxShadow: '0 0 0 2px rgba(16,185,129,.5)' }} />
        Jadwal tetap (terkunci)
      </span>
      <span>
        <i className="leg-dot" style={{ background: '#fff', boxShadow: '0 0 0 2px #e5484d' }} />
        Konflik
      </span>
      <span>
        <i className="leg-dot" style={{ background: '#eeecfe' }} />
        Seret kartu untuk memindah · klik untuk ubah
      </span>
    </div>
  );
}

export { slotKey };
