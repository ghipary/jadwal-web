// State global aplikasi + penyimpanan localStorage + data contoh sekolah.

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import {
  Assignment,
  Block,
  CollectionKey,
  HasId,
  Period,
  Project,
  Requirement,
  SchoolClass,
  slotKey,
  Student,
  Subject,
  Teacher,
} from './types';
import { uid } from './utils';

const STORAGE_KEY = 'jadwalweb:v1';

// ---------------------------------------------------------------------------
// Data contoh
// ---------------------------------------------------------------------------

function demoProject(): Project {
  const periode: Period[] = [
    { id: 'p1', nama: 'Jam ke-1', mulai: '07:00', selesai: '07:40', istirahat: false },
    { id: 'p2', nama: 'Jam ke-2', mulai: '07:40', selesai: '08:20', istirahat: false },
    { id: 'p3', nama: 'Jam ke-3', mulai: '08:20', selesai: '09:00', istirahat: false },
    { id: 'i1', nama: 'Istirahat', mulai: '09:00', selesai: '09:20', istirahat: true },
    { id: 'p4', nama: 'Jam ke-4', mulai: '09:20', selesai: '10:00', istirahat: false },
    { id: 'p5', nama: 'Jam ke-5', mulai: '10:00', selesai: '10:40', istirahat: false },
    { id: 'i2', nama: 'Istirahat', mulai: '10:40', selesai: '11:00', istirahat: true },
    { id: 'p6', nama: 'Jam ke-6', mulai: '11:00', selesai: '11:40', istirahat: false },
    { id: 'p7', nama: 'Jam ke-7', mulai: '11:40', selesai: '12:20', istirahat: false },
    { id: 'p8', nama: 'Jam ke-8', mulai: '12:20', selesai: '13:00', istirahat: false },
  ];

  type SubjDef = [string, string, string, string, string, boolean];
  const subjDefs: SubjDef[] = [
    ['m_mtk', 'Matematika', 'MTK', '#4f46e5', 'reguler', false],
    ['m_in', 'Bahasa Indonesia', 'IND', '#0ea5e9', 'reguler', false],
    ['m_eng', 'Bahasa Inggris', 'ING', '#06b6d4', 'reguler', false],
    ['m_fis', 'Fisika', 'FIS', '#8b5cf6', 'lab-sains', false],
    ['m_kim', 'Kimia', 'KIM', '#a855f7', 'lab-sains', false],
    ['m_bio', 'Biologi', 'BIO', '#10b981', 'lab-sains', false],
    ['m_pkn', 'PPKn', 'PPK', '#f59e0b', 'reguler', false],
    ['m_sej', 'Sejarah', 'SEJ', '#f97316', 'reguler', false],
    ['m_geo', 'Geografi', 'GEO', '#ec4899', 'reguler', false],
    ['m_eko', 'Ekonomi', 'EKO', '#ef4444', 'reguler', false],
    ['m_inf', 'Informatika', 'INF', '#14b8a6', 'lab-komputer', false],
    ['m_jok', 'PJOK', 'JOK', '#84cc16', 'olahraga', false],
    ['m_sen', 'Seni Budaya', 'SEN', '#eab308', 'reguler', true],
    ['m_jaw', 'Bahasa Jawa', 'JAW', '#64748b', 'reguler', true],
  ];
  const mapel: Subject[] = subjDefs.map(([id, nama, kode, warna, tipeRuang, pilihan]) => ({
    id,
    nama,
    kode,
    warna,
    tipeRuang,
    pilihan,
  }));

  const pengajar: Record<string, string[]> = {
    m_mtk: ['g_rina', 'g_ahmad'],
    m_in: ['g_sari', 'g_budi'],
    m_eng: ['g_dewi'],
    m_fis: ['g_hendra'],
    m_kim: ['g_lestari'],
    m_bio: ['g_maya'],
    m_pkn: ['g_agus'],
    m_sej: ['g_toni'],
    m_geo: ['g_wulan'],
    m_eko: ['g_fitri'],
    m_inf: ['g_rizal'],
    m_jok: ['g_yoga'],
    m_sen: ['g_nia'],
    m_jaw: ['g_ratna'],
  };

  type GuruDef = [string, string, string, string[]];
  const guruDefs: GuruDef[] = [
    ['g_rina', 'Rina Susanti, S.Pd.', 'MTH', ['m_mtk']],
    ['g_ahmad', 'Ahmad Fauzi, S.Pd.', 'MTH', ['m_mtk']],
    ['g_sari', 'Sari Rahmawati, M.Pd.', 'IND', ['m_in']],
    ['g_budi', 'Budi Santoso, S.Pd.', 'IND', ['m_in']],
    ['g_dewi', 'Dewi Lestari, S.Pd.', 'ING', ['m_eng']],
    ['g_hendra', 'Hendra Gunawan, M.Si.', 'FIS', ['m_fis']],
    ['g_lestari', 'Lestari Wijaya, M.Si.', 'KIM', ['m_kim']],
    ['g_maya', 'Maya Kusuma, S.Pd.', 'BIO', ['m_bio']],
    ['g_agus', 'Agus Prasetyo, S.H.', 'PPK', ['m_pkn']],
    ['g_toni', 'Toni Saputra, S.Pd.', 'SEJ', ['m_sej']],
    ['g_wulan', 'Wulan Ramadhani, S.Pd.', 'GEO', ['m_geo']],
    ['g_fitri', 'Fitri Handayani, S.E.', 'EKO', ['m_eko']],
    ['g_rizal', 'Rizal Ramadhan, S.Kom.', 'INF', ['m_inf']],
    ['g_yoga', 'Yoga Permana, S.Pd.', 'JOK', ['m_jok']],
    ['g_nia', 'Nia Puspita, S.Sn.', 'SEN', ['m_sen']],
    ['g_ratna', 'Ratna Dewi, S.Pd.', 'JAW', ['m_jaw']],
  ];
  const guru: Teacher[] = guruDefs.map(([id, nama, kode, mapelIds]) => ({
    id,
    nama,
    kode,
    mapelIds,
    maxJam: 24,
    maxPerHari: 6,
    slotDiinginkan: [],
    slotDilarang: id === 'g_yoga' ? [slotKey(0, 'p8')] : [],
    catatan: '',
  }));

  type KelasDef = [string, string, string, string, number];
  const kelasDefs: KelasDef[] = [
    ['k_x1', 'X-1', 'X', 'g_rina', 36],
    ['k_x2', 'X-2', 'X', 'g_sari', 36],
    ['k_xi1', 'XI-1', 'XI', 'g_hendra', 36],
    ['k_xi2', 'XI-2', 'XI', 'g_maya', 36],
    ['k_xii1', 'XII-1', 'XII', 'g_agus', 36],
    ['k_xii2', 'XII-2', 'XII', 'g_toni', 36],
  ];
  const kelas: SchoolClass[] = kelasDefs.map(([id, nama, tingkat, waliKelasId, jumlahSiswa]) => ({
    id,
    nama,
    tingkat,
    waliKelasId,
    jumlahSiswa,
  }));

  const ruang = [
    { id: 'r_r1', nama: 'R-1', kapasitas: 40, tipe: 'reguler' },
    { id: 'r_r2', nama: 'R-2', kapasitas: 40, tipe: 'reguler' },
    { id: 'r_r3', nama: 'R-3', kapasitas: 40, tipe: 'reguler' },
    { id: 'r_r4', nama: 'R-4', kapasitas: 40, tipe: 'reguler' },
    { id: 'r_r5', nama: 'R-5', kapasitas: 40, tipe: 'reguler' },
    { id: 'r_lfis', nama: 'Lab Fisika', kapasitas: 40, tipe: 'lab-sains' },
    { id: 'r_lkim', nama: 'Lab Kimia', kapasitas: 40, tipe: 'lab-sains' },
    { id: 'r_lbio', nama: 'Lab Biologi', kapasitas: 40, tipe: 'lab-sains' },
    { id: 'r_lkom', nama: 'Lab Komputer', kapasitas: 40, tipe: 'lab-komputer' },
    { id: 'r_lap', nama: 'Lapangan Utama', kapasitas: 60, tipe: 'olahraga' },
  ];

  // Kurikulum: [kodeMapel, jam/minggu]
  const kurikulum: Record<string, [string, number][]> = {
    X: [
      ['m_mtk', 4], ['m_in', 4], ['m_eng', 3], ['m_pkn', 2], ['m_sej', 3], ['m_bio', 3],
      ['m_fis', 3], ['m_kim', 3], ['m_inf', 2], ['m_jok', 3], ['m_sen', 2], ['m_jaw', 2],
    ],
    XI: [
      ['m_mtk', 4], ['m_in', 4], ['m_eng', 3], ['m_pkn', 2], ['m_fis', 4], ['m_kim', 4],
      ['m_bio', 4], ['m_inf', 2], ['m_jok', 3], ['m_geo', 3], ['m_eko', 3],
    ],
    XII: [
      ['m_mtk', 4], ['m_in', 4], ['m_eng', 3], ['m_pkn', 2], ['m_fis', 4], ['m_kim', 4],
      ['m_bio', 4], ['m_sej', 3], ['m_inf', 2], ['m_jok', 3],
    ],
  };

  const kebutuhan: Requirement[] = [];
  kelas.forEach((c, ci) => {
    for (const [mapelId, jam] of kurikulum[c.tingkat]) {
      const daftarGuru = pengajar[mapelId] ?? [];
      const guruId = daftarGuru[ci % daftarGuru.length];
      kebutuhan.push({
        id: uid('k'),
        kelasId: c.id,
        mapelId,
        guruId,
        jumlahJam: jam,
        ruangId: '',
      });
    }
  });

  const depan = [
    'Aditya', 'Bella', 'Citra', 'Dimas', 'Elsa', 'Fajar', 'Galih', 'Hana',
    'Ilham', 'Jihan', 'Kevin', 'Laras', 'Muhammad', 'Nadia', 'Oskar', 'Putri',
    'Raka', 'Salsa', 'Taufik', 'Umara', 'Vino', 'Wahyu', 'Yuni', 'Zahra',
  ];
  const belakang = [
    'Pratama', 'Wijaya', 'Saputra', 'Ramadhan', 'Kusuma', 'Handayani',
    'Nugroho', 'Permata', 'Setiawan', 'Anggraini', 'Firmansyah', 'Maharani',
  ];
  const siswa: Student[] = [];
  kelas.forEach((c, ci) => {
    for (let i = 0; i < 8; i++) {
      const nama = `${depan[(ci * 5 + i) % depan.length]} ${belakang[(ci * 3 + i) % belakang.length]}`;
      const pilihan =
        c.tingkat === 'X'
          ? i % 3 === 0
            ? ['m_sen']
            : i % 3 === 1
              ? ['m_jaw']
              : ['m_sen', 'm_jaw']
          : [];
      siswa.push({ id: uid('s'), nama, kelasId: c.id, pilihan });
    }
  });

  const jadwal: Assignment[] = [];
  const blokir: Block[] = [];

  return {
    info: {
      nama: 'SMA Nusantara',
      tahunAjaran: '2026/2027',
      kepalaSekolah: 'Drs. H. Bambang Suryono, M.Pd.',
    },
    periode,
    guru,
    kelas,
    siswa,
    mapel,
    ruang,
    kebutuhan,
    jadwal,
    blokir,
    opsi: { percobaan: 8, rataHari: true, hindariUjung: true, wajibRuang: true },
  };
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type Action = { type: 'set'; patch: Partial<Project> } | { type: 'load'; project: Project };

function reducer(state: Project, action: Action): Project {
  switch (action.type) {
    case 'set':
      return { ...state, ...action.patch };
    case 'load':
      return action.project;
  }
}

function upsertArr<T extends HasId>(arr: T[], item: T): T[] {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i === -1) return [...arr, item];
  const copy = [...arr];
  copy[i] = item;
  return copy;
}

const ARRAYS: CollectionKey[] = [
  'periode', 'guru', 'kelas', 'siswa', 'mapel', 'ruang', 'kebutuhan', 'jadwal', 'blokir',
];

function sanitize(raw: unknown): Project | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const base = demoProject();
  for (const k of ARRAYS) {
    if (!Array.isArray(r[k])) return null;
  }
  if (!r.info || typeof r.info !== 'object') return null;
  return {
    ...(base as unknown as Record<string, unknown>),
    ...r,
    opsi: { ...base.opsi, ...(r.opsi as object) },
  } as unknown as Project;
}

interface Ctx {
  project: Project;
  set: (patch: Partial<Project>) => void;
  upsert: (key: CollectionKey, item: HasId) => void;
  remove: (key: CollectionKey, id: string) => void;
  loadProject: (p: Project) => void;
  resetDemo: () => void;
}

const ProjectCtx = createContext<Ctx | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, dispatch] = useReducer(reducer, undefined, () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = sanitize(JSON.parse(raw));
        if (p) return p;
      }
    } catch {
      // abaikan
    }
    return demoProject();
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch {
      // kuota penuh — abaikan
    }
  }, [project]);

  const set = useCallback(
    (patch: Partial<Project>) => dispatch({ type: 'set', patch }),
    [],
  );
  const upsert = useCallback(
    (key: CollectionKey, item: HasId) => {
      const arr = project[key] as HasId[];
      dispatch({ type: 'set', patch: { [key]: upsertArr(arr, item) } as Partial<Project> });
    },
    [project],
  );
  const remove = useCallback(
    (key: CollectionKey, id: string) => {
      const arr = project[key] as HasId[];
      dispatch({ type: 'set', patch: { [key]: arr.filter((x) => x.id !== id) } as Partial<Project> });
    },
    [project],
  );
  const loadProject = useCallback(
    (p: Project) => dispatch({ type: 'load', project: p }),
    [],
  );
  const resetDemo = useCallback(
    () => dispatch({ type: 'load', project: demoProject() }),
    [],
  );

  const value = useMemo(
    () => ({ project, set, upsert, remove, loadProject, resetDemo }),
    [project, set, upsert, remove, loadProject, resetDemo],
  );

  return <ProjectCtx.Provider value={value}>{children}</ProjectCtx.Provider>;
}

export function useProject(): Ctx {
  const ctx = useContext(ProjectCtx);
  if (!ctx) throw new Error('useProject harus dipakai di dalam ProjectProvider');
  return ctx;
}

export { demoProject };

/** Validasi & normalisasi objek proyek dari berkas/unduhan. */
export function parseProyek(raw: unknown): Project | null {
  return sanitize(raw);
}
