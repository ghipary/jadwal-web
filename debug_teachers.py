"""
Debug teacher availability vs requirements
"""
import pandas as pd

xls = pd.ExcelFile('jadwal-web/DATA JADWAL ACUAN/data-jadwal-s_m_a_w_a_h_i_d_i_y_a_h-2026-10-20_FIXED2.xlsx')
df_guru = pd.read_excel(xls, sheet_name='Guru')
df_keb = pd.read_excel(xls, sheet_name='Kebutuhan Jam')

hari_list = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
hari_max_jp = {'Senin': 7, 'Selasa': 8, 'Rabu': 8, 'Kamis': 8, 'Jumat': 5, 'Sabtu': 8}

def parse_slot_list(slot_str):
    if pd.isna(slot_str) or str(slot_str).strip().lower() == 'nan':
        return set()
    result = set()
    parts = [p.strip() for p in str(slot_str).split(';')]
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if part in hari_list:
            for p in range(1, hari_max_jp[part] + 1):
                result.add((part, p))
        elif ' ' in part and part.split(' ')[0] in hari_list:
            day_part, period_part = part.split(' ', 1)
            day_part = day_part.strip()
            period_part = period_part.strip().upper()
            if period_part.startswith('J') and period_part[1:].isdigit():
                p = int(period_part[1:])
                if 1 <= p <= hari_max_jp[day_part]:
                    result.add((day_part, p))
            elif period_part == 'PAGI':
                for p in range(1, min(5, hari_max_jp[day_part] + 1)):
                    result.add((day_part, p))
    return result

teachers = {}
for _, row in df_guru.iterrows():
    kode = int(row['kode'])
    nama = row['nama']
    maxJam = int(row['maxJam']) if pd.notna(row['maxJam']) else 0
    maxPerHari = int(row['maxPerHari']) if pd.notna(row['maxPerHari']) else 8
    diinginkan = parse_slot_list(row['slotDiinginkan'])
    dilarang = parse_slot_list(row['slotDilarang'])
    if diinginkan:
        allowed = diinginkan - dilarang
    else:
        all_slots = set((d, p) for d in hari_list for p in range(1, hari_max_jp[d]+1))
        allowed = all_slots - dilarang
    teachers[kode] = {
        'nama': nama,
        'maxJam': maxJam,
        'maxPerHari': maxPerHari,
        'allowed_slots': allowed,
        'allowed_days': set(d for d, p in allowed),
    }

# Requirements per teacher
reqs_by_guru = {}
for idx, row in df_keb.iterrows():
    guru = int(row['guruId'])
    if guru not in reqs_by_guru:
        reqs_by_guru[guru] = []
    reqs_by_guru[guru].append({
        'kelas': row['kelasId'],
        'mapel': row['mapelId'],
        'jumlah': int(row['jumlahJam']),
        'pola': str(row['polaJP']) if pd.notna(row['polaJP']) else ''
    })

print("=== TEACHER CAPACITY ANALYSIS ===")
for guru in sorted(reqs_by_guru.keys()):
    t = teachers[guru]
    reqs = reqs_by_guru[guru]
    total_jam = sum(r['jumlah'] for r in reqs)
    num_blocks = sum(len([int(x) for x in str(r['pola']).split(';') if x.strip().isdigit()]) if r['pola'] else r['jumlah'] for r in reqs)
    
    print(f"\nGuru {guru} ({t['nama']}):")
    print(f"  Kebutuhan: {total_jam} jam, {len(reqs)} mapel, ~{num_blocks} blok")
    print(f"  MaxJam: {t['maxJam']}, MaxPerHari: {t['maxPerHari']}")
    print(f"  Hari tersedia: {sorted(t['allowed_days'])} ({len(t['allowed_days'])} hari)")
    print(f"  Slot tersedia: {len(t['allowed_slots'])}")
    
    # Max possible per day
    max_per_day_possible = 0
    for day in t['allowed_days']:
        day_slots = sum(1 for d, p in t['allowed_slots'] if d == day)
        max_per_day_possible += min(t['maxPerHari'], day_slots)
    
    print(f"  Max possible (day limits): {max_per_day_possible}")
    
    if total_jam > t['maxJam']:
        print(f"  [EXCEEDS MAXJAM]: {total_jam} > {t['maxJam']}")
    if total_jam > max_per_day_possible:
        print(f"  [EXCEEDS DAY LIMITS]: {total_jam} > {max_per_day_possible}")
    if len(t['allowed_days']) == 0:
        print(f"  [NO ALLOWED DAYS]!")
    
    for r in reqs:
        print(f"    {r['kelas']} {r['mapel']}: {r['jumlah']} jam, pola={r['pola']}")