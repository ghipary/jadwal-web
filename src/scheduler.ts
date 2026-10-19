// Mesin pembuat jadwal otomatis (constraint solver) + pengecek konflik.
//
// Pendekatan: pencarian lokal dengan heuristik MRV (Minimum Remaining Values),
// skor penalti untuk batasan lunak (sebaran hari, beban guru, preferensi,
// ruang, jam ujung hari), dan beberapa kali percobaan acak untuk hasil terbaik.

import {
  Assignment,
  Conflict,
  DAYS,
  labelTipeWaktu,
  Period,
  Project,
  Requirement,
  SchoolClass,
  SlotKey,
  Subject,
  slotKey,
} from './types';
import { uid } from './utils';

export interface GagalItem {
  req: Requirement;
  alasan: string;
}

export interface Laporan {
  totalKebutuhan: number;
  ditempatkan: number;
  totalGagal: number;
  gagal: GagalItem[];
  penalti: number;
  percobaan: number;
  durasiMs: number;
  pesan: string[];
}

export interface HasilGenerate {
  jadwal: Assignment[];
  laporan: Laporan;
}

export function periodeAktif(p: Project): Period[] {
  // Hanya baris bertipe "pelajaran" yang boleh dipakai menampung pelajaran;
  // istirahat/apel/kustom tetap ditampilkan di grid tetapi kosong dari jadwal.
  return p.periode.filter((x) => x.tipe === 'pelajaran');
}

export function slotLabel(p: Project, hari: number, periodeId: string): string {
  const per = p.periode.find((x) => x.id === periodeId);
  return `${DAYS[hari] ?? '?'}${per ? ` · ${per.nama} (${per.mulai}–${per.selesai})` : ''}`;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

interface Item {
  req: Requirement;
}

interface Cand {
  hari: number;
  periodeId: string;
  ruangId: string;
  penalti: number;
}

type Okupansi = Map<string, Set<SlotKey>>;

function occGet(m: Okupansi, k: string): Set<SlotKey> {
  let s = m.get(k);
  if (!s) {
    s = new Set();
    m.set(k, s);
  }
  return s;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

export async function generate(
  p: Project,
  onProgress?: (i: number, total: number) => void,
): Promise<HasilGenerate> {
  const t0 = performance.now();
  const opsi = p.opsi;
  const guruM = new Map(p.guru.map((g) => [g.id, g]));
  const kelasM = new Map(p.kelas.map((c) => [c.id, c]));
  const mapelM = new Map(p.mapel.map((m) => [m.id, m]));
  const ruangM = new Map(p.ruang.map((r) => [r.id, r]));
  const assignable = periodeAktif(p);
  const perIndex = new Map(assignable.map((x, i) => [x.id, i]));
  const firstId = assignable[0]?.id;
  const lastId = assignable[assignable.length - 1]?.id;

  const blokir = new Set<string>();
  for (const b of p.blokir) blokir.add(`${b.jenis}|${b.refId}|${slotKey(b.hari, b.periodeId)}`);
  const isBlocked = (jenis: string, refId: string, sk: SlotKey) =>
    blokir.has(`${jenis}|${refId}|${sk}`);

  const tetap = p.jadwal.filter((j) => j.tetap);
  const totalKebutuhan = p.kebutuhan.reduce((a, r) => a + r.jumlahJam, 0);

  let best: HasilGenerate | null = null;
  let bestSkor = Infinity;
  const total = Math.max(1, opsi.percobaan);

  for (let attempt = 1; attempt <= opsi.percobaan; attempt++) {
    onProgress?.(attempt, total);
    await tick();

    const occ: Okupansi = new Map();
    const teacherWeek = new Map<string, number>();
    const teacherDay = new Map<string, number>(); // `${guruId}|${hari}`
    const classSubjDay = new Map<string, number>(); // `${kelasId}|${mapelId}|${hari}`
    const classDay = new Map<string, number>(); // `${kelasId}|${hari}`
    const placed: Assignment[] = [];

    const markOcc = (j: Assignment) => {
      const sk = slotKey(j.hari, j.periodeId);
      occGet(occ, `k|${j.kelasId}`).add(sk);
      occGet(occ, `g|${j.guruId}`).add(sk);
      if (j.ruangId) occGet(occ, `r|${j.ruangId}`).add(sk);
    };
    const bumpLoad = (j: Assignment) => {
      const wk = teacherWeek.get(j.guruId) ?? 0;
      teacherWeek.set(j.guruId, wk + 1);
      const dk = `${j.guruId}|${j.hari}`;
      teacherDay.set(dk, (teacherDay.get(dk) ?? 0) + 1);
      const sk2 = `${j.kelasId}|${j.mapelId}|${j.hari}`;
      classSubjDay.set(sk2, (classSubjDay.get(sk2) ?? 0) + 1);
      const ck = `${j.kelasId}|${j.hari}`;
      classDay.set(ck, (classDay.get(ck) ?? 0) + 1);
    };
    for (const j of tetap) {
      markOcc(j);
      bumpLoad(j);
    }

    // Perluas kebutuhan jam menjadi item (sisa jam setelah jadwal tetap).
    const items: Item[] = [];
    for (const req of p.kebutuhan) {
      const sudahTetap = tetap.filter(
        (j) =>
          j.kelasId === req.kelasId && j.mapelId === req.mapelId && j.guruId === req.guruId,
      ).length;
      const sisa = Math.max(0, req.jumlahJam - sudahTetap);
      for (let i = 0; i < sisa; i++) items.push({ req });
    }

    const pickRoom = (req: Requirement, mapel: Subject, kelas: SchoolClass, sk: SlotKey) => {
      if (req.ruangId) {
        const r = ruangM.get(req.ruangId);
        if (!r) return undefined;
        return occGet(occ, `r|${r.id}`).has(sk) ? undefined : r;
      }
      const tipe = mapel.tipeRuang;
      const cand = p.ruang.filter(
        (r) =>
          (tipe === 'semua' || r.tipe === tipe) &&
          !occGet(occ, `r|${r.id}`).has(sk) &&
          (!opsi.wajibRuang || r.kapasitas >= kelas.jumlahSiswa),
      );
      if (!cand.length) return undefined;
      cand.sort((a, b) => b.kapasitas - a.kapasitas);
      return Math.random() < 0.7 ? cand[0] : cand[Math.floor(Math.random() * cand.length)];
    };

    const evalItem = (item: Item): Cand[] => {
      const req = item.req;
      const g = guruM.get(req.guruId);
      const kelas = kelasM.get(req.kelasId);
      const mapel = mapelM.get(req.mapelId);
      if (!g || !kelas || !mapel) return [];
      if ((teacherWeek.get(g.id) ?? 0) >= g.maxJam) return [];
      const res: Cand[] = [];
      const dilarangGuru = new Set(g.slotDilarang);
      const diinginkanGuru = new Set(g.slotDiinginkan);
      for (let hari = 0; hari < DAYS.length; hari++) {
        const dayLoad = teacherDay.get(`${g.id}|${hari}`) ?? 0;
        if (dayLoad >= g.maxPerHari) continue;
        for (const per of assignable) {
          const sk = slotKey(hari, per.id);
          if (occGet(occ, `k|${kelas.id}`).has(sk)) continue;
          if (occGet(occ, `g|${g.id}`).has(sk)) continue;
          if (isBlocked('kelas', kelas.id, sk) || isBlocked('guru', g.id, sk)) continue;
          if (dilarangGuru.has(sk)) continue;
          const room = pickRoom(req, mapel, kelas, sk);
          if (!room) continue;

          let pen = 0;
          const subjDay = classSubjDay.get(`${kelas.id}|${mapel.id}|${hari}`) ?? 0;
          if (subjDay > 0) pen += (opsi.rataHari ? 26 : 9) * subjDay;
          pen += 3 * dayLoad;
          pen += 2 * (classDay.get(`${kelas.id}|${hari}`) ?? 0);
          if (diinginkanGuru.has(sk)) pen -= 18;
          // Dorong pelajaran guru menjadi blok berurutan (kurangi jeda).
          if (dayLoad > 0) {
            const idx = perIndex.get(per.id) ?? -1;
            const prev = idx > 0 ? assignable[idx - 1] : undefined;
            const next =
              idx >= 0 && idx < assignable.length - 1 ? assignable[idx + 1] : undefined;
            const adjacent =
              (prev && !occGet(occ, `g|${g.id}`).has(slotKey(hari, prev.id))) ||
              (next && !occGet(occ, `g|${g.id}`).has(slotKey(hari, next.id)));
            if (!adjacent) pen += 6;
          }
          if (opsi.hindariUjung && (per.id === firstId || per.id === lastId)) pen += 7;
          res.push({ hari, periodeId: per.id, ruangId: room.id, penalti: pen });
        }
      }
      return res;
    };

    const diag = (item: Item): string => {
      const req = item.req;
      const g = guruM.get(req.guruId);
      const kelas = kelasM.get(req.kelasId);
      const mapel = mapelM.get(req.mapelId);
      if (!g || !kelas || !mapel) return 'data kebutuhan tidak lengkap (guru/mapel/kelas terhapus)';
      if ((teacherWeek.get(g.id) ?? 0) >= g.maxJam)
        return `guru melebihi maksimum ${g.maxJam} jam/minggu`;
      const counts: Record<string, number> = {};
      const bump = (s: string) => (counts[s] = (counts[s] ?? 0) + 1);
      for (let hari = 0; hari < DAYS.length; hari++) {
        const dayLoad = teacherDay.get(`${g.id}|${hari}`) ?? 0;
        if (dayLoad >= g.maxPerHari) {
          bump('guru melebihi batas jam per hari');
          continue;
        }
        for (const per of assignable) {
          const sk = slotKey(hari, per.id);
          if (occGet(occ, `k|${kelas.id}`).has(sk)) bump('kelas sudah terisi');
          else if (occGet(occ, `g|${g.id}`).has(sk)) bump('guru bentrok');
          else if (isBlocked('kelas', kelas.id, sk) || isBlocked('guru', g.id, sk))
            bump('diblokir lewat halaman Batasan');
          else if (g.slotDilarang.includes(sk)) bump('di luar preferensi guru');
          else if (!pickRoom(req, mapel, kelas, sk)) bump('ruang tidak tersedia');
        }
      }
      const top = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([k, v]) => `${k} (${v} slot)`);
      return top.length ? top.join(', ') : 'tidak ada slot tersisa';
    };

    const gagal: GagalItem[] = [];
    let penaltiTotal = 0;

    // Urutkan item: yang paling sulit dulu — guru dengan sisa jam paling sempit,
    // mapel dengan ruang paling terbatas, kelas dengan tuntutan terbanyak.
    // Rantai pengacak antar percobaan membuat tiap percobaan berbeda.
    const butuhGuru = new Map<string, number>();
    for (const it of items) butuhGuru.set(it.req.guruId, (butuhGuru.get(it.req.guruId) ?? 0) + 1);
    const butuhKelas = new Map<string, number>();
    for (const it of items) butuhKelas.set(it.req.kelasId, (butuhKelas.get(it.req.kelasId) ?? 0) + 1);
    const jumlahRuangTipe = new Map<string, number>();
    for (const r of p.ruang) jumlahRuangTipe.set(r.tipe, (jumlahRuangTipe.get(r.tipe) ?? 0) + 1);

    const urut = [...items].sort((a, b) => {
      const ga = guruM.get(a.req.guruId);
      const gb = guruM.get(b.req.guruId);
      const slackA = (ga?.maxJam ?? 24) - (butuhGuru.get(a.req.guruId) ?? 0);
      const slackB = (gb?.maxJam ?? 24) - (butuhGuru.get(b.req.guruId) ?? 0);
      if (slackA !== slackB) return slackA - slackB;
      const ma = mapelM.get(a.req.mapelId);
      const mb = mapelM.get(b.req.mapelId);
      const ruangA = jumlahRuangTipe.get(ma?.tipeRuang ?? 'reguler') ?? 99;
      const ruangB = jumlahRuangTipe.get(mb?.tipeRuang ?? 'reguler') ?? 99;
      if (ruangA !== ruangB) return ruangA - ruangB;
      const kelasA = butuhKelas.get(a.req.kelasId) ?? 0;
      const kelasB = butuhKelas.get(b.req.kelasId) ?? 0;
      if (kelasA !== kelasB) return kelasB - kelasA;
      return Math.random() - 0.5;
    });

    for (const item of urut) {
      const cands = evalItem(item);
      if (!cands.length) {
        gagal.push({ req: item.req, alasan: diag(item) });
        continue;
      }
      cands.sort((a, b) => a.penalti - b.penalti);
      const top = cands.slice(0, Math.min(4, cands.length));
      const minPen = top[0].penalti;
      const bobot = top.map((c) => Math.exp(-(c.penalti - minPen) / 10) * (0.6 + Math.random() * 0.8));
      const sum = bobot.reduce((a, b) => a + b, 0);
      let r = Math.random() * sum;
      let chosen = top[0];
      for (let i = 0; i < top.length; i++) {
        r -= bobot[i];
        if (r <= 0) {
          chosen = top[i];
          break;
        }
      }

      const j: Assignment = {
        id: uid('j'),
        reqId: item.req.id,
        kelasId: item.req.kelasId,
        mapelId: item.req.mapelId,
        guruId: item.req.guruId,
        ruangId: chosen.ruangId,
        hari: chosen.hari,
        periodeId: chosen.periodeId,
        tetap: false,
        catatan: '',
      };
      markOcc(j);
      bumpLoad(j);
      placed.push(j);
      penaltiTotal += chosen.penalti;
    }

    const jadwal = [...tetap, ...placed];
    const skor = gagal.length * 1000 + Math.max(0, penaltiTotal);
    if (skor < bestSkor) {
      bestSkor = skor;
      best = { jadwal, laporan: null as unknown as Laporan };
      best.laporan = {
        totalKebutuhan,
        ditempatkan: tetap.length + placed.length,
        totalGagal: gagal.length,
        gagal,
        penalti: Math.round(Math.max(0, penaltiTotal)),
        percobaan: attempt,
        durasiMs: 0,
        pesan: [],
      };
    }
    if (!gagal.length && penaltiTotal <= 0) break; // sudah sempurna
  }

  const durasiMs = Math.round(performance.now() - t0);
  const hasil = best ?? { jadwal: [...tetap], laporan: {} as Laporan };
  const l = hasil.laporan;
  l.durasiMs = durasiMs;
  l.percobaan = Math.min(opsi.percobaan, l.percobaan);
  l.pesan = [];
  if (l.totalGagal === 0) {
    l.pesan.push(`Semua ${l.totalKebutuhan} jam pelajaran berhasil dijadwalkan.`);
  } else {
    l.pesan.push(
      `${l.ditempatkan} dari ${l.totalKebutuhan} jam pelajaran berhasil dijadwalkan, ${l.totalGagal} gagal.`,
    );
    l.pesan.push('Coba tambah jumlah percobaan, kurangi jam, atau periksa batasan pada halaman Batasan.');
  }
  l.pesan.push(`Selesai dalam ${durasiMs} ms setelah ${l.percobaan} percobaan.`);
  return { jadwal: hasil.jadwal, laporan: l };
}

// ---------------------------------------------------------------------------
// Pengecek konflik
// ---------------------------------------------------------------------------

export function checkConflicts(p: Project): Conflict[] {
  const out: Conflict[] = [];
  const guruM = new Map(p.guru.map((g) => [g.id, g]));
  const kelasM = new Map(p.kelas.map((c) => [c.id, c]));
  const mapelM = new Map(p.mapel.map((m) => [m.id, m]));
  const ruangM = new Map(p.ruang.map((r) => [r.id, r]));
  const perM = new Map(p.periode.map((x) => [x.id, x]));
  const namaMapel = (id: string) => mapelM.get(id)?.nama ?? '(mapel terhapus)';

  // 1. Bentrok kelas / guru / ruang pada slot yang sama.
  const groups: { tipe: Conflict['tipe']; label: string; map: Map<string, Assignment[]> }[] = [
    { tipe: 'kelas-bentrok', label: 'Kelas', map: new Map() },
    { tipe: 'guru-bentrok', label: 'Guru', map: new Map() },
    { tipe: 'ruang-bentrok', label: 'Ruang', map: new Map() },
  ];
  for (const j of p.jadwal) {
    const sk = slotKey(j.hari, j.periodeId);
    const push = (m: Map<string, Assignment[]>, key: string) => {
      const arr = m.get(key);
      if (arr) arr.push(j);
      else m.set(key, [j]);
    };
    push(groups[0].map, `${j.kelasId}|${sk}`);
    push(groups[1].map, `${j.guruId}|${sk}`);
    if (j.ruangId) push(groups[2].map, `${j.ruangId}|${sk}`);
  }
  for (const g of groups) {
    for (const [key, arr] of g.map) {
      if (arr.length < 2) continue;
      const ref = key.slice(0, key.indexOf('|'));
      const first = arr[0];
      let subjek = '';
      if (g.tipe === 'kelas-bentrok') subjek = kelasM.get(ref)?.nama ?? '(kelas terhapus)';
      else if (g.tipe === 'guru-bentrok') subjek = guruM.get(ref)?.nama ?? '(guru terhapus)';
      else subjek = ruangM.get(ref)?.nama ?? '(ruang terhapus)';
      out.push({
        id: `${g.tipe}|${key}`,
        tipe: g.tipe,
        tingkat: 'error',
        pesan: `${g.label} ${subjek} — ${slotLabel(p, first.hari, first.periodeId)}: ${arr.length} pelajaran di waktu yang sama (${arr.map((a) => namaMapel(a.mapelId)).join(' + ')})`,
        refJadwal: arr.map((a) => a.id),
      });
    }
  }

  // 2. Jadwal pada baris di luar jam pelajaran (istirahat/apel/kustom) / data tidak valid.
  for (const j of p.jadwal) {
    const per = perM.get(j.periodeId);
    if (!per || per.tipe !== 'pelajaran') {
      out.push({
        id: `istirahat|${j.id}`,
        tipe: 'istirahat',
        tingkat: 'error',
        pesan: `${namaMapel(j.mapelId)} (${kelasM.get(j.kelasId)?.nama ?? '?'}) dijadwalkan di ${slotLabel(p, j.hari, j.periodeId)} — bertipe ${per ? labelTipeWaktu(per).toLowerCase() : 'di luar jam pelajaran'}, bukan jam pelajaran.`,
        refJadwal: [j.id],
      });
    }
    if (!guruM.has(j.guruId) || !mapelM.has(j.mapelId) || !kelasM.has(j.kelasId)) {
      out.push({
        id: `data|${j.id}`,
        tipe: 'data',
        tingkat: 'error',
        pesan: `Pelajaran ${namaMapel(j.mapelId)} merujuk data guru/kelas/mapel yang sudah dihapus.`,
        refJadwal: [j.id],
      });
    }
    // 3. Batasan blokir.
    for (const b of p.blokir) {
      if (b.hari !== j.hari || b.periodeId !== j.periodeId) continue;
      const cocok =
        (b.jenis === 'kelas' && b.refId === j.kelasId) ||
        (b.jenis === 'guru' && b.refId === j.guruId) ||
        (b.jenis === 'ruang' && b.refId === j.ruangId);
      if (cocok) {
        const subjek =
          b.jenis === 'kelas'
            ? kelasM.get(b.refId)?.nama
            : b.jenis === 'guru'
              ? guruM.get(b.refId)?.nama
              : ruangM.get(b.refId)?.nama;
        out.push({
          id: `blokir|${j.id}|${b.id}`,
          tipe: 'blokir',
          tingkat: 'error',
          pesan: `${namaMapel(j.mapelId)} menempati slot ${b.jenis} ${subjek} yang diblokir${b.alasan ? ` (${b.alasan})` : ''} — ${slotLabel(p, j.hari, j.periodeId)}.`,
          refJadwal: [j.id],
        });
      }
    }
    // 4. Kapasitas ruang.
    const kelas = kelasM.get(j.kelasId);
    const ruang = ruangM.get(j.ruangId);
    if (kelas && ruang && ruang.kapasitas < kelas.jumlahSiswa) {
      out.push({
        id: `kapasitas|${j.id}`,
        tipe: 'kapasitas',
        tingkat: 'peringatan',
        pesan: `${kelas.nama} (${kelas.jumlahSiswa} siswa) berada di ${ruang.nama} (kapasitas ${ruang.kapasitas}) — ${slotLabel(p, j.hari, j.periodeId)}.`,
        refJadwal: [j.id],
      });
    }
  }

  // 5. Pemenuhan kebutuhan jam.
  const hitung = (kelasId: string, mapelId: string, guruId: string) =>
    p.jadwal.filter(
      (j) => j.kelasId === kelasId && j.mapelId === mapelId && j.guruId === guruId,
    ).length;
  for (const req of p.kebutuhan) {
    const c = hitung(req.kelasId, req.mapelId, req.guruId);
    if (c >= req.jumlahJam) continue;
    const kelas = kelasM.get(req.kelasId);
    const mapel = mapelM.get(req.mapelId);
    const guru = guruM.get(req.guruId);
    if (!kelas || !mapel || !guru) {
      out.push({
        id: `kebutuhan-data|${req.id}`,
        tipe: 'data',
        tingkat: 'error',
        pesan: 'Baris kebutuhan jam merujuk data yang sudah dihapus.',
        refJadwal: [],
      });
      continue;
    }
    out.push({
      id: `kurang|${req.id}`,
      tipe: 'kurang-jam',
      tingkat: c === 0 ? 'error' : 'peringatan',
      pesan: `${kelas.nama} · ${mapel.nama} (${guru.nama}): baru ${c} dari ${req.jumlahJam} jam/minggu.`,
      refJadwal: [],
    });
  }

  // 6. Jam berlebih per kelas+mapel.
  const expected = new Map<string, number>();
  for (const r of p.kebutuhan) {
    const k = `${r.kelasId}|${r.mapelId}`;
    expected.set(k, (expected.get(k) ?? 0) + r.jumlahJam);
  }
  const actual = new Map<string, number>();
  for (const j of p.jadwal) {
    const k = `${j.kelasId}|${j.mapelId}`;
    actual.set(k, (actual.get(k) ?? 0) + 1);
  }
  for (const [k, cnt] of actual) {
    const exp = expected.get(k) ?? 0;
    if (cnt > exp) {
      const [kelasId, mapelId] = k.split('|');
      out.push({
        id: `lebih|${k}`,
        tipe: 'lebih-jam',
        tingkat: 'peringatan',
        pesan: `${kelasM.get(kelasId)?.nama ?? '?'} · ${namaMapel(mapelId)}: ${cnt} jam terjadwal, padahal kebutuhan ${exp} jam.`,
        refJadwal: [],
      });
    }
  }

  // 7. Beban guru melebihi maksimum.
  for (const g of p.guru) {
    const cnt = p.jadwal.filter((j) => j.guruId === g.id).length;
    if (cnt > g.maxJam) {
      out.push({
        id: `guru-jam|${g.id}`,
        tipe: 'guru-lebih-jam',
        tingkat: 'peringatan',
        pesan: `${g.nama}: ${cnt} jam terjadwal, melebihi maksimum ${g.maxJam} jam/minggu.`,
        refJadwal: p.jadwal.filter((j) => j.guruId === g.id).map((j) => j.id),
      });
    }
  }

  if (out.length === 0) {
    out.push({
      id: 'aman',
      tipe: 'data',
      tingkat: 'peringatan',
      pesan: 'Tidak ada konflik — jadwal bersih.',
      refJadwal: [],
    });
  }

  out.sort((a, b) => (a.tingkat === b.tingkat ? 0 : a.tingkat === 'error' ? -1 : 1));
  return out;
}

/** Benar-benar bersih? (hanya entri "aman" buatan). */
export function isClean(conflicts: Conflict[]): boolean {
  return conflicts.length === 1 && conflicts[0].id === 'aman';
}
