"""
MAX-SAT Scheduler with Proper Excel Period Structure
All constraints soft with penalties - finds best effort schedule
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
# 2. BUILD PERIOD STRUCTURE (from Excel)
# ============================================================
hari_list = df_hari['nama'].tolist()
hari_max_jp = dict(zip(df_hari['nama'], df_hari['maksJP']))

def parse_hari_aktif(val):
    if pd.isna(val) or str(val).strip() == '':
        return list(range(len(hari_list)))
    result = []
    for part in str(val).split(';'):
        part = part.strip()
        if part in hari_list:
            result.append(hari_list.index(part))
    return result

periods_by_day = {day: [] for day in hari_list}
fixed_blocks_by_day = {day: [] for day in hari_list}

for _, row in df_periode.iterrows():
    p_name = row['nama']
    p_mulai = str(row['mulai'])
    p_selesai = str(row['selesai'])
    p_tipe = str(row['tipe'])
    p_tipeKet = str(row['tipeKet']) if pd.notna(row['tipeKet']) else ''
    p_hari_aktif = parse_hari_aktif(row['hariAktif'])
    
    for day_idx in p_hari_aktif:
        day = hari_list[day_idx]
        if str(p_tipe).strip().lower() == 'pelajaran':
            periods_by_day[day].append({
                'name': p_name, 'mulai': p_mulai, 'selesai': p_selesai,
                'index': len(periods_by_day[day])
            })
        else:
            fixed_blocks_by_day[day].append({
                'name': p_name, 'mulai': p_mulai, 'selesai': p_selesai,
                'tipe': p_tipe, 'tipeKet': p_tipeKet
            })

print("=== STRUKTUR PER HARI ===")
for day in hari_list:
    pel = [p['name'] for p in periods_by_day[day]]
    fix = [f"{b['name']}({b['tipe']})" for b in fixed_blocks_by_day[day]]
    print(f"  {day}: Pelajaran={pel} | Fixed={fix}")

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
        if not part: continue
        if part in hari_list:
            for p_idx in range(len(periods_by_day[part])):
                result.add((part, p_idx))
        elif ' ' in part and part.split(' ')[0] in hari_list:
            day_part, period_part = part.split(' ', 1)
            day_part = day_part.strip()
            period_part = period_part.strip().upper()
            if period_part.startswith('J') and period_part[1:].isdigit():
                p_name = f"J{period_part[1:]}"
                for p_idx, p in enumerate(periods_by_day[day_part]):
                    if p['name'] == p_name:
                        result.add((day_part, p_idx))
                        break
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
# 4. PARSE REQUIREMENTS
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
        blocks = [1] * jumlah  # fallback
    
    requirements.append({
        'req_id': req_id, 'kelas': kelas, 'mapel': mapel, 'guru': guru,
        'jumlah': jumlah, 'blocks': blocks
    })

# ============================================================
# 5. BUILD SLOTS
# ============================================================
all_slots = []
slot_to_idx = {}
for day in hari_list:
    for p_idx in range(len(periods_by_day[day])):
        all_slots.append((day, p_idx))
        slot_to_idx[(day, p_idx)] = len(slot_to_idx)

NUM_SLOTS = len(all_slots)
print(f"\nTotal schedulable slots: {NUM_SLOTS}")

# ============================================================
# 6. MAX-SAT MODEL (ALL SOFT)
# ============================================================
model = cp_model.CpModel()

# x[req_id][block_idx][day][start] = 1 if block placed
x = {}
for req in requirements:
    req_id = req['req_id']
    guru = req['guru']
    blocks = req['blocks']
    allowed = set()
    for (day, p_idx) in all_slots:
        if (day, p_idx) not in teacher_dilarang[guru]:
            allowed.add((day, p_idx))
    
    for block_idx, block_size in enumerate(blocks):
        for day in hari_list:
            day_slots = [p for p in range(len(periods_by_day[day])) if (day, p) in allowed]
            for start in range(len(day_slots) - block_size + 1):
                seq = day_slots[start:start+block_size]
                if all(seq[i] == seq[i-1]+1 for i in range(1, len(seq))):
                    x[(req_id, block_idx, day, start)] = model.NewBoolVar(f"x_{req_id}_{block_idx}_{day}_{start}")

print(f"Variables: {len(x)}")

# SOFT CONSTRAINTS WITH PENALTIES
penalties = []
weights = []

# 1. Each block placed exactly once (HARD-ish but soft with high penalty)
for req in requirements:
    req_id = req['req_id']
    for block_idx in range(len(req['blocks'])):
        vars_list = [x[(req_id, block_idx, day, start)] 
                     for day in hari_list for start in range(len(periods_by_day[day]))
                     if (req_id, block_idx, day, start) in x]
        if vars_list:
            total = sum(vars_list)
            under = model.NewIntVar(0, 1, f"under_{req_id}_{block_idx}")
            model.Add(under >= 1 - total)
            over = model.NewIntVar(0, len(vars_list), f"over_{req_id}_{block_idx}")
            model.Add(over >= total - 1)
            penalties.extend([under, over])
            weights.extend([1000, 1000])

# 2. Class conflict
for day in hari_list:
    for p_idx in range(len(periods_by_day[day])):
        for kelas in df_kelas['nama'].tolist():
            covering = []
            for req in requirements:
                if req['kelas'] != kelas: continue
                req_id = req['req_id']
                for block_idx, block_size in enumerate(req['blocks']):
                    for start in range(len(periods_by_day[day]) - block_size + 1):
                        key = (req_id, block_idx, day, start)
                        if key in x:
                            covering.append(x[key])
            if len(covering) > 1:
                conflict = model.NewBoolVar(f"cls_conf_{kelas}_{day}_{p_idx}")
                model.Add(sum(covering) <= 1 + len(covering) * conflict)
                penalties.append(conflict)
                weights.append(500)

# 3. Teacher conflict
for day in hari_list:
    for p_idx in range(len(periods_by_day[day])):
        for guru in df_guru['kode'].tolist():
            covering = []
            for req in requirements:
                if req['guru'] != guru: continue
                req_id = req['req_id']
                for block_idx, block_size in enumerate(req['blocks']):
                    for start in range(len(periods_by_day[day]) - block_size + 1):
                        key = (req_id, block_idx, day, start)
                        if key in x:
                            covering.append(x[key])
            if len(covering) > 1:
                conflict = model.NewBoolVar(f"tch_conf_{guru}_{day}_{p_idx}")
                model.Add(sum(covering) <= 1 + len(covering) * conflict)
                penalties.append(conflict)
                weights.append(500)

# 4. Teacher max per day
for guru in df_guru['kode'].tolist():
    max_day = teachers[guru]['maxPerHari']
    for day in hari_list:
        day_load = []
        for req in requirements:
            if req['guru'] != guru: continue
            req_id = req['req_id']
            for block_idx, block_size in enumerate(req['blocks']):
                for start in range(len(periods_by_day[day]) - block_size + 1):
                    key = (req_id, block_idx, day, start)
                    if key in x:
                        day_load.append(block_size * x[key])
        if day_load:
            over = model.NewIntVar(0, sum(r['jumlah'] for r in requirements if r['guru']==guru), f"tch_day_{guru}_{day}")
            model.Add(over >= sum(day_load) - max_day)
            penalties.append(over)
            weights.append(50)

# 5. Teacher max per week
for guru in df_guru['kode'].tolist():
    max_week = teachers[guru]['maxJam']
    if max_week > 0:
        week_load = []
        for req in requirements:
            if req['guru'] != guru: continue
            req_id = req['req_id']
            for block_idx, block_size in enumerate(req['blocks']):
                for day in hari_list:
                    for start in range(len(periods_by_day[day]) - block_size + 1):
                        key = (req_id, block_idx, day, start)
                        if key in x:
                            week_load.append(block_size * x[key])
        if week_load:
            over = model.NewIntVar(0, sum(r['jumlah'] for r in requirements if r['guru']==guru), f"tch_week_{guru}")
            model.Add(over >= sum(week_load) - max_week)
            penalties.append(over)
            weights.append(50)

# 6. Preferred slots
for req in requirements:
    req_id = req['req_id']
    guru = req['guru']
    preferred = teacher_diinginkan[guru]
    for block_idx, block_size in enumerate(req['blocks']):
        for day in hari_list:
            for start in range(len(periods_by_day[day]) - block_size + 1):
                key = (req_id, block_idx, day, start)
                if key in x:
                    var = x[key]
                    non_pref = sum(1 for p in range(start, start+block_size) if (day, p) not in preferred)
                    if non_pref > 0:
                        for _ in range(non_pref):
                            penalties.append(var)
                            weights.append(1)

# Objective
model.Minimize(sum(w * v for w, v in zip(weights, penalties)))

# ============================================================
# 7. SOLVE
# ============================================================
print("\nSolving MAX-SAT...")
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
schedule = defaultdict(lambda: defaultdict(dict))
for req in requirements:
    req_id = req['req_id']
    kelas = req['kelas']
    mapel = req['mapel']
    guru = req['guru']
    for block_idx, block_size in enumerate(req['blocks']):
        for day in hari_list:
            for start in range(len(periods_by_day[day]) - block_size + 1):
                key = (req_id, block_idx, day, start)
                if key in x and solver.Value(x[key]) == 1:
                    for p_idx in range(start, start + block_size):
                        schedule[kelas][day][p_idx] = (mapel, guru, f"{req_id}_{block_idx}")

# ============================================================
# 9. PRINT RESULTS
# ============================================================
print("\n=== JADWAL ===")
for kelas in sorted(schedule.keys()):
    print(f"\n--- {kelas} ---")
    for day in hari_list:
        row = []
        for p_idx, p in enumerate(periods_by_day[day]):
            if p_idx in schedule[kelas][day]:
                m, g, _ = schedule[kelas][day][p_idx]
                row.append(f"{p['name']}: {m}(G{g})")
            else:
                row.append(f"{p['name']}: ---")
        print(f"  {day}: {' | '.join(row)}")

# Verify
print("\n=== VERIFIKASI ===")
for kelas in sorted(schedule.keys()):
    total = sum(len(schedule[kelas][day]) for day in hari_list)
    print(f"  {kelas}: {total} jam")

# Teacher loads
guru_load = defaultdict(int)
for req in requirements:
    req_id = req['req_id']
    guru = req['guru']
    for block_idx, block_size in enumerate(req['blocks']):
        for day in hari_list:
            for start in range(len(periods_by_day[day]) - block_size + 1):
                key = (req_id, block_idx, day, start)
                if key in x and solver.Value(x[key]) == 1:
                    guru_load[guru] += block_size

print("\n=== GURU LOAD ===")
for guru in sorted(guru_load.keys()):
    t = teachers[guru]
    print(f"  Guru {guru} ({t['nama']}): {guru_load[guru]}/{t['maxJam']} jam")

# ============================================================
# 10. BUILD WEB JSON
# ============================================================
def uid(prefix=''):
    return prefix + ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))

guru_id_map = {str(int(row['kode'])): uid('g') for _, row in df_guru.iterrows() if pd.notna(row['kode'])}
kelas_id_map = {row['nama']: uid('k') for _, row in df_kelas.iterrows()}
mapel_id_map = {row['kode']: uid('m') for _, row in df_mapel.iterrows()}
ruang_id_map = {row['nama']: uid('r') for _, row in df_ruang.iterrows()}

periode_id_map = {}
for day_idx, day in enumerate(hari_list):
    for p_idx in range(len(periods_by_day[day])):
        periode_id_map[(day_idx, p_idx)] = f"p{day_idx}_{p_idx}"

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
    diinginkan = parse_slot_list(row['slotDiinginkan']) if 'parse_slot_list' in dir() else set()
    dilarang = parse_slot_list(row['slotDilarang']) if 'parse_slot_list' in dir() else set()
    
    mapel_ids = [mapel_id_map[m.strip()] for m in str(row['mapelIds']).split(',') if m.strip() in mapel_id_map]
    color_hash = int(hashlib.md5(old_id.encode()).hexdigest(), 16)
    PALET = ['#4f46e5','#0ea5e9','#f59e0b','#ec4899','#8b5cf6','#10b981','#ef4444','#14b8a6','#f97316','#6366f1','#84cc16','#a855f7']
    warna = PALET[color_hash % len(PALET)]
    
    # Convert slots to web format
    def convert_slots(s):
        res = []
        for (day, p_idx) in s:
            day_idx = hari_list.index(day)
            pid = f"p{day_idx}_{p_idx}"
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

# Kelas, Siswa, Mapel, Ruang (same as before)
kelas_list = [{'id': kelas_id_map[row['nama']], 'nama': row['nama'], 'tingkat': row['tingkat'], 'waliKelasId': '', 'jumlahSiswa': int(row['jumlahSiswa'])} for _, row in df_kelas.iterrows()]
siswa_list = []
for _, row in df_siswa.iterrows():
    if pd.notna(row['nama']):
        kid = kelas_id_map.get(row['kelasId'])
        if kid: siswa_list.append({'id': uid('s'), 'nama': row['nama'], 'kelasId': kid, 'pilihan': []})

mapel_list = [{'id': mapel_id_map[row['kode']], 'nama': row['nama'], 'kode': row['kode'], 'tipeRuang': 'reguler', 'pilihan': False} for _, row in df_mapel.iterrows()]
ruang_list = [{'id': ruang_id_map[row['nama']], 'nama': row['nama'], 'kapasitas': int(row['kapasitas']), 'tipe': 'reguler'} for _, row in df_ruang.iterrows()]

# Periode for web (all periods)
periode_list = []
for day_idx, day in enumerate(hari_list):
    all_p = []
    for p_idx, p in enumerate(periods_by_day[day]):
        all_p.append((p['mulai'], 'pelajaran', p['name'], '', p_idx))
    for fb in fixed_blocks_by_day[day]:
        all_p.append((fb['mulai'], fb['tipe'], fb['name'], fb.get('tipeKet',''), -1))
    all_p.sort(key=lambda x: x[0])
    for item in all_p:
        if item[4] >= 0:
            pid = f"p{day_idx}_{item[4]}"
            periode_list.append({'id': pid, 'nama': item[2], 'mulai': str(item[0]), 'selesai': str(item[1]), 'tipe': 'pelajaran', 'tipeKet': '', 'hariAktif': [day_idx]})
        else:
            pid = f"p{day_idx}_fix{len([x for x in periode_list if x['id'].startswith(f'p{day_idx}_fix')])}"
            periode_list.append({'id': pid, 'nama': item[2], 'mulai': str(item[0]), 'selesai': str(item[1]), 'tipe': item[1], 'tipeKet': item[3], 'hariAktif': [day_idx]})

# Kebutuhan
kebutuhan_list = []
for req in requirements:
    kebutuhan_list.append({'id': uid('kb'), 'kelasId': kelas_id_map[req['kelas']], 'mapelId': mapel_id_map[req['mapel']], 'guruId': guru_id_map[str(req['guru'])], 'ruangId': '', 'jumlahJam': req['jumlah'], 'polaJP': req['blocks']})

# Jadwal
jadwal_list = []
for kelas_name in schedule:
    kelas_id = kelas_id_map[kelas_name]
    for day in hari_list:
        day_idx = hari_list.index(day)
        for p_idx, (mapel, guru, block_id) in sorted(schedule[kelas_name][day].items()):
            pid = f"p{day_idx}_{p_idx}"
            jadwal_list.append({'id': uid('j'), 'reqId': uid('kb'), 'kelasId': kelas_id, 'mapelId': mapel_id_map[mapel], 'guruId': guru_id_map[str(guru)], 'ruangId': '', 'hari': day_idx, 'periodeId': pid, 'tetap': False, 'catatan': '', 'blokId': block_id})

project = {'ownerId': None, 'info': {'nama': 'SMA Wahidiyah', 'tahunAjaran': '2026/2027', 'kepalaSekolah': '', 'alamat': '', 'logo': ''}, 'hari': hari_list, 'hariKonfig': [{'maksJP': len(periods_by_day[d]), 'slotNonAktif': []} for d in hari_list], 'periode': periode_list, 'guru': guru_list, 'kelas': kelas_list, 'siswa': siswa_list, 'mapel': mapel_list, 'ruang': ruang_list, 'kebutuhan': kebutuhan_list, 'jadwal': jadwal_list, 'blokir': [], 'opsi': {'percobaan': 8, 'rataHari': True, 'hindariUjung': True, 'wajibRuang': True}}

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