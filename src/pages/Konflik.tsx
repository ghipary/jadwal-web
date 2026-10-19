// Halaman pemeriksa konflik jadwal.

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConflictTipe } from '../types';
import { useProject } from '../store';
import { checkConflicts, isClean } from '../scheduler';
import { Banner, Btn, EmptyState, Icon, PageHead } from '../ui';

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
  data: 'info',
};

export function HalKonflik() {
  const { project } = useProject();
  const navigate = useNavigate();

  const konflik = useMemo(() => checkConflicts(project), [project]);
  const bersih = isClean(konflik);
  const jumlahError = konflik.filter((k) => k.tingkat === 'error').length;
  const jumlahWarning = konflik.filter((k) => k.tingkat === 'peringatan').length;

  return (
    <>
      <PageHead
        title="Pemeriksa Konflik"
        desc="Periksa ulang seluruh jadwal: bentrok kelas/guru/ruang, kebutuhan jam yang belum terpenuhi, batasan yang dilanggar, dan kapasitas ruang."
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
        <div className="stat">
          <div className={`stat-ic ${jumlahError ? 'i-bahaya' : 'i-sukses'}`}>
            <Icon name={jumlahError ? 'konflik' : 'cek'} size={19} />
          </div>
          <div>
            <div className="stat-val">{jumlahError}</div>
            <div className="stat-label">Konflik keras (harus diperbaiki)</div>
          </div>
        </div>
        <div className="stat">
          <div className={`stat-ic ${jumlahWarning ? 'i-oring' : 'i-sukses'}`}>
            <Icon name={jumlahWarning ? 'info' : 'cek'} size={19} />
          </div>
          <div>
            <div className="stat-val">{jumlahWarning}</div>
            <div className="stat-label">Peringatan (sebaiknya diperiksa)</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-ic i-brand">
            <Icon name="jadwal" size={19} />
          </div>
          <div>
            <div className="stat-val">{project.jadwal.length}</div>
            <div className="stat-label">Jam pelajaran terjadwal</div>
          </div>
        </div>
      </div>

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
                  <Btn
                    size="sm"
                    variant="ghost"
                    icon="kanan"
                    onClick={() =>
                      navigate('/jadwal', {
                        state: { lesId: k.refJadwal[0], scope: 'kelas' },
                      })
                    }
                  >
                    Lihat di Jadwal
                  </Btn>
                </div>
              ) : null}
            </div>
          ))}
        </>
      )}
    </>
  );
}
