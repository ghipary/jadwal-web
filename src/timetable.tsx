// Grid jadwal mingguan — dipakai halaman Jadwal dan Publikasi.

import { CSSProperties, DragEvent, Fragment, useState } from 'react';
import {
  Assignment,
  labelTipeWaktu,
  periodeAktifHari,
  Project,
  slotKey,
} from './types';
import { buatMatriks, kunciSel } from './matrix';
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
      <div
        key={a.id}
        className={kelas}
        style={{
          borderLeftColor: warna,
          background: hexA(warna, 0.14),
        }}
        draggable={editable}
        onDragStart={(e) => onDragStart(e, a)}
        onClick={(e) => {
          e.stopPropagation();
          onOpen?.(a);
        }}
        title={`${m?.nama ?? '?'} — ${kelasM.get(a.kelasId)?.nama ?? ''} / ${guruM.get(a.guruId)?.nama ?? ''} / ${ruangM.get(a.ruangId)?.nama ?? 'tanpa ruang'}${a.blokId ? ' · bagian blok JP (pola berurutan)' : ''}`}
      >
        <span className="nama">{m?.nama ?? '(mapel terhapus)'}</span>
        <span className="meta">{metaFor(a)}</span>
      </div>
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
                    !aktif ? 'cell-mati' : '',
                    rowSpan ? 'cell-blok' : '',
                    list.length > 1 ? 'multi' : '',
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
                  // sel abu-abu tipis, tanpa tombol tambah/drag.
                  if (!aktif && list.length === 0 && rowSpan === 0) {
                    return (
                      <td
                        key={key}
                        className={`${cls} cell-mati`}
                        title={`${project.hari[hari]} · ${per.nama} non-aktif pada hari ini`}
                      />
                    );
                  }
                  // Sel kosong yang aktif: tetap bisa diklik untuk menambah
                  // pelajaran (tanpa tombol "+" agar tabel tetap padat).
                  const bisaTambah = editable && scope === 'kelas' && list.length === 0 && aktif && !rowSpan;
                  return (
                    <td
                      key={key}
                      className={cls}
                      rowSpan={rowSpan || undefined}
                      {...(editable && !mergeCover.has(key) ? handlerDrag : {})}
                      {...(bisaTambah
                        ? {
                            onClick: () => onAdd?.(hari, per.id),
                            title: `Tambah pelajaran · ${project.hari[hari]} · ${per.nama}`,
                            role: 'button' as const,
                            tabIndex: 0,
                          }
                        : {})}
                    >
                      {list.map(renderLes)}
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

/**
 * Matriks "Per Sekolah" — format persis tabel Excel:
 *   baris  = hari (di-rowspan) × jam pelajaran
 *   kolom  = kelas (X-1 s.d XII-4)
 *
 * Berbeda dari `TimetableGrid` (hari di kolom), komponen ini menaruh HARI &
 * PUKUL di baris dan seluruh kelas berjejer menyamping. Isi sel = blok mapel
 * sungguhan (nama mapel + guru), bukan kode. Baris di luar jam pelajaran
 * (istirahat/apel/kustom) digabung horizontal (colspan) selebar kolom kelas.
 */
export function SekolahMatrix({
  project,
  editable = false,
  konflik,
  focusId,
  onOpen,
  onAdd,
  onMove,
}: {
  project: Project;
  editable?: boolean;
  konflik?: Set<string>;
  focusId?: string | null;
  onOpen?: (a: Assignment) => void;
  onAdd?: (kelasId: string, hari: number, periodeId: string) => void;
  onMove?: (a: Assignment, hari: number, periodeId: string) => void;
}) {
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const m = buatMatriks(project);

  const guruM = new Map(project.guru.map((g) => [g.id, g]));
  const mapelM = new Map(project.mapel.map((x) => [x.id, x]));
  const kelasM = new Map(project.kelas.map((c) => [c.id, c]));

  const namaSingkatGuru = (id: string) => {
    const g = guruM.get(id);
    if (!g) return '(guru terhapus)';
    const n = g.nama.split(',')[0].split(' ');
    return n.length > 2 ? `${n[0]} ${n[n.length - 1]}` : g.nama.split(',')[0];
  };

  const renderBlok = (a: Assignment, span = 1) => {
    const mpl = mapelM.get(a.mapelId);
    const warna = guruM.get(a.guruId)?.warna ?? '#94a3b8';
    const cls = [
      'les-mx',
      a.tetap ? 'les-tetap' : '',
      konflik?.has(a.id) || focusId === a.id ? 'les-konflik' : '',
      a.blokId ? 'les-blok' : '',
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <div
        key={a.id}
        className={cls}
        style={{
          borderLeftColor: warna,
          background: hexA(warna, 0.2),
          ...(span > 1 ? ({ '--mx-span': String(span) } as CSSProperties) : {}),
        }}
        draggable={editable}
        onDragStart={(e) => {
          if (!editable) return;
          e.dataTransfer.setData('text/plain', a.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onClick={(e) => {
          e.stopPropagation();
          onOpen?.(a);
        }}
        title={`${mpl?.nama ?? '?'} — ${kelasM.get(a.kelasId)?.nama ?? ''} / ${
          guruM.get(a.guruId)?.nama ?? ''
        }${a.blokId ? ' · bagian blok JP (pola berurutan)' : ''}`}
      >
        <span className="nama">{mpl?.nama ?? '(mapel terhapus)'}</span>
        <span className="meta">{namaSingkatGuru(a.guruId)}</span>
      </div>
    );
  };

  const jumlahKolomKelas = Math.max(m.kelas.length, 1);

  return (
    <div className="mx-sekolah-scroll">
      <table className="mx mx-sekolah">
        <thead>
          <tr>
            <th className="c-hari">HARI</th>
            <th className="c-jam">PUKUL</th>
            {m.kelas.map((k) => (
              <th key={k.id}>{k.nama}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {m.blok
            .filter((b) => b.jumlah > 0)
            .map((b) => (
              <Fragment key={b.hari}>
                {m.baris.slice(b.mulai, b.mulai + b.jumlah).map((br, i) => {
                  const barisIni = b.mulai + i;
                  const keyBaris = `${br.hari}-${br.periodeId}`;
                  return (
                    <tr key={keyBaris}>
                      {i === 0 ? (
                        <td className="c-hari" rowSpan={b.jumlah}>
                          {b.nama}
                        </td>
                      ) : null}
                      <td className="c-jam">{br.jam}</td>

                      {br.tipe !== 'pelajaran' ? (
                        // Baris non-pelajaran: satu sel digabung horizontal.
                        <td
                          colSpan={jumlahKolomKelas}
                          className={`c-ist c-ist-${br.tipe}`}
                        >
                          {br.label}
                        </td>
                      ) : (
                        m.kelas.map((k) => {
                          const key = kunciSel(br.hari, br.periodeId, k.id);
                          const blok = m.blokSel.find(
                            (bl) =>
                              bl.kelasId === k.id &&
                              bl.mulai <= barisIni &&
                              barisIni < bl.mulai + bl.jumlah,
                          );
                          // Bagian lanjutan blok berurutan → menyatu ke sel atas.
                          if (blok && blok.mulai !== barisIni) return null;
                          const s = m.sel.get(key);
                          const bisaTambah =
                            editable && !s && !blok;
                          const drag = {
                            onDragOver: (e: DragEvent) => {
                              if (!editable) return;
                              e.preventDefault();
                              setDropTarget(key);
                            },
                            onDragLeave: () =>
                              setDropTarget((t) => (t === key ? null : t)),
                            onDrop: (e: DragEvent) => {
                              e.preventDefault();
                              setDropTarget(null);
                              if (!editable) return;
                              const id = e.dataTransfer.getData('text/plain');
                              const a = project.jadwal.find((x) => x.id === id);
                              if (a) onMove?.(a, br.hari, br.periodeId);
                            },
                          };
                          return (
                            <td
                              key={k.id}
                              className={[
                                'c-isi',
                                s ? 'c-kode' : '',
                                blok ? 'c-blok' : '',
                                dropTarget === key ? 'drag-over' : '',
                                bisaTambah ? 'c-tambah' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              rowSpan={blok ? blok.jumlah : undefined}
                              {...(editable ? drag : {})}
                              {...(bisaTambah
                                ? {
                                    onClick: () => onAdd?.(k.id, br.hari, br.periodeId),
                                    role: 'button' as const,
                                    tabIndex: 0,
                                    title: `Tambah pelajaran · ${k.nama} · ${b.nama} · ${br.jam}`,
                                  }
                                : {})}
                            >
                              {(s?.les ?? []).map((a) => renderBlok(a, blok ? blok.jumlah : 1))}
                            </td>
                          );
                        })
                      )}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
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
