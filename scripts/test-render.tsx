// Uji render seluruh rute (react-dom/server) untuk menangkap error runtime.
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ProjectProvider } from '../src/store';
import App from '../src/App';

const rute = [
  '/',
  '/guru',
  '/kelas',
  '/siswa',
  '/mapel',
  '/ruang',
  '/jam',
  '/kebutuhan',
  '/batasan',
  '/generate',
  '/jadwal',
  '/konflik',
  '/berkas',
  '/publikasi',
];

let gagal = 0;
for (const r of rute) {
  try {
    const html = renderToString(
      <ProjectProvider>
        <MemoryRouter initialEntries={[r]}>
          <App />
        </MemoryRouter>
      </ProjectProvider>,
    );
    if (html.length < 300) throw new Error(`terlalu pendek (${html.length} char)`);
    console.log(`OK  ${r.padEnd(14)} ${html.length} char`);
  } catch (e) {
    gagal++;
    console.log(`GAGAL ${r}:`, e instanceof Error ? e.message : e);
  }
}

console.log(gagal === 0 ? '\nRENDER LULUS ✅' : `\nRENDER GAGAL ❌ (${gagal})`);
process.exit(gagal === 0 ? 0 : 1);
