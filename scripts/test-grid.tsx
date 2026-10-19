// Uji markup Grid Jadwal (SSR): struktur tabel kaku, sel seragam, kartu <div>.
import { renderToStaticMarkup } from 'react-dom/server';
import { demoProject } from '../src/store';
import { TimetableGrid } from '../src/timetable';

const p = demoProject();
const kelas = p.kelas[0];
const mapel = p.mapel[0];
const guru = p.guru[0];
const ruang = p.ruang[0];
// Dua pelajaran: satu tunggal, satu blok 2 JP berurutan + satu sel dengan 2 kartu.
p.jadwal = [
  {
    id: 'a1',
    reqId: p.kebutuhan[0]?.id,
    kelasId: kelas.id,
    mapelId: mapel.id,
    guruId: guru.id,
    ruangId: ruang.id,
    hari: 0,
    periodeId: 'p1',
    tetap: false,
    catatan: '',
  },
  {
    id: 'a2',
    reqId: p.kebutuhan[0]?.id,
    kelasId: kelas.id,
    mapelId: mapel.id,
    guruId: guru.id,
    ruangId: ruang.id,
    hari: 0,
    periodeId: 'p2',
    tetap: false,
    catatan: '',
    blokId: 'bl1',
  },
  {
    id: 'a3',
    reqId: p.kebutuhan[0]?.id,
    kelasId: kelas.id,
    mapelId: mapel.id,
    guruId: guru.id,
    ruangId: ruang.id,
    hari: 0,
    periodeId: 'p3',
    tetap: false,
    catatan: '',
    blokId: 'bl1',
  },
  // Dua kartu di sel yang sama (skenario bentrok) → harus dapat kelas "multi".
  {
    id: 'a4',
    reqId: p.kebutuhan[1]?.id,
    kelasId: kelas.id,
    mapelId: p.mapel[1].id,
    guruId: p.guru[1].id,
    ruangId: ruang.id,
    hari: 1,
    periodeId: 'p1',
    tetap: false,
    catatan: '',
  },
  {
    id: 'a5',
    reqId: p.kebutuhan[2]?.id,
    kelasId: kelas.id,
    mapelId: p.mapel[2].id,
    guruId: p.guru[2].id,
    ruangId: ruang.id,
    hari: 1,
    periodeId: 'p1',
    tetap: false,
    catatan: '',
  },
];

const html = renderToStaticMarkup(
  <TimetableGrid project={p} items={p.jadwal} scope="kelas" editable judul={kelas.nama} />,
);

let gagal = 0;
const cek = (nama: string, syarat: boolean) => {
  if (syarat) console.log(`OK   grid   ${nama}`);
  else {
    gagal++;
    console.log(`GAGAL grid ${nama}`);
  }
};

cek('<table class="tt">', html.includes('<table class="tt">'));
cek('<th class="jam-cell">', html.includes('class="jam-cell"'));
cek('sel class "cell"', /class="cell[ "]/i.test(html));
cek('kartu les berupa <div>', /<div class="les[ "]/i.test(html));
cek('kartu les bukan <button>', !/<button[^>]*class="[^"]*\bles\b/i.test(html));
cek('sel dengan 2 kartu → class "multi"', /class="[^"]*\bmulti\b[^"]*"/.test(html));
cek('sel blok menyatu → class "cell-blok"', /class="[^"]*\bcell-blok\b[^"]*"/.test(html));
cek('tanpa tombol les-tambah', !html.includes('les-tambah'));
cek('tanpa placeholder libur-tanda', !html.includes('libur-tanda'));
cek('baris jam non-pelajaran tetap ada', html.includes('baris-waktu'));

console.log(gagal === 0 ? '\nGRID MARKUP LULUS ✅' : `\nGRID MARKUP GAGAL ❌ (${gagal})`);
process.exit(gagal === 0 ? 0 : 1);
