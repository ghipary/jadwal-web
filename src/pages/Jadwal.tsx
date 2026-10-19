// Halaman grid jadwal: lihat per kelas/guru/ruang/siswa, edit manual
// (seret-pindah, klik-ubah, tambah di sel kosong).

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Assignment, DAYS } from '../types';
import { useProject } from '../store';
import { checkConflicts } from '../scheduler';
import { Legend, Scope, TimetableGrid } from '../timetable';
import { Banner, Btn, EmptyState, FormField, Icon, Modal, PageHead, Tabs } from '../ui';
import { downloadCSV, uid } from '../utils';

interface Draft {
  kelasId: string;
  hari: number;
  periodeId: string;
  mapelId: string;
  guruId: string;
  ruangId: string;
  catatan: string;
}

export function HalJadwal() {
  const { project, upsert, remove, set } = useProject();
  const location = useLocation();
  const navigate = useNavigate();
  const [scope, setScope] = useState<Scope>('kelas');
  const [refId, setRefId] = useState('');
  const [bukaLes, setBukaLes] = useState<Assignment | null>(null);
  const [tambah, setTambah] = useState<Draft | null>(null);

  const state = location.state as { lesId?: string } | null;
  const focusLes = state?.lesId
    ? project.jadwal.find((j) => j.id === state.lesId) ?? null
    : null;

  useEffect(() => {
    if (focusLes) {
      setScope('kelas');
      setRefId(focusLes.kelasId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusLes?.id]);

  const daftar = useMemo(() => {
    if (scope === 'sekolah') return [];
    if (scope === 'kelas') return project.kelas.map((x) => ({ id: x.id, label: x.nama }));
    if (scope === 'guru') return project.guru.map((x) => ({ id: x.id, label: x.nama }));
    if (scope === 'ruang') return project.ruang.map((x) => ({ id: x.id, label: x.nama }));
    return project.siswa.map((x) => ({
      id: x.id,
      label: `${x.nama} · ${project.kelas.find((c) => c.id === x.kelasId)?.nama ?? '?'}`,
    }));
  }, [scope, project]);

  useEffect(() => {
    if (daftar.length && !daftar.some((x) => x.id === refId)) setRefId(daftar[0].id);
  }, [daftar, refId]);

  const siswa = scope === 'siswa' ? project.siswa.find((s) => s.id === refId) : undefined;

  const items = project.jadwal.filter((j) => {
    if (scope === 'sekolah') return true;
    if (scope === 'kelas') return j.kelasId === refId;
    if (scope === 'guru') return j.guruId === refId;
    if (scope === 'ruang') return j.ruangId === refId;
    if (scope === 'siswa') return Boolean(siswa) && j.kelasId === siswa!.kelasId;
    return false;
  });

  const konflikSet = useMemo(
    () => new Set(checkConflicts(project).flatMap((c) => c.refJadwal)),
    [project],
  );

  // --- lookup nama -------------------------------------------------------
  const kelasNama = (id: string) => project.kelas.find((c) => c.id === id)?.nama ?? '(terhapus)';
  const mapelCari = (id: string) => project.mapel.find((m) => m.id === id);
  const guruNama = (id: string) =>
    project.guru.find((g) => g.id === id)?.nama.split(',')[0] ?? '(terhapus)';
  const ruangNama = (id: string) => project.ruang.find((r) => r.id === id)?.nama ?? '(tanpa ruang)';

  const cekBentrok = (cand: Assignment): string[] => {
    const out: string[] = [];
    for (const j of project.jadwal) {
      if (j.id === cand.id) continue;
      if (j.hari !== cand.hari || j.periodeId !== cand.periodeId) continue;
      if (j.kelasId === cand.kelasId)
        out.push(`Kelas ${kelasNama(cand.kelasId)} sudah berisi ${mapelCari(j.mapelId)?.nama}`);
      if (j.guruId === cand.guruId)
        out.push(`Guru ${guruNama(cand.guruId)} sudah mengajar ${mapelCari(j.mapelId)?.nama} (${kelasNama(j.kelasId)})`);
      if (cand.ruangId && j.ruangId === cand.ruangId)
        out.push(`Ruang ${ruangNama(cand.ruangId)} dipakai ${mapelCari(j.mapelId)?.nama} (${kelasNama(j.kelasId)})`);
    }
    return [...new Set(out)];
  };

  const autoRoom = (d: Draft): string => {
    const mapel = mapelCari(d.mapelId);
    const kelas = project.kelas.find((c) => c.id === d.kelasId);
    if (!mapel) return '';
    const busy = new Set(
      project.jadwal
        .filter((j) => j.hari === d.hari && j.periodeId === d.periodeId && j.ruangId)
        .map((j) => j.ruangId),
    );
    const cocok = (butuhKapasitas: boolean) =>
      project.ruang.filter(
        (r) =>
          (mapel.tipeRuang === 'semua' || r.tipe === mapel.tipeRuang) &&
          !busy.has(r.id) &&
          (!butuhKapasitas || !kelas || r.kapasitas >= kelas.jumlahSiswa),
      );
    return cocok(true)[0]?.id ?? cocok(false)[0]?.id ?? '';
  };

  const pindah = (a: Assignment, hari: number, periodeId: string) => {
    if (a.hari === hari && a.periodeId === periodeId) return;
    const cand: Assignment = { ...a, hari, periodeId };
    const bentrok = cekBentrok(cand);
    const per = project.periode.find((p) => p.id === periodeId);
    const tujuan = `${DAYS[hari]} · ${per?.nama ?? ''}`;
    if (
      bentrok.length &&
      !window.confirm(`Pindahkan ke ${tujuan}?\n\nPotensi bentrok:\n• ${bentrok.join('\n• ')}\n\nTetap pindahkan?`)
    )
      return;
    upsert('jadwal', cand);
  };

  const mulaiTambah = (kelasId: string, hari: number, periodeId: string) => {
    const mapelPertama = project.mapel[0];
    const guruPertama =
      project.guru.find((g) => g.mapelIds.includes(mapelPertama?.id ?? '')) ?? project.guru[0];
    setTambah({
      kelasId,
      hari,
      periodeId,
      mapelId: mapelPertama?.id ?? '',
      ruangId: '',
      guruId: guruPertama?.id ?? '',
      catatan: '',
    });
  };

  const simpanTambah = () => {
    if (!tambah || !tambah.kelasId) return;
    const ruangId = tambah.ruangId || autoRoom(tambah);
    const cand: Assignment = {
      id: uid('j'),
      reqId: '',
      kelasId: tambah.kelasId,
      mapelId: tambah.mapelId,
      guruId: tambah.guruId,
      ruangId,
      hari: tambah.hari,
      periodeId: tambah.periodeId,
      tetap: false,
      catatan: tambah.catatan,
    };
    if (!cand.mapelId || !cand.guruId) {
      window.alert('Pilih mata pelajaran dan guru terlebih dahulu.');
      return;
    }
    const bentrok = cekBentrok(cand);
    if (
      bentrok.length &&
      !window.confirm(`Ada potensi bentrok:\n\n• ${bentrok.join('\n• ')}\n\nTetap simpan pelajaran ini?`)
    )
      return;
    upsert('jadwal', cand);
    setTambah(null);
  };

  const simpanBuka = () => {
    if (!bukaLes) return;
    const bentrok = cekBentrok(bukaLes);
    if (
      bentrok.length &&
      !window.confirm(`Perubahan menimbulkan bentrok:\n\n• ${bentrok.join('\n• ')}\n\nTetap simpan?`)
    )
      return;
    upsert('jadwal', bukaLes);
    setBukaLes(null);
  };

  const eksporCSV = () => {
    const urutPeriode = new Map(project.periode.map((p, i) => [p.id, i]));
    const sorted = [...items].sort(
      (a, b) =>
        a.hari - b.hari ||
        (urutPeriode.get(a.periodeId) ?? 99) - (urutPeriode.get(b.periodeId) ?? 99),
    );
    const rows: (string | number)[][] = [
      ['Hari', 'Jam', 'Waktu', 'Kelas', 'Mata Pelajaran', 'Guru', 'Ruang', 'Tetap'],
      ...sorted.map((j) => {
        const per = project.periode.find((p) => p.id === j.periodeId);
        return [
          DAYS[j.hari] ?? '',
          per?.nama ?? '',
          `${per?.mulai ?? ''}-${per?.selesai ?? ''}`,
          kelasNama(j.kelasId),
          mapelCari(j.mapelId)?.nama ?? '',
          project.guru.find((g) => g.id === j.guruId)?.nama ?? '',
          ruangNama(j.ruangId),
          j.tetap ? 'Ya' : 'Tidak',
        ];
      }),
    ];
    const namaRef =
      scope === 'sekolah'
        ? 'seluruh-sekolah'
        : (daftar.find((x) => x.id === refId)?.label ?? 'jadwal');
    downloadCSV(
      `jadwal-${scope}-${namaRef.replace(/[^\w-]+/g, '_').toLowerCase()}.csv`,
      rows,
    );
  };

  const kosongkan = () => {
    const nonTetap = project.jadwal.filter((j) => !j.tetap).length;
    if (!nonTetap) {
      window.alert('Tidak ada jadwal non-tetap untuk dikosongkan.');
      return;
    }
    if (
      window.confirm(
        `Kosongkan ${nonTetap} jadwal non-tetap seluruh kelas? (jadwal yang ditandai tetap tetap aman)`,
      )
    ) {
      set({ jadwal: project.jadwal.filter((j) => j.tetap) });
    }
  };

  const jumlah = items.length;
  const batas =
    scope === 'sekolah'
      ? ` · ${project.kelas.length} kelas · ${project.guru.length} guru`
      : scope === 'guru'
      ? (() => {
          const g = project.guru.find((x) => x.id === refId);
          return g ? ` · ${jumlah}/${g.maxJam} jam per minggu` : '';
        })()
      : scope === 'kelas'
        ? (() => {
            const butuh = project.kebutuhan
              .filter((k) => k.kelasId === refId)
              .reduce((a, k) => a + k.jumlahJam, 0);
            return butuh ? ` · ${jumlah}/${butuh} jam dari kebutuhan` : '';
          })()
        : '';

  const dimMapel =
    scope === 'siswa' && siswa && siswa.pilihan.length
      ? (mapelId: string) => {
          const m = mapelCari(mapelId);
          return Boolean(m?.pilihan) && !siswa.pilihan.includes(mapelId);
        }
      : undefined;

  const guruOpsi = (() => {
    const base = tambah
      ? project.guru.filter((g) => g.mapelIds.includes(tambah.mapelId))
      : [];
    const list = base.length ? base : project.guru;
    return list.map((g) => ({ value: g.id, label: g.nama }));
  })();

  const mapelUntukLes = bukaLes ? mapelCari(bukaLes.mapelId) : undefined;
  const ruangOpsiLes = (() => {
    if (!bukaLes || !mapelUntukLes) return project.ruang.map((r) => ({ value: r.id, label: r.nama }));
    const busy = new Set(
      project.jadwal
        .filter(
          (j) =>
            j.id !== bukaLes.id && j.hari === bukaLes.hari && j.periodeId === bukaLes.periodeId && j.ruangId,
        )
        .map((j) => j.ruangId),
    );
    const cocok = project.ruang.filter(
      (r) => mapelUntukLes.tipeRuang === 'semua' || r.tipe === mapelUntukLes.tipeRuang,
    );
    cocok.sort((a, b) => Number(busy.has(a.id)) - Number(busy.has(b.id)));
    const lain = project.ruang.filter((r) => !cocok.includes(r));
    return [
      { value: '', label: '— Tanpa Ruang —' },
      ...cocok.map((r) => ({ value: r.id, label: `${r.nama} · ${LABEL_TIPE(r.tipe)}${busy.has(r.id) ? ' (terpakai)' : ''}` })),
      ...lain.map((r) => ({ value: r.id, label: `${r.nama} · ${LABEL_TIPE(r.tipe)} (tipe berbeda)` })),
    ];
  })();

  if (scope === 'sekolah' ? project.kelas.length === 0 : daftar.length === 0) {
    return (
      <>
        <PageHead title="Jadwal Pelajaran" desc="Grid jadwal mingguan untuk seluruh kelas, guru, dan ruang." />
        <div className="card">
          <EmptyState
            icon="jadwal"
            title="Belum ada data untuk ditampilkan"
            desc="Tambahkan data kelas/guru/ruang dulu di menu Data, lalu jalankan generator."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead
        title="Jadwal Pelajaran"
        desc="Seret kartu untuk memindah jam, klik kartu untuk mengubah ruang/menandai tetap/menghapus, klik tombol + di sel kosong untuk menambah."
        actions={
          <>
            <Btn variant="ghost" icon="unduh" onClick={eksporCSV}>
              Ekspor CSV
            </Btn>
            <Btn variant="ghost" icon="cetak" onClick={() => window.print()}>
              Cetak
            </Btn>
            <Btn variant="danger" icon="hapus" onClick={kosongkan}>
              Kosongkan Non-Tetap
            </Btn>
            <Btn variant="primary" icon="generate" onClick={() => navigate('/generate')}>
              Generate
            </Btn>
          </>
        }
      />

      <div className="tt-toolbar">
        <Tabs
          items={[
            { id: 'sekolah', label: 'Per Sekolah', icon: 'sekolah' },
            { id: 'kelas', label: 'Per Kelas', icon: 'kelas' },
            { id: 'guru', label: 'Per Guru', icon: 'guru' },
            { id: 'ruang', label: 'Per Ruang', icon: 'ruang' },
            { id: 'siswa', label: 'Per Siswa', icon: 'siswa' },
          ]}
          value={scope}
          onChange={(id) => {
            setScope(id as Scope);
            setRefId('');
          }}
        />
        {scope === 'sekolah' ? null : (
          <select
            className="input"
            style={{ maxWidth: 320 }}
            value={refId}
            onChange={(e) => setRefId(e.target.value)}
          >
            {daftar.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        )}
        <span className="hint" style={{ marginLeft: 'auto' }}>
          {scope === 'sekolah' ? `${jumlah} jam pelajaran` : `${jumlah} jam/minggu`}
          {batas}
        </span>
      </div>

      {scope === 'siswa' && siswa && siswa.pilihan.length ? (
        <Banner tone="info" icon="info">
          Menampilkan jadwal kelas <b>{kelasNama(siswa.kelasId)}</b>. Mapel pilihan yang tidak diambil siswa ini
          ditampilkan redup.
        </Banner>
      ) : null}

      {scope === 'sekolah' ? (
        <div className="tt-stack">
          {project.kelas.map((k) => {
            const les = project.jadwal.filter((j) => j.kelasId === k.id);
            const butuh = project.kebutuhan
              .filter((kk) => kk.kelasId === k.id)
              .reduce((a, kk) => a + kk.jumlahJam, 0);
            return (
              <TimetableGrid
                key={k.id}
                project={project}
                items={les}
                scope="kelas"
                editable
                konflik={konflikSet}
                judul={k.nama}
                subjudul={
                  butuh ? `${les.length}/${butuh} jam dari kebutuhan` : `${les.length} jam/minggu`
                }
                focusId={focusLes?.id ?? null}
                onOpen={(a) => setBukaLes({ ...a })}
                onAdd={(hari, periodeId) => mulaiTambah(k.id, hari, periodeId)}
                onMove={pindah}
              />
            );
          })}
        </div>
      ) : (
        <TimetableGrid
          project={project}
          items={items}
          scope={scope}
          editable
          konflik={konflikSet}
          dimMapel={dimMapel}
          focusId={focusLes?.id ?? null}
          onOpen={(a) => setBukaLes({ ...a })}
          onAdd={(hari, periodeId) => mulaiTambah(refId, hari, periodeId)}
          onMove={pindah}
        />
      )}
      <Legend />

      {/* --- Modal ubah pelajaran --- */}
      <Modal
        open={bukaLes !== null}
        title="Detail Pelajaran"
        desc="Ubah ruang, tandai sebagai jadwal tetap, atau hapus pelajaran."
        onClose={() => setBukaLes(null)}
        footer={
          bukaLes ? (
            <>
              <Btn
                variant="danger"
                icon="hapus"
                onClick={() => {
                  if (window.confirm(`Hapus pelajaran ${mapelCari(bukaLes.mapelId)?.nama}?`)) {
                    remove('jadwal', bukaLes.id);
                    setBukaLes(null);
                  }
                }}
              >
                Hapus
              </Btn>
              <div style={{ flex: 1 }} />
              <Btn variant="ghost" onClick={() => setBukaLes(null)}>
                Batal
              </Btn>
              <Btn variant="primary" icon="cek" onClick={simpanBuka}>
                Simpan
              </Btn>
            </>
          ) : null
        }
      >
        {bukaLes ? (
          <div className="form-grid">
            <div className="field">
              <label>Mata Pelajaran</label>
              <div className="kv" style={{ border: 'none', padding: '4px 0' }}>
                <b>
                  <i
                    className="warna-dot"
                    style={{
                      background:
                        project.guru.find((g) => g.id === bukaLes.guruId)?.warna ?? '#94a3b8',
                    }}
                  />
                  {mapelCari(bukaLes.mapelId)?.nama ?? '(terhapus)'}
                </b>
                {bukaLes.tetap ? <span className="badge badge-hijau">Tetap</span> : <span className="badge badge-abu">Fleksibel</span>}
              </div>
              <span className="hint">
                {kelasNama(bukaLes.kelasId)} · {guruNama(bukaLes.guruId)} · {DAYS[bukaLes.hari]} ·{' '}
                {project.periode.find((p) => p.id === bukaLes.periodeId)?.nama}
              </span>
            </div>
            <FormField
              def={{
                key: 'ruangId',
                label: 'Ruang',
                type: 'select',
                options: ruangOpsiLes,
                hint: 'Urutan: ruang bertipe sesuai & bebas lebih dulu.',
              }}
              value={bukaLes.ruangId}
              onChange={(v) => setBukaLes({ ...bukaLes, ruangId: String(v) })}
            />
            <FormField
              def={{
                key: 'guruId',
                label: 'Guru',
                type: 'select',
                options: project.guru.map((g) => ({ value: g.id, label: g.nama })),
              }}
              value={bukaLes.guruId}
              onChange={(v) => setBukaLes({ ...bukaLes, guruId: String(v) })}
            />
            <FormField
              def={{
                key: 'tetap',
                label: 'Jadwal Tetap',
                type: 'check',
                hint: 'Tandai tetap: tidak akan diganti saat generate ulang.',
              }}
              value={bukaLes.tetap}
              onChange={(v) => setBukaLes({ ...bukaLes, tetap: Boolean(v) })}
            />
            <div className="span2">
              <FormField
                def={{ key: 'catatan', label: 'Catatan', type: 'textarea', placeholder: 'Opsional…' }}
                value={bukaLes.catatan}
                onChange={(v) => setBukaLes({ ...bukaLes, catatan: String(v) })}
              />
            </div>
          </div>
        ) : null}
      </Modal>

      {/* --- Modal tambah pelajaran --- */}
      <Modal
        open={tambah !== null}
        title="Tambah Pelajaran"
        desc={
          tambah
            ? `${kelasNama(tambah.kelasId)} · ${DAYS[tambah.hari]} · ${project.periode.find((p) => p.id === tambah.periodeId)?.nama ?? ''}`
            : undefined
        }
        onClose={() => setTambah(null)}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setTambah(null)}>
              Batal
            </Btn>
            <Btn variant="primary" icon="cek" onClick={simpanTambah}>
              Simpan Pelajaran
            </Btn>
          </>
        }
      >
        {tambah ? (
          <div className="form-grid">
            <FormField
              def={{
                key: 'mapelId',
                label: 'Mata Pelajaran',
                type: 'select',
                options: project.mapel.map((m) => ({ value: m.id, label: m.nama })),
              }}
              value={tambah.mapelId}
              onChange={(v) => {
                const mapelId = String(v);
                const guruMasihCocok = project.guru.some(
                  (g) => g.id === tambah.guruId && g.mapelIds.includes(mapelId),
                );
                const guruBaru = guruMasihCocok
                  ? tambah.guruId
                  : project.guru.find((g) => g.mapelIds.includes(mapelId))?.id ?? tambah.guruId;
                setTambah({ ...tambah, mapelId, guruId: guruBaru, ruangId: '' });
              }}
            />
            <FormField
              def={{
                key: 'guruId',
                label: 'Guru',
                type: 'select',
                options: guruOpsi,
                hint: 'Opsi utama: guru yang mengampu mapel tersebut.',
              }}
              value={tambah.guruId}
              onChange={(v) => setTambah({ ...tambah, guruId: String(v) })}
            />
            <FormField
              def={{
                key: 'ruangId',
                label: 'Ruang',
                type: 'select',
                options: [
                  { value: '', label: 'Otomatis (pilih ruang bebas yang sesuai)' },
                  ...project.ruang.map((r) => ({ value: r.id, label: `${r.nama} · ${LABEL_TIPE(r.tipe)}` })),
                ],
              }}
              value={tambah.ruangId}
              onChange={(v) => setTambah({ ...tambah, ruangId: String(v) })}
            />
            <FormField
              def={{ key: 'catatan', label: 'Catatan', type: 'text', placeholder: 'Opsional…' }}
              value={tambah.catatan}
              onChange={(v) => setTambah({ ...tambah, catatan: String(v) })}
            />
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function LABEL_TIPE(t: string): string {
  return (
    { reguler: 'Reguler', 'lab-komputer': 'Lab Komputer', 'lab-sains': 'Lab Sains', olahraga: 'Lapangan' }[
      t
    ] ?? t
  );
}
