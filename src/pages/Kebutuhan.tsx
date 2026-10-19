// Halaman kebutuhan jam pelajaran per kelas × mapel × guru.

import { useMemo, useState } from 'react';
import { Requirement } from '../types';
import { useProject } from '../store';
import { Banner, Btn, EmptyState, FormField, Icon, Modal, PageHead, Tabs } from '../ui';
import { uid } from '../utils';

export function HalKebutuhan() {
  const { project, upsert, remove } = useProject();
  const [q, setQ] = useState('');
  const [fKelas, setFKelas] = useState('semua');
  const [form, setForm] = useState<Requirement | null>(null);

  const hitung = useMemo(() => {
    const m = new Map<string, number>();
    for (const j of project.jadwal) {
      const k = `${j.kelasId}|${j.mapelId}|${j.guruId}`;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [project.jadwal]);

  const rows = project.kebutuhan.filter((r) => {
    if (fKelas !== 'semua' && r.kelasId !== fKelas) return false;
    if (!q.trim()) return true;
    const nama =
      `${project.kelas.find((c) => c.id === r.kelasId)?.nama} ` +
      `${project.mapel.find((m) => m.id === r.mapelId)?.nama} ` +
      `${project.guru.find((g) => g.id === r.guruId)?.nama}`;
    return nama.toLowerCase().includes(q.trim().toLowerCase());
  });

  const blank = (): Requirement => ({
    id: uid('k'),
    kelasId: project.kelas[0]?.id ?? '',
    mapelId: project.mapel[0]?.id ?? '',
    guruId: project.guru[0]?.id ?? '',
    jumlahJam: 2,
    ruangId: '',
    polaJP: [],
  });

  const simpan = () => {
    if (!form) return;
    const out = {
      ...form,
      jumlahJam: Math.max(1, Number(form.jumlahJam) || 1),
      polaJP: Array.isArray(form.polaJP) ? form.polaJP.filter((n) => n >= 1) : [],
    };
    upsert('kebutuhan', out);
    setForm(null);
  };

  const totalSemua = project.kebutuhan.reduce((a, r) => a + r.jumlahJam, 0);
  const totalTerjadwal = project.jadwal.length;

  const opsiGuru = (() => {
    if (!form) return project.guru.map((g) => ({ value: g.id, label: g.nama }));
    const byMapel = project.guru.filter((g) => g.mapelIds.includes(form.mapelId));
    const list = byMapel.length ? byMapel : project.guru;
    const opsi = list.map((g) => ({ value: g.id, label: g.nama }));
    if (form.guruId && !opsi.some((o) => o.value === form.guruId)) {
      const g = project.guru.find((x) => x.id === form.guruId);
      if (g) opsi.unshift({ value: g.id, label: `${g.nama} (tidak mengampu mapel ini)` });
    }
    return opsi;
  })();

  return (
    <>
      <PageHead
        title="Kebutuhan Jam Pelajaran"
        desc="Berapa jam pelajaran tiap kelas butuhkan untuk setiap mata pelajaran — inilah target yang dipenuhi generator jadwal."
        actions={
          <>
            <div className="search-box">
              <Icon name="cari" size={15} />
              <input
                className="input"
                placeholder="Cari kelas/mapel/guru…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Btn icon="tambah" onClick={() => setForm(blank())}>
              Tambah Kebutuhan
            </Btn>
          </>
        }
      />

      <div className="stat-grid">
        {project.kelas.map((c) => {
          const jam = project.kebutuhan
            .filter((k) => k.kelasId === c.id)
            .reduce((a, k) => a + k.jumlahJam, 0);
          const ada = project.jadwal.filter((j) => j.kelasId === c.id).length;
          const persen = jam ? Math.min(100, Math.round((ada / jam) * 100)) : 0;
          return (
            <div className="stat" key={c.id}>
              <div className="stat-ic i-brand">{<Icon name="kelas" size={19} />}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="stat-val" style={{ fontSize: 17 }}>
                  {ada}/{jam}
                </div>
                <div className="stat-label">{c.nama} · jam terjadwal</div>
                <div className="bar" style={{ marginTop: 6 }}>
                  <div style={{ width: `${persen}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="tt-toolbar">
          <Tabs
            items={[
              { id: 'semua', label: 'Semua Kelas' },
              ...project.kelas.map((c) => ({ id: c.id, label: c.nama })),
            ]}
            value={fKelas}
            onChange={setFKelas}
          />
          <span className="hint" style={{ marginLeft: 'auto' }}>
            Total {totalSemua} jam/minggu · {totalTerjadwal} sudah terjadwal
          </span>
        </div>

        {project.kebutuhan.length === 0 ? (
          <EmptyState
            icon="daftar"
            title="Belum ada kebutuhan jam"
            desc="Tambahkan baris kebutuhan untuk tiap kelas × mata pelajaran, lalu jalankan generator."
            action={
              <Btn icon="tambah" onClick={() => setForm(blank())}>
                Tambah Kebutuhan
              </Btn>
            }
          />
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Kelas</th>
                  <th>Mata Pelajaran</th>
                  <th>Guru</th>
                  <th>Ruang</th>
                  <th>Jam/Minggu</th>
                  <th>Pola JP</th>
                  <th>Terjadwal</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const c = hitung.get(`${r.kelasId}|${r.mapelId}|${r.guruId}`) ?? 0;
                  const mapel = project.mapel.find((m) => m.id === r.mapelId);
                  const kelas = project.kelas.find((x) => x.id === r.kelasId);
                  const guru = project.guru.find((x) => x.id === r.guruId);
                  const ruang = project.ruang.find((x) => x.id === r.ruangId);
                  return (
                    <tr key={r.id}>
                      <td>
                        <span className="badge badge-biru">{kelas?.nama ?? '(terhapus)'}</span>
                      </td>
                      <td>
                        <b>
                          <i className="warna-dot" style={{ background: guru?.warna ?? '#94a3b8' }} />
                          {mapel?.nama ?? '(terhapus)'}
                        </b>
                      </td>
                      <td>{guru?.nama ?? '(terhapus)'}</td>
                      <td>{ruang?.nama ?? <span className="hint">Otomatis</span>}</td>
                      <td>{r.jumlahJam}</td>
                      <td>
                        {r.polaJP.length ? (
                          <span className="badge badge-biru">{r.polaJP.join(' + ')}</span>
                        ) : (
                          <span className="hint">—</span>
                        )}
                      </td>
                      <td>{c}</td>
                      <td>
                        {c >= r.jumlahJam ? (
                          <span className="badge badge-hijau">Terpenuhi</span>
                        ) : c === 0 ? (
                          <span className="badge badge-merah">Belum ada</span>
                        ) : (
                          <span className="badge badge-kuning">Kurang {r.jumlahJam - c}</span>
                        )}
                      </td>
                      <td className="aksi">
                        <div className="aksi-inline">
                          <button
                            className="icon-btn"
                            title="Ubah"
                            onClick={() => setForm({ ...r })}
                          >
                            <Icon name="ubah" size={15} />
                          </button>
                          <button
                            className="icon-btn"
                            title="Hapus"
                            onClick={() => {
                              if (window.confirm(`Hapus kebutuhan ${kelas?.nama} · ${mapel?.nama}?`))
                                remove('kebutuhan', r.id);
                            }}
                          >
                            <Icon name="hapus" size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="empty" style={{ padding: '26px' }}>
                        <p>Tidak ada baris yang cocok.</p>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={form !== null}
        title={form?.id ? 'Ubah Kebutuhan Jam' : 'Tambah Kebutuhan Jam'}
        desc="Tentukan kelas, mata pelajaran, guru, dan jumlah jam per minggu."
        onClose={() => setForm(null)}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setForm(null)}>
              Batal
            </Btn>
            <Btn icon="cek" onClick={simpan}>
              Simpan
            </Btn>
          </>
        }
      >
        {form ? (
          <div className="form-grid">
            <FormField
              def={{
                key: 'kelasId',
                label: 'Kelas',
                type: 'select',
                options: project.kelas.map((c) => ({ value: c.id, label: c.nama })),
              }}
              value={form.kelasId}
              onChange={(v) => setForm({ ...form, kelasId: String(v) })}
            />
            <FormField
              def={{
                key: 'mapelId',
                label: 'Mata Pelajaran',
                type: 'select',
                options: project.mapel.map((m) => ({ value: m.id, label: m.nama })),
              }}
              value={form.mapelId}
              onChange={(v) => setForm({ ...form, mapelId: String(v) })}
            />
            <FormField
              def={{
                key: 'guruId',
                label: 'Guru',
                type: 'select',
                options: opsiGuru,
                hint: 'Opsinya diurutkan: guru yang benar-benar mengampu mapel tersebut.',
              }}
              value={form.guruId}
              onChange={(v) => setForm({ ...form, guruId: String(v) })}
            />
            <FormField
              def={{
                key: 'ruangId',
                label: 'Ruang Tetap (opsional)',
                type: 'select',
                options: [
                  { value: '', label: 'Otomatis (sesuai tipe mapel)' },
                  ...project.ruang.map((r) => ({ value: r.id, label: `${r.nama} (${r.kapasitas})` })),
                ],
              }}
              value={form.ruangId}
              onChange={(v) => setForm({ ...form, ruangId: String(v) })}
            />
            <FormField
              def={{
                key: 'jumlahJam',
                label: 'Jumlah Jam / Minggu',
                type: 'number',
                min: 1,
                max: 20,
              }}
              value={form.jumlahJam}
              onChange={(v) => setForm({ ...form, jumlahJam: Number(v) })}
            />
            <div className="span2">
              <FormField
                def={{
                  key: 'polaJP',
                  label: 'Pola Distribusi JP (Block Scheduling)',
                  type: 'pola',
                  placeholder: 'Contoh: 2, 1',
                  hint: 'Pecah jumlah jam menjadi blok berurutan, mis. jumlah 3 JP dengan pola 2, 1 = blok 2 JP menyambung + 1 JP. Kosong = mengikuti pola guru / bebas.',
                }}
                value={form.polaJP}
                onChange={(v) => setForm({ ...form, polaJP: v as number[] })}
              />
              {(() => {
                // Validasi: total pola harus masuk akal terhadap jumlah jam.
                // Pola boleh diulang (mis. [2,1] untuk 6 JP = 2+1+2+1), jadi
                // pola dianggap cocok bila jumlah jam habis dibagi total pola,
                // atau total pola sama persis dengan jumlah jam.
                const total = (form.polaJP ?? []).reduce((a, b) => a + b, 0);
                const jam = Math.max(1, Number(form.jumlahJam) || 0);
                if (!total) return null;
                const pas = total === jam || jam % total === 0;
                if (pas) return null;
                return (
                  <Banner tone="peringatan" icon="info">
                    Total pola <b>{form.polaJP.join(' + ')}</b> = {total} JP, tidak sama dengan
                    Jumlah Jam ({jam} JP). Generator akan mengulang pola sampai jam habis, tetapi
                    hasilnya bisa tidak sesuai blok yang diinginkan. Samakan total pola dengan
                    jumlah jam (mis. 3 JP → pola “2, 1”).
                  </Banner>
                );
              })()}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
