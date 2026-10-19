// Data Isolation (Multi-Tenant): binding ownerId ke user_id saat login, dan filter opsional jika terhubung Supabase nanti.
// Untuk mode lokal (tanpa Supabase) tetap pakai localStorage per browser.

import { useEffect } from 'react';
import { useAuth } from './auth';
import { useProject } from '../store';

export function TenantGuard() {
  const { user } = useAuth();
  const { project, setOwnerId } = useProject();

  useEffect(() => {
    const uid = user?.id ?? null;
    if (project.ownerId !== uid) {
      setOwnerId(uid);
    }
  }, [user?.id, project.ownerId, setOwnerId]);

  return null;
}
