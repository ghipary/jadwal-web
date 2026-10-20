import pandas as pd

xls = pd.ExcelFile('jadwal-web/DATA JADWAL ACUAN/data-jadwal-s_m_a_w_a_h_i_d_i_y_a_h-2026-10-20.xlsx')
df_hari = pd.read_excel(xls, sheet_name='Hari')
df_guru = pd.read_excel(xls, sheet_name='Guru')
df_kelas = pd.read_excel(xls, sheet_name='Kelas')
df_mapel = pd.read_excel(xls, sheet_name='Mata Pelajaran')
df_jam = pd.read_excel(xls, sheet_name='Jam Pelajaran')
df_keb = pd.read_excel(xls, sheet_name='Kebutuhan Jam')

print("=== HARI ===")
print(df_hari.to_string())

print("\n=== JAM PELAJARAN ===")
print(df_jam.to_string())

print("\n=== GURU DETAILS ===")
for _, row in df_guru.iterrows():
    print(f"Guru {row['kode']}: {row['nama']}")
    print(f"  mapelIds: {row['mapelIds']}")
    print(f"  maxJam: {row['maxJam']}, maxPerHari: {row['maxPerHari']}")
    print(f"  slotDiinginkan: {row['slotDiinginkan']}")
    print(f"  slotDilarang: {row['slotDilarang']}")
    print(f"  polaJP: {row['polaJP']}")
    print(f"  catatan: {row['catatan']}")
    print()