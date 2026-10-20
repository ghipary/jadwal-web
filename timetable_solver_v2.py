"""
Timetabling Engine v2 - With conflict analysis and feasible subset solving
"""

from ortools.sat.python import cp_model
import pandas as pd
import numpy as np
from collections import defaultdict
import sys

# ============================================================
# 1. LOAD DATA
# ============================================================
print("Loading data...", flush=True)
xls = pd.ExcelFile('jadwal-web/DATA JADWAL ACUAN/data-jadwal-s_m_a_w_a_h_i_d_i_y_a_h-2026-10-20.xlsx')
df_hari = pd.read_excel(xls, sheet_name='Hari')
df_guru = pd.read_excel(xls, sheet_name='Guru')
df_kelas = pd.read_excel(xls, sheet_name='Kelas')
df_mapel = pd.read_excel(xls, sheet_name='Mata Pelajaran')
df_jam = pd.read_excel(xls, sheet_name='Jam Pelajaran')
df_keb = pd.read_excel(xls, sheet_name='Kebutuhan Jam')

# ============================================================
# 2. DEFINE TIME SLOTS
# ============================================================
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
print(f"Total time slots per week: {NUM_SLOTS}")

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
for _, row in df_guru.iterrows():
    kode = int(row['kode'])
    teachers[kode] = {
        'nama': row['nama'],
        'mapelIds': [m.strip() for m in str(row['mapelIds']).split(',')] if pd.notna(row['mapelIds']) else [],
        'maxJam': int(row['maxJam']) if pd.notna(row['maxJam']) else 0,
        'maxPerHari': int(row['maxPerHari']) if pd.notna(row['maxPerHari']) else 8,
        'slotDiinginkan': parse_slot_list(row['slotDiinginkan']),
        'slotDilarang': parse_slot_list(row['slotDilarang']),
        'polaJP': row['polaJP'] if pd.notna(row['polaJP']) else '',
        'catatan': row['catatan'] if pd.notna(row['catatan']) else ''
    }

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
    pola = str(row['polaJP']) if pd.notna(row['polaJP']) else '1'
    requirements.append((req_id, kelas, mapel, guru, jumlah, pola))

# ============================================================
# 5. CONFLICT ANALYSIS
# ============================================================
print("\n=== CONFLICT ANALYSIS ===")

# Check class overflow
class_hours = defaultdict(int)
class_reqs = defaultdict(list)
for req_id, kelas, mapel, guru, jumlah, pola in requirements:
    class_hours[kelas] += jumlah
    class_reqs[kelas].append((req_id, mapel, guru, jumlah, pola))

conflicts = []
for kelas in sorted(class_hours.keys()):
    needed = class_hours[kelas]
    if needed > NUM_SLOTS:
        conflicts.append(f"KELAS OVERFLOW: {kelas} needs {needed} hours but only {NUM_SLOTS} slots available (excess: {needed - NUM_SLOTS})")

# Check teacher overload
teacher_hours = defaultdict(int)
for _, _, _, guru, jumlah, _ in requirements:
    teacher_hours[guru] += jumlah

for guru in sorted(teacher_hours.keys()):
    needed = teacher_hours[guru]
    max_allowed = teachers[guru]['maxJam']
    if needed > max_allowed:
        conflicts.append(f"GURU OVERLOAD: Guru {guru} ({teachers[guru]['nama']}) needs {needed} hours but maxJam={max_allowed}")

# Check teacher day limits
for guru in teacher_hours:
    max_day = teachers[guru]['maxPerHari']
    # Theoretical minimum days needed
    min_days = (teacher_hours[guru] + max_day - 1) // max_day
    available_days = 6  # Senin-Sabtu
    forbidden_days = set()
    for (day, _) in teachers[guru]['slotDilarang']:
        forbidden_days.add(day)
    available_days -= len(forbidden_days)
    if min_days > available_days:
        conflicts.append(f"GURU DAY LIMIT: Guru {guru} needs min {min_days} days (max {max_day}/day) but only {available_days} days allowed")

# Check forbidden slots coverage
for guru in teacher_hours:
    forbidden = teachers[guru]['slotDilarang']
    preferred = teachers[guru]['slotDiinginkan']
    if preferred:
        # Check if preferred slots are enough
        pref_slots = len(preferred)
        if teacher_hours[guru] > pref_slots:
            conflicts.append(f"GURU PREF LIMIT: Guru {guru} needs {teacher_hours[guru]} hours but only {pref_slots} preferred slots")

print(f"Total conflicts found: {len(conflicts)}")
for c in conflicts:
    print(f"  - {c}")

# ============================================================
# 6. BUILD MODEL FOR FEASIBLE SUBSET
# ============================================================
# Strategy: Remove XII-3 excess requirements (11 hours over)
# We'll try to solve for all classes except XII-3, or reduce XII-3

# Let's identify which requirements belong to XII-3
xii3_reqs = [r for r in requirements if r[1] == 'XII-3']
print(f"\nXII-3 has {len(xii3_reqs)} requirements totaling {sum(r[3] for r in xii3_reqs)} hours")

# Option 1: Solve without XII-3 first to see if rest is feasible
# Option 2: Reduce XII-3 requirements proportionally
# Let's try Option 1 first

# Create filtered requirements (exclude XII-3)
filtered_reqs = [r for r in requirements if r[1] != 'XII-3']
print(f"\nSolving for {len(filtered_reqs)} requirements (excluding XII-3)...")

# Build model with filtered requirements
model = cp_model.CpModel()

req_by_class = defaultdict(list)
req_by_teacher = defaultdict(list)
for req in filtered_reqs:
    req_by_class[req[1]].append(req[0])
    req_by_teacher[req[3]].append(req[0])

# Variables
x = {}
for req_id, kelas, mapel, guru, jumlah, pola in filtered_reqs:
    for s_idx in range(NUM_SLOTS):
        x[(req_id, s_idx)] = model.NewBoolVar(f"x_req{req_id}_slot{s_idx}")

print(f"Variables: {len(x)}")

# Constraint 1: Each requirement gets exactly its required number of slots
for req_id, kelas, mapel, guru, jumlah, pola in filtered_reqs:
    model.Add(sum(x[(req_id, s)] for s in range(NUM_SLOTS)) == jumlah)

# Constraint 2: Each class at most one per slot
for kelas in req_by_class:
    for s in range(NUM_SLOTS):
        model.Add(sum(x[(req_id, s)] for req_id in req_by_class[kelas]) <= 1)

# Constraint 3: Each teacher at most one per slot
for guru in req_by_teacher:
    for s in range(NUM_SLOTS):
        model.Add(sum(x[(req_id, s)] for req_id in req_by_teacher[guru]) <= 1)

# Constraint 4: Teacher max hours per day
for guru in req_by_teacher:
    for day in hari_list:
        day_slots_idx = [slot_index[(day, p)] for p in range(1, hari_max_jp[day] + 1)]
        max_day = teachers[guru]['maxPerHari']
        model.Add(sum(x[(req_id, s)] for req_id in req_by_teacher[guru] for s in day_slots_idx) <= max_day)

# Constraint 5: Teacher max hours per week
for guru in req_by_teacher:
    max_week = teachers[guru]['maxJam']
    if max_week > 0:
        model.Add(sum(x[(req_id, s)] for req_id in req_by_teacher[guru] for s in range(NUM_SLOTS)) <= max_week)

# Constraint 6: Teacher forbidden slots
for guru in req_by_teacher:
    forbidden = teachers[guru]['slotDilarang']
    for (day, period) in forbidden:
        if (day, period) in slot_index:
            s = slot_index[(day, period)]
            for req_id in req_by_teacher[guru]:
                model.Add(x[(req_id, s)] == 0)

# Constraint 7: Teacher preferred slots (soft - we'll use as hints)
# For now, just solve feasibility

print("Solving...", flush=True)
solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = 120
solver.parameters.num_search_workers = 8
solver.parameters.log_search_progress = True

status = solver.Solve(model)
print(f"\nSolver status: {solver.StatusName(status)}")

if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
    print("SOLUTION FOUND for filtered requirements!")
    # Extract solution
    schedule = defaultdict(dict)
    for req_id, kelas, mapel, guru, jumlah, pola in filtered_reqs:
        for s in range(NUM_SLOTS):
            if solver.Value(x[(req_id, s)]) == 1:
                day, period = slots[s]
                schedule[kelas][(day, period)] = (mapel, guru)
    
    # Print schedule
    for kelas in sorted(schedule.keys()):
        print(f"\n=== {kelas} ===")
        for day in hari_list:
            day_schedule = []
            for p in range(1, hari_max_jp[day] + 1):
                if (day, p) in schedule[kelas]:
                    mapel, guru = schedule[kelas][(day, p)]
                    day_schedule.append(f"J{p}: {mapel}(G{guru})")
                else:
                    day_schedule.append(f"J{p}: ---")
            print(f"  {day}: " + " | ".join(day_schedule))
    
    # Teacher load report
    print("\n=== TEACHER LOAD REPORT ===")
    teacher_load = defaultdict(lambda: defaultdict(int))
    for req_id, kelas, mapel, guru, jumlah, pola in filtered_reqs:
        for s in range(NUM_SLOTS):
            if solver.Value(x[(req_id, s)]) == 1:
                day, period = slots[s]
                teacher_load[guru][day] += 1
    
    for guru in sorted(teacher_load.keys()):
        total = sum(teacher_load[guru].values())
        day_str = ", ".join(f"{day}:{teacher_load[guru][day]}" for day in hari_list if teacher_load[guru][day] > 0)
        print(f"  Guru {guru} ({teachers[guru]['nama']}): {total} jam total [{day_str}]")
    
else:
    print("STILL INFEASIBLE - analyzing further...")
    
    # Try to identify which teacher/class constraints cause infeasibility
    # Use assumption-based solving or try removing constraints one by one
    pass

print("\nDone.")