// Halaman Identitas Sekolah: ubah nama sekolah, tahun ajaran, dan kepala
// sekolah. Nama dipakai di sidebar/topbar, kop matriks cetak, ekspor Excel,
// dan halaman Publikasi.

import { useEffect, useState } from 'react';
import type { SchoolInfo } from '../types';
import { useProject } from '../store';
import { Banner, Btn, FormField, PageHead } from '../ui';
import type { FieldDef } from '../ui';

/** Warna yang diambil langsung dari logo sekolah. */
const WARNA_LOGO: { hex: string; nama: string }[] = [
  { hex: '#138046', nama: 'Hijau utama' },
  { hex: '#FAC10F', nama: 'Emas' },
  { hex: '#E6212A', nama: 'Merah' },
  { hex: '#342C2A', nama: 'Tinta' },
  { hex: '#FEFEFE', nama: 'Putih' },
];

export function HalSekolah() {
  const { project, set } = useProject();
  const [form, setForm] = useState<SchoolInfo>(project.info);
  const [pesan, setPesan] = useState<'sukses' | 'kosong' | null>(null);

  // Sinkron saat data dimuat ulang / proyek diganti.
  useEffect(() => {
    setForm(project.info);
  }, [project.info]);

  const ubah = (key: keyof SchoolInfo, v: unknown) => {
    setForm((f) => ({ ...f, [key]: String(v) }));
    setPesan(null);
  };

  const simpan = () => {
    if (!form.nama.trim()) {
      setPesan('kosong');
      return;
    }
    set({
      info: {
        nama: form.nama.trim(),
        tahunAjaran: form.tahunAjaran.trim(),
        kepalaSekolah: form.kepalaSekolah.trim(),
      },
    });
    setPesan('sukses');
  };

  const fields: FieldDef<SchoolInfo>[] = [
    {
      key: 'nama',
      label: 'Nama Sekolah',
      type: 'text',
      placeholder: 'Contoh: SMA Nusantara',
      hint: 'Tampil di sidebar, kop cetak, ekspor Excel, dan halaman Publikasi.',
    },
    {
      key: 'tahunAjaran',
      label: 'Tahun Ajaran',
      type: 'text',
      placeholder: 'Contoh: 2026/2027',
      hint: 'Format bebas, mis. 2026/2027 atau 2026/2027 (Ganjil).',
    },
    {
      key: 'kepalaSekolah',
      label: 'Kepala Sekolah',
      type: 'text',
      placeholder: 'Contoh: Drs. H. Bambang Suryono, M.Pd.',
      hint: 'Dipakai pada kop lembar jadwal resmi.',
    },
  ];

  return (
    <>
      <PageHead
        title="Identitas Sekolah"
        desc="Data identitas ini menjadi kop pada cetak matriks, berkas Excel, dan halaman publikasi jadwal."
        actions={
          <Btn variant="primary" icon="cek" onClick={simpan}>
            Simpan Perubahan
          </Btn>
        }
      />

      {pesan === 'sukses' ? (
        <Banner tone="sukses" icon="cek">
          Identitas sekolah berhasil disimpan.
        </Banner>
      ) : null}
      {pesan === 'kosong' ? (
        <Banner tone="bahaya" icon="konflik">
          Nama sekolah wajib diisi sebelum disimpan.
        </Banner>
      ) : null}

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Data Sekolah</div>
          <div className="card-sub">Tersimpan otomatis di perangkat ini setelah disimpan.</div>
          <div className="form-grid">
            {fields.map((def) => (
              <div key={def.key} className="span2">
                <FormField
                  def={def}
                  value={form[def.key]}
                  onChange={(v) => ubah(def.key, v)}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title">Logo &amp; Tema</div>
          <div className="card-sub">
            Tema aplikasi mengikuti warna logo sekolah: hijau utama, aksen emas, dan merah untuk
            peringatan.
          </div>

          <div className="sekolah-logo">
            <img src="/logo-sekolah.png" alt="Logo sekolah" />
            <div>
              <b>{form.nama || 'Nama Sekolah'}</b>
              <div className="hint">Tahun Ajaran {form.tahunAjaran || '—'}</div>
              <a href="/logo.png" download>
                Unduh logo asli (PNG)
              </a>
            </div>
          </div>

          <div className="palet">
            {WARNA_LOGO.map((w) => (
              <span key={w.hex} title={w.nama}>
                <i style={{ background: w.hex }} />
                {w.hex}
              </span>
            ))}
          </div>

          <div className="kop-preview">
            <div className="mx-title">JADWAL PELAJARAN</div>
            <div className="mx-school">{form.nama || 'NAMA SEKOLAH'}</div>
            <div className="mx-ta" style={{ marginBottom: 0 }}>
              TAHUN AJARAN {form.tahunAjaran || '—'}
            </div>
          </div>
          <div className="hint kop-caption">
            Kop di atas tampil sama pada cetak matriks, ekspor Excel, dan Publikasi.
          </div>
        </div>
      </div>
    </>
  );
}
