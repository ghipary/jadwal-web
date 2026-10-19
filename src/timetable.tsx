// Grid jadwal mingguan (Senin–Sabtu) — dipakai halaman Jadwal dan Publikasi.

import { DragEvent, useState } from 'react';
import { Assignment, DAYS, Project, slotKey } from './types';

export type Scope = 'kelas' | 'guru' | 'ruang' | 'siswa' | 'sekolah';

function hexA(hex: string, a: number): string {
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex + Math.round(a * 255).toString(16).padStart(2, '0');
  return '#ffffff';
}

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
  onOpen?: (a: Assignment) => void;
  onAdd?: (hari: number, periodeId: string) => void;
  onMove?: (a: Assignment, hari: number, periodeId: string) => void;
}) {
  const [dropTarget, setDropTarget] = useState<string | null>(null);

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
            {DAYS.map((d, i) => (
              <th key={d}>
                {d}
                <span className="sub">Hari ke-{i + 1}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {project.periode.map((per) => {
            if (per.istirahat) {
              return (
                <tr key={per.id} className="baris-istirahat">
                  <th className="jam-cell">
                    {per.nama}
                    <span className="waktu">
                      {per.mulai}–{per.selesai}
                    </span>
                  </th>
                  <td colSpan={DAYS.length}>☕ Istirahat</td>
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
                {DAYS.map((_, hari) => {
                  const key = cellKey(hari, per.id);
                  const list = cells.get(key) ?? [];
                  const cls = [
                    'cell',
                    dropTarget === key ? 'drag-over' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <td
                      key={key}
                      className={cls}
                      onDragOver={(e) => {
                        if (!editable) return;
                        e.preventDefault();
                        setDropTarget(key);
                      }}
                      onDragLeave={() => setDropTarget((t) => (t === key ? null : t))}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDropTarget(null);
                        if (!editable) return;
                        const id = e.dataTransfer.getData('text/plain');
                        const a = items.find((x) => x.id === id);
                        if (a) onMove?.(a, hari, per.id);
                      }}
                    >
                      {list.map((a) => {
                        const m = mapelM.get(a.mapelId);
                        const warna = m?.warna ?? '#94a3b8';
                        const kelas = [
                          'les',
                          a.tetap ? 'les-tetap' : '',
                          konflik?.has(a.id) || focusId === a.id ? 'les-konflik' : '',
                          dimMapel?.(a.mapelId) ? 'les-redup' : '',
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
                            title={`${m?.nama ?? '?'} — ${kelasM.get(a.kelasId)?.nama ?? ''} / ${guruM.get(a.guruId)?.nama ?? ''} / ${ruangM.get(a.ruangId)?.nama ?? 'tanpa ruang'}`}
                          >
                            <span className="nama">{m?.nama ?? '(mapel terhapus)'}</span>
                            <span className="meta">{metaFor(a)}</span>
                          </button>
                        );
                      })}
                      {editable && scope === 'kelas' && list.length === 0 ? (
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
