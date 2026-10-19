// Uji cepat mesin generator (dijalankan via esbuild + node).
import { demoProject } from '../src/store';
import { checkConflicts, generate } from '../src/scheduler';
import { buatMatriks, matriksKeXlsx } from '../src/matrix';

async function main() {
  const p = demoProject();
  const t0 = Date.now();
  const { jadwal, laporan } = await generate(p);
  p.jadwal = jadwal;
  const konflik = checkConflicts(p);

  console.log('=== LAPORAN GENERATE ===');
  console.log('total kebutuhan :', laporan.totalKebutuhan);
  console.log('ditempatkan     :', laporan.ditempatkan);
  console.log('gagal           :', laporan.totalGagal);
  console.log('percobaan       :', laporan.percobaan);
  console.log('penalti         :', laporan.penalti);
  console.log('pesan           :', laporan.pesan.join(' | '));
  console.log('waktu total     :', Date.now() - t0, 'ms');
  for (const g of laporan.gagal.slice(0, 10)) {
    console.log('  GAGAL:', g.req.kelasId, g.req.mapelId, g.req.guruId, '→', g.alasan);
  }

  const errors = konflik.filter((k) => k.tingkat === 'error');
  const warnings = konflik.filter((k) => k.tingkat !== 'error' && k.id !== 'aman');
  console.log('\n=== CEK KONFLIK ===');
  console.log('error   :', errors.length);
  console.log('peringatan:', warnings.length);
  for (const k of [...errors, ...warnings].slice(0, 15)) {
    console.log(`  [${k.tingkat}] ${k.tipe}: ${k.pesan}`);
  }

  // Beban guru
  console.log('\n=== BEBAN GURU ===');
  for (const g of p.guru) {
    const n = p.jadwal.filter((j) => j.guruId === g.id).length;
    const over = n > g.maxJam ? ' ⚠ LEBIH' : '';
    console.log(`  ${g.nama.split(',')[0]}: ${n}/${g.maxJam}${over}`);
  }

  const ok = laporan.totalGagal === 0 && errors.length === 0;

  // Matriks + ekspor Excel
  console.log('\n=== MATRIKS & XLSX ===');
  let matriksOk = true;
  try {
    const m = buatMatriks(p);
    const totalSel = [...m.sel.values()].reduce((a, s) => a + s.les.length, 0);
    console.log('kelas          :', m.kelas.length);
    console.log('baris matriks  :', m.baris.length, `(${m.blok.length} hari)`);
    console.log('sel terisi     :', m.sel.size, `(=${totalSel} pelajaran)`);
    console.log('entri legenda  :', m.legenda.length);
    if (totalSel !== p.jadwal.length) {
      console.log('  ⚠ jumlah sel tidak cocok dengan jadwal!');
      matriksOk = false;
    }
    const kodeContoh = m.legenda.slice(0, 5).map((e) => `${e.kode}=${e.guru.split(' ')[0]}`);
    console.log('contoh kode    :', kodeContoh.join(', '));

    const bytes = matriksKeXlsx(p, m);
    const magic = String.fromCharCode(...bytes.slice(0, 2));
    const isi = new TextDecoder('latin1').decode(bytes); // STORE → teks polos
    const punyaPK = magic === 'PK';
    const punyaSheet = isi.includes('<sheetData>') && isi.includes('JADWAL PELAJARAN');
    const punyaStyle = isi.includes('<styleSheet');
    // Kop surat: nama sekolah, alamat, & tahun ajaran harus tertulis di sheet.
    const punyaKop =
      isi.includes(p.info.nama) &&
      isi.includes(p.info.tahunAjaran) &&
      (p.info.alamat ? isi.includes(p.info.alamat) : true);
    const punyaMerge = isi.includes('<mergeCells') && isi.includes('<mergeCell ref="A1:');
    console.log('xlsx byte      :', bytes.length, 'magic:', magic, punyaPK ? '✓' : '✗');
    console.log('isi worksheet  :', punyaSheet ? '✓' : '✗', '| gaya:', punyaStyle ? '✓' : '✗');
    console.log('kop surat      :', punyaKop ? '✓' : '✗', '| merge kop:', punyaMerge ? '✓' : '✗');
    matriksOk = matriksOk && punyaPK && punyaSheet && punyaStyle && punyaKop && punyaMerge;

    // Tulis contoh berkas untuk pemeriksaan manual.
    try {
      const fs = await import('fs');
      fs.mkdirSync('temp', { recursive: true });
      fs.writeFileSync('temp/matriks-test.xlsx', bytes);
      console.log('contoh ditulis : temp/matriks-test.xlsx');
    } catch {
      /* lingkungan tanpa fs — lewati */
    }
  } catch (e) {
    console.log('GAGAL matriks/xlsx:', e instanceof Error ? e.message : e);
    matriksOk = false;
  }

  // ------------------------------------------------------------------
  // Uji fitur hariAktif: periode yang dibatasi hanya beberapa hari harus
  // dihormati generator, grid, dan matriks.
  // ------------------------------------------------------------------
  console.log('\n=== UJI hariAktif (JP khusus per hari) ===');
  let hariAktifOk = true;
  try {
    const p2 = demoProject();
    // Batasi Jam ke-8 hanya untuk Senin–Kamis (indeks 0..3), lepas Jumat & Sabtu.
    p2.periode = p2.periode.map((per) =>
      per.id === 'p8' ? { ...per, hariAktif: [0, 1, 2, 3] } : per,
    );
    // Tambah istirahat Jumat yang khusus (09:00–09:20) hanya hari Jumat (indeks 4).
    p2.periode.push({
      id: 'if_jumat',
      nama: 'Istirahat Jumat',
      mulai: '09:00',
      selesai: '09:20',
      tipe: 'istirahat',
      hariAktif: [4],
    });

    const { periodeAktifHari, hariPeriode } = await import('../src/types');
    const jpP8 = (h: number) => periodeAktifHari(p2, h).some((x) => x.id === 'p8');
    const terima: boolean[] = [0, 1, 2, 3, 4, 5].map(jpP8);
    const benar =
      terima[0] && terima[1] && terima[2] && terima[3] && !terima[4] && !terima[5];
    console.log('J4 aktif Sen–Kam :', terima.map((x) => (x ? '✓' : '−')).join(' '));
    console.log('J4 harus mati di Jumat/Sabtu :', benar ? '✓' : '✗');
    const hpJumat = hariPeriode(p2, { hariAktif: [4] }).join(',');
    console.log('Istirahat Jumat hanya hari idx:', hpJumat === '4' ? '✓ (4)' : `✗ (${hpJumat})`);

    const hasil = await generate(p2);
    p2.jadwal = hasil.jadwal;
    const salahTempat = p2.jadwal.filter((j) => {
      const per = p2.periode.find((x) => x.id === j.periodeId);
      const aktif = per?.hariAktif ?? [];
      return aktif.length > 0 && !aktif.includes(j.hari);
    }).length;
    console.log('pelajaran di hari terlarang :', salahTempat, salahTempat === 0 ? '✓' : '✗');
    const konflik2 = checkConflicts(p2).filter((k) => k.tingkat === 'error');
    console.log('gagal & konflik error       :', hasil.laporan.totalGagal, '/', konflik2.length);

    // Matriks: baris per hari harus HANYA memuat periode aktif hari itu,
    // terurut menaik berdasarkan jam mulai, tanpa baris placeholder.
    const { buatMatriks } = await import('../src/matrix');
    const m2 = buatMatriks(p2);
    const hrSenin = m2.blok.find((b) => b.hari === 0);
    const hrJumat = m2.blok.find((b) => b.hari === 4);
    const barisHari = (h: number) => m2.baris.filter((b) => b.hari === h);
    const jumatId = new Set(barisHari(4).map((b) => b.periodeId));
    const p8DiJumat = jumatId.has('p8');
    const ifDiJumat = jumatId.has('if_jumat');
    const seninId = new Set(barisHari(0).map((b) => b.periodeId));
    const p8DiSenin = seninId.has('p8');
    const ifDiSenin = seninId.has('if_jumat');
    // Jam pada tiap hari harus terurut menaik.
    const urut = (h: number) => {
      const jam = barisHari(h).map((b) => b.jam.split(' - ')[0]);
      return jam.every((x, i) => i === 0 || jam[i - 1] <= x);
    };
    const semuaUrut = [0, 1, 2, 3, 4, 5].every(urut);
    const jmlSenin = hrSenin?.jumlah ?? 0;
    const jmlJumat = hrJumat?.jumlah ?? 0;
    console.log('baris Jumat tanpa JP non-aktif:', p8DiJumat ? '✗' : '✓', `(${jmlJumat} baris)`);
    console.log('istirahat Jumat ada di hari 4 :', ifDiJumat ? '✓' : '✗');
    console.log('J4 ada di Senin, tak ada Jumat :', p8DiSenin && !p8DiJumat ? '✓' : '✗');
    console.log('istirahat Jumat bukan di Senin :', ifDiSenin ? '✗' : '✓');
    console.log('baris tiap hari terurut jam    :', semuaUrut ? '✓' : '✗', `(Senin ${jmlSenin}, Jumat ${jmlJumat})`);
    const barisOk =
      !p8DiJumat && ifDiJumat && p8DiSenin && !ifDiSenin && semuaUrut && jmlSenin > 0 && jmlJumat > 0;

    hariAktifOk = benar && hpJumat === '4' && salahTempat === 0 && konflik2.length === 0 && barisOk;
    console.log('status hariAktif            :', hariAktifOk ? 'LULUS ✅' : 'GAGAL ❌');
  } catch (e) {
    console.log('GAGAL uji hariAktif:', e instanceof Error ? e.message : e);
    hariAktifOk = false;
  }

  // ------------------------------------------------------------------
  // Uji pola distribusi JP (block scheduling): parser harus menerima "2, 1"
  // dan solver harus menempatkan SELURUH jam (3 JP = 2 berurutan + 1), tidak
  // menghilangkan satu JP.
  // ------------------------------------------------------------------
  console.log('\n=== UJI polaJP (block scheduling) ===');
  let polaOk = true;
  try {
    const { parsePolaJP } = await import('../src/ui');
    const urai = (s: string) => JSON.stringify(parsePolaJP(s));
    const kasus: Array<[string, string]> = [
      ['2, 1', '[2,1]'],
      ['2,1', '[2,1]'],
      ['2 1', '[2,1]'],
      ['2;1', '[2,1]'],
      ['[2, 1]', '[2,1]'],
      ['3', '[3]'],
      ['2, 1, 1', '[2,1,1]'],
      ['', '[]'],
    ];
    let uraiOk = true;
    for (const [inp, harap] of kasus) {
      const got = urai(inp);
      if (got !== harap) {
        uraiOk = false;
        console.log(`  ✗ parse ${JSON.stringify(inp)} → ${got} (harap ${harap})`);
      }
    }
    console.log('parser "2, 1" & sejenis   :', uraiOk ? '✓' : '✗');

    // Kebutuhan 3 JP dengan pola [2, 1] harus menghasilkan 3 JP terjadwal.
    const p3 = demoProject();
    const req = p3.kebutuhan[0];
    req.jumlahJam = 3;
    req.polaJP = [2, 1];
    // Bersihkan jadwal tetap agar semuanya digenerate ulang.
    p3.jadwal = [];
    const hasil3 = await generate(p3);
    p3.jadwal = hasil3.jadwal;
    const milik = p3.jadwal.filter(
      (j) =>
        j.kelasId === req.kelasId && j.mapelId === req.mapelId && j.guruId === req.guruId,
    );
    // Hitung blok: kumpulan JP dengan blokId sama di hari sama.
    const blok = new Map<string, number>();
    for (const j of milik) {
      const k = j.blokId ?? `tunggal_${j.hari}_${j.periodeId}`;
      blok.set(k, (blok.get(k) ?? 0) + 1);
    }
    const ukuran = [...blok.values()].sort((a, b) => b - a);
    const totalOk = milik.length === 3;
    const adaBlok2 = ukuran.includes(2);
    const adaTunggal = ukuran.includes(1);
    const konflik3 = checkConflicts(p3).filter((k) => k.tingkat === 'error');
    console.log('3 JP + pola "2, 1" terjadwal:', milik.length, '/ 3', totalOk ? '✓' : '✗');
    console.log('blok terbentuk (2 JP + 1 JP):', ukuran.join(' + ') || '-', adaBlok2 && adaTunggal ? '✓' : '✗');
    console.log('konflik error              :', konflik3.length, konflik3.length === 0 ? '✓' : '✗');
    polaOk = uraiOk && totalOk && adaBlok2 && adaTunggal && konflik3.length === 0;
    console.log('status polaJP              :', polaOk ? 'LULUS ✅' : 'GAGAL ❌');
  } catch (e) {
    console.log('GAGAL uji polaJP:', e instanceof Error ? e.message : e);
    polaOk = false;
  }

  console.log('\nHASIL:', ok && matriksOk && hariAktifOk && polaOk ? 'LULUS ✅' : 'GAGAL ❌');
  process.exit(ok && matriksOk && hariAktifOk && polaOk ? 0 : 1);
}

main();
