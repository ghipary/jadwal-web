// Halaman Identitas Sekolah: ubah nama sekolah, tahun ajaran, kepala sekolah,
// alamat, dan logo. Seluruh data ini tersimpan di dalam Project milik pengguna
// yang sedang masuk (terikat ownerId/user_id), sehingga logo & identitas satu
// akun tidak pernah terlihat oleh akun lain.

import { useEffect, useRef, useState } from 'react';
import type { SchoolInfo } from '../types';
import { useProject } from '../store';
import { useAuth } from '../lib/auth';
import { Banner, Btn, FormField, KopSurat, PageHead } from '../ui';
import type { FieldDef } from '../ui';

/** Batas ukuran berkas logo (byte) agar penyimpanan tetap ringan. */
const BATAS_LOGO = 512 * 1024;

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
  const { user } = useAuth();
  const [form, setForm] = useState<SchoolInfo>(project.info);
  const [pesan, setPesan] = useState<'sukses' | 'kosong' | 'logo' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Sinkron saat data dimuat ulang / proyek diganti (termasuk saat ganti akun).
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
        alamat: form.alamat.trim(),
        logo: form.logo,
      },
    });
    setPesan('sukses');
  };

  const pilihLogo = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setPesan('logo');
      return;
    }
    if (f.size > BATAS_LOGO) {
      window.alert('Ukuran logo maksimal 512 KB. Silakan perkecil gambar terlebih dahulu.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((s) => ({ ...s, logo: String(reader.result ?? '') }));
      setPesan(null);
    };
    reader.readAsDataURL(f);
  };

  const hapusLogo = () => {
    setForm((s) => ({ ...s, logo: '' }));
    setPesan(null);
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
    {
      key: 'alamat',
      label: 'Alamat / Lokasi',
      type: 'text',
      placeholder: 'Contoh: Jl. Pendidikan No. 1, Nusantara',
      hint: 'Tampil di bawah nama sekolah pada kop surat cetak & ekspor.',
    },
  ];

  return (
    <>
      <PageHead
        title="Identitas Sekolah"
        desc="Data identitas ini menjadi kop pada cetak matriks, ekspor Excel, dan halaman publikasi jadwal. Tersimpan khusus untuk akun Anda."
        actions={
          <Btn variant="primary" icon="cek" onClick={simpan}>
            Simpan Perubahan
          </Btn>
        }
      />

      {pesan === 'sukses' ? (
        <Banner tone="sukses" icon="cek">
          Identitas sekolah berhasil disimpan untuk akun{' '}
          <b>{user?.nama || user?.email || 'Anda'}</b>.
        </Banner>
      ) : null}
      {pesan === 'kosong' ? (
        <Banner tone="bahaya" icon="konflik">
          Nama sekolah wajib diisi sebelum disimpan.
        </Banner>
      ) : null}
      {pesan === 'logo' ? (
        <Banner tone="bahaya" icon="konflik">
          Berkas logo harus berupa gambar (PNG, JPG, SVG, atau WebP).
        </Banner>
      ) : null}

      <Banner tone="info" icon="info">
        Identitas &amp; logo tersimpan khusus untuk akun yang sedang masuk
        {user ? ` (${user.nama || user.email})` : ''} — akun lain tidak akan melihat logo sekolah Anda.
      </Banner>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Data Sekolah</div>
          <div className="card-sub">
            Tersimpan otomatis khusus akun ini setelah ditekan Simpan.
          </div>
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
            Unggah logo sekolah Anda (maks. 512 KB). Logo ini muncul di kop cetak, pratinjau, dan
            sidebar.
          </div>

          <div className="sekolah-logo">
            <img src={form.logo || '/logo-sekolah.png'} alt="Logo sekolah" />
            <div>
              <b>{form.nama || 'Nama Sekolah'}</b>
              <div className="hint">Tahun Ajaran {form.tahunAjaran || '—'}</div>
              <div className="logo-aksi">
                <Btn size="sm" variant="soft" icon="unggah" onClick={() => fileRef.current?.click()}>
                  Unggah Logo
                </Btn>
                {form.logo ? (
                  <Btn size="sm" variant="ghost" icon="hapus" onClick={hapusLogo}>
                    Hapus Logo
                  </Btn>
                ) : null}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden-input"
                onChange={(e) => {
                  pilihLogo(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
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
            <KopSurat info={form} proyeksi judul="JADWAL PELAJARAN" />
          </div>
          <div className="hint kop-caption">
            Kop surat di atas tampil sama pada cetak matriks, grid jadwal, ekspor Excel, dan
            Publikasi.
          </div>
        </div>
      </div>
    </>
  );
}
