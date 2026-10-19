// Mesin pembuat jadwal otomatis (constraint solver) + pengecek konflik.
//
// Pendekatan: pencarian lokal dengan heuristik MRV (Minimum Remaining Values),
// skor penalti untuk batasan lunak (sebaran hari, beban guru, preferensi,
// ruang, jam ujung hari), dan beberapa kali percobaan acak untuk hasil terbaik.
//
// Sejak dukungan JP berbeda per hari & block scheduling:
// - Slot yang dipakai selalu diambil dari `periodeAktifHari` (bukan seluruh JP).
// - Kebutuhan jam dipecah mengikuti pola distribusi JP (mis. [2, 1]) dan
//   ditempatkan sebagai blok jam berurutan pada hari yang sama.

import {
  Assignment,
  Conflict,
  labelTipeWaktu,
  periodeAktifHari,
  Period,
  Project,
  Requirement,
  SchoolClass,
  SlotKey,
  slotHariAktif,
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
  // Hanya baris bertipe "pelajaran" yang boleh dipakai menampung pelajaran.
  return p.periode.filter((x) => x.tipe === 'pelajaran');
}

export function slotLabel(p: Project, hari: number, periodeId: string): string {
  const per = p.periode.find((x) => x.id === periodeId);
  return `${p.hari[hari] ?? '?'}${per ? ` · ${per.nama} (${per.mulai}–${per.selesai})` : ''}`;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/** Satu unit penempatan: satu JP tunggal atau satu blok berurutan. */
interface Task {
  req: Requirement;
  ukuran: number;
  /**
   * Id grup blok: semua potongan yang berasal dari SATU kebutuhan + pola yang
   * sama. Dipakai agar potongan pola (mis. 2 JP + 1 JP) cenderung ditempatkan
   * pada hari yang BERBEDA, bukan menumpuk di hari yang sama.
   */
  grup: string;
}

interface Cand {
  hari: number;
  slots: string[];
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

/** Pola distribusi efektif: kebutuhan diprioritaskan, lalu pola guru. */
function polaEfektif(req: Requirement, polaGuru: number[] | undefined): number[] {
  const bersih = (arr: number[] | undefined) =>
    (arr ?? []).map((n) => Math.floor(Number(n))).filter((n) => Number.isFinite(n) && n >= 1);
  const dariKebutuhan = bersih(req.polaJP);
  return dariKebutuhan.length ? dariKebutuhan : bersih(polaGuru);
}

/** Pecah sejumlah JP menjadi potongan sesuai pola (pola diulang bila perlu). */
function pecahMenjadiBlok(sisa: number, pola: number[]): number[] {
  if (sisa <= 0) return [];
  if (!pola.length) return Array.from({ length: sisa }, () => 1);
  const out: number[] = [];
  let s = sisa;
  let i = 0;
  while (s > 0) {
    const dasar = Math.max(1, Math.floor(pola[i % pola.length]));
    const n = Math.min(dasar, s);
    out.push(n);
    s -= n;
    i++;
  }
  return out;
}

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

  // Slot aktif berbeda per hari (batas maks. JP & JP yang dimatikan).
  const aktifHari = p.hari.map((_, h) => periodeAktifHari(p, h));
  const idxAll = new Map(p.periode.map((per, i) => [per.id, i]));

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
    // Hari yang sudah dipakai tiap grup blok (`grup|hari` → jumlah JP).
    // Dipakai supaya potongan pola (mis. 2 JP + 1 JP) cenderung tersebar ke hari
    // berbeda, bukan menumpuk di hari yang sama.
    const grupHari = new Map<string, number>();
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

    // Perluas kebutuhan jam menjadi task (sisa jam setelah jadwal tetap).
    // Setiap task mengikuti pola distribusi JP milik kebutuhan/guru.
    // Satu kebutuhan dengan pola [2, 1] → DUA task terpisah: blok 2 JP dan 1 JP.
    const items: Task[] = [];
    for (const req of p.kebutuhan) {
      const sudahTetap = tetap.filter(
        (j) =>
          j.kelasId === req.kelasId && j.mapelId === req.mapelId && j.guruId === req.guruId,
      ).length;
      const sisa = Math.max(0, req.jumlahJam - sudahTetap);
      if (!sisa) continue;
      const guru = guruM.get(req.guruId);
      const pola = polaEfektif(req, guru?.polaJP);
      const grup = `g_${req.id}`;
      for (const ukuran of pecahMenjadiBlok(sisa, pola)) {
        items.push({ req, ukuran, grup });
      }
    }

    const pickRoom = (
      req: Requirement,
      mapel: Subject,
      kelas: SchoolClass,
      hari: number,
      slots: string[],
    ) => {
      const bebasDi = (ruangId: string) =>
        slots.every((pid) => !occGet(occ, `r|${ruangId}`).has(slotKey(hari, pid)));
      if (req.ruangId) {
        const r = ruangM.get(req.ruangId);
        if (!r || !bebasDi(r.id)) return undefined;
        return r;
      }
      const tipe = mapel.tipeRuang;
      const cand = p.ruang.filter(
        (r) =>
          (tipe === 'semua' || r.tipe === tipe) &&
          bebasDi(r.id) &&
          (!opsi.wajibRuang || r.kapasitas >= kelas.jumlahSiswa),
      );
      if (!cand.length) return undefined;
      cand.sort((a, b) => b.kapasitas - a.kapasitas);
      return Math.random() < 0.7 ? cand[0] : cand[Math.floor(Math.random() * cand.length)];
    };

    const evalTask = (task: Task): Cand[] => {
      const req = task.req;
      const g = guruM.get(req.guruId);
      const kelas = kelasM.get(req.kelasId);
      const mapel = mapelM.get(req.mapelId);
      if (!g || !kelas || !mapel) return [];
      if ((teacherWeek.get(g.id) ?? 0) + task.ukuran > g.maxJam) return [];
      const res: Cand[] = [];
      const dilarangGuru = new Set(g.slotDilarang);
      const diinginkanGuru = new Set(g.slotDiinginkan);

      for (let hari = 0; hari < p.hari.length; hari++) {
        const dayLoad = teacherDay.get(`${g.id}|${hari}`) ?? 0;
        if (dayLoad + task.ukuran > g.maxPerHari) continue;
        const aktif = aktifHari[hari];
        if (aktif.length < task.ukuran) continue;

        for (let i = 0; i + task.ukuran <= aktif.length; i++) {
          const run = aktif.slice(i, i + task.ukuran);
          // Blok harus benar-benar berurutan di daftar jam global (bukan
          // melompati baris istirahat atau JP yang dimatikan).
          let nyambung = true;
          for (let k = 1; k < run.length; k++) {
            if ((idxAll.get(run[k].id) ?? -1) !== (idxAll.get(run[k - 1].id) ?? -2) + 1) {
              nyambung = false;
              break;
            }
          }
          if (!nyambung) continue;

          let ok = true;
          for (const per of run) {
            const sk = slotKey(hari, per.id);
            if (occGet(occ, `k|${kelas.id}`).has(sk)) ok = false;
            else if (occGet(occ, `g|${g.id}`).has(sk)) ok = false;
            else if (isBlocked('kelas', kelas.id, sk) || isBlocked('guru', g.id, sk)) ok = false;
            else if (dilarangGuru.has(sk)) ok = false;
            if (!ok) break;
          }
          if (!ok) continue;

          const room = pickRoom(
            req,
            mapel,
            kelas,
            hari,
            run.map((x) => x.id),
          );
          if (!room) continue;

          let pen = 0;
          const subjDay = classSubjDay.get(`${kelas.id}|${mapel.id}|${hari}`) ?? 0;
          if (subjDay > 0) pen += (opsi.rataHari ? 26 : 9) * subjDay;
          pen += (3 * dayLoad + 2 * (classDay.get(`${kelas.id}|${hari}`) ?? 0)) * task.ukuran;
          // Sebar potongan pola yang sama ke hari berbeda: hari yang sudah
          // dipakai grup ini diberi penalti besar (tetap boleh bila terpaksa).
          if (grupHari.has(`${task.grup}|${hari}`)) pen += 60;
          for (const per of run) if (diinginkanGuru.has(slotKey(hari, per.id))) pen -= 18;
          // Dorong blok menempel pada jam guru yang sudah terisi di hari itu.
          if (dayLoad > 0) {
            const sebelum = i > 0 ? aktif[i - 1] : undefined;
            const sesudah = i + task.ukuran < aktif.length ? aktif[i + task.ukuran] : undefined;
            const nempel =
              (sebelum && occGet(occ, `g|${g.id}`).has(slotKey(hari, sebelum.id))) ||
              (sesudah && occGet(occ, `g|${g.id}`).has(slotKey(hari, sesudah.id)));
            if (!nempel) pen += 6;
          }
          if (opsi.hindariUjung) {
            const perAwal = slotKey(hari, run[0].id);
            const perAkhir = slotKey(hari, run[run.length - 1].id);
            if (perAwal === slotKey(hari, aktif[0].id)) pen += 7;
            if (perAkhir === slotKey(hari, aktif[aktif.length - 1].id)) pen += 7;
          }
          res.push({
            hari,
            slots: run.map((x) => x.id),
            ruangId: room.id,
            penalti: pen,
          });
        }
      }
      return res;
    };

    const diag = (task: Task): string => {
      const req = task.req;
      const g = guruM.get(req.guruId);
      const kelas = kelasM.get(req.kelasId);
      const mapel = mapelM.get(req.mapelId);
      if (!g || !kelas || !mapel) return 'data kebutuhan tidak lengkap (guru/mapel/kelas terhapus)';
      if ((teacherWeek.get(g.id) ?? 0) + task.ukuran > g.maxJam)
        return `guru melebihi maksimum ${g.maxJam} jam/minggu`;
      const counts: Record<string, number> = {};
      const bump = (s: string) => (counts[s] = (counts[s] ?? 0) + 1);
      for (let hari = 0; hari < p.hari.length; hari++) {
        const dayLoad = teacherDay.get(`${g.id}|${hari}`) ?? 0;
        if (dayLoad + task.ukuran > g.maxPerHari) {
          bump('guru melebihi batas jam per hari');
          continue;
        }
        for (const per of aktifHari[hari]) {
          const sk = slotKey(hari, per.id);
          if (occGet(occ, `k|${kelas.id}`).has(sk)) bump('kelas sudah terisi');
          else if (occGet(occ, `g|${g.id}`).has(sk)) bump('guru bentrok');
          else if (isBlocked('kelas', kelas.id, sk) || isBlocked('guru', g.id, sk))
            bump('diblokir lewat halaman Batasan');
          else if (g.slotDilarang.includes(sk)) bump('di luar preferensi guru');
          else if (req.ruangId && !ruangM.has(req.ruangId)) bump('ruang tetap tidak ditemukan');
          else if (!p.ruang.length) bump('belum ada data ruang');
        }
      }
      const top = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([k, v]) => `${k} (${v} slot)`);
      // Hitung hari yang benar-benar tidak punya JP aktif. Ini penyebab paling
      // fatal (biasanya karena tipe baris "Jam Pelajaran" tidak dikenali),
      // dan pesannya dibuat eksplisit dalam satuan HARI — bukan jumlah slot.
      const hariTanpaJp = p.hari.filter((_, h) => !aktifHari[h].length).length;
      const bagian: string[] = [];
      if (hariTanpaJp) {
        bagian.push(
          `tidak ada JP aktif pada hari ini (${hariTanpaJp} hari dari ${p.hari.length} hari kosong)`,
        );
      }
      bagian.push(...top);
      return bagian.length ? bagian.join(', ') : 'tidak ada slot tersisa';
    };

    const gagal: GagalItem[] = [];
    let penaltiTotal = 0;

    // Urutkan task: yang paling sulit dulu — guru dengan sisa jam paling sempit,
    // blok terbesar lebih dulu, mapel dengan ruang paling terbatas.
    const butuhGuru = new Map<string, number>();
    for (const it of items)
      butuhGuru.set(it.req.guruId, (butuhGuru.get(it.req.guruId) ?? 0) + it.ukuran);
    const butuhKelas = new Map<string, number>();
    for (const it of items)
      butuhKelas.set(it.req.kelasId, (butuhKelas.get(it.req.kelasId) ?? 0) + it.ukuran);
    const jumlahRuangTipe = new Map<string, number>();
    for (const r of p.ruang) jumlahRuangTipe.set(r.tipe, (jumlahRuangTipe.get(r.tipe) ?? 0) + 1);

    const urut = [...items].sort((a, b) => {
      const ga = guruM.get(a.req.guruId);
      const gb = guruM.get(b.req.guruId);
      const slackA = (ga?.maxJam ?? 24) - (butuhGuru.get(a.req.guruId) ?? 0);
      const slackB = (gb?.maxJam ?? 24) - (butuhGuru.get(b.req.guruId) ?? 0);
      if (slackA !== slackB) return slackA - slackB;
      if (a.ukuran !== b.ukuran) return b.ukuran - a.ukuran;
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

    for (const task of urut) {
      const cands = evalTask(task);
      if (!cands.length) {
        gagal.push({ req: task.req, alasan: diag(task) });
        continue;
      }
      cands.sort((a, b) => a.penalti - b.penalti);
      const top = cands.slice(0, Math.min(4, cands.length));
      const minPen = top[0].penalti;
      const bobot = top.map(
        (c) => Math.exp(-(c.penalti - minPen) / 10) * (0.6 + Math.random() * 0.8),
      );
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

      const blokId = task.ukuran > 1 ? uid('bl') : undefined;
      for (const periodeId of chosen.slots) {
        const j: Assignment = {
          id: uid('j'),
          reqId: task.req.id,
          kelasId: task.req.kelasId,
          mapelId: task.req.mapelId,
          guruId: task.req.guruId,
          ruangId: chosen.ruangId,
          hari: chosen.hari,
          periodeId,
          tetap: false,
          catatan: '',
          blokId,
        };
        markOcc(j);
        bumpLoad(j);
        placed.push(j);
      }
      if (task.ukuran > 1) {
        // Blok multi-JP menandai harinya; potongan lain dari grup yang sama
        // akan diberi penalti bila memilih hari yang sama.
        grupHari.set(`${task.grup}|${chosen.hari}`, (grupHari.get(`${task.grup}|${chosen.hari}`) ?? 0) + 1);
      }
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
    l.pesan.push(
      'Coba tambah jumlah percobaan, kurangi jam, atau periksa batasan pada halaman Batasan.',
    );
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

  // 2. Jadwal pada baris di luar jam pelajaran / di luar JP aktif hari itu.
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
    } else if (!slotHariAktif(p, j.hari, j.periodeId)) {
      out.push({
        id: `nonaktif|${j.id}`,
        tipe: 'nonaktif',
        tingkat: 'error',
        pesan: `${namaMapel(j.mapelId)} (${kelasM.get(j.kelasId)?.nama ?? '?'}) berada di ${slotLabel(p, j.hari, j.periodeId)} — JP tersebut tidak aktif pada hari ${p.hari[j.hari] ?? '?'} (jam hanya berlaku hari lain, batas maks. JP, atau dimatikan manual).`,
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

// ---------------------------------------------------------------------------
// Perbaikan konflik otomatis (trial-and-error pindah/swap slot)
// ---------------------------------------------------------------------------

export interface HasilAutoFix {
  jadwal: Assignment[];
  /** Jumlah konflik keras sebelum perbaikan. */
  sebelum: number;
  /** Jumlah konflik keras yang tersisa. */
  sesudah: number;
  /** Konflik yang berhasil dihilangkan. */
  berhasil: number;
  /** Sisa konflik (sama dengan `sesudah`). */
  tersisa: number;
  /** Banyak langkah pemindahan/penukaran yang dilakukan. */
  gerakan: number;
}

/** Tipe konflik yang bisa diperbaiki dengan memindahkan/menukar slot. */
const TIPE_OTOMATIS = new Set([
  'kelas-bentrok',
  'guru-bentrok',
  'ruang-bentrok',
  'blokir',
  'istirahat',
  'nonaktif',
]);

function errorJadwal(p: Project, jadwal: Assignment[]): Conflict[] {
  return checkConflicts({ ...p, jadwal }).filter(
    (k) => k.id !== 'aman' && k.tingkat === 'error',
  );
}

function errorBisaDiperbaiki(p: Project, jadwal: Assignment[]): Conflict[] {
  return errorJadwal(p, jadwal).filter((k) => TIPE_OTOMATIS.has(k.tipe));
}

/** Apakah assignment boleh diletakkan di slot tertentu tanpa bentrok keras? */
function slotAman(
  p: Project,
  jadwal: Assignment[],
  a: Assignment,
  hari: number,
  periodeId: string,
  abaikan: Set<string>,
): boolean {
  if (!slotHariAktif(p, hari, periodeId)) return false;
  // Blokir kelas/guru pada slot tujuan (ruang tujuan menyesuaikan: ruang
  // terblokir pada slot itu ditolak lewat pemeriksaan bentrok di bawah).
  for (const b of p.blokir) {
    if (b.hari !== hari || b.periodeId !== periodeId) continue;
    if (
      (b.jenis === 'kelas' && b.refId === a.kelasId) ||
      (b.jenis === 'guru' && b.refId === a.guruId)
    )
      return false;
  }
  for (const j of jadwal) {
    if (abaikan.has(j.id)) continue;
    if (j.hari !== hari || j.periodeId !== periodeId) continue;
    if (
      j.kelasId === a.kelasId ||
      j.guruId === a.guruId ||
      (a.ruangId && j.ruangId === a.ruangId)
    )
      return false;
  }
  return true;
}

/** Cari slot kosong terdekat untuk memindahkan satu pelajaran. */
function cariSlotBebas(
  p: Project,
  jadwal: Assignment[],
  a: Assignment,
): { hari: number; periodeId: string } | null {
  const urutanHari = [a.hari, ...p.hari.map((_, i) => i).filter((i) => i !== a.hari)];
  for (const hari of urutanHari) {
    for (const per of periodeAktifHari(p, hari)) {
      if (hari === a.hari && per.id === a.periodeId) continue;
      if (slotAman(p, jadwal, a, hari, per.id, new Set([a.id]))) {
        return { hari, periodeId: per.id };
      }
    }
  }
  return null;
}

export function autoFixConflicts(p: Project): HasilAutoFix {
  let jadwal = p.jadwal.map((j) => ({ ...j }));
  const sebelum = errorJadwal(p, jadwal).length;
  let gerakan = 0;

  // Batas iterasi mencegah loop panjang pada data yang memang tidak mungkin
  // dirapikan (mis. slot terlalu sedikit).
  for (let iter = 0; iter < 400; iter++) {
    const errs = errorBisaDiperbaiki(p, jadwal);
    if (!errs.length) break;
    let maju = false;

    for (const konflik of errs) {
      const ids = konflik.refJadwal;
      // 1) Pindahkan salah satu pelajaran ke slot yang benar-benar bebas.
      for (const id of ids) {
        const a = jadwal.find((x) => x.id === id);
        if (!a || a.tetap) continue;
        const slot = cariSlotBebas(p, jadwal, a);
        if (!slot) continue;
        jadwal = jadwal.map((x) =>
          x.id === a.id ? { ...x, hari: slot.hari, periodeId: slot.periodeId } : x,
        );
        maju = true;
        break;
      }
      if (maju) break;

      // 2) Tukar posisi dengan pelajaran lain (tetap menghormati jadwal tetap).
      for (const id of ids) {
        const a = jadwal.find((x) => x.id === id);
        if (!a || a.tetap) continue;
        for (const b of jadwal) {
          if (b.id === a.id || b.tetap) continue;
          if (b.hari === a.hari && b.periodeId === a.periodeId) continue;
          const abaikan = new Set([a.id, b.id]);
          if (
            !slotAman(p, jadwal, a, b.hari, b.periodeId, abaikan) ||
            !slotAman(p, jadwal, b, a.hari, a.periodeId, abaikan)
          )
            continue;
          jadwal = jadwal.map((x) => {
            if (x.id === a.id) return { ...x, hari: b.hari, periodeId: b.periodeId };
            if (x.id === b.id) return { ...x, hari: a.hari, periodeId: a.periodeId };
            return x;
          });
          maju = true;
          break;
        }
        if (maju) break;
      }
      if (maju) break;
    }

    if (!maju) break;
    gerakan++;
  }

  const sesudah = errorJadwal(p, jadwal).length;
  return {
    jadwal,
    sebelum,
    sesudah,
    berhasil: Math.max(0, sebelum - sesudah),
    tersisa: sesudah,
    gerakan,
  };
}
