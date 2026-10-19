// Uji cepat mesin generator (dijalankan via esbuild + node).
import { demoProject } from '../src/store';
import { checkConflicts, generate } from '../src/scheduler';

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
  console.log('\nHASIL:', ok ? 'LULUS ✅' : 'GAGAL ❌');
  process.exit(ok ? 0 : 1);
}

main();
