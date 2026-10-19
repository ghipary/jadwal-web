// Halaman Matriks: tabel matriks ala lembar cetak resmi sekolah
// (baris = hari × jam, kolom = kelas, isi = kode guru+mapel) + ekspor Excel
// .xlsx dengan format yang sama persis.

import { Fragment, useMemo, useState } from 'react';
import { useProject } from '../store';
import { buatMatriks, matriksKeXlsx } from '../matrix';
import { downloadXlsx } from '../xlsx';
import { hexA } from '../utils';
import { Banner, Btn, EmptyState, PageHead } from '../ui';

export function HalMatriks() {
  const { project } = useProject();
  const [galat, setGalat] = useState('');
  const m = useMemo(() => buatMatriks(project), [project]);

  if (!m.adaIsi) {
    return (
      <>
        <PageHead
          title="Matriks Jadwal"
          desc="Tabel matriks ala lembar cetak resmi: baris = hari × jam, kolom = kelas."
        />
        <div className="card">
          <EmptyState
            icon="jadwal"
            title="Belum ada jadwal"
            desc="Jalankan Generator Jadwal dulu, lalu kembali ke sini untuk mencetak atau mengekspor matriks."
          />
        </div>
      </>
    );
  }

  const namaSekolah = project.info.nama || 'SEKOLAH';
  const ta = project.info.tahunAjaran || '—';

  const ekspor = () => {
    try {
      setGalat('');
      const bytes = matriksKeXlsx(project, m);
      const slug = namaSekolah.replace(/[^\w-]+/g, '_').toLowerCase();
      downloadXlsx(`matriks-jadwal-${slug}.xlsx`, bytes);
    } catch {
      setGalat('Gagal membuat berkas Excel. Coba lagi atau gunakan Cetak → Simpan sebagai PDF.');
    }
  };

  return (
    <>
      <PageHead
        title="Matriks Jadwal"
        desc="Isi sel = kode nomor guru + kode mapel (mis. 22PP). Ubah kode lewat menu Guru & Mata Pelajaran."
        actions={
          <>
            <Btn variant="ghost" icon="cetak" onClick={() => window.print()}>
              Cetak / PDF
            </Btn>
            <Btn variant="primary" icon="unduh" onClick={ekspor}>
              Ekspor Excel
            </Btn>
          </>
        }
      />

      {galat ? (
        <Banner tone="bahaya" icon="konflik">
          {galat}
        </Banner>
      ) : null}

      <Banner tone="info" icon="info">
        Tampilan ini sama persis dengan lembar cetak: gunakan <b>Cetak / PDF</b> untuk hasil
        A4-landscape, atau <b>Ekspor Excel</b> untuk berkas .xlsx dengan legenda kode di kanan.
      </Banner>

      <div className="mx-doc">
        <div className="mx-title">JADWAL PELAJARAN</div>
        <div className="mx-school">{namaSekolah}</div>
        <div className="mx-ta">TAHUN AJARAN {ta}</div>

        <div className="mx-wrap">
          <table className="mx">
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
              {m.blok.map((b) => (
                <Fragment key={b.hari}>
                  {m.baris.slice(b.mulai, b.mulai + b.jumlah).map((br, i) => (
                    <tr key={`${b.hari}-${br.periodeId}`}>
                      {i === 0 ? (
                        <td className="c-hari" rowSpan={b.jumlah}>
                          {b.nama}
                        </td>
                      ) : null}
                      <td className="c-jam">{br.jam}</td>
                      {br.tipe !== 'pelajaran' ? (
                        <td colSpan={m.kelas.length} className={`c-ist c-ist-${br.tipe}`}>
                          {br.label}
                        </td>
                      ) : (
                        m.kelas.map((k) => {
                          const s = m.sel.get(`${br.hari}|${br.periodeId}|${k.id}`);
                          return (
                            <td
                              key={k.id}
                              className={s ? 'c-kode' : ''}
                              style={s ? { background: hexA(s.warna, 0.35) } : undefined}
                            >
                              {s?.kode ?? ''}
                            </td>
                          );
                        })
                      )}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>

          <table className="mx-legend">
            <thead>
              <tr>
                <th>KODE</th>
                <th>NAMA</th>
                <th>MATA PELAJARAN</th>
              </tr>
            </thead>
            <tbody>
              {m.legenda.map((e) => (
                <tr key={e.kode}>
                  <td className="c-kode" style={{ background: hexA(e.warna, 0.35) }}>
                    {e.kode}
                  </td>
                  <td>{e.guru}</td>
                  <td>{e.mapel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
