// Halaman generator jadwal otomatis + laporan hasil.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../store';
import { Laporan, generate } from '../scheduler';
import { Banner, Btn, Card, Icon, PageHead } from '../ui';

export function HalGenerate() {
  const { project, set } = useProject();
  const navigate = useNavigate();
  const [jalan, setJalan] = useState(false);
  const [prog, setProg] = useState({ i: 0, total: 1 });
  const [laporan, setLaporan] = useState<Laporan | null>(null);

  const opsi = project.opsi;
  const setOpsi = (patch: Partial<typeof opsi>) => set({ opsi: { ...opsi, ...patch } });

  const jumlahTetap = project.jadwal.filter((j) => j.tetap).length;
  const totalKebutuhan = project.kebutuhan.reduce((a, r) => a + r.jumlahJam, 0);

  const jalankan = async () => {
    setJalan(true);
    setLaporan(null);
    setProg({ i: 0, total: opsi.percobaan });
    await new Promise((r) => setTimeout(r, 30));
    const hasil = await generate(project, (i, total) => setProg({ i, total }));
    set({ jadwal: hasil.jadwal });
    setLaporan(hasil.laporan);
    setJalan(false);
  };

  const opsiRows: { key: 'rataHari' | 'hindariUjung' | 'wajibRuang'; title: string; desc: string }[] = [
    {
      key: 'rataHari',
      title: 'Sebar rata pada hari',
      desc: 'Menghindari mapel yang sama menumpuk di satu hari (diprioritaskan, bukan mutlak).',
    },
    {
      key: 'hindariUjung',
      title: 'Hindari jam pertama & terakhir',
      desc: 'Pelajaran guru tidak ditempatkan di jam ujung hari bila masih ada pilihan lain.',
    },
    {
      key: 'wajibRuang',
      title: 'Wajib ruang sesuai tipe & kapasitas',
      desc: 'Kelas hanya ditempatkan di ruang berkapasitas cukup dan bertipe sesuai mapel (lab, lapangan, dll).',
    },
  ];

  return (
    <>
      <PageHead
        title="Generator Jadwal Otomatis"
        desc="Susun jadwal seluruh kelas dari daftar kebutuhan jam, dengan penghormatan pada jadwal tetap, batasan jam guru, preferensi, dan ketersediaan ruang."
      />

      <div className="generate-hero">
        <div className="hero-ic">
          <Icon name="generate" size={26} />
        </div>
        <div>
          <h2>{jalan ? 'Menyusun jadwal…' : 'Siap menyusun jadwal?'}</h2>
          <p>
            {jalan
              ? `Percobaan ${prog.i} dari ${prog.total} — memilih kombinasi terbaik.`
              : `${totalKebutuhan} jam kebutuhan menunggu dijadwalkan. Jadwal yang ditandai “tetap” tidak akan diubah.`}
          </p>
          {jalan ? (
            <div className="progress" style={{ marginTop: 12, width: 320, maxWidth: '100%' }}>
              <div style={{ width: `${Math.round((prog.i / Math.max(1, prog.total)) * 100)}%` }} />
            </div>
          ) : null}
        </div>
        <div className="hero-action">
          <Btn
            variant="primary"
            icon="generate"
            size="md"
            disabled={jalan || totalKebutuhan === 0}
            onClick={jalankan}
          >
            {project.jadwal.length > 0 ? 'Generate Ulang Jadwal' : 'Generate Jadwal'}
          </Btn>
        </div>
      </div>

      {totalKebutuhan === 0 ? (
        <Banner tone="peringatan" icon="info">
          Belum ada kebutuhan jam. Isi dulu di halaman <b>Kebutuhan Jam</b>, baru generator bisa bekerja.
        </Banner>
      ) : null}

      <div className="grid-2">
        <Card>
          <div className="card-title">Opsi Generator</div>
          <div className="card-sub">Sifat lunak — generator berusaha memenuhi, bukan aturan mutlak.</div>
          <div className="opt-list">
            {opsiRows.map((o) => {
              const on = Boolean(opsi[o.key]);
              return (
                <label key={o.key} className={`opt-row ${on ? 'on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => setOpsi({ [o.key]: e.target.checked } as never)}
                  />
                  <span>
                    <span className="opt-title">{o.title}</span>
                    <br />
                    <span className="opt-desc">{o.desc}</span>
                  </span>
                </label>
              );
            })}
            <div className="field" style={{ marginTop: 10 }}>
              <label>Jumlah Percobaan</label>
              <input
                type="number"
                className="input"
                min={1}
                max={30}
                value={opsi.percobaan}
                onChange={(e) => setOpsi({ percobaan: Math.max(1, Math.min(30, Number(e.target.value) || 1)) })}
              />
              <span className="hint">
                Generator dijalankan berulang dengan acakan berbeda, hasil terbaik yang dipakai. 5–15 sudah ideal.
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <div className="card-title">Ringkasan</div>
          <div className="card-sub">Kondisi proyek sebelum generate.</div>
          <div className="kv">
            <span className="k">Kebutuhan jam total</span>
            <span className="v">{totalKebutuhan} jam/minggu</span>
          </div>
          <div className="kv">
            <span className="k">Jadwal tetap (dipertahankan)</span>
            <span className="v">{jumlahTetap} jam</span>
          </div>
          <div className="kv">
            <span className="k">Jadwal lama (non-tetap)</span>
            <span className="v">{project.jadwal.length - jumlahTetap} jam (akan diganti)</span>
          </div>
          <div className="kv">
            <span className="k">Slot tersedia per kelas</span>
            <span className="v">
              {project.periode.filter((p) => p.tipe === 'pelajaran').length} jam × 6 hari ={' '}
              {project.periode.filter((p) => p.tipe === 'pelajaran').length * 6} slot
            </span>
          </div>
          <div className="kv">
            <span className="k">Batasan slot terblokir</span>
            <span className="v">{project.blokir.length} slot</span>
          </div>
          <div className="kv">
            <span className="k">Konflik saat ini</span>
            <span className="v">
              {jumlahTetap > 0 || project.jadwal.length > 0 ? 'akan diperiksa ulang setelah generate' : 'belum ada jadwal'}
            </span>
          </div>
        </Card>
      </div>

      {laporan ? (
        <Card>
          <div className="card-title">Laporan Hasil</div>
          <div className="card-sub">
            {laporan.percobaan} percobaan · {laporan.durasiMs} ms · penalti {laporan.penalti}
          </div>

          {laporan.totalGagal === 0 ? (
            <Banner tone="sukses" icon="cek" action={
              <>
                <Btn size="sm" variant="ghost" icon="jadwal" onClick={() => navigate('/jadwal')}>
                  Buka Jadwal
                </Btn>
                <Btn size="sm" variant="ghost" icon="konflik" onClick={() => navigate('/konflik')}>
                  Cek Konflik
                </Btn>
              </>
            }>
              {laporan.pesan[0]}
            </Banner>
          ) : (
            <Banner tone="peringatan" icon="konflik" action={
              <>
                <Btn size="sm" variant="ghost" icon="jadwal" onClick={() => navigate('/jadwal')}>
                  Buka Jadwal
                </Btn>
                <Btn size="sm" variant="ghost" icon="konflik" onClick={() => navigate('/konflik')}>
                  Cek Konflik
                </Btn>
              </>
            }>
              {laporan.pesan[0]}
              <br />
              <span style={{ fontSize: 12.5, opacity: 0.85 }}>{laporan.pesan[1]}</span>
            </Banner>
          )}

          {laporan.gagal.length > 0 ? (
            <>
              <div className="card-title" style={{ marginTop: 12 }}>
                Jam yang gagal ditempatkan ({laporan.gagal.length})
              </div>
              <ul className="laporan-list">
                {laporan.gagal.slice(0, 30).map((g, i) => {
                  const kelas = project.kelas.find((c) => c.id === g.req.kelasId);
                  const mapel = project.mapel.find((m) => m.id === g.req.mapelId);
                  const guru = project.guru.find((x) => x.id === g.req.guruId);
                  return (
                    <li key={i}>
                      <div className="kiri">
                        <b>
                          {kelas?.nama ?? '?'} · {mapel?.nama ?? '?'} ({guru?.nama ?? '?'})
                        </b>
                        <span className="alasan">Alasan: {g.alasan}</span>
                      </div>
                      <span className="badge badge-merah">{g.req.jumlahJam} jam</span>
                    </li>
                  );
                })}
              </ul>
              {laporan.gagal.length > 30 ? (
                <p className="hint">…dan {laporan.gagal.length - 30} lainnya.</p>
              ) : null}
            </>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}
