"""
Fix XII-3 overflow & XII-1 underload by adjusting requirements
Run: python fix_class_balance.py
"""

import pandas as pd

# Load
xls = pd.ExcelFile('jadwal-web/DATA JADWAL ACUAN/data-jadwal-s_m_a_w_a_h_i_d_i_y_a_h-2026-10-20.xlsx')
df_keb = pd.read_excel(xls, sheet_name='Kebutuhan Jam')

print("=== SEBELUM ===")
for kelas in ['XII-1', 'XII-3']:
    subset = df_keb[df_keb['kelasId'] == kelas]
    total = subset['jumlahJam'].sum()
    print(f"{kelas}: {total} jam ({len(subset)} mapel)")
    for _, r in subset.iterrows():
        print(f"  {r['mapelId']}: {r['jumlahJam']} jam (Guru {r['guruId']})")

# STRATEGY: 
# 1. XII-3: Kurangi 11 jam dari mapel dengan jam paling banyak
# 2. XII-1: Tambah 11 jam (bisa duplikasikan mapel dari XII-2/4 atau tambah mapel baru)

# Backup original
df_keb.to_excel('Kebutuhan_Jam_BACKUP.xlsx', index=False)
print("\n[OK] Backup: Kebutuhan_Jam_BACKUP.xlsx")

# === FIX XII-3: Kurangi 11 jam ===
xii3_mask = df_keb['kelasId'] == 'XII-3'
xii3_rows = df_keb[xii3_mask].copy()
# Urutkan jam descending, kurangi dari yang terbesar
xii3_rows = xii3_rows.sort_values('jumlahJam', ascending=False)

kurang = 11
for idx in xii3_rows.index:
    if kurang <= 0:
        break
    current = df_keb.at[idx, 'jumlahJam']
    if current <= 1:
        continue
    kurangi = min(kurang, current - 1)  # minimal 1 jam
    df_keb.at[idx, 'jumlahJam'] = current - kurangi
    kurang -= kurangi
    print(f"  XII-3 {df_keb.at[idx, 'mapelId']}: {current} -> {df_keb.at[idx, 'jumlahJam']} (-{kurangi})")

# === FIX XII-1: Tambah 11 jam ===
# Salin 11 jam dari XII-2 (yang mirip kurikulum)
xii2_rows = df_keb[df_keb['kelasId'] == 'XII-2'].sort_values('jumlahJam', ascending=False)
tambah = 11
for _, row in xii2_rows.iterrows():
    if tambah <= 0:
        break
    add_jam = min(tambah, row['jumlahJam'])
    # Cek apakah sudah ada mapel+guru yang sama di XII-1
    existing = df_keb[(df_keb['kelasId'] == 'XII-1') & 
                       (df_keb['mapelId'] == row['mapelId']) & 
                       (df_keb['guruId'] == row['guruId'])]
    if len(existing) > 0:
        idx = existing.index[0]
        df_keb.at[idx, 'jumlahJam'] += add_jam
        print(f"  XII-1 {row['mapelId']} (Guru {row['guruId']}): +{add_jam} -> {df_keb.at[idx, 'jumlahJam']}")
    else:
        new_row = row.copy()
        new_row['kelasId'] = 'XII-1'
        new_row['jumlahJam'] = add_jam
        new_row['id'] = len(df_keb) + 1  # dummy
        df_keb = pd.concat([df_keb, pd.DataFrame([new_row])], ignore_index=True)
        print(f"  XII-1 TAMBAH {row['mapelId']} (Guru {row['guruId']}): {add_jam} jam baru")
    tambah -= add_jam

print("\n=== SESUDAH ===")
for kelas in ['XII-1', 'XII-3']:
    subset = df_keb[df_keb['kelasId'] == kelas]
    total = subset['jumlahJam'].sum()
    print(f"{kelas}: {total} jam")

# Save
with pd.ExcelWriter('jadwal-web/DATA JADWAL ACUAN/data-jadwal-s_m_a_w_a_h_i_d_i_y_a_h-2026-10-20_FIXED.xlsx', engine='openpyxl') as writer:
    for sheet in xls.sheet_names:
        if sheet == 'Kebutuhan Jam':
            df_keb.to_excel(writer, sheet_name=sheet, index=False)
        else:
            pd.read_excel(xls, sheet_name=sheet).to_excel(writer, sheet_name=sheet, index=False)

print("\n[OK] File fixed: data-jadwal-..._FIXED.xlsx")
print("==> Ganti file asli dengan ini, lalu generate ulang jadwal-web-project.json")