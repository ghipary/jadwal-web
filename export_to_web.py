"""
Convert OR-Tools schedule to Web App Project JSON format
Uses the working solver output from timetable_solver_final.py
Run: python export_to_web.py
Output: jadwal-web-project.json (import via web app Berkas page)
"""

import json
import pandas as pd
from collections import defaultdict
import random
import string
import hashlib

# ============================================================
# 1. LOAD DATA & RUN SOLVER (from timetable_solver_final)
# ============================================================
from ortools.sat.python import cp_model

print("Loading data...", flush=True)
xls = pd.ExcelFile('jadwal-web/DATA JADWAL ACUAN/data-jadwal-s_m_a_w_a_h_i_d_i_y_a_h-2026-10-20.xlsx')
df_hari = pd.read_excel(xls, sheet_name='Hari')
df_guru = pd.read_excel(xls, sheet_name='Guru')
df_kelas = pd.read_excel(xls, sheet_name='Kelas')
df_siswa = pd.read_excel(xls, sheet_name='Siswa')
df_mapel = pd.read_excel(xls, sheet_name='Mata Pelajaran')
df_ruang = pd.read_excel(xls, sheet_name='Ruang')
df_periode = pd.read_excel(xls, sheet_name='Jam Pelajaran')
df_keb = pd.read_excel(xls, sheet_name='Kebutuhan Jam')
df_blokir = pd.read_excel(xls, sheet_name='Batasan')

# Time slots
hari_list = df_hari['nama'].tolist()
hari_max_jp = dict(zip(df_hari['nama'], df_hari['maksJP']))

slots = []
slot_index = {}
for day in hari_list:
    max_p = int(hari_max_jp[day])
    for p in range(1, max_p + 1):
        idx = len(slots)
        slots.append((day, p))
        slot_index[(day, p)] = idx

NUM_SLOTS = len(slots)
all_slots_set = set(slots)

# Parse teacher constraints
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
            elif 'ISTIRAHAT' in period_part.upper() or 'SETELAH' in period_part.upper():
                if day_part == 'Senin':
                    for p in range(4, hari_max_jp[day_part] + 1):
                        result.add((day_part, p))
                else:
                    for p in range(5, hari_max_jp[day_part] + 1):
                        result.add((day_part, p))
        elif part.upper().startswith('J') and part.upper()[1:].isdigit():
            p = int(part.upper()[1:])
            for day in hari_list:
                if p <= hari_max_jp[day]:
                    result.add((day, p))
        elif ';' in part and all(p.strip().upper().startswith('J') for p in part.split(';')):
            for p_str in part.split(';'):
                p_str = p_str.strip().upper()
                if p_str.startswith('J') and p_str[1:].isdigit():
                    p = int(p_str[1:])
                    for day in hari_list:
                        if p <= hari_max_jp[day]:
                            result.add((day, p))
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

# Requirements
requirements = []
for idx, row in df_keb.iterrows():
    req_id = idx
    kelas = row['kelasId']
    mapel = row['mapelId']
    guru = int(row['guruId'])
    jumlah = int(row['jumlahJam'])
    pola = str(row['polaJP']) if pd.notna(row['polaJP']) else '1'
    requirements.append((req_id, kelas, mapel, guru, jumlah, pola))

# Exclude XII-3 (overflow)
filtered_reqs = [r for r in requirements if r[1] != 'XII-3']

# ============================================================
# 2. BUILD AND SOLVE MODEL
# ============================================================
model = cp_model.CpModel()

req_by_class = defaultdict(list)
req_by_teacher = defaultdict(list)
for req in filtered_reqs:
    req_by_class[req[1]].append(req[0])
    req_by_teacher[req[3]].append(req[0])

x = {}
for req_id, kelas, mapel, guru, jumlah, pola in filtered_reqs:
    allowed = all_slots_set - teacher_dilarang[guru]
    for s_idx, (day, period) in enumerate(slots):
        if (day, period) in allowed:
            x[(req_id, s_idx)] = model.NewBoolVar(f"x_{req_id}_{s_idx}")

penalty_vars = []
penalty_weights = []

# Requirement fulfillment
for req_id, kelas, mapel, guru, jumlah, pola in filtered_reqs:
    allowed_indices = [slot_index[(day, period)] for (day, period) in (all_slots_set - teacher_dilarang[guru])]
    assigned = [x[(req_id, s)] for s in allowed_indices if (req_id, s) in x]
    if assigned:
        total_assigned = sum(assigned)
        under = model.NewIntVar(0, jumlah, f"under_{req_id}")
        model.Add(under >= jumlah - total_assigned)
        penalty_vars.append(under)
        penalty_weights.append(100)
        over = model.NewIntVar(0, len(assigned), f"over_{req_id}")
        model.Add(over >= total_assigned - jumlah)
        penalty_vars.append(over)
        penalty_weights.append(100)

# Class conflict
for kelas in req_by_class:
    for s in range(NUM_SLOTS):
        vars_at_slot = [x[(req_id, s)] for req_id in req_by_class[kelas] if (req_id, s) in x]
        if len(vars_at_slot) > 1:
            conflict = model.NewBoolVar(f"class_conflict_{kelas}_{s}")
            model.Add(sum(vars_at_slot) <= 1 + len(vars_at_slot) * conflict)
            penalty_vars.append(conflict)
            penalty_weights.append(50)

# Teacher conflict
for guru in req_by_teacher:
    for s in range(NUM_SLOTS):
        vars_at_slot = [x[(req_id, s)] for req_id in req_by_teacher[guru] if (req_id, s) in x]
        if len(vars_at_slot) > 1:
            conflict = model.NewBoolVar(f"teacher_conflict_{guru}_{s}")
            model.Add(sum(vars_at_slot) <= 1 + len(vars_at_slot) * conflict)
            penalty_vars.append(conflict)
            penalty_weights.append(50)

# Teacher max per day
for guru in req_by_teacher:
    max_day = teachers[guru]['maxPerHari']
    for day in hari_list:
        day_slots_idx = [slot_index[(day, p)] for p in range(1, hari_max_jp[day] + 1)]
        allowed_day_slots = [s for s in day_slots_idx if slots[s] not in teacher_dilarang[guru]]
        if allowed_day_slots:
            assigned = [x[(req_id, s)] for req_id in req_by_teacher[guru] for s in allowed_day_slots if (req_id, s) in x]
            if assigned:
                total_day = sum(assigned)
                over = model.NewIntVar(0, len(assigned), f"teacher_day_over_{guru}_{day}")
                model.Add(over >= total_day - max_day)
                penalty_vars.append(over)
                penalty_weights.append(20)

# Teacher max per week
for guru in req_by_teacher:
    max_week = teachers[guru]['maxJam']
    if max_week > 0:
        allowed_indices = [slot_index[(day, period)] for (day, period) in (all_slots_set - teacher_dilarang[guru])]
        assigned = [x[(req_id, s)] for req_id in req_by_teacher[guru] for s in allowed_indices if (req_id, s) in x]
        if assigned:
            total_week = sum(assigned)
            over = model.NewIntVar(0, len(assigned), f"teacher_week_over_{guru}")
            model.Add(over >= total_week - max_week)
            penalty_vars.append(over)
            penalty_weights.append(20)

# Preferred slots
for req_id, kelas, mapel, guru, jumlah, pola in filtered_reqs:
    preferred = teacher_diinginkan[guru]
    allowed = all_slots_set - teacher_dilarang[guru]
    non_preferred = allowed - preferred
    for (day, period) in non_preferred:
        s = slot_index[(day, period)]
        if (req_id, s) in x:
            penalty_vars.append(x[(req_id, s)])
            penalty_weights.append(1)

model.Minimize(sum(w * v for w, v in zip(penalty_weights, penalty_vars)))

print("Solving...", flush=True)
solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = 120
solver.parameters.num_search_workers = 8
solver.parameters.log_search_progress = False

status = solver.Solve(model)

if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
    print("Solver failed!")
    exit(1)

print(f"Solved! Objective: {solver.ObjectiveValue()}")

# ============================================================
# 3. EXTRACT SCHEDULE
# ============================================================
schedule = defaultdict(dict)
req_fulfillment = {}

for req_id, kelas, mapel, guru, jumlah, pola in filtered_reqs:
    allowed_indices = [slot_index[(day, period)] for (day, period) in (all_slots_set - teacher_dilarang[guru])]
    assigned_slots = []
    for s in allowed_indices:
        if (req_id, s) in x and solver.Value(x[(req_id, s)]) == 1:
            day, period = slots[s]
            assigned_slots.append((day, period))
            schedule[kelas][(day, period)] = (mapel, guru)
    req_fulfillment[req_id] = (len(assigned_slots), jumlah, assigned_slots)

# ============================================================
# 4. BUILD WEB APP PROJECT JSON
# ============================================================

def uid(prefix=''):
    return prefix + ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))

# ID mappings
guru_id_map = {str(int(row['kode'])): uid('g') for _, row in df_guru.iterrows() if pd.notna(row['kode'])}
kelas_id_map = {row['nama']: uid('k') for _, row in df_kelas.iterrows()}
mapel_id_map = {row['kode']: uid('m') for _, row in df_mapel.iterrows()}
ruang_id_map = {row['nama']: uid('r') for _, row in df_ruang.iterrows()}

# Periode mapping: (day_idx, "J{p}") -> period_id
periode_id_map = {}
for day_idx, day in enumerate(hari_list):
    for p in range(1, hari_max_jp[day] + 1):
        periode_id_map[(day_idx, f"J{p}")] = f"p{day_idx}_{p}"

# Color palette
PALET_GURU = ['#4f46e5', '#0ea5e9', '#f59e0b', '#ec4899', '#8b5cf6', '#10b981',
              '#ef4444', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#a855f7']

# ---- Guru ----
guru_list = []
for _, row in df_guru.iterrows():
    old_id = str(int(row['kode'])) if pd.notna(row['kode']) else ''
    new_id = guru_id_map[old_id]
    
    def convert_slots(slot_str):
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
                for p in range(1, hari_max_jp[part] + 1):
                    pid = periode_id_map.get((day_idx, f"J{p}"))
                    if pid:
                        result.append(f"{day_idx}#{pid}")
            elif ' ' in part and part.split(' ')[0] in hari_list:
                day_part, period_part = part.split(' ', 1)
                day_part = day_part.strip()
                day_idx = hari_list.index(day_part)
                period_part = period_part.strip().upper()
                if period_part.startswith('J') and period_part[1:].isdigit():
                    p = int(period_part[1:])
                    pid = periode_id_map.get((day_idx, f"J{p}"))
                    if pid:
                        result.append(f"{day_idx}#{pid}")
                elif period_part == 'PAGI':
                    for p in range(1, min(5, hari_max_jp[day_part] + 1)):
                        pid = periode_id_map.get((day_idx, f"J{p}"))
                        if pid:
                            result.append(f"{day_idx}#{pid}")
            elif part.upper().startswith('J') and part.upper()[1:].isdigit():
                p = int(part.upper()[1:])
                for day_idx, day in enumerate(hari_list):
                    if p <= hari_max_jp[day]:
                        pid = periode_id_map.get((day_idx, f"J{p}"))
                        if pid:
                            result.append(f"{day_idx}#{pid}")
        return result
    
    diinginkan_raw = row['slotDiinginkan'] if pd.notna(row['slotDiinginkan']) else ''
    dilarang_raw = row['slotDilarang'] if pd.notna(row['slotDilarang']) else ''
    pola_raw = row['polaJP'] if pd.notna(row['polaJP']) else ''
    
    slot_diinginkan = convert_slots(diinginkan_raw)
    slot_dilarang = convert_slots(dilarang_raw)
    
    def parse_pola_arr(pola_str):
        if pd.isna(pola_str) or str(pola_str).strip().lower() == 'nan':
            return []
        return [int(x.strip()) for x in str(pola_str).split(',') if x.strip().isdigit()]
    
    mapel_ids_raw = str(row['mapelIds']) if pd.notna(row['mapelIds']) else ''
    mapel_ids = []
    for m in mapel_ids_raw.split(','):
        m = m.strip()
        if m in mapel_id_map:
            mapel_ids.append(mapel_id_map[m])
    
    color_hash = int(hashlib.md5(old_id.encode()).hexdigest(), 16)
    warna = PALET_GURU[color_hash % len(PALET_GURU)]
    
    guru_list.append({
        'id': new_id,
        'nama': row['nama'],
        'kode': str(row['kode']) if pd.notna(row['kode']) else '',
        'warna': warna,
        'mapelIds': mapel_ids,
        'maxJam': int(row['maxJam']) if pd.notna(row['maxJam']) else 0,
        'maxPerHari': int(row['maxPerHari']) if pd.notna(row['maxPerHari']) else 8,
        'slotDiinginkan': slot_diinginkan,
        'slotDilarang': slot_dilarang,
        'polaJP': parse_pola_arr(pola_raw),
        'catatan': str(row['catatan']) if pd.notna(row['catatan']) else ''
    })

# ---- Kelas ----
kelas_list = []
for _, row in df_kelas.iterrows():
    new_id = kelas_id_map[row['nama']]
    kelas_list.append({
        'id': new_id,
        'nama': row['nama'],
        'tingkat': row['tingkat'],
        'waliKelasId': '',
        'jumlahSiswa': int(row['jumlahSiswa'])
    })

# ---- Siswa ----
siswa_list = []
for _, row in df_siswa.iterrows():
    if pd.notna(row['nama']):
        kelas_id = kelas_id_map.get(row['kelasId'], '')
        if kelas_id:
            siswa_list.append({
                'id': uid('s'),
                'nama': row['nama'],
                'kelasId': kelas_id,
                'pilihan': []
            })

# ---- Mapel ----
mapel_list = []
for _, row in df_mapel.iterrows():
    new_id = mapel_id_map[row['kode']]
    mapel_list.append({
        'id': new_id,
        'nama': row['nama'],
        'kode': row['kode'],
        'tipeRuang': 'reguler',
        'pilihan': False
    })

# ---- Ruang ----
ruang_list = []
for _, row in df_ruang.iterrows():
    new_id = ruang_id_map[row['nama']]
    ruang_list.append({
        'id': new_id,
        'nama': row['nama'],
        'kapasitas': int(row['kapasitas']),
        'tipe': 'reguler'
    })

# ---- Periode ----
periode_list = []
for day_idx, day in enumerate(hari_list):
    for p in range(1, hari_max_jp[day] + 1):
        pid = f"p{day_idx}_{p}"
        # Find time from df_periode
        row = df_periode[(df_periode['nama'] == f'J{p}') & 
                         (df_periode['hariAktif'].astype(str).str.contains(day, na=False))]
        if len(row) > 0:
            mulai = str(row.iloc[0]['mulai'])
            selesai = str(row.iloc[0]['selesai'])
            tipe = str(row.iloc[0]['tipe'])
            tipeKet = str(row.iloc[0]['tipeKet']) if pd.notna(row.iloc[0]['tipeKet']) else ''
        else:
            if day == 'Senin':
                times = {1: ('07:30', '08:10'), 2: ('08:10', '08:50'), 3: ('08:50', '09:30'),
                         4: ('10:00', '10:40'), 5: ('10:40', '11:20'), 6: ('12:00', '12:40'), 7: ('12:40', '13:20')}
            elif day == 'Jumat':
                times = {1: ('07:00', '07:40'), 2: ('07:40', '08:20'), 3: ('08:20', '09:00'),
                         4: ('09:10', '09:50'), 5: ('09:50', '10:30')}
            else:
                times = {1: ('07:00', '07:40'), 2: ('07:40', '08:20'), 3: ('08:20', '09:00'),
                         4: ('09:00', '09:40'), 5: ('10:00', '10:40'), 6: ('10:40', '11:20'),
                         7: ('12:00', '12:40'), 8: ('12:40', '13:20')}
            mulai, selesai = times.get(p, ('07:00', '07:40'))
            tipe = 'pelajaran'
            tipeKet = ''
        
        periode_list.append({
            'id': pid,
            'nama': f'J{p}',
            'mulai': mulai,
            'selesai': selesai,
            'tipe': tipe if tipe != 'nan' else 'pelajaran',
            'tipeKet': tipeKet if tipeKet != 'nan' else '',
            'hariAktif': [day_idx]
        })

# ---- Kebutuhan ----
kebutuhan_list = []
for req_id, kelas, mapel, guru, jumlah, pola in filtered_reqs:
    kebutuhan_list.append({
        'id': uid('kb'),
        'kelasId': kelas_id_map[kelas],
        'mapelId': mapel_id_map[mapel],
        'guruId': guru_id_map[str(guru)],
        'ruangId': '',
        'jumlahJam': jumlah,
        'polaJP': [int(x.strip()) for x in str(pola).split(',') if x.strip().isdigit()]
    })

# ---- Jadwal (Assignment) ----
# Build a mapping from (kelas, mapel, guru) -> requirement ID
req_id_map = {}
for req_id, kelas, mapel, guru, jumlah, pola in filtered_reqs:
    req_id_map[(kelas, mapel, guru)] = uid('kb')

jadwal_list = []
for kelas_name in schedule:
    kelas_id = kelas_id_map[kelas_name]
    for (day, period), (mapel, guru) in schedule[kelas_name].items():
        day_idx = hari_list.index(day)
        pid = periode_id_map.get((day_idx, f"J{period}"))
        if pid:
            req_id = req_id_map.get((kelas_name, mapel, guru), uid('kb'))
            jadwal_list.append({
                'id': uid('j'),
                'reqId': req_id,
                'kelasId': kelas_id,
                'mapelId': mapel_id_map[mapel],
                'guruId': guru_id_map[str(guru)],
                'ruangId': '',
                'hari': day_idx,
                'periodeId': pid,
                'tetap': False,
                'catatan': '',
                'blokId': ''
            })

# ---- Blokir ----
blokir_list = []

# ---- HariKonfig ----
hari_konfig = []
for day_idx, day in enumerate(hari_list):
    hari_konfig.append({
        'maksJP': hari_max_jp[day],
        'slotNonAktif': []
    })

# ---- Project Object ----
project = {
    'ownerId': None,
    'info': {
        'nama': 'SMA Wahidiyah',
        'tahunAjaran': '2026/2027',
        'kepalaSekolah': '',
        'alamat': '',
        'logo': ''
    },
    'hari': hari_list,
    'hariKonfig': hari_konfig,
    'periode': periode_list,
    'guru': guru_list,
    'kelas': kelas_list,
    'siswa': siswa_list,
    'mapel': mapel_list,
    'ruang': ruang_list,
    'kebutuhan': kebutuhan_list,
    'jadwal': jadwal_list,
    'blokir': blokir_list,
    'opsi': {
        'percobaan': 8,
        'rataHari': True,
        'hindariUjung': True,
        'wajibRuang': True
    }
}

# Save JSON
output_file = 'jadwal-web-project.json'
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(project, f, ensure_ascii=False, indent=2)

print(f"\n[OK] Project JSON saved to: {output_file}")
print(f"   Guru: {len(guru_list)}")
print(f"   Kelas: {len(kelas_list)}")
print(f"   Mapel: {len(mapel_list)}")
print(f"   Ruang: {len(ruang_list)}")
print(f"   Periode: {len(periode_list)}")
print(f"   Kebutuhan: {len(kebutuhan_list)}")
print(f"   Jadwal: {len(jadwal_list)}")

print("\n[DONE] To use in web app:")
print("   1. Open the web app (npm run dev or open dist/index.html)")
print("   2. Go to 'Berkas & Data' page")
print("   3. Click 'Muat dari Berkas' and select jadwal-web-project.json")
print("   4. Go to 'Generator Jadwal' page and click 'Generate Ulang Jadwal' if needed")
print("   5. View schedule at 'Jadwal' page - grid view with print option")