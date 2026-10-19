// Uji khusus: render halaman /jadwal-matriks ke berkas HTML untuk inspeksi.
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { writeFileSync } from 'fs';
import { ProjectProvider } from '../src/store';
import App from '../src/App';

const html = renderToString(
  <ProjectProvider>
    <MemoryRouter initialEntries={['/jadwal-matriks']}>
      <App />
    </MemoryRouter>
  </ProjectProvider>,
);
writeFileSync('temp/matriks-preview.html', html, 'utf8');
console.log('OK ditulis temp/matriks-preview.html', html.length, 'char');
