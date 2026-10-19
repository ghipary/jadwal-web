// Halaman Matriks: tabel matriks ala lembar cetak resmi sekolah
// (baris = hari × jam, kolom = kelas, isi = kode guru+mapel), meniru
// berkas acuan "Jadwal SMA.xlsx". Ekspor .xlsx dan .pdf memakai tata
// letak yang sama persis dengan pratinjau di bawah ini.

import { Fragment, useMemo, useState } from 'react';
import { useProject } from '../store';
import { buatMatriks, matriksKePdf, matriksKeXlsx } from '../matrix';
import { downloadPdf } from '../pdf';
import { downloadXlsx } from '../xlsx';
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
  const slug = namaSekolah.replace(/[^\w-]+/g, '_').toLowerCase() || 'sekolah';

  const eksporExcel = () => {
    try {
      setGalat('');
      downloadXlsx(`jadwal-matriks-${slug}.xlsx`, matriksKeXlsx(project, m));
    } catch {
      setGalat('Gagal membuat berkas Excel. Coba lagi atau gunakan tombol Unduh PDF.');
    }
  };

  const eksporPdf = () => {
    try {
      setGalat('');
      downloadPdf(`jadwal-matriks-${slug}.pdf`, matriksKePdf(project, m));
    } catch {
      setGalat('Gagal membuat berkas PDF. Coba lagi.');
    }
  };

  const nK = m.kelas.length;
  const legendaSisa = Math.max(0, m.legenda.length + 1 - m.baris.length);
  const legendaUntuk = (r: number) => (r >= 1 ? m.legenda[r - 1] : undefined);

  return (
    <>
      <PageHead
        title="Matriks Jadwal"
        desc="Isi sel = kode nomor guru + kode mapel (mis. 22PP). Ubah kode lewat menu Guru & Mata Pelajaran."
        actions={
          <>
            <Btn variant="ghost" icon="cetak" onClick={() => window.print()}>
              Cetak
            </Btn>
            <Btn variant="ghost" icon="unduh" onClick={eksporPdf}>
              Unduh PDF
            </Btn>
            <Btn variant="primary" icon="unduh" onClick={eksporExcel}>
              Unduh Excel
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
        Pratinjau di bawah sama persis dengan berkas hasil unduhan (<b>.xlsx</b> dan{' '}
        <b>.pdf</b>, A4 lanskap). Kode di tiap sel dirujuk ke tabel legenda di kanan.
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
                {m.legenda.length ? (
                  <>
                    <th className="lg-head" rowSpan={2}>
                      KODE
                    </th>
                    <th className="lg-head" rowSpan={2}>
                      NAMA
                    </th>
                    <th className="lg-head l-mapel" rowSpan={2}>
                      MATA PELAJARAN
                    </th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {m.blok.map((b) => (
                <Fragment key={b.hari}>
                  {m.baris.slice(b.mulai, b.mulai + b.jumlah).map((br, i) => {
                    const r = b.mulai + i;
                    const leg = legendaUntuk(r);
                    return (
                      <tr key={`${b.hari}-${br.periodeId}`}>
                        {i === 0 ? (
                          <td className="c-hari" rowSpan={b.jumlah}>
                            {b.nama}
                          </td>
                        ) : null}
                        <td className="c-jam">{br.jam}</td>
                        {br.istirahat ? (
                          <td colSpan={nK} className="c-ist">
                            {br.label}
                          </td>
                        ) : (
                          m.kelas.map((k) => {
                            const s = m.sel.get(`${br.hari}|${br.periodeId}|${k.id}`);
                            return (
                              <td key={k.id} className="c-kode">
                                {s?.kode ?? ''}
                              </td>
                            );
                          })
                        )}
                        {r >= 1 && m.legenda.length ? (
                          <>
                            <td className="lg-kode">{leg?.kode ?? ''}</td>
                            <td className="lg-nama">{leg?.guru ?? ''}</td>
                            <td className={`lg-mapel${leg ? ' isi' : ''}`}>{leg?.mapel ?? ''}</td>
                          </>
                        ) : null}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
              {Array.from({ length: legendaSisa }).map((_, i) => {
                const r = m.baris.length + i;
                const leg = m.legenda[r - 1];
                return (
                  <tr key={`leg-${i}`}>
                    <td colSpan={2 + nK} />
                    <td className="lg-kode">{leg?.kode ?? ''}</td>
                    <td className="lg-nama">{leg?.guru ?? ''}</td>
                    <td className="lg-mapel isi">{leg?.mapel ?? ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
