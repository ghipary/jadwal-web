// Uji logika komponen FormField 'hari' (tanpa DOM): panggil fungsi komponen,
// telusuri elemen tombol, lalu jalankan onClick dan periksa nilai onChange.
import { FormField, type FieldDef } from '../src/ui';

type El = { type: unknown; props: Record<string, unknown>; key: string | null };

/** Telusuri pohon React element untuk mengumpulkan semua elemen bertipe 'button'. */
function kumpulTombol(node: unknown, out: El[] = []): El[] {
  if (node === null || node === undefined || typeof node === 'boolean') return out;
  if (Array.isArray(node)) {
    for (const n of node) kumpulTombol(n, out);
    return out;
  }
  const el = node as El;
  if (el && typeof el === 'object' && 'type' in el && 'props' in el) {
    if (el.type === 'button') out.push(el);
    const kids = (el.props as { children?: unknown }).children;
    kumpulTombol(kids, out);
  }
  return out;
}

interface Periode { id: string; hariAktif: number[] }

const def: FieldDef<Periode> = {
  key: 'hariAktif',
  label: 'Aktif pada Hari',
  type: 'hari',
  hari: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
};

let gagal = 0;
const cek = (nama: string, ok: boolean) => {
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${nama}`);
  if (!ok) gagal++;
};

// Render ulang setelah tiap perubahan state (meniru setState React).
function render(nilai: number[], onChange: (v: unknown) => void) {
  const tree = FormField<Periode>({ def, value: nilai, onChange });
  return kumpulTombol(tree);
}

// 1) Kosong = "Semua Hari" aktif; tombol hari ada 6, dan semuanya tampil aktif.
{
  const tombol = render([], () => {});
  cek('jumlah tombol = 1 (Semua Hari) + 6 hari', tombol.length === 7);
  const semua = tombol[0];
  cek('tombol "Semua Hari" aktif (chip-on)', String(semua.props.className).includes('chip-on'));
  cek('semua tombol hari aktif saat mode "semua"', [1, 2, 3, 4, 5, 6].every((i) => String(tombol[i].props.className).includes('chip-on')));
}

// 2) Klik hari "Selasa" dari kondisi kosong (semua) -> melepas Selasa.
{
  let hasil: unknown = 'BELUM';
  const tombol = render([], (v) => (hasil = v));
  const selasa = tombol[2]; // [0]=Semua, [1]=Senin, [2]=Selasa
  cek('punya onClick', typeof selasa.props.onClick === 'function');
  (selasa.props.onClick as () => void)();
  cek('klik dari "semua" melepas Selasa -> [0,2,3,4,5]', JSON.stringify(hasil) === JSON.stringify([0, 2, 3, 4, 5]));
}

// 3) Klik hari yang belum ada -> ditambahkan (imutabel).
{
  let hasil: unknown = 'BELUM';
  const tombol = render([0, 1], (v) => (hasil = v));
  const rabu = tombol[3];
  (rabu.props.onClick as () => void)();
  cek('menambah Rabu -> [0,1,2]', JSON.stringify(hasil) === JSON.stringify([0, 1, 2]));
}

// 4) Klik hari yang sudah ada -> dihapus.
{
  let hasil: unknown = 'BELUM';
  const tombol = render([0, 1, 2], (v) => (hasil = v));
  const selasa = tombol[2];
  (selasa.props.onClick as () => void)();
  cek('toggling Selasa -> [0,2]', JSON.stringify(hasil) === JSON.stringify([0, 2]));
}

// 5) Klik "Semua Hari" -> [].
{
  let hasil: unknown = 'BELUM';
  const tombol = render([0, 2], (v) => (hasil = v));
  (tombol[0].props.onClick as () => void)();
  cek('klik "Semua Hari" -> []', JSON.stringify(hasil) === JSON.stringify([]));
}

// 6) Cek visual chip-on saat sebagian hari dipilih.
{
  const tombol = render([0, 1], () => {});
  cek('hari terpilih chip-on', String(tombol[1].props.className).includes('chip-on'));
  cek('hari tak terpilih tidak chip-on', !String(tombol[3].props.className).includes('chip-on'));
  cek('"Semua Hari" tidak chip-on saat sebagian', !String(tombol[0].props.className).includes('chip-on'));
}

// 7) Bila semua hari ditambahkan satu per satu, hasil akhirnya [] (= semua).
{
  let hasil: unknown = [];
  const semuaIdx = [0, 1, 2, 3, 4, 5];
  for (const i of semuaIdx) {
    const tombol = render(hasil as number[], (v) => (hasil = v));
    (tombol[i + 1].props.onClick as () => void)();
  }
  cek('memilih seluruh hari -> [] (semua)', JSON.stringify(hasil) === JSON.stringify([]));
}

console.log(gagal === 0 ? '\nUJI FORM HARI LULUS ✅' : `\nUJI FORM HARI GAGAL ❌ (${gagal})`);
process.exit(gagal === 0 ? 0 : 1);
