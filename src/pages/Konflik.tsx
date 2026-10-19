// Halaman pemeriksa konflik jadwal — 3 card interaktif yang membuka modal detail:
// Konflik keras, Peringatan, dan Rincian Jam Pelajaran.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConflictTipe } from '../types';
import { useProject } from '../store';
import { HasilAutoFix, autoFixConflicts, checkConflicts, isClean } from '../scheduler';import { Banner, Btn, EmptyState, Icon, Modal, PageHead } from '../ui';

const LABEL_TIPE: Record<ConflictTipe, string> = {
  'kelas-bentrok': 'Kelas Bentrok',
  'guru-bentrok': 'Guru Bentrok',
  'ruang-bentrok': 'Ruang Bentrok',
  'kurang-jam': 'Kurang Jam',
  'lebih-jam': 'Lebih Jam',
  'guru-lebih-jam': 'Beban Guru Berlebih',
  kapasitas: 'Kapasitas Ruang',
  blokir: 'Slot Terblokir Dilanggar',
  istirahat: 'Di Luar Jam Pelajaran',
  nonaktif: 'JP Non-Aktif pada Hari Itu',
  data: 'Masalah Data',
};

const IKON_TIPE: Record<ConflictTipe, string> = {
  'kelas-bentrok': 'kelas',
  'guru-bentrok': 'guru',
  'ruang-bentrok': 'ruang',
  'kurang-jam': 'daftar',
  'lebih-jam': 'daftar',
  'guru-lebih-jam': 'guru',
  kapasitas: 'ruang',
  blokir: 'blokir',
  istirahat: 'jam',
  nonaktif: 'jam',
  data: 'info',
};

type JenisModal = 'konflik' | 'peringatan' | 'jam' | null;

export function HalKonflik() {
  const { project, set } = useProject();
  const navigate = useNavigate();
  const [modal, setModal] = useState<JenisModal>(null);
  const [jalan, setJalan] = useState(false);
  const [hasil, setHasil] = useState<HasilAutoFix | null>(null);

  const konflik = useMemo(() => checkConflicts(project), [project]);
  const bersih = isClean(konflik);
  const daftarError = useMemo(
    () => konflik.filter((k) => k.tingkat === 'error'),
    [konflik],
  );
  const daftarWarning = useMemo(
    () => konflik.filter((k) => k.tingkat === 'peringatan'),
    [konflik],
  );
  const jumlahError = daftarError.length;
  const jumlahWarning = daftarWarning.length;

  // Isi modal: daftar konflik sesuai card yang diklik.
  const daftarModal = modal === 'peringatan' ? daftarWarning : daftarError;

  // Rincian jam mengajar per guru (hanya dihitung saat modal jam dibuka).
  const rincianGuru = useMemo(() => {
    if (modal !== 'jam') return [];
    const jam = new Map<string, number>();
    for (const j of project.jadwal) jam.set(j.guruId, (jam.get(j.guruId) ?? 0) + 1);
    return project.guru
      .map((g) => ({ g, jam: jam.get(g.id) ?? 0 }))
      .sort((a, b) => b.jam - a.jam || a.g.nama.localeCompare(b.g.nama));
  }, [modal, project]);

  // Rincian jam per mata pelajaran (vs kebutuhan jam).
  const rincianMapel = useMemo(() => {
    if (modal !== 'jam') return [];
    const jam = new Map<string, number>();
    for (const j of project.jadwal) jam.set(j.mapelId, (jam.get(j.mapelId) ?? 0) + 1);
    const butuh = new Map<string, number>();
    for (const k of project.kebutuhan)
      butuh.set(k.mapelId, (butuh.get(k.mapelId) ?? 0) + k.jumlahJam);
    return project.mapel
      .map((m) => ({ m, jam: jam.get(m.id) ?? 0, butuh: butuh.get(m.id) ?? 0 }))
      .sort((a, b) => b.jam - a.jam || a.m.nama.localeCompare(b.m.nama));
  }, [modal, project]);

  const lihatDiJadwal = (lesId: string) => {
    setModal(null);
    navigate('/jadwal', { state: { lesId, scope: 'kelas' } });
  };

  /**
   * TASK 5 — tombol besar "Selesaikan Semua Konflik": trial-and-error
   * memindahkan/menukar posisi jadwal sampai konflik keras hilang.
   */
  const selesaikanSemua = async () => {
    setJalan(true);
    setHasil(null);
    await new Promise((r) => setTimeout(r, 40));
    const r = autoFixConflicts(project);
    set({ jadwal: r.jadwal });
    setHasil(r);
    setJalan(false);
  };

  return (
    <>
      <PageHead
        title="Pemeriksa Konflik"
        desc="Periksa ulang seluruh jadwal: bentrok kelas/guru/ruang, kebutuhan jam yang belum terpenuhi, batasan yang dilanggar, dan kapasitas ruang. Klik salah satu kartu di bawah untuk melihat rinciannya."
        actions={
          <>
            <Btn variant="ghost" icon="generate" onClick={() => navigate('/generate')}>
              Generate Ulang
            </Btn>
            <Btn variant="primary" icon="jadwal" onClick={() => navigate('/jadwal')}>
              Buka Jadwal
            </Btn>
          </>
        }
      />

      <div className="stat-grid">
        <button
          type="button"
          className="stat stat-aktif"
          title="Klik untuk melihat daftar konflik keras"
          onClick={() => setModal('konflik')}
        >
          <div className={`stat-ic ${jumlahError ? 'i-bahaya' : 'i-sukses'}`}>
            <Icon name={jumlahError ? 'konflik' : 'cek'} size={19} />
          </div>
          <div>
            <div className="stat-val">{jumlahError}</div>
            <div className="stat-label">Konflik keras (harus diperbaiki)</div>
          </div>
          <span className="stat-arrow">
            <Icon name="kanan" size={16} />
          </span>
        </button>

        <button
          type="button"
          className="stat stat-aktif"
          title="Klik untuk melihat daftar peringatan"
          onClick={() => setModal('peringatan')}
        >
          <div className={`stat-ic ${jumlahWarning ? 'i-oring' : 'i-sukses'}`}>
            <Icon name={jumlahWarning ? 'info' : 'cek'} size={19} />
          </div>
          <div>
            <div className="stat-val">{jumlahWarning}</div>
            <div className="stat-label">Peringatan (sebaiknya diperiksa)</div>
          </div>
          <span className="stat-arrow">
            <Icon name="kanan" size={16} />
          </span>
        </button>

        <button
          type="button"
          className="stat stat-aktif"
          title="Klik untuk merinci total jam mengajar per guru/mapel"
          onClick={() => setModal('jam')}
        >
          <div className="stat-ic i-brand">
            <Icon name="jadwal" size={19} />
          </div>
          <div>
            <div className="stat-val">{project.jadwal.length}</div>
            <div className="stat-label">Jam pelajaran terjadwal</div>
          </div>
          <span className="stat-arrow">
            <Icon name="kanan" size={16} />
          </span>
        </button>
      </div>

      <div className="perbaiki-panel no-print">
        <div className="perbaiki-ic">
          <Icon name="generate" size={22} />
        </div>
        <div className="perbaiki-teks">
          <h3>{jalan ? 'Mencoba menyelesaikan konflik…' : 'Perbaikan Otomatis'}</h3>
          <p>
            Coba pindahkan &amp; tukar posisi pelajaran secara trial-and-error supaya seluruh konflik
            keras hilang. Jadwal yang ditandai “tetap” tidak diubah.
          </p>
          {hasil ? (
            <p className="perbaiki-hasil">
              {hasil.tersisa === 0 ? (
                <>
                  <b>Berhasil menyelesaikan {hasil.berhasil} konflik, 0 tersisa.</b> Jadwal kini
                  bersih dari konflik keras ({hasil.gerakan} langkah pemindahan).
                </>
              ) : (
                <>
                  Berhasil menyelesaikan <b>{hasil.berhasil}</b> konflik, <b>{hasil.tersisa}</b>{' '}
                  tersisa. Sisa konflik umumnya butuh penambahan slot/ruang atau penyesuaian manual.
                </>
              )}
            </p>
          ) : null}
        </div>
        <Btn
          variant="primary"
          icon={jalan ? 'putar' : 'konflik'}
          size="md"
          disabled={jalan || isClean(konflik) || jumlahError === 0}
          onClick={() => void selesaikanSemua()}
        >
          {jalan ? 'Memproses…' : 'Selesaikan Semua Konflik'}
        </Btn>
      </div>

      {hasil ? (
        <Banner tone={hasil.tersisa === 0 ? 'sukses' : 'peringatan'} icon={hasil.tersisa === 0 ? 'cek' : 'konflik'}>
          Berhasil menyelesaikan <b>{hasil.berhasil}</b> konflik, <b>{hasil.tersisa}</b> tersisa.
        </Banner>
      ) : null}

      {bersih ? (
        <div className="card">
          <EmptyState
            icon="cek"
            title="Jadwal bersih dari konflik"
            desc="Tidak ada bentrok, kebutuhan jam terpenuhi, dan seluruh batasan dihormati. Tinggal disempurnakan secara manual bila perlu."
            action={
              <Btn icon="jadwal" onClick={() => navigate('/jadwal')}>
                Lihat Jadwal
              </Btn>
            }
          />
        </div>
      ) : (
        <>
          {jumlahError > 0 ? (
            <Banner tone="bahaya" icon="konflik">
              Ada <b>{jumlahError}</b> konflik keras. Perbaiki sebelum jadwal dipakai — klik “Lihat di Jadwal” untuk menuju kartu yang bermasalah.
            </Banner>
          ) : null}
          {konflik.map((k) => (
            <div key={k.id} className={`conf-item ${k.tingkat}`}>
              <div className="conf-ic">
                <Icon name={IKON_TIPE[k.tipe]} size={16} />
              </div>
              <div>
                <h4>
                  {LABEL_TIPE[k.tipe]}{' '}
                  <span className={`badge ${k.tingkat === 'error' ? 'badge-merah' : 'badge-kuning'}`}>
                    {k.tingkat === 'error' ? 'Keras' : 'Peringatan'}
                  </span>
                </h4>
                <p>{k.pesan}</p>
              </div>
              {k.refJadwal.length > 0 ? (
                <div className="aksi-bar">
                  <Btn size="sm" variant="ghost" icon="kanan" onClick={() => lihatDiJadwal(k.refJadwal[0])}>
                    Lihat di Jadwal
                  </Btn>
                </div>
              ) : null}
            </div>
          ))}
        </>
      )}

      {/* --- Modal detail konflik / peringatan --- */}
      <Modal
        open={modal === 'konflik' || modal === 'peringatan'}
        title={modal === 'peringatan' ? 'Detail Peringatan' : 'Detail Konflik Keras'}
        desc={
          modal === 'peringatan'
            ? `${jumlahWarning} peringatan — sebaiknya diperiksa agar jadwal nyaman dipakai.`
            : `${jumlahError} konflik keras — harus diperbaiki sebelum jadwal dipakai.`
        }
        lebar="lg"
        onClose={() => setModal(null)}
        footer={
          <Btn variant="ghost" onClick={() => setModal(null)}>
            Tutup
          </Btn>
        }
      >
        {daftarModal.length === 0 ? (
          <EmptyState
            icon="cek"
            title={modal === 'peringatan' ? 'Tidak ada peringatan' : 'Tidak ada konflik keras'}
            desc="Tidak ada masalah dengan kategori ini. Kartu lain mungkin masih berisi rincian yang perlu diperiksa."
          />
        ) : (
          daftarModal.map((k) => (
            <div key={k.id} className={`conf-item ${k.tingkat}`}>
              <div className="conf-ic">
                <Icon name={IKON_TIPE[k.tipe]} size={16} />
              </div>
              <div>
                <h4>
                  {LABEL_TIPE[k.tipe]}{' '}
                  <span className={`badge ${k.tingkat === 'error' ? 'badge-merah' : 'badge-kuning'}`}>
                    {k.tingkat === 'error' ? 'Keras' : 'Peringatan'}
                  </span>
                </h4>
                <p>{k.pesan}</p>
              </div>
              {k.refJadwal.length > 0 ? (
                <div className="aksi-bar">
                  <Btn size="sm" variant="ghost" icon="kanan" onClick={() => lihatDiJadwal(k.refJadwal[0])}>
                    Lihat di Jadwal
                  </Btn>
                </div>
              ) : null}
            </div>
          ))
        )}
      </Modal>

      {/* --- Modal rincian jam pelajaran --- */}
      <Modal
        open={modal === 'jam'}
        title="Rincian Jam Pelajaran"
        desc="Total jam mengajar terjadwal per guru dan per mata pelajaran."
        lebar="lg"
        onClose={() => setModal(null)}
        footer={
          <Btn variant="ghost" onClick={() => setModal(null)}>
            Tutup
          </Btn>
        }
      >
        <div className="card-title">Per Guru</div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Guru</th>
                <th>Jam Terjadwal</th>
                <th>Batas Mingguan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rincianGuru.map(({ g, jam }) => (
                <tr key={g.id}>
                  <td>
                    <b>
                      <i className="warna-dot" style={{ background: g.warna }} />
                      {g.nama}
                    </b>
                  </td>
                  <td>{jam} jam</td>
                  <td>{g.maxJam} jam</td>
                  <td>
                    {jam > g.maxJam ? (
                      <span className="badge badge-merah">Melebihi batas</span>
                    ) : jam === 0 ? (
                      <span className="hint">Belum terjadwal</span>
                    ) : (
                      <span className="badge badge-hijau">Sesuai</span>
                    )}
                  </td>
                </tr>
              ))}
              {rincianGuru.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="empty" style={{ padding: 18 }}>
                      <p>Belum ada data guru.</p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="card-title" style={{ marginTop: 20 }}>
          Per Mata Pelajaran
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Mata Pelajaran</th>
                <th>Jam Terjadwal</th>
                <th>Kebutuhan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rincianMapel.map(({ m, jam, butuh }) => (
                <tr key={m.id}>
                  <td>
                    <b>{m.nama}</b> <span className="badge badge-abu">{m.kode || '—'}</span>
                  </td>
                  <td>{jam} jam</td>
                  <td>{butuh} jam</td>
                  <td>
                    {butuh === 0 ? (
                      <span className="hint">Tanpa kebutuhan</span>
                    ) : jam === 0 ? (
                      <span className="badge badge-merah">Belum terjadwal</span>
                    ) : jam < butuh ? (
                      <span className="badge badge-kuning">Kurang {butuh - jam} jam</span>
                    ) : (
                      <span className="badge badge-hijau">Terpenuhi</span>
                    )}
                  </td>
                </tr>
              ))}
              {rincianMapel.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="empty" style={{ padding: 18 }}>
                      <p>Belum ada data mata pelajaran.</p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Modal>
    </>
  );
}
