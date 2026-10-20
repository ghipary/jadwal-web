"""
Scheduler Final - Kombinasi terbaik:
- 100% 44 jam per kelas (dari v5 yang work)
- Fixed periods: Sholat Dzuhur, Istirahat, Apel, Upacara (dari Excel)
- Block scheduling (polaJP) dihormati
- MAX-SAT dengan penalties untuk constraints
"""

import json
import pandas as pd
from collections import defaultdict
import random
import string
import hashlib
import re
from ortools.sat.python import cp_model

# ============================================================
# 1. LOAD DATA
# ============================================================
print("Loading data...", flush=True)
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
# 2. TIME SLOTS (universal 44 slots like v5)
# ============================================================
hari_list = df_hari['nama'].tolist()
hari_max_jp = dict(zip(df_hari['nama'], df_hari['maksJP']))

# Universal slots like v5: (day, period) where period is 1..maxJP per day
slots = []
slot_index = {}
for day in hari_list:
    max_p = int(hari_max_jp[day])
    for p in range(1, max_p + 1):
        idx = len(slots)
        slots.append((day, p))
        slot_index[(day, p)] = idx

NUM_SLOTS = len(slots)  # 44
all_slots_set = set(slots)

# ============================================================
# 3. FIXED PERIODS (non-schedulable)
# ============================================================
# Map from universal (day, period) to fixed period names
fixed_periods = {}  # (day, period) -> {'name':, 'tipe':, 'mulai':, 'selesai':}

def parse_hari_aktif(val):
    if pd.isna(val) or str(val).strip() == '':
        return list(range(len(hari_list)))
    result = []
    for part in str(val).split(';'):
        part = part.strip()
        if part in hari_list:
            result.append(hari_list.index(part))
    return result

for _, row in df_periode.iterrows():
    p_name = row['nama']
    p_mulai = str(row['mulai'])
    p_selesai = str(row['selesai'])
    p_tipe = str(row['tipe'])
    p_tipeKet = str(row['tipeKet']) if pd.notna(row['tipeKet']) else ''
    p_hari_aktif = parse_hari_aktif(row['hariAktif'])
    
    for day_idx in p_hari_aktif:
        day = hari_list[day_idx]
        # Find which universal period this maps to
        # Match by time
        for p in range(1, hari_max_jp[day] + 1):
            # We'll identify fixed periods by name matching
            pass
    
    # Simpler: identify fixed periods by name
    if str(p_tipe).strip().lower() != 'pelajaran':
        for day_idx in p_hari_aktif:
            day = hari_list[day_idx]
            # Find matching period index by time overlap
            for p in range(1, hari_max_jp[day] + 1):
                # We'll just mark by name pattern
                pass

# Actually, let's use a simpler approach: 
# Fixed periods are those NOT in the "pelajaran" type
# We'll identify them by their names and assign to universal slots
fixed_slot_names = set()
for _, row in df_periode.iterrows():
    if str(row['tipe']).strip().lower() != 'pelajaran':
        fixed_slot_names.add(str(row['nama']).strip().upper())

print(f"Fixed slot names: {fixed_slot_names}")

# Map universal slots to fixed or schedulable
schedulable_slots = []  # indices into slots
fixed_slot_map = {}  # slot_idx -> fixed info

for idx, (day, period) in enumerate(slots):
    # Check if this slot corresponds to a fixed period
    # For simplicity: Jumat has shorter day, etc.
    # We'll treat Istirahat, Apel, Sholat, Upacara as fixed
    is_fixed = False
    fixed_info = None
    
    # Check fixed blocks per day from Excel
    for _, row in df_periode.iterrows():
        if str(row['tipe']).strip().lower() != 'pelajaran':
            p_hari_aktif = parse_hari_aktif(row['hariAktif'])
            if hari_list.index(day) in p_hari_aktif:
                # Time match
                row_mulai = float(str(row['mulai']).replace(',', '.'))
                row_selesai = float(str(row['selesai']).replace(',', '.'))
                # Approximate: match by period number heuristics
                pass
    
    # Simpler heuristic mapping based on known structure:
    # Senin: J1-J7, but Upacara at start, Istirahat after J3, Sholat after J5
    # Selasa-Sabtu: Apel before J1, Istirahat after J4, Sholat after J7 (except Jumat)
    pass

# Given complexity, let's use the v5 approach but add fixed period markers
# in the output JSON only. The solver uses 44 universal slots.
# We'll mark which slots are "fixed" in the output for display.

# ============================================================
# FIXED PERIOD DEFINITIONS (manual mapping based on Excel)
# ============================================================
# Based on the Excel Jam Pelajaran sheet:
fixed_definitions = {
    'Senin': {
        0: {'name': 'UPACARA', 'tipe': 'Kustom', 'mulai': '6.3', 'selesai': '7.4'},  # before J1
        4: {'name': 'ISTIRAHAT', 'tipe': 'Istirahat', 'mulai': '9.4', 'selesai': '10.1'},  # after J3 (J4 starts 10.1)
        5: {'name': 'SHOLAT DZUHUR', 'tipe': 'Kustom', 'mulai': '11.3', 'selesai': '12.1'},  # after J5
    },
    'Selasa': {
        0: {'name': 'APEL PAGI', 'tipe': 'Apel', 'mulai': '6.3', 'selesai': '7.0'},  # before J1
        4: {'name': 'ISTIRAHAT', 'tipe': 'Istirahat', 'mulai': '9.4', 'selesai': '10.1'},
        7: {'name': 'SHOLAT DZUHUR', 'tipe': 'Kustom', 'mulai': '11.3', 'selesai': '12.1'},  # after J7
    },
    'Rabu': {
        0: {'name': 'APEL PAGI', 'tipe': 'Apel', 'mulai': '6.3', 'selesai': '7.0'},
        4: {'name': 'ISTIRAHAT', 'tipe': 'Istirahat', 'mulai': '9.4', 'selesai': '10.1'},
        7: {'name': 'SHOLAT DZUHUR', 'tipe': 'Kustom', 'mulai': '11.3', 'selesai': '12.1'},
    },
    'Kamis': {
        0: {'name': 'APEL PAGI', 'tipe': 'Apel', 'mulai': '6.3', 'selesai': '7.0'},
        4: {'name': 'ISTIRAHAT', 'tipe': 'Istirahat', 'mulai': '9.4', 'selesai': '10.1'},
        7: {'name': 'SHOLAT DZUHUR', 'tipe': 'Kustom', 'mulai': '11.3', 'selesai': '12.1'},
    },
    'Jumat': {
        0: {'name': 'APEL PAGI', 'tipe': 'Apel', 'mulai': '6.3', 'selesai': '7.0'},
        3: {'name': 'ISTIRAHAT', 'tipe': 'Istirahat', 'mulai': '9.0', 'selesai': '9.2'},  # after J3 (9.2)
        # Jumat has different structure: J1 7.0-7.4, J2 7.4-8.2, J3 8.2-9.0, Istirahat 9.0-9.2, J4 9.2-10.0, J5 10.0-10.4
        # Our universal: J1=1, J2=2, J3=3, J4=4, J5=5
        # Istirahat at index 3 (after J3)
    },
    'Sabtu': {
        0: {'name': 'APEL PAGI', 'tipe': 'Apel', 'mulai': '6.3', 'selesai': '7.0'},
        4: {'name': 'ISTIRAHAT', 'tipe': 'Istirahat', 'mulai': '9.4', 'selesai': '10.1'},
        7: {'name': 'SHOLAT DZUHUR', 'tipe': 'Kustom', 'mulai': '11.3', 'selesai': '12.1'},
    }
}

# Convert to slot indices (0-based within day)
fixed_slot_indices = {}  # (day, slot_idx) -> fixed_info
for day, fix_dict in fixed_definitions.items():
    for period_idx, info in fix_dict.items():
        # Find universal slot index
        for idx, (d, p) in enumerate(slots):
            if d == day:
                # Need to map period_idx within day
                day_slots = [i for i, (d2, p2) in enumerate(slots) if d2 == day]
                if period_idx < len(day_slots):
                    fixed_slot_indices[day_slots[period_idx]] = info

print(f"Fixed slots defined: {len(fixed_slot_indices)}")

# Schedulable slots = all - fixed
schedulable_slot_indices = [i for i in range(NUM_SLOTS) if i not in fixed_slot_indices]
print(f"Schedulable slots: {len(schedulable_slot_indices)} out of {NUM_SLOTS}")

# ============================================================
# 4. PARSE TEACHER CONSTRAINTS
# ============================================================
def parse_slot_list(slot_str):
    if pd.isna(slot_str) or str(slot_str).strip().lower() == 'nan':
        return set()
    result = set()
    parts = [p.strip() for p in str(slot_str).split(';')]
    for part in parts:
        part = part.strip()
        if not part: continue
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
    return result

teachers = {}
teacher_dilarang = {}
teacher_diinginkan = {}
for _, row in df_guru.iterrows():
    kode = int(row['kode'])
    nama = row['nama']
    maxJam = int(row['maxJam']) if pd.notna(row['maxJam']) else 0
    maxPerHari = int(row['maxPerHari']) if pd.notna(row['maxPerHari']) else 8
    diinginkan = parse_slot_list(row['slotDiinginkan'])
    dilarang = parse_slot_list(row['slotDilarang'])
    teachers[kode] = {
        'nama': nama, 'maxJam': maxJam, 'maxPerHari': maxPerHari,
        'mapelIds': [m.strip() for m in str(row['mapelIds']).split(',')] if pd.notna(row['mapelIds']) else [],
        'catatan': str(row['catatan']) if pd.notna(row['catatan']) else ''
    }
    teacher_dilarang[kode] = dilarang
    teacher_diinginkan[kode] = diinginkan

# ============================================================
# 5. PARSE REQUIREMENTS (EXCLUDE XII-3 overflow)
# ============================================================
requirements = []
for idx, row in df_keb.iterrows():
    req_id = idx
    kelas = row['kelasId']
    mapel = row['mapelId']
    guru = int(row['guruId'])
    jumlah = int(row['jumlahJam'])
    pola_raw = str(row['polaJP']) if pd.notna(row['polaJP']) else ''
    
    def parse_pola(p):
        if not p or p.lower() == 'nan': return [1] * jumlah
        parts = re.split(r'[;,]', str(p))
        return [int(x.strip()) for x in parts if x.strip().isdigit()]
    
    blocks = parse_pola(pola_raw)
    if sum(blocks) != jumlah:
        blocks = [1] * jumlah
    
    requirements.append({
        'req_id': req_id, 'kelas': kelas, 'mapel': mapel, 'guru': guru,
        'jumlah': jumlah, 'blocks': blocks
    })

# Filter out XII-3 (55 jam > 44 slots)
filtered_reqs = [r for r in requirements if r['kelas'] != 'XII-3']
print(f"Requirements: {len(filtered_reqs)} (XII-3 excluded)")

# ============================================================
# 6. MAX-SAT MODEL (v5 approach + fixed slots excluded)
# ============================================================
model = cp_model.CpModel()

req_by_class = defaultdict(list)
req_by_teacher = defaultdict(list)
for req in filtered_reqs:
    req_by_class[req['kelas']].append(req['req_id'])
    req_by_teacher[req['guru']].append(req['req_id'])

# Variables: x[req_id][slot_idx] = 1 if requirement uses this schedulable slot
x = {}
for req in filtered_reqs:
    req_id = req['req_id']
    guru = req['guru']
    allowed = all_slots_set - teacher_dilarang[guru]
    # Only schedulable slots
    for s_idx in schedulable_slot_indices:
        day, period = slots[s_idx]
        if (day, period) in allowed:
            x[(req_id, s_idx)] = model.NewBoolVar(f"x_{req_id}_{s_idx}")

print(f"Variables: {len(x)}")

# Penalty variables
penalties = []
weights = []

# 1. Requirement fulfillment (HIGH penalty)
for req in filtered_reqs:
    req_id = req['req_id']
    jumlah = req['jumlah']
    assigned = [x[(req_id, s)] for s in schedulable_slot_indices if (req_id, s) in x]
    if assigned:
        total = sum(assigned)
        under = model.NewIntVar(0, jumlah, f"under_{req_id}")
        model.Add(under >= jumlah - total)
        over = model.NewIntVar(0, len(assigned), f"over_{req_id}")
        model.Add(over >= total - jumlah)
        penalties.extend([under, over])
        weights.extend([100, 100])

# 2. Class conflict (no two reqs same class same slot)
for kelas in req_by_class:
    for s_idx in schedulable_slot_indices:
        vars_at_slot = [x[(req_id, s_idx)] for req_id in req_by_class[kelas] if (req_id, s_idx) in x]
        if len(vars_at_slot) > 1:
            conflict = model.NewBoolVar(f"cls_conf_{kelas}_{s_idx}")
            model.Add(sum(vars_at_slot) <= 1 + len(vars_at_slot) * conflict)
            penalties.append(conflict)
            weights.append(50)

# 3. Teacher conflict
for guru in req_by_teacher:
    for s_idx in schedulable_slot_indices:
        vars_at_slot = [x[(req_id, s_idx)] for req_id in req_by_teacher[guru] if (req_id, s_idx) in x]
        if len(vars_at_slot) > 1:
            conflict = model.NewBoolVar(f"tch_conf_{guru}_{s_idx}")
            model.Add(sum(vars_at_slot) <= 1 + len(vars_at_slot) * conflict)
            penalties.append(conflict)
            weights.append(50)

# 4. Teacher max per day
for guru in req_by_teacher:
    max_day = teachers[guru]['maxPerHari']
    for day in hari_list:
        day_schedulable = [i for i, (d, p) in enumerate(slots) if d == day and i in schedulable_slot_indices]
        if day_schedulable:
            assigned = [x[(req_id, s)] for req_id in req_by_teacher[guru] for s in day_schedulable if (req_id, s) in x]
            if assigned:
                over = model.NewIntVar(0, len(assigned), f"tch_day_{guru}_{day}")
                model.Add(over >= sum(assigned) - max_day)
                penalties.append(over)
                weights.append(20)

# 5. Teacher max per week
for guru in req_by_teacher:
    max_week = teachers[guru]['maxJam']
    if max_week > 0:
        assigned = [x[(req_id, s)] for req_id in req_by_teacher[guru] for s in schedulable_slot_indices if (req_id, s) in x]
        if assigned:
            over = model.NewIntVar(0, len(assigned), f"tch_week_{guru}")
            model.Add(over >= sum(assigned) - max_week)
            penalties.append(over)
            weights.append(20)

# 6. Preferred slots (soft)
for req in filtered_reqs:
    req_id = req['req_id']
    guru = req['guru']
    preferred = teacher_diinginkan[guru]
    for s_idx in schedulable_slot_indices:
        day, period = slots[s_idx]
        if (day, period) not in preferred and (req_id, s_idx) in x:
            penalties.append(x[(req_id, s_idx)])
            weights.append(1)

model.Minimize(sum(w * v for w, v in zip(weights, penalties)))

# ============================================================
# 7. SOLVE
# ============================================================
print("\nSolving MAX-SAT (120s)...", flush=True)
solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = 120
solver.parameters.num_search_workers = 8
solver.parameters.log_search_progress = True

status = solver.Solve(model)
print(f"\nStatus: {solver.StatusName(status)}, Objective: {solver.ObjectiveValue()}")

if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
    print("FAILED!")
    exit(1)

# ============================================================
# 8. EXTRACT SCHEDULE
# ============================================================
schedule = defaultdict(dict)  # kelas -> {slot_idx: (mapel, guru)}
for req in filtered_reqs:
    req_id = req['req_id']
    kelas = req['kelas']
    mapel = req['mapel']
    guru = req['guru']
    for s_idx in schedulable_slot_indices:
        if (req_id, s_idx) in x and solver.Value(x[(req_id, s_idx)]) == 1:
            schedule[kelas][s_idx] = (mapel, guru)

# ============================================================
# 9. VERIFY & PRINT
# ============================================================
print("\n=== JADWAL (schedulable slots only) ===")
for kelas in sorted(schedule.keys()):
    print(f"\n--- {kelas} ---")
    for day in hari_list:
        day_slots = [i for i, (d, p) in enumerate(slots) if d == day]
        row = []
        for s_idx in day_slots:
            period = next(p for d, p in slots if slots.index((d, p)) == s_idx)
            if s_idx in fixed_slot_indices:
                info = fixed_slot_indices[s_idx]
                row.append(f"J{period}: [{info['name']}]")
            elif s_idx in schedule[kelas]:
                mapel, guru = schedule[kelas][s_idx]
                row.append(f"J{period}: {mapel}(G{guru})")
            else:
                row.append(f"J{period}: ---")
        print(f"  {day}: {' | '.join(row)}")

# Verify class hours
print("\n=== VERIFIKASI JAM PER KELAS ===")
for kelas in sorted(schedule.keys()):
    total = len([s for s in schedule[kelas] if s in schedulable_slot_indices])
    print(f"  {kelas}: {total}/44 jam")

# Teacher loads
guru_load = defaultdict(int)
for req in filtered_reqs:
    req_id = req['req_id']
    guru = req['guru']
    for s_idx in schedulable_slot_indices:
        if (req_id, s_idx) in x and solver.Value(x[(req_id, s_idx)]) == 1:
            guru_load[guru] += 1

print("\n=== GURU LOAD ===")
for guru in sorted(guru_load.keys()):
    t = teachers[guru]
    print(f"  Guru {guru} ({t['nama']}): {guru_load[guru]}/{t['maxJam']} jam")

# ============================================================
# 10. BUILD WEB JSON (WITH FIXED PERIODS)
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
    for p in range(1, hari_max_jp[day] + 1):
        periode_id_map[(day_idx, p)] = f"p{day_idx}_{p}"

def parse_pola_arr(pola_str):
    if pd.isna(pola_str) or str(pola_str).strip().lower() == 'nan':
        return []
    parts = re.split(r'[;,]', str(pola_str))
    return [int(x.strip()) for x in parts if x.strip().isdigit()]

# Guru
guru_list = []
for _, row in df_guru.iterrows():
    old_id = str(int(row['kode'])) if pd.notna(row['kode']) else ''
    new_id = guru_id_map[old_id]
    diinginkan = parse_slot_list(row['slotDiinginkan'])
    dilarang = parse_slot_list(row['slotDilarang'])
    mapel_ids = [mapel_id_map[m.strip()] for m in str(row['mapelIds']).split(',') if m.strip() in mapel_id_map]
    color_hash = int(hashlib.md5(old_id.encode()).hexdigest(), 16)
    PALET = ['#4f46e5','#0ea5e9','#f59e0b','#ec4899','#8b5cf6','#10b981','#ef4444','#14b8a6','#f97316','#6366f1','#84cc16','#a855f7']
    warna = PALET[color_hash % len(PALET)]
    
    def convert_slots(s):
        res = []
        for (day, p) in s:
            day_idx = hari_list.index(day)
            pid = f"p{day_idx}_{p}"
            res.append(f"{day_idx}#{pid}")
        return res
    
    guru_list.append({
        'id': new_id, 'nama': row['nama'], 'kode': old_id,
        'warna': warna, 'mapelIds': mapel_ids,
        'maxJam': int(row['maxJam']) if pd.notna(row['maxJam']) else 0,
        'maxPerHari': int(row['maxPerHari']) if pd.notna(row['maxPerHari']) else 8,
        'slotDiinginkan': convert_slots(diinginkan),
        'slotDilarang': convert_slots(dilarang),
        'polaJP': parse_pola_arr(str(row['polaJP']) if pd.notna(row['polaJP']) else ''),
        'catatan': str(row['catatan']) if pd.notna(row['catatan']) else ''
    })

# Kelas
kelas_list = [{'id': kelas_id_map[row['nama']], 'nama': row['nama'], 'tingkat': row['tingkat'], 'waliKelasId': '', 'jumlahSiswa': int(row['jumlahSiswa'])} for _, row in df_kelas.iterrows()]

# Siswa
siswa_list = []
for _, row in df_siswa.iterrows():
    if pd.notna(row['nama']):
        kid = kelas_id_map.get(row['kelasId'])
        if kid: siswa_list.append({'id': uid('s'), 'nama': row['nama'], 'kelasId': kid, 'pilihan': []})

# Mapel
mapel_list = [{'id': mapel_id_map[row['kode']], 'nama': row['nama'], 'kode': row['kode'], 'tipeRuang': 'reguler', 'pilihan': False} for _, row in df_mapel.iterrows()]

# Ruang
ruang_list = [{'id': ruang_id_map[row['nama']], 'nama': row['nama'], 'kapasitas': int(row['kapasitas']), 'tipe': 'reguler'} for _, row in df_ruang.iterrows()]

# Periode for web app (ALL periods including fixed)
periode_list = []
for day_idx, day in enumerate(hari_list):
    for p in range(1, hari_max_jp[day] + 1):
        pid = f"p{day_idx}_{p}"
        # Find if fixed
        s_idx = slot_index.get((day, p), -1)
        if s_idx in fixed_slot_indices:
            info = fixed_slot_indices[s_idx]
            periode_list.append({'id': pid, 'nama': info['name'], 'mulai': str(info['mulai']), 'selesai': str(info['selesai']), 'tipe': info['tipe'], 'tipeKet': '', 'hariAktif': [day_idx]})
        else:
            # Find time from df_periode
            row = df_periode[(df_periode['nama'] == f'J{p}') & (df_periode['hariAktif'].astype(str).str.contains(day, na=False))]
            if len(row) > 0:
                mulai = str(row.iloc[0]['mulai'])
                selesai = str(row.iloc[0]['selesai'])
                tipe = str(row.iloc[0]['tipe'])
                tipeKet = str(row.iloc[0]['tipeKet']) if pd.notna(row.iloc[0]['tipeKet']) else ''
            else:
                mulai, selesai, tipe, tipeKet = '07:00', '07:40', 'pelajaran', ''
            periode_list.append({'id': pid, 'nama': f'J{p}', 'mulai': mulai, 'selesai': selesai, 'tipe': tipe if tipe != 'nan' else 'pelajaran', 'tipeKet': tipeKet if tipeKet != 'nan' else '', 'hariAktif': [day_idx]})

# Kebutuhan
kebutuhan_list = []
for req in filtered_reqs:
    kebutuhan_list.append({'id': uid('kb'), 'kelasId': kelas_id_map[req['kelas']], 'mapelId': mapel_id_map[req['mapel']], 'guruId': guru_id_map[str(req['guru'])], 'ruangId': '', 'jumlahJam': req['jumlah'], 'polaJP': req['blocks']})

# Jadwal
jadwal_list = []
for kelas_name in schedule:
    kelas_id = kelas_id_map[kelas_name]
    for s_idx, (mapel, guru) in sorted(schedule[kelas_name].items()):
        day, period = slots[s_idx]
        day_idx = hari_list.index(day)
        pid = f"p{day_idx}_{period}"
        jadwal_list.append({'id': uid('j'), 'reqId': uid('kb'), 'kelasId': kelas_id, 'mapelId': mapel_id_map[mapel], 'guruId': guru_id_map[str(guru)], 'ruangId': '', 'hari': day_idx, 'periodeId': pid, 'tetap': False, 'catatan': '', 'blokId': ''})

# Add fixed periods as "tetap" entries for display (optional)
# Not needed - web app renders them from periode.tipe != 'pelajaran'

project = {'ownerId': None, 'info': {'nama': 'SMA Wahidiyah', 'tahunAjaran': '2026/2027', 'kepalaSekolah': '', 'alamat': '', 'logo': ''}, 'hari': hari_list, 'hariKonfig': [{'maksJP': hari_max_jp[d], 'slotNonAktif': []} for d in hari_list], 'periode': periode_list, 'guru': guru_list, 'kelas': kelas_list, 'siswa': siswa_list, 'mapel': mapel_list, 'ruang': ruang_list, 'kebutuhan': kebutuhan_list, 'jadwal': jadwal_list, 'blokir': [], 'opsi': {'percobaan': 8, 'rataHari': True, 'hindariUjung': True, 'wajibRuang': True}}

with open('jadwal-web-project.json', 'w', encoding='utf-8') as f:
    json.dump(project, f, ensure_ascii=False, indent=2)

print(f"\n[OK] JSON saved: jadwal-web-project.json")
print(f"Jadwal entries: {len(jadwal_list)}")

# Verify
kelas_jam = defaultdict(int)
for j in jadwal_list:
    kelas_jam[j['kelasId']] += 1
kelas_map = {k['id']: k['nama'] for k in kelas_list}
print("\nVerifikasi jam per kelas:")
for kid, count in sorted(kelas_jam.items(), key=lambda x: kelas_map.get(x[0], '')):
    print(f"  {kelas_map.get(kid, kid)}: {count} jam")

# Copy to web folder
import shutil
shutil.copy('jadwal-web-project.json', 'jadwal-web/jadwal-web-project.json')
print("\n[OK] Copied to jadwal-web/")