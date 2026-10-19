// Halaman data generik: tabel + pencarian + tambah/ubah/hapus (CRUD).

import { ReactNode, useState } from 'react';
import { CollectionKey, HasId } from '../types';
import { useProject } from '../store';
import { Btn, EmptyState, FieldDef, FormField, Icon, Modal, PageHead } from '../ui';
import { uid } from '../utils';

export interface EntityConfig<T extends HasId> {
  collection: CollectionKey;
  judul: string;
  desc: string;
  ikon: string;
  kolom: { label: string; render: (row: T) => ReactNode }[];
  fields: FieldDef<T>[] | ((form: T) => FieldDef<T>[]);
  blank: () => T;
  judulForm: (row: T | null) => string;
  descForm?: string;
  labelHapus: (row: T) => string;
  placeholderCari?: string;
  aksiTambahan?: (row: T) => ReactNode;
  setelahSimpan?: (row: T) => void;
}

export function DataPage<T extends HasId>({
  cfg,
  atas,
}: {
  cfg: EntityConfig<T>;
  /** Konten tambahan di bawah judul halaman (mis. pengelola hari). */
  atas?: ReactNode;
}) {
  const { project, upsert, remove } = useProject();
  const [q, setQ] = useState('');
  const [form, setForm] = useState<T | null>(null);

  const rows = project[cfg.collection] as unknown as T[];
  const filtered = q.trim()
    ? rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q.trim().toLowerCase()))
    : rows;

  const openBaru = () => setForm(cfg.blank());
  const ubah = (row: T) => setForm({ ...row });
  const simpan = () => {
    if (!form) return;
    const defs = Array.isArray(cfg.fields) ? cfg.fields : cfg.fields(form);
    const out: Record<string, unknown> = { ...(form as unknown as Record<string, unknown>) };
    for (const f of defs) {
      if (f.numeric) {
        const v = out[f.key];
        if (typeof v === 'string') out[f.key] = v === '' ? 0 : Number(v);
      }
    }
    upsert(cfg.collection, out as unknown as T);
    cfg.setelahSimpan?.(form);
    setForm(null);
  };
  const hapus = (row: T) => {
    if (!window.confirm(`Hapus "${cfg.labelHapus(row)}"? Data yang merujuknya akan ditandai sebagai konflik.`))
      return;
    remove(cfg.collection, row.id);
  };

  const defs = form ? (Array.isArray(cfg.fields) ? cfg.fields : cfg.fields(form)) : [];

  return (
    <>
      <PageHead
        title={cfg.judul}
        desc={cfg.desc}
        actions={
          <>
            <div className="search-box">
              <Icon name="cari" size={15} />
              <input
                className="input"
                placeholder={cfg.placeholderCari ?? 'Cari…'}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Btn icon="tambah" onClick={openBaru}>
              Tambah
            </Btn>
          </>
        }
      />

      {atas}

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={cfg.ikon}
            title={`Belum ada data ${cfg.judul.toLowerCase()}`}
            desc="Tambahkan data pertama untuk mulai menyusun jadwal."
            action={
              <Btn icon="tambah" onClick={openBaru}>
                Tambah Data
              </Btn>
            }
          />
        </div>
      ) : (
        <div className="card">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  {cfg.kolom.map((k) => (
                    <th key={k.label}>{k.label}</th>
                  ))}
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    {cfg.kolom.map((k) => (
                      <td key={k.label}>{k.render(row)}</td>
                    ))}
                    <td className="aksi">
                      <div className="aksi-inline">
                        {cfg.aksiTambahan?.(row)}
                        <button
                          className="icon-btn"
                          title="Ubah"
                          onClick={() => ubah(row)}
                        >
                          <Icon name="ubah" size={15} />
                        </button>
                        <button
                          className="icon-btn"
                          title="Hapus"
                          onClick={() => hapus(row)}
                        >
                          <Icon name="hapus" size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={cfg.kolom.length + 1}>
                      <div className="empty" style={{ padding: '26px' }}>
                        <p>Tidak ada yang cocok dengan pencarian “{q}”.</p>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={form !== null}
        title={cfg.judulForm(form)}
        desc={cfg.descForm}
        onClose={() => setForm(null)}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setForm(null)}>
              Batal
            </Btn>
            <Btn icon="cek" onClick={simpan} disabled={!form}>
              Simpan
            </Btn>
          </>
        }
      >
        {form ? (
          <div className="form-grid">
            {defs.map((f) => (
              <div key={f.key} className={f.type === 'slots' || f.type === 'textarea' || f.type === 'multi' ? 'span2' : ''}>
                <FormField
                  def={f}
                  value={(form as unknown as Record<string, unknown>)[f.key]}
                  onChange={(v) => setForm({ ...form, [f.key]: v } as T)}
                />
              </div>
            ))}
          </div>
        ) : null}
      </Modal>
    </>
  );
}

export function idBaru(prefix: string): string {
  return uid(prefix);
}
