// Komponen UI bersama: ikon, tombol, modal, tabs, empty state, dan renderer form.

import { ReactNode, useEffect } from 'react';
import { labelTipeWaktu, SlotKey, slotKey } from './types';
import { useProject } from './store';

// ---------------------------------------------------------------------------
// Ikon (stroke SVG sederhana)
// ---------------------------------------------------------------------------

const ICONS: Record<string, ReactNode> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M10 21v-6h4v6" />
    </>
  ),
  guru: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3 2.4-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16 5.4a3.2 3.2 0 0 1 0 5.2" />
      <path d="M17.6 15.3c1.7.8 2.9 2.4 2.9 4.7" />
    </>
  ),
  kelas: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
    </>
  ),
  siswa: (
    <>
      <circle cx="12" cy="7.5" r="3.5" />
      <path d="M5 20.5c0-3.6 3.1-6 7-6s7 2.4 7 6" />
    </>
  ),
  mapel: (
    <>
      <path d="M4 4.5h5.5A2.5 2.5 0 0 1 12 7v13a2.4 2.4 0 0 0-2.4-2H4z" />
      <path d="M20 4.5h-5.5A2.5 2.5 0 0 0 12 7v13a2.4 2.4 0 0 1 2.4-2H20z" />
    </>
  ),
  ruang: (
    <>
      <path d="M4 21h16" />
      <path d="M6.5 21V4.5A1.5 1.5 0 0 1 8 3h8a1.5 1.5 0 0 1 1.5 1.5V21" />
      <circle cx="14.2" cy="12.5" r="1" />
    </>
  ),
  jam: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.2 1.9" />
    </>
  ),
  daftar: (
    <>
      <path d="M8.5 6h12M8.5 12h12M8.5 18h12" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </>
  ),
  generate: (
    <>
      <path d="M11 3.5 12.7 8l4.5 1.7-4.5 1.7L11 16l-1.7-4.6L4.8 9.7 9.3 8z" />
      <path d="M18 14.5 18.9 17l2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" />
    </>
  ),
  jadwal: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.2" />
      <path d="M3 9.5h18M8 3v4M16 3v4" />
      <path d="M7.5 13.5h4M13.5 13.5h3M7.5 17.5h4M13.5 17.5h3" />
    </>
  ),
  sekolah: (
    <>
      <path d="M12 3.5 3.5 8h17z" />
      <path d="M5.5 8v12h13V8" />
      <path d="M9.5 20v-5.5h5V20" />
      <path d="M8.5 11.5h2M13.5 11.5h2" />
    </>
  ),
  konflik: (
    <>
      <path d="M12 3.5 2.8 20h18.4z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.4h.01" />
    </>
  ),
  berkas: (
    <>
      <path d="M6.5 2.5h7L19 8v13.5H6.5z" />
      <path d="M13.5 2.5V8H19" />
      <path d="M9.5 12.5h6M9.5 16h6" />
    </>
  ),
  bagikan: (
    <>
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="17.5" cy="6" r="2.6" />
      <circle cx="17.5" cy="18" r="2.6" />
      <path d="m8.4 10.8 6.8-3.6M8.4 13.2l6.8 3.6" />
    </>
  ),
  blokir: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m6.2 6.2 11.6 11.6" />
    </>
  ),
  tambah: <path d="M12 5v14M5 12h14" />,
  salin: (
    <>
      <rect x="8" y="8" width="11.5" height="11.5" rx="2" />
      <path d="M5.5 15.5H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5h9A1.5 1.5 0 0 1 15.5 5v.5" />
    </>
  ),
  hari: (
    <>
      <rect x="3" y="5" width="18" height="15.5" rx="2.2" />
      <path d="M3 9.5h18M8 3v4M16 3v4" />
      <path d="M7.5 13.5h3M13.5 13.5h3M7.5 17.5h3M13.5 17.5h3" />
    </>
  ),
  hapus: (
    <>
      <path d="M4 7h16M9.5 7V4h5v3" />
      <path d="m6.5 7 1 13h9l1-13" />
      <path d="M10 11v5.5M14 11v5.5" />
    </>
  ),
  ubah: (
    <>
      <path d="M4 20h4L20.2 7.8a2.1 2.1 0 0 0-3-3L5 17z" />
      <path d="m14.5 6.5 3 3" />
    </>
  ),
  tutup: <path d="M6 6l12 12M18 6 6 18" />,
  cek: <path d="m5 12.5 4.5 4.5L19 7" />,
  unduh: (
    <>
      <path d="M12 3.5v11M7.5 10 12 14.5 16.5 10" />
      <path d="M4 19.5h16" />
    </>
  ),
  unggah: (
    <>
      <path d="M12 14.5v-11M7.5 7 12 2.5 16.5 7" />
      <path d="M4 19.5h16" />
    </>
  ),
  cetak: (
    <>
      <path d="M7 8.5V3.5h10v5" />
      <rect x="3.5" y="8.5" width="17" height="8" rx="2" />
      <path d="M7 14h10v6.5H7z" />
    </>
  ),
  tautan: (
    <>
      <path d="m9.5 14.5 5-5" />
      <path d="m11 6.8 1.8-1.8a3.6 3.6 0 0 1 5.1 5.1L16 12" />
      <path d="m13 17.2-1.8 1.8a3.6 3.6 0 0 1-5.1-5.1L8 12" />
    </>
  ),
  cari: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  putar: (
    <>
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20.5 4v5h-5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.2" />
      <path d="M12 7.8h.01" />
    </>
  ),
  seret: (
    <>
      <path d="M12 3v18M3 12h18" />
      <path d="m8 7 4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4" />
    </>
  ),
  masuk: (
    <>
      <path d="M14 3.5h4.5A1.5 1.5 0 0 1 20 5v14a1.5 1.5 0 0 1-1.5 1.5H14" />
      <path d="M10 8.5 13.5 12 10 15.5" />
      <path d="M13.5 12H4.5" />
    </>
  ),
  keluar: (
    <>
      <path d="M10 3.5H5.5A1.5 1.5 0 0 0 4 5v14a1.5 1.5 0 0 0 1.5 1.5H10" />
      <path d="M15.5 8.5 19 12l-3.5 3.5" />
      <path d="M19 12H9.5" />
    </>
  ),
  kanan: <path d="m9 5 7 7-7 7" />,
  bawah: <path d="m5 9 7 7 7-7" />,
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg
      className="ic"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name] ?? ICONS.info}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Elemen dasar
// ---------------------------------------------------------------------------

type BtnVariant = 'primary' | 'soft' | 'ghost' | 'danger' | 'dark';

export function Btn({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className = '',
  ...rest
}: {
  variant?: BtnVariant;
  size?: 'sm' | 'md';
  icon?: string;
  children?: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`btn btn-${variant} btn-${size} ${className}`}
      {...rest}
    >
      {icon ? <Icon name={icon} size={size === 'sm' ? 14 : 16} /> : null}
      {children}
    </button>
  );
}

export function PageHead({
  title,
  desc,
  actions,
}: {
  title: string;
  desc?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {desc ? <p>{desc}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function Card({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={`card ${className}`} style={style}>
    {children}
  </div>;
}

export function Tabs({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string; icon?: string; badge?: number }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          aria-selected={value === it.id}
          className={`tab ${value === it.id ? 'aktif' : ''}`}
          onClick={() => onChange(it.id)}
        >
          {it.icon ? <Icon name={it.icon} size={15} /> : null}
          {it.label}
          {typeof it.badge === 'number' && it.badge > 0 ? (
            <span className="tab-badge">{it.badge}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon: string;
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-ic">
        <Icon name={icon} size={26} />
      </div>
      <h3>{title}</h3>
      {desc ? <p>{desc}</p> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

export function Banner({
  tone = 'info',
  icon,
  children,
  action,
}: {
  tone?: 'info' | 'sukses' | 'bahaya' | 'peringatan';
  icon?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={`banner banner-${tone}`}>
      {icon ? <Icon name={icon} size={17} /> : null}
      <div className="banner-body">{children}</div>
      {action ? <div className="banner-action">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kop surat (letterhead) — logo kiri + identitas sekolah, garis tebal di bawah
// ---------------------------------------------------------------------------

/**
 * Kop surat resmi sekolah: logo di kiri, lalu nama sekolah (tebal/besar),
 * alamat, dan tahun ajaran di kanan; ditutup garis horizontal tebal.
 *
 * `proyeksi` = pratinjau di layar (selalu tampak). Tanpa `proyeksi`,
 * komponen hanya tampil saat mencetak (lihat `.kop-surat` di styles.css)
 * sehingga dapat dipasang di halaman biasanya tanpa mengganggu tampilan.
 */
export function KopSurat({
  info,
  proyeksi = false,
  judul,
  className = '',
}: {
  info: { nama: string; tahunAjaran: string; alamat: string; logo: string };
  proyeksi?: boolean;
  /** Judul dokumen opsional, mis. "JADWAL PELAJARAN". */
  judul?: string;
  className?: string;
}) {
  const logo = info.logo || '/logo-sekolah.png';
  return (
    <div
      className={`kop-surat ${proyeksi ? 'kop-surat-tampil' : ''} ${className}`}
      role="img"
      aria-label={`Kop surat ${info.nama || 'sekolah'}`}
    >
      <div className="kop-logo">
        <img src={logo} alt="Logo sekolah" />
      </div>
      <div className="kop-teks">
        <div className="kop-nama">{info.nama || 'NAMA SEKOLAH'}</div>
        {info.alamat ? <div className="kop-alamat">{info.alamat}</div> : null}
        {info.tahunAjaran ? (
          <div className="kop-ta">TAHUN AJARAN {info.tahunAjaran}</div>
        ) : null}
        {judul ? <div className="kop-judul">{judul}</div> : null}
      </div>
    </div>
  );
}

export function Modal({
  open,
  title,
  desc,
  onClose,
  children,
  footer,
  lebar = 'md',
}: {
  open: boolean;
  title: string;
  desc?: string;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  lebar?: 'sm' | 'md' | 'lg';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal modal-${lebar}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {desc ? <p>{desc}</p> : null}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Tutup">
            <Icon name="tutup" size={17} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

export interface Option {
  value: string;
  label: string;
}

export interface FieldDef<T> {
  key: keyof T & string;
  label: string;
  type:
    | 'text'
    | 'number'
    | 'textarea'
    | 'select'
    | 'multi'
    | 'color'
    | 'check'
    | 'slots'
    | 'pola'
    | 'hari';
  options?: Option[];
  placeholder?: string;
  hint?: string;
  min?: number;
  max?: number;
  /** Paksa nilai diubah ke number saat disimpan (mis. select yang bernilai numerik). */
  numeric?: boolean;
  /** Daftar nama hari untuk `type: 'hari'` (indeks array = nilai tersimpan). */
  hari?: string[];
}

export function FormField<T>({
  def,
  value,
  onChange,
}: {
  def: FieldDef<T>;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const id = `f_${def.key}`;
  let control: ReactNode;

  switch (def.type) {
    case 'textarea':
      control = (
        <textarea
          id={id}
          className="input"
          rows={3}
          placeholder={def.placeholder}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case 'select':
      control = (
        <select
          id={id}
          className="input"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        >
          {(def.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    case 'multi':
      control = (
        <div className="multi">
          {(def.options ?? []).map((o) => {
            const arr = Array.isArray(value) ? (value as string[]) : [];
            const on = arr.includes(o.value);
            return (
              <button
                type="button"
                key={o.value}
                className={`chip ${on ? 'chip-on' : ''}`}
                onClick={() => onChange(on ? arr.filter((x) => x !== o.value) : [...arr, o.value])}
              >
                {on ? <Icon name="cek" size={12} /> : null}
                {o.label}
              </button>
            );
          })}
        </div>
      );
      break;
    case 'color':
      control = (
        <div className="color-row">
          <input
            id={id}
            type="color"
            className="color-input"
            value={String(value ?? '#138046')}
            onChange={(e) => onChange(e.target.value)}
          />
          <input
            className="input"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
      break;
    case 'check':
      control = (
        <label className="check-row">
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{def.hint ?? def.label}</span>
        </label>
      );
      break;
    case 'slots':
      control = <SlotPicker value={Array.isArray(value) ? (value as SlotKey[]) : []} onChange={(v) => onChange(v)} />;
      break;
    case 'pola': {
      const arr = Array.isArray(value) ? (value as number[]) : [];
      control = (
        <div className="pola-row">
          <input
            id={id}
            className="input"
            placeholder={def.placeholder ?? 'Contoh: 2, 1'}
            value={arr.join(', ')}
            onChange={(e) => onChange(parsePolaJP(e.target.value))}
          />
          {arr.length ? (
            <div className="multi">
              {arr.map((n, i) => (
                <span key={`${i}-${n}`} className="chip chip-on">
                  {n} JP
                </span>
              ))}
              <span className="hint">= {arr.reduce((a, b) => a + b, 0)} JP</span>
            </div>
          ) : (
            <span className="hint">
              Kosong = tiap JP ditempatkan satu-satu (bukan blok berurutan).
            </span>
          )}
        </div>
      );
      break;
    }
    case 'hari': {
      const hari = def.hari ?? [];
      const arr = Array.isArray(value)
        ? (value as unknown[]).map((x) => Math.floor(Number(x))).filter((n) => Number.isInteger(n))
        : [];
      // Kosong = semua hari aktif (perilaku bawaan). Tombol pertama menandai
      // "semua hari" secara eksplisit agar pengguna mudah mengembalikannya.
      const semua = arr.length === 0;
      control = (
        <div className="hari-pilih">
          <div className="multi">
            <button
              type="button"
              className={`chip ${semua ? 'chip-on' : ''}`}
              title="Aktif di semua hari"
              onClick={() => onChange([])}
            >
              {semua ? <Icon name="cek" size={12} /> : null}
              Semua Hari
            </button>
            {hari.map((nama, i) => {
              const on = !semua && arr.includes(i);
              return (
                <button
                  type="button"
                  key={`${i}-${nama}`}
                  className={`chip ${on ? 'chip-on' : ''}`}
                  title={nama}
                  onClick={() => {
                    // Dari mode "semua" → mulai dari seluruh hari lalu lepas satu.
                    const dasar = semua ? hari.map((_, x) => x) : arr;
                    const next = on
                      ? dasar.filter((x) => x !== i)
                      : [...new Set([...dasar, i])].sort((a, b) => a - b);
                    // Bila hasilnya mencakup seluruh hari, simpan kosong (semua).
                    onChange(next.length === hari.length ? [] : next);
                  }}
                >
                  {on ? <Icon name="cek" size={12} /> : null}
                  {nama}
                </button>
              );
            })}
          </div>
        </div>
      );
      break;
    }
    case 'number':
      control = (
        <input
          id={id}
          type="number"
          className="input"
          min={def.min}
          max={def.max}
          value={value === undefined || value === null ? '' : Number(value)}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        />
      );
      break;
    default:
      control = (
        <input
          id={id}
          className="input"
          placeholder={def.placeholder}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }

  if (def.type === 'check') {
    return (
      <div className="field">
        {control}
        {def.hint && def.hint !== def.label ? <span className="hint">{def.hint}</span> : null}
      </div>
    );
  }

  return (
    <div className="field">
      <label htmlFor={id}>{def.label}</label>
      {control}
      {def.hint ? <span className="hint">{def.hint}</span> : null}
    </div>
  );
}

/**
 * Urai teks pola distribusi JP menjadi array angka.
 * Menerima "2, 1", "2;1", "2 1", atau angka tunggal. Nilai < 1 dibuang.
 */
export function parsePolaJP(teks: string): number[] {
  return teks
    .split(/[;,\s]+/)
    .map((x) => Math.floor(Number(x)))
    .filter((n) => Number.isFinite(n) && n >= 1);
}

/** Pemilih slot hari × jam (untuk preferensi/blokir). */
export function SlotPicker({
  value,
  onChange,
}: {
  value: SlotKey[];
  onChange: (v: SlotKey[]) => void;
}) {
  const { project } = useProject();
  const set = new Set(value);
  const toggle = (k: SlotKey) => {
    onChange(set.has(k) ? value.filter((x) => x !== k) : [...value, k]);
  };
  const periods = project.periode;
  return (
    <div className="slotpicker">
      <table>
        <thead>
          <tr>
            <th />
            {project.hari.map((d) => (
              <th key={d}>{d.slice(0, 3)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((per) => (
            <tr key={per.id} className={per.tipe !== 'pelajaran' ? `waktu-${per.tipe}` : ''}>
              <th>
                {per.nama}
                <span>
                  {per.tipe === 'pelajaran' ? ` · ${per.mulai}` : ` · ${labelTipeWaktu(per).toLowerCase()}`}
                </span>
              </th>
              {project.hari.map((_, h) => {
                const k = slotKey(h, per.id);
                const on = set.has(k);
                return (
                  <td key={k}>
                    <button
                      type="button"
                      title={`${project.hari[h]} ${per.nama}`}
                      className={`slotcell ${on ? 'on' : ''} ${per.tipe !== 'pelajaran' ? 'mati' : ''}`}
                      onClick={() => per.tipe === 'pelajaran' && toggle(k)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
