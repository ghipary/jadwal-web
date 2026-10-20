"""
Fix polaJP in the Excel to match jumlahJam
"""
import pandas as pd

xls = pd.ExcelFile('jadwal-web/DATA JADWAL ACUAN/data-jadwal-s_m_a_w_a_h_i_d_i_y_a_h-2026-10-20_FIXED.xlsx')
df_keb = pd.read_excel(xls, sheet_name='Kebutuhan Jam')

print("Checking polaJP vs jumlahJam mismatches:")
for idx, row in df_keb.iterrows():
    pola = str(row['polaJP']) if pd.notna(row['polaJP']) else ''
    jumlah = int(row['jumlahJam'])
    if pola and pola.lower() != 'nan':
        blocks = [int(x.strip()) for x in str(pola).split(',') if x.strip().isdigit()]
        if blocks and sum(blocks) != jumlah:
            print(f"  Row {idx}: {row['kelasId']} {row['mapelId']} - polaJP={pola} (sum={sum(blocks)}) vs jumlahJam={jumlah}")

# Fix: set polaJP to match jumlahJam (default to all 1s = no block constraint)
# Or better: if jumlah <= 2, use [jumlah]; if 3, use [2,1] or [3]; if 4, use [2,2] or [3,1] or [4]; etc.
def fix_pola(jumlah, current_pola):
    if pd.isna(current_pola) or str(current_pola).strip().lower() == 'nan':
        return ';'.join(['1'] * jumlah)  # no block, all singles
    blocks = [int(x.strip()) for x in str(current_pola).split(',') if x.strip().isdigit()]
    if blocks and sum(blocks) == jumlah:
        return current_pola  # already correct
    # Default: try to make reasonable blocks
    if jumlah == 1:
        return '1'
    elif jumlah == 2:
        return '2'
    elif jumlah == 3:
        return '2;1'
    elif jumlah == 4:
        return '2;2'
    elif jumlah == 5:
        return '3;2'
    elif jumlah == 6:
        return '3;3'
    else:
        return ';'.join(['1'] * jumlah)

df_keb['polaJP'] = df_keb.apply(lambda r: fix_pola(int(r['jumlahJam']), r['polaJP']), axis=1)

# Save
with pd.ExcelWriter('jadwal-web/DATA JADWAL ACUAN/data-jadwal-s_m_a_w_a_h_i_d_i_y_a_h-2026-10-20_FIXED2.xlsx', engine='openpyxl') as writer:
    for sheet in xls.sheet_names:
        if sheet == 'Kebutuhan Jam':
            df_keb.to_excel(writer, sheet_name=sheet, index=False)
        else:
            pd.read_excel(xls, sheet_name=sheet).to_excel(writer, sheet_name=sheet, index=False)

print("\nFixed polaJP saved to _FIXED2.xlsx")

# Verify
print("\nVerifying fixed data:")
for idx, row in df_keb.iterrows():
    pola = str(row['polaJP']) if pd.notna(row['polaJP']) else ''
    jumlah = int(row['jumlahJam'])
    if pola and pola.lower() != 'nan':
        blocks = [int(x.strip()) for x in str(pola).split(';') if x.strip().isdigit()]
        if blocks and sum(blocks) != jumlah:
            print(f"  STILL BROKEN: Row {idx}: {row['kelasId']} {row['mapelId']} - polaJP={pola} sum={sum(blocks)} vs {jumlah}")
        else:
            pass  # OK
print("All checked.")