import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './lib/auth';
import { ProjectProvider } from './store';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* AuthProvider lebih dulu: store membaca sesi untuk mengunci data per user. */}
    <AuthProvider>
      <ProjectProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </ProjectProvider>
    </AuthProvider>
  </StrictMode>,
);
