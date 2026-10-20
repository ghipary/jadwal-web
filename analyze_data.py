import pandas as pd
xls = pd.ExcelFile('jadwal-web/DATA JADWAL ACUAN/data-jadwal-s_m_a_w_a_h_i_d_i_y_a_h-2026-10-20.xlsx')
df_keb = pd.read_excel(xls, sheet_name='Kebutuhan Jam')
df_guru = pd.read_excel(xls, sheet_name='Guru')

# Total hours per teacher
print('=== Total Hours per Teacher (from Kebutuhan Jam) ===')
teacher_hours = df_keb.groupby('guruId')['jumlahJam'].sum().sort_values(ascending=False)
for gid, hrs in teacher_hours.items():
    guru_name = df_guru[df_guru['kode']==gid]['nama'].values
    maxjam = df_guru[df_guru['kode']==gid]['maxJam'].values
    maxhari = df_guru[df_guru['kode']==gid]['maxPerHari'].values
    name = guru_name[0] if len(guru_name)>0 else "?"
    mj = maxjam[0] if len(maxjam)>0 else "?"
    mh = maxhari[0] if len(maxhari)>0 else "?"
    print(f'  Guru {gid} ({name}): {hrs} jam (maxJam={mj}, maxPerHari={mh})')

print()
print('=== Total Hours per Class ===')
class_hours = df_keb.groupby('kelasId')['jumlahJam'].sum().sort_values(ascending=False)
for cid, hrs in class_hours.items():
    print(f'  {cid}: {hrs} jam')

print()
print('=== Total Hours per Subject ===')
subj_hours = df_keb.groupby('mapelId')['jumlahJam'].sum().sort_values(ascending=False)
for sid, hrs in subj_hours.items():
    print(f'  {sid}: {hrs} jam')