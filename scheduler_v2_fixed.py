"""
Scheduler v2 - Mengikuti format Excel asli:
- JP, Istirahat, Apel, Sholat Dzuhur, Upacara = fixed positions
- Block scheduling (polaJP): 3 jam = 3 JP berurutan, 4 jam = 4 JP berurutan, dll
- Hanya periode tipe "Pelajaran" yang diisi
"""

import json
import pandas as pd
from collections import defaultdict
import random
import string
import hashlib
from ortools.sat.python import cp_model

# ============================================================
# 1. LOAD FIXED DATA
# ============================================================
print("Loading FIXED data...", flush=True)
xls = pd.ExcelFile('jadwal-web/DATA JADWAL ACUAN/data-jadwal-s_m_a_w_a_h_i_d_i_y_a_h-2026-10-20_FIXED2.xlsx')
df_hari = pd.read_excel(xls, sheet_name='Hari')
df_guru = pd.read_excel(xls, sheet_name='Guru')
df_kelas = pd.read_excel(xls, sheet_name='Kelas')
df_siswa = pd.read_excel(xls, sheet_name='Siswa')
df_mapel = pd.read_excel(xls, sheet_name='Mata Pelajaran')
df_ruang = pd.read_excel(xls, sheet_name='Ruang')
df_periode = pd.read_excel(xls, sheet_name='Jam Pelajaran')
df_keb = pd.read_excel(xls, sheet_name='Kebutuhan Jam')
df_blokir = pd.read_excel(xls, sheet_name='Batasan')

# ============================================================
# 2. BUILD PERIOD STRUCTURE PER HARI (dari Excel asli)
# ============================================================
hari_list = df_hari['nama'].tolist()
hari_max_jp = dict(zip(df_hari['nama'], df_hari['maksJP']))

# Parse hariAktif for each period
def parse_hari_aktif(val):
    if pd.isna(val) or str(val).strip() == '':
        return list(range(len(hari_list)))  # all days
    result = []
    for part in str(val).split(';'):
        part = part.strip()
        if part in hari_list:
            result.append(hari_list.index(part))
    return result

# Build periods per day: only "Pelajaran" types are schedulable
# Others (Istirahat, Apel, Kustom, Sholat) are FIXED blocks
periods_by_day = {day: [] for day in hari_list}
fixed_blocks_by_day = {day: [] for day in hari_list}  # (start_idx, end_idx, name, type)

for _, row in df_periode.iterrows():
    p_name = row['nama']
    p_mulai = str(row['mulai'])
    p_selesai = str(row['selesai'])
    p_tipe = str(row['tipe'])
    p_tipeKet = str(row['tipeKet']) if pd.notna(row['tipeKet']) else ''
    p_hari_aktif = parse_hari_aktif(row['hariAktif'])
    
    for day_idx in p_hari_aktif:
        day = hari_list[day_idx]
        # Case-insensitive check for "pelajaran"
        if str(p_tipe).strip().lower() == 'pelajaran':
            periods_by_day[day].append({
                'name': p_name,
                'mulai': p_mulai,
                'selesai': p_selesai,
                'index': len(periods_by_day[day])  # 0-based index within day
            })
        else:
            # Fixed block - will be placed at specific position
            fixed_blocks_by_day[day].append({
                'name': p_name,
                'mulai': p_mulai,
                'selesai': p_selesai,
                'tipe': p_tipe,
                'tipeKet': p_tipeKet
            })

print("\n=== STRUKTUR PER HARI (dari Excel) ===")
for day in hari_list:
    pelajaran = [p['name'] for p in periods_by_day[day]]
    fixed = [f"{b['name']}({b['tipe']})" for b in fixed_blocks_by_day[day]]
    print(f"{day}: Pelajaran={pelajaran} | Fixed={fixed}")

# ============================================================
# 3. PARSE TEACHER CONSTRAINTS
# ============================================================
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
            for p_idx in range(len(periods_by_day[part])):
                result.add((part, p_idx))
        elif ' ' in part and part.split(' ')[0] in hari_list:
            day_part, period_part = part.split(' ', 1)
            day_part = day_part.strip()
            period_part = period_part.strip().upper()
            if period_part.startswith('J') and period_part[1:].isdigit():
                # Find period index by name
                p_name = f"J{period_part[1:]}"
                for idx, p in enumerate(periods_by_day[day_part]):
                    if p['name'] == p_name:
                        result.add((day_part, idx))
                        break
            elif period_part == 'PAGI':
                for idx, p in enumerate(periods_by_day[day_part]):
                    if idx < 4:  # first 4 periods
                        result.add((day_part, idx))
    return result

teachers = {}
teacher_dilarang = {}
teacher_diinginkan = {}
for _, row in df_guru.iterrows():
    kode = int(row['kode'])
    nama = row['nama']
    mapelIds = [m.strip() for m in str(row['mapelIds']).split(',')] if pd.notna(row['mapelIds']) else []
    maxJam = int(row['maxJam']) if pd.notna(row['maxJam']) else 0
    maxPerHari = int(row['maxPerHari']) if pd.notna(row['maxPerHari']) else 8
    catatan = row['catatan'] if pd.notna(row['catatan']) else ''
    
    diinginkan = parse_slot_list(row['slotDiinginkan'])
    dilarang = parse_slot_list(row['slotDilarang'])
    
    teachers[kode] = {
        'nama': nama,
        'mapelIds': mapelIds,
        'maxJam': maxJam,
        'maxPerHari': maxPerHari,
        'catatan': catatan,
    }
    teacher_dilarang[kode] = dilarang
    teacher_diinginkan[kode] = diinginkan

# ============================================================
# 4. PARSE REQUIREMENTS WITH BLOCK SCHEDULING
# ============================================================
requirements = []
for idx, row in df_keb.iterrows():
    req_id = idx
    kelas = row['kelasId']
    mapel = row['mapelId']
    guru = int(row['guruId'])
    jumlah = int(row['jumlahJam'])
    pola_raw = str(row['polaJP']) if pd.notna(row['polaJP']) else ''
    
    # Parse polaJP: "3" = [3], "2,1" = [2,1], "3;2" = [3,2], "1;1;1" = [1,1,1]
    def parse_pola(p):
        if not p or p.lower() == 'nan':
            return [1] * jumlah  # default: all singles
        # Split by both comma and semicolon
        import re
        parts = re.split(r'[;,]', str(p))
        return [int(x.strip()) for x in parts if x.strip().isdigit()]
    
    blocks = parse_pola(pola_raw)
    # Validate: sum blocks should equal jumlah
    if sum(blocks) != jumlah:
        # Adjust: if blocks don't sum to jumlah, use simple blocks
        print(f"  Warning: {kelas} {mapel} polaJP={pola_raw} sum={sum(blocks)} != jumlah={jumlah}, using default")
        blocks = [1] * jumlah
    
    requirements.append({
        'req_id': req_id,
        'kelas': kelas,
        'mapel': mapel,
        'guru': guru,
        'jumlah': jumlah,
        'blocks': blocks  # list of block sizes
    })

# ============================================================
# 5. BUILD SLOTS FOR CP-SAT
# ============================================================
# Each slot = (day, period_index) where period_index is index in periods_by_day[day]
# Only "Pelajaran" periods are slots
all_slots = []
slot_to_idx = {}
idx = 0
for day in hari_list:
    for p_idx, p in enumerate(periods_by_day[day]):
        all_slots.append((day, p_idx))
        slot_to_idx[(day, p_idx)] = idx
        idx += 1

NUM_SLOTS = len(all_slots)
print(f"\nTotal schedulable slots: {NUM_SLOTS}")

# Map (day, period_name) -> slot_index for constraints
period_name_to_idx = {}
for day in hari_list:
    for p_idx, p in enumerate(periods_by_day[day]):
        period_name_to_idx[(day, p['name'])] = p_idx

# ============================================================
# 6. CP-SAT MODEL WITH BLOCK SCHEDULING
# ============================================================
model = cp_model.CpModel()

# For each requirement, we need to place its blocks
# A block of size N = N consecutive periods on the SAME DAY

# Variables: for each requirement, each possible block placement
# block_vars[req_id][block_idx][day][start_period] = 1 if block placed here
block_vars = {}

# DEBUG: Track which blocks have no valid placement
blocks_with_no_placement = []

for req in requirements:
    req_id = req['req_id']
    blocks = req['blocks']
    guru = req['guru']
    kelas = req['kelas']
    mapel = req['mapel']
    allowed_slots = set()
    for (day, p_idx) in all_slots:
        if (day, p_idx) not in teacher_dilarang[guru]:
            allowed_slots.add((day, p_idx))
    
    block_vars[req_id] = []
    for block_idx, block_size in enumerate(blocks):
        day_vars = {}
        for day in hari_list:
            day_slots = [p_idx for p_idx in range(len(periods_by_day[day])) if (day, p_idx) in allowed_slots]
            # Find all valid consecutive sequences of length block_size
            for start_idx in range(len(day_slots) - block_size + 1):
                seq = day_slots[start_idx:start_idx + block_size]
                # Check if consecutive in actual period indices
                consecutive = True
                for i in range(1, len(seq)):
                    if seq[i] != seq[i-1] + 1:
                        consecutive = False
                        break
                if consecutive:
                    var = model.NewBoolVar(f"b_{req_id}_{block_idx}_{day}_{seq[0]}")
                    day_vars[(day, seq[0])] = var
        if not day_vars:
            blocks_with_no_placement.append(f"{kelas} {mapel} (G{guru}) block#{block_idx} size={block_size}")
        block_vars[req_id].append(day_vars)

if blocks_with_no_placement:
    print("\n=== BLOCKS WITH NO VALID PLACEMENT ===")
    for b in blocks_with_no_placement:
        print(f"  {b}")
    print("These will cause INFEASIBLE!")

print(f"Block variables created")

# Constraint 1: Each block must be placed exactly once
for req in requirements:
    req_id = req['req_id']
    for block_idx, day_vars in enumerate(block_vars[req_id]):
        if day_vars:
            model.Add(sum(day_vars.values()) == 1)
        else:
            # No valid placement for this block - should not happen
            pass

# Constraint 2: No class conflict (same class, same day, overlapping periods)
for day in hari_list:
    day_periods = len(periods_by_day[day])
    for p_idx in range(day_periods):
        # Find all blocks covering this period
        covering = []
        for req in requirements:
            req_id = req['req_id']
            kelas = req['kelas']
            for block_idx, day_vars in enumerate(block_vars[req_id]):
                for (d, start), var in day_vars.items():
                    if d == day:
                        block_size = req['blocks'][block_idx]
                        if start <= p_idx < start + block_size:
                            covering.append(var)
        if len(covering) > 1:
            model.Add(sum(covering) <= 1)

# Constraint 3: No teacher conflict
for day in hari_list:
    day_periods = len(periods_by_day[day])
    for p_idx in range(day_periods):
        covering = []
        for req in requirements:
            req_id = req['req_id']
            guru = req['guru']
            for block_idx, day_vars in enumerate(block_vars[req_id]):
                for (d, start), var in day_vars.items():
                    if d == day:
                        block_size = req['blocks'][block_idx]
                        if start <= p_idx < start + block_size:
                            covering.append(var)
        if len(covering) > 1:
            model.Add(sum(covering) <= 1)

# Constraint 4: Teacher max per day
for guru in set(r['guru'] for r in requirements):
    max_day = teachers[guru]['maxPerHari']
    for day in hari_list:
        day_load = []
        for req in requirements:
            if req['guru'] != guru:
                continue
            req_id = req['req_id']
            for block_idx, day_vars in enumerate(block_vars[req_id]):
                for (d, start), var in day_vars.items():
                    if d == day:
                        block_size = req['blocks'][block_idx]
                        day_load.append(block_size * var)
        if day_load:
            model.Add(sum(day_load) <= max_day)

# Constraint 5: Teacher max per week
for guru in set(r['guru'] for r in requirements):
    max_week = teachers[guru]['maxJam']
    if max_week > 0:
        week_load = []
        for req in requirements:
            if req['guru'] != guru:
                continue
            req_id = req['req_id']
            for block_idx, day_vars in enumerate(block_vars[req_id]):
                for (d, start), var in day_vars.items():
                    block_size = req['blocks'][block_idx]
                    week_load.append(block_size * var)
        if week_load:
            model.Add(sum(week_load) <= max_week)

# Constraint 6: Preferred slots (soft)
penalty_vars = []
penalty_weights = []

for req in requirements:
    req_id = req['req_id']
    guru = req['guru']
    preferred = teacher_diinginkan[guru]
    for block_idx, day_vars in enumerate(block_vars[req_id]):
        for (day, start), var in day_vars.items():
            block_size = req['blocks'][block_idx]
            # Check if any period in this block is NOT preferred
            non_pref = 0
            for p_idx in range(start, start + block_size):
                if (day, p_idx) not in preferred:
                    non_pref += 1
            if non_pref > 0:
                # Add penalty for each non-preferred period
                for _ in range(non_pref):
                    penalty_vars.append(var)
                    penalty_weights.append(1)

# Objective: minimize preference violations
if penalty_vars:
    model.Minimize(sum(w * v for w, v in zip(penalty_weights, penalty_vars)))
else:
    model.Minimize(0)

# ============================================================
# 7. SOLVE
# ============================================================
print("\nSolving...")
solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = 120
solver.parameters.num_search_workers = 8
solver.parameters.log_search_progress = True

status = solver.Solve(model)
print(f"\nStatus: {solver.StatusName(status)}")

if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
    print("FAILED!")
    exit(1)

# ============================================================
# 8. EXTRACT SCHEDULE
# ============================================================
schedule = defaultdict(lambda: defaultdict(dict))  # kelas -> day -> period_idx -> (mapel, guru, block_id)

for req in requirements:
    req_id = req['req_id']
    kelas = req['kelas']
    mapel = req['mapel']
    guru = req['guru']
    for block_idx, day_vars in enumerate(block_vars[req_id]):
        for (day, start), var in day_vars.items():
            if solver.Value(var) == 1:
                block_size = req['blocks'][block_idx]
                block_id = f"{req_id}_{block_idx}"
                for p_idx in range(start, start + block_size):
                    schedule[kelas][day][p_idx] = (mapel, guru, block_id)

# ============================================================
# 9. VERIFY & PRINT
# ============================================================
print("\n=== JADWAL HASIL ===")
for kelas in sorted(schedule.keys()):
    print(f"\n--- {kelas} ---")
    for day in hari_list:
        periods = periods_by_day[day]
        row = []
        for p_idx, p in enumerate(periods):
            if p_idx in schedule[kelas][day]:
                mapel, guru, block_id = schedule[kelas][day][p_idx]
                row.append(f"{p['name']}: {mapel}(G{guru})")
            else:
                row.append(f"{p['name']}: ---")
        print(f"  {day}: {' | '.join(row)}")

# Verify class hours
print("\n=== VERIFIKASI JAM PER KELAS ===")
for kelas in sorted(schedule.keys()):
    total = sum(len(schedule[kelas][day]) for day in hari_list)
    print(f"  {kelas}: {total} jam")

# Verify teacher loads
print("\n=== BEBAN GURU ===")
guru_load = defaultdict(int)
for req in requirements:
    req_id = req['req_id']
    guru = req['guru']
    for block_idx, day_vars in enumerate(block_vars[req_id]):
        for (day, start), var in day_vars.items():
            if solver.Value(var) == 1:
                guru_load[guru] += req['blocks'][block_idx]

for guru in sorted(guru_load.keys()):
    t = teachers[guru]
    print(f"  Guru {guru} ({t['nama']}): {guru_load[guru]}/{t['maxJam']} jam")

# ============================================================
# 10. BUILD WEB APP JSON
# ============================================================
def uid(prefix=''):
    return prefix + ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))

guru_id_map = {str(int(row['kode'])): uid('g') for _, row in df_guru.iterrows() if pd.notna(row['kode'])}
kelas_id_map = {row['nama']: uid('k') for _, row in df_kelas.iterrows()}
mapel_id_map = {row['kode']: uid('m') for _, row in df_mapel.iterrows()}
ruang_id_map = {row['nama']: uid('r') for _, row in df_ruang.iterrows()}

# Period IDs for web app
periode_id_map = {}
for day_idx, day in enumerate(hari_list):
    for p_idx, p in enumerate(periods_by_day[day]):
        periode_id_map[(day_idx, p_idx)] = f"p{day_idx}_{p_idx}"

# Convert teacher slots to web format (day_idx#period_id)
def convert_slots_web(slot_str):
    if pd.isna(slot_str) or str(slot_str).strip().lower() == 'nan':
        return []
    result = []
    parts = [p.strip() for p in str(slot_str).split(';')]
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if part in hari_list:
            day_idx = hari_list.index(part)
            for p_idx in range(len(periods_by_day[part])):
                pid = periode_id_map.get((day_idx, p_idx))
                if pid:
                    result.append(f"{day_idx}#{pid}")
        elif ' ' in part and part.split(' ')[0] in hari_list:
            day_part, period_part = part.split(' ', 1)
            day_part = day_part.strip()
            day_idx = hari_list.index(day_part)
            period_part = period_part.strip().upper()
            if period_part.startswith('J') and period_part[1:].isdigit():
                p_name = f"J{period_part[1:]}"
                for p_idx, p in enumerate(periods_by_day[day_part]):
                    if p['name'] == p_name:
                        pid = periode_id_map.get((day_idx, p_idx))
                        if pid:
                            result.append(f"{day_idx}#{pid}")
                        break
            elif period_part == 'PAGI':
                for p_idx in range(min(4, len(periods_by_day[day_part]))):
                    pid = periode_id_map.get((day_idx, p_idx))
                    if pid:
                        result.append(f"{day_idx}#{pid}")
    return result

def parse_pola_arr(pola_str):
    if pd.isna(pola_str) or str(pola_str).strip().lower() == 'nan':
        return []
    import re
    parts = re.split(r'[;,]', str(pola_str))
    return [int(x.strip()) for x in parts if x.strip().isdigit()]

PALET_GURU = ['#4f46e5', '#0ea5e9', '#f59e0b', '#ec4899', '#8b5cf6', '#10b981',
              '#ef4444', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#a855f7']

# Guru
guru_list = []
for _, row in df_guru.iterrows():
    old_id = str(int(row['kode'])) if pd.notna(row['kode']) else ''
    new_id = guru_id_map[old_id]
    diinginkan_raw = row['slotDiinginkan'] if pd.notna(row['slotDiinginkan']) else ''
    dilarang_raw = row['slotDilarang'] if pd.notna(row['slotDilarang']) else ''
    pola_raw = row['polaJP'] if pd.notna(row['polaJP']) else ''
    
    slot_diinginkan = convert_slots_web(diinginkan_raw)
    slot_dilarang = convert_slots_web(dilarang_raw)
    
    mapel_ids_raw = str(row['mapelIds']) if pd.notna(row['mapelIds']) else ''
    mapel_ids = [mapel_id_map[m.strip()] for m in mapel_ids_raw.split(',') if m.strip() in mapel_id_map]
    
    color_hash = int(hashlib.md5(old_id.encode()).hexdigest(), 16)
    warna = PALET_GURU[color_hash % len(PALET_GURU)]
    
    guru_list.append({
        'id': new_id, 'nama': row['nama'], 'kode': old_id,
        'warna': warna, 'mapelIds': mapel_ids,
        'maxJam': int(row['maxJam']) if pd.notna(row['maxJam']) else 0,
        'maxPerHari': int(row['maxPerHari']) if pd.notna(row['maxPerHari']) else 8,
        'slotDiinginkan': slot_diinginkan, 'slotDilarang': slot_dilarang,
        'polaJP': parse_pola_arr(pola_raw),
        'catatan': str(row['catatan']) if pd.notna(row['catatan']) else ''
    })

# Kelas
kelas_list = []
for _, row in df_kelas.iterrows():
    new_id = kelas_id_map[row['nama']]
    kelas_list.append({
        'id': new_id, 'nama': row['nama'], 'tingkat': row['tingkat'],
        'waliKelasId': '', 'jumlahSiswa': int(row['jumlahSiswa'])
    })

# Siswa
siswa_list = []
for _, row in df_siswa.iterrows():
    if pd.notna(row['nama']):
        kelas_id = kelas_id_map.get(row['kelasId'], '')
        if kelas_id:
            siswa_list.append({'id': uid('s'), 'nama': row['nama'], 'kelasId': kelas_id, 'pilihan': []})

# Mapel
mapel_list = []
for _, row in df_mapel.iterrows():
    new_id = mapel_id_map[row['kode']]
    mapel_list.append({'id': new_id, 'nama': row['nama'], 'kode': row['kode'], 'tipeRuang': 'reguler', 'pilihan': False})

# Ruang
ruang_list = []
for _, row in df_ruang.iterrows():
    new_id = ruang_id_map[row['nama']]
    ruang_list.append({'id': new_id, 'nama': row['nama'], 'kapasitas': int(row['kapasitas']), 'tipe': 'reguler'})

# Periode for web app (include ALL periods: pelajaran + fixed)
# Web app needs all periods to render grid correctly
periode_list = []
# Add fixed blocks first (Upacara, Apel, Istirahat, Sholat)
for day_idx, day in enumerate(hari_list):
    # Sort all periods by time
    all_day_periods = []
    
    # Add pelajaran
    for p_idx, p in enumerate(periods_by_day[day]):
        all_day_periods.append((p['mulai'], p['selesai'], 'pelajaran', p['name'], '', p_idx, None))
    
    # Add fixed blocks
    for fb in fixed_blocks_by_day[day]:
        all_day_periods.append((fb['mulai'], fb['selesai'], fb['tipe'], fb['name'], fb.get('tipeKet', ''), -1, fb))
    
    # Sort by mulai time
    all_day_periods.sort(key=lambda x: x[0])
    
    for item in all_day_periods:
        mulai, selesai, tipe, nama, tipeKet, p_idx, fb = item
        pid = f"p{day_idx}_{len([x for x in periode_list if x['id'].startswith(f'p{day_idx}_')])}"
        periode_list.append({
            'id': pid,
            'nama': nama,
            'mulai': str(mulai),
            'selesai': str(selesai),
            'tipe': tipe if tipe != 'nan' else 'pelajaran',
            'tipeKet': tipeKet if tipeKet != 'nan' else '',
            'hariAktif': [day_idx]
        })

# Kebutuhan
kebutuhan_list = []
for req in requirements:
    kebutuhan_list.append({
        'id': uid('kb'),
        'kelasId': kelas_id_map[req['kelas']],
        'mapelId': mapel_id_map[req['mapel']],
        'guruId': guru_id_map[str(req['guru'])],
        'ruangId': '',
        'jumlahJam': req['jumlah'],
        'polaJP': req['blocks']
    })

# Jadwal assignments
jadwal_list = []
for kelas_name in schedule:
    kelas_id = kelas_id_map[kelas_name]
    for day in hari_list:
        day_idx = hari_list.index(day)
        for p_idx, (mapel, guru, block_id) in sorted(schedule[kelas_name][day].items()):
            pid = periode_id_map.get((day_idx, p_idx))
            if pid:
                jadwal_list.append({
                    'id': uid('j'),
                    'reqId': uid('kb'),
                    'kelasId': kelas_id,
                    'mapelId': mapel_id_map[mapel],
                    'guruId': guru_id_map[str(guru)],
                    'ruangId': '',
                    'hari': day_idx,
                    'periodeId': pid,
                    'tetap': False,
                    'catatan': '',
                    'blokId': block_id
                })

# Fixed blocks as "tetap" assignments (optional - for display)
# We can add them as jadwal with tetap=true for each class
# But web app renders fixed blocks separately from periode.tipe != 'pelajaran'
# So we don't need to add them to jadwal

# Project
project = {
    'ownerId': None,
    'info': {'nama': 'SMA Wahidiyah', 'tahunAjaran': '2026/2027', 'kepalaSekolah': '', 'alamat': '', 'logo': ''},
    'hari': hari_list,
    'hariKonfig': [{'maksJP': len(periods_by_day[d]), 'slotNonAktif': []} for d in hari_list],
    'periode': periode_list,
    'guru': guru_list,
    'kelas': kelas_list,
    'siswa': siswa_list,
    'mapel': mapel_list,
    'ruang': ruang_list,
    'kebutuhan': kebutuhan_list,
    'jadwal': jadwal_list,
    'blokir': [],
    'opsi': {'percobaan': 8, 'rataHari': True, 'hindariUjung': True, 'wajibRuang': True}
}

output_file = 'jadwal-web-project.json'
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(project, f, ensure_ascii=False, indent=2)

print(f"\n[OK] JSON saved: {output_file}")
print(f"Jadwal entries: {len(jadwal_list)}")

# Verify
kelas_jam = defaultdict(int)
for j in jadwal_list:
    kelas_jam[j['kelasId']] += 1
kelas_map = {k['id']: k['nama'] for k in kelas_list}
print("\nVerifikasi jam per kelas:")
for kid, count in sorted(kelas_jam.items(), key=lambda x: kelas_map.get(x[0], '')):
    print(f"  {kelas_map.get(kid, kid)}: {count} jam")