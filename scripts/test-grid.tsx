// Uji markup Matriks Entitas (SSR): struktur tabel sama dengan SekolahMatrix (HARI & PUKUL di baris).
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { demoProject } from '../src/store';
import { SekolahMatrix, EntityMatrix } from '../src/timetable';

const p = demoProject();
const kelas = p.kelas[0];
const mapel = p.mapel[0];
const guru = p.guru[0];
// Dua pelajaran: satu tunggal, satu blok 2 JP berurutan + satu sel dengan 2 kartu.
p.jadwal = [
  {
    id: 'a1',
    reqId: p.kebutuhan[0]?.id,
    kelasId: kelas.id,
    mapelId: mapel.id,
    guruId: guru.id,
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
    hari: 1,
    periodeId: 'p1',
    tetap: false,
    catatan: '',
  },
];

// --- Matriks "Per Sekolah": hari & pukul di baris, kelas di kolom ----------
const mx = renderToStaticMarkup(<SekolahMatrix project={p} editable konflik={new Set()} />);

let gagal = 0;
const cek2 = (nama: string, syarat: boolean) => {
  if (syarat) console.log(`OK   sekolah   ${nama}`);
  else {
    gagal++;
    console.log(`GAGAL sekolah ${nama}`);
  }
};

cek2('<table class="mx mx-sekolah">', mx.includes('<table class="mx mx-sekolah">'));
cek2('header HARI', /<th class="c-hari">HARI<\/th>/.test(mx));
cek2('header PUKUL', /<th class="c-jam">PUKUL<\/th>/.test(mx));
// Setiap nama kelas muncul sebagai kolom header.
cek2(
  'semua kelas jadi kolom',
  p.kelas.every((k) => mx.includes(`<th>${k.nama}</th>`)),
);
// Kolom HARI memakai rowspan (digabung per hari).
cek2('kolom HARI memakai rowspan', /class="c-hari" rowspan="\d+"/.test(mx));
// Baris non-pelajaran digabung horizontal selebar kolom kelas.
cek2(
  'baris non-pelajaran digabung (colspan)',
  /<td[^>]*colspan="\d+"[^>]*class="c-ist c-ist-\w+"/i.test(mx),
);
// Blok mapel memakai kelas les-mx.
cek2('blok mapel pakai .les-mx', /class="les-mx[ "]/i.test(mx));
cek2('blok mapel bukan <button>', !/<button[^>]*les-mx/i.test(mx));
// Tak ada struktur lama (kartu .les generik) di matriks sekolah.
cek2('tanpa .les generik', !/<div class="les[ "]/i.test(mx));
cek2('tanpa judul per kelas (tt-titel)', !mx.includes('tt-titel'));

// --- Matriks "Per Entitas" (Kelas/Guru/Siswa): struktur identik SekolahMatrix tapi 1 kolom ---
const me = renderToStaticMarkup(
  <EntityMatrix project={p} scope="kelas" entitasId={kelas.id} editable={false} />,
);

const cek3 = (nama: string, syarat: boolean) => {
  if (syarat) console.log(`OK   entitas  ${nama}`);
  else {
    gagal++;
    console.log(`GAGAL entitas ${nama}`);
  }
};

cek3('<table class="mx mx-sekolah">', me.includes('<table class="mx mx-sekolah">'));
cek3('header HARI', /<th class="c-hari">HARI<\/th>/.test(me));
cek3('header PUKUL', /<th class="c-jam">PUKUL<\/th>/.test(me));
cek3('header entitas (nama kelas)', me.includes(`<th>${kelas.nama}</th>`));
cek3('kolom HARI memakai rowspan', /class="c-hari" rowspan="\d+"/.test(me));
cek3('baris non-pelajaran digabung (colspan)', /<td[^>]*colspan="1"[^>]*class="c-ist c-ist-\w+"/i.test(me));
cek3('blok mapel pakai .les-mx', /class="les-mx[ "]/i.test(me));
cek3('blok mapel bukan <button>', !/<button[^>]*les-mx/i.test(me));
cek3('tanpa .les generik', !/<div class="les[ "]/i.test(me));
cek3('tanpa judul per kelas (tt-titel)', !me.includes('tt-titel'));

console.log(gagal === 0 ? '\nMATRIKS MARKUP LULUS ✅' : `\nMATRIKS MARKUP GAGAL ❌ (${gagal})`);
process.exit(gagal === 0 ? 0 : 1);
