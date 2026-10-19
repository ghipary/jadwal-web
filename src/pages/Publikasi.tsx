// Halaman publikasi: buat tautan read-only untuk dibagikan ke siswa/guru/orang tua.

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Project } from '../types';
import { parseProyek, useProject } from '../store';
import { Banner, Btn, Card, EmptyState, PageHead, Tabs } from '../ui';
import { Scope, TimetableGrid } from '../timetable';
import { decodePayload, encodePayload } from '../utils';

function IsiPublikasi({ data }: { data: Project }) {
  const [scope, setScope] = useState<Scope>('kelas');
  const [refId, setRefId] = useState('');

  const daftar =
    scope === 'sekolah'
      ? []
      : scope === 'kelas'
        ? data.kelas.map((x) => ({ id: x.id, label: x.nama }))
        : scope === 'guru'
          ? data.guru.map((x) => ({ id: x.id, label: x.nama }))
          : data.ruang.map((x) => ({ id: x.id, label: x.nama }));

  useEffect(() => {
    if (scope === 'sekolah') return;
    if (daftar.length && !daftar.some((x) => x.id === refId)) setRefId(daftar[0].id);
  }, [daftar, refId, scope]);

  const items = data.jadwal.filter((j) => {
    if (scope === 'sekolah') return true;
    if (scope === 'kelas') return j.kelasId === refId;
    if (scope === 'guru') return j.guruId === refId;
    return j.ruangId === refId;
  });

  if (data.jadwal.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="jadwal"
          title="Belum ada jadwal untuk dipublikasikan"
          desc="Jalankan generator terlebih dahulu, lalu bagikan tautannya."
        />
      </Card>
    );
  }

  return (
    <>
      <div className="tt-toolbar">
        <Tabs
          items={[
            { id: 'sekolah', label: 'Per Sekolah', icon: 'sekolah' },
            { id: 'kelas', label: 'Per Kelas', icon: 'kelas' },
            { id: 'guru', label: 'Per Guru', icon: 'guru' },
            { id: 'ruang', label: 'Per Ruang', icon: 'ruang' },
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
          {scope === 'sekolah'
            ? `${data.kelas.length} kelas · ${items.length} jam pelajaran`
            : `${items.length} jam/minggu`}{' '}
          · tampilan baca-saja
        </span>
      </div>
      {scope === 'sekolah' ? (
        <div className="tt-stack">
          {data.kelas.map((k) => {
            const les = data.jadwal.filter((j) => j.kelasId === k.id);
            return (
              <TimetableGrid
                key={k.id}
                project={data}
                items={les}
                scope="kelas"
                judul={k.nama}
                subjudul={`${les.length} jam/minggu`}
              />
            );
          })}
        </div>
      ) : (
        <TimetableGrid project={data} items={items} scope={scope} />
      )}
      <div className="tt-legend">
        <span>Tersedia {data.hari.join(' · ')}</span>
      </div>
    </>
  );
}

export function HalPublikasi() {
  const { project } = useProject();
  const [tautan, setTautan] = useState('');
  const [tersalin, setTersalin] = useState(false);
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');

  const bagikan = async () => {
    setProses(true);
    setGalat('');
    try {
      // Tautan publik bersifat baca-saja dan bisa dibuka siapa pun yang memilikinya,
      // maka data pribadi yang tidak diperlukan untuk menampilkan jadwal
      // (daftar siswa & blokir guru) TIDAK ikut ditanam di dalamnya.
      const publik = { ...project, siswa: [], blokir: [] };
      const payload = await encodePayload(publik);
      const url = `${window.location.origin}${window.location.pathname}#/publikasi?d=${payload}`;
      setTautan(url);
      try {
        await navigator.clipboard.writeText(url);
        setTersalin(true);
      } catch {
        setTersalin(false);
      }
    } catch {
      setGalat('Gagal membuat tautan. Coba lagi atau gunakan Unduh JSON di halaman Berkas.');
    } finally {
      setProses(false);
    }
  };

  return (
    <>
      <PageHead
        title="Publikasi Jadwal"
        desc="Tampilan baca-saja untuk dibagikan. Tautan berisi salinan data jadwal (bukan akses edit), sehingga penerima bisa melihat jadwal dari perangkat mana pun tanpa login."
        actions={
          <Btn variant="primary" icon="bagikan" disabled={proses} onClick={bagikan}>
            {proses ? 'Menyusun tautan…' : 'Buat & Salin Tautan Publik'}
          </Btn>
        }
      />

      {galat ? (
        <Banner tone="bahaya" icon="konflik">
          {galat}
        </Banner>
      ) : null}

      {tautan ? (
        <Banner
          tone={tersalin ? 'sukses' : 'info'}
          icon={tersalin ? 'cek' : 'tautan'}
          action={
            <a href={tautan} target="_blank" rel="noreferrer">
              <Btn size="sm" variant="ghost" icon="kanan">
                Buka
              </Btn>
            </a>
          }
        >
          {tersalin
            ? 'Tautan publikasi sudah disalin ke papan klip! Tempelkan di chat/email.'
            : 'Tautan dibuat. Salin manual dari kotak di bawah (peramban menolak akses papan klip).'}
        </Banner>
      ) : null}

      {tautan ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Tautan Publikasi</div>
          <div className="card-sub">
            Panjangnya {tautan.length} karakter karena data jadwal ikut tertanam di dalamnya.
          </div>
          <input
            className="input"
            readOnly
            value={tautan}
            onFocus={(e) => e.currentTarget.select()}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        </div>
      ) : null}

      <IsiPublikasi data={project} />
    </>
  );
}

/** Halaman read-only ketika dibuka lewat tautan publikasi (?d=…). */
export function PublikasiReadonly() {
  const location = useLocation();
  const [data, setData] = useState<Project | null>(null);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    const d = new URLSearchParams(location.search).get('d');
    if (!d) {
      setGalat('Tautan ini tidak berisi data jadwal.');
      return;
    }
    let batal = false;
    decodePayload<unknown>(d)
      .then((raw) => {
        if (batal) return;
        const p = parseProyek(raw);
        if (!p) setGalat('Data pada tautan tidak valid.');
        else setData(p);
      })
      .catch(() => {
        if (!batal) setGalat('Gagal membaca data pada tautan ini.');
      });
    return () => {
      batal = true;
    };
  }, [location.search]);

  return (
    <div className="readonly-shell">
      <div className="readonly-top">
        <div className="brand-logo" style={{ width: 44, height: 44 }}>
          <span style={{ fontSize: 20 }}>🗓️</span>
        </div>
        <div>
          <h1>{data?.info.nama ?? 'Jadwal Pelajaran'}</h1>
          <p>
            {data ? (
              <>
                Tahun Ajaran {data.info.tahunAjaran} · Jadwal Pelajaran Resmi
              </>
            ) : (
              'Memuat data jadwal…'
            )}
          </p>
        </div>
      </div>
      <div className="readonly-body">
        {galat ? (
          <Banner tone="bahaya" icon="konflik">
            {galat}
          </Banner>
        ) : null}
        {data ? <IsiPublikasi data={data} /> : null}
        {!data && !galat ? (
          <Card>
            <EmptyState icon="jam" title="Memuat…" desc="Sedang mendekompresi data jadwal dari tautan." />
          </Card>
        ) : null}
      </div>
    </div>
  );
}
