"""
Timetabling Engine v3 - Correct constraint interpretation
- slotDiinginkan = HARD constraint (teacher ONLY available on these days/periods)
- slotDilarang = HARD constraint (teacher NOT available on these)
- Combined: allowed = diinginkan - dilarang (if diinginkan specified), else all - dilarang
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

# All possible slots as set
all_slots_set = set(slots)

# ============================================================
# 3. PARSE TEACHER AVAILABILITY (HARD CONSTRAINTS)
# ============================================================
def parse_slot_list(slot_str):
    """Parse slot string into set of (day, period)"""
    if pd.isna(slot_str) or str(slot_str).strip().lower() == 'nan':
        return set()
    result = set()
    parts = [p.strip() for p in str(slot_str).split(';')]
    for part in parts:
        part = part.strip()
        if not part:
            continue
        # Day only: "Senin", "Selasa"
        if part in hari_list:
            for p in range(1, hari_max_jp[part] + 1):
                result.add((part, p))
        # Day with period: "Senin J5", "Kamis J1"
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
        # Period only: "J1", "J5" - applies to all days
        elif part.upper().startswith('J') and part.upper()[1:].isdigit():
            p = int(part.upper()[1:])
            for day in hari_list:
                if p <= hari_max_jp[day]:
                    result.add((day, p))
        # Multiple periods: "J5; J6; J7; J8"
        elif ';' in part and all(p.strip().upper().startswith('J') for p in part.split(';')):
            for p_str in part.split(';'):
                p_str = p_str.strip().upper()
                if p_str.startswith('J') and p_str[1:].isdigit():
                    p = int(p_str[1:])
                    for day in hari_list:
                        if p <= hari_max_jp[day]:
                            result.add((day, p))
    return result

# Compute allowed slots for each teacher
teachers = {}
teacher_allowed_slots = {}
for _, row in df_guru.iterrows():
    kode = int(row['kode'])
    nama = row['nama']
    mapelIds = [m.strip() for m in str(row['mapelIds']).split(',')] if pd.notna(row['mapelIds']) else []
    maxJam = int(row['maxJam']) if pd.notna(row['maxJam']) else 0
    maxPerHari = int(row['maxPerHari']) if pd.notna(row['maxPerHari']) else 8
    catatan = row['catatan'] if pd.notna(row['catatan']) else ''
    
    diinginkan = parse_slot_list(row['slotDiinginkan'])
    dilarang = parse_slot_list(row['slotDilarang'])
    
    # Compute allowed slots
    if diinginkan:
        # Teacher ONLY available on diinginkan days/periods
        allowed = diinginkan - dilarang
    else:
        # Available on all slots except dilarang
        allowed = all_slots_set - dilarang
    
    teachers[kode] = {
        'nama': nama,
        'mapelIds': mapelIds,
        'maxJam': maxJam,
        'maxPerHari': maxPerHari,
        'catatan': catatan,
        'diinginkan_raw': row['slotDiinginkan'] if pd.notna(row['slotDiinginkan']) else '',
        'dilarang_raw': row['slotDilarang'] if pd.notna(row['slotDilarang']) else '',
    }
    teacher_allowed_slots[kode] = allowed
    
    # Debug print for problematic teachers
    if kode in [2, 6, 7, 16, 18, 21, 30, 32, 37, 38, 39]:
        print(f"Guru {kode} ({nama}): allowed={len(allowed)} slots, maxJam={maxJam}, maxPerHari={maxPerHari}")
        # Show allowed days
        allowed_days = set(d for d, p in allowed)
        print(f"  Allowed days: {sorted(allowed_days)}")
        for day in sorted(allowed_days):
            periods = sorted(p for d, p in allowed if d == day)
            print(f"  {day}: J{periods}")

# ============================================================
# 4. PARSE REQUIREMENTS (EXCLUDE XII-3 for now)
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

# Filter out XII-3 (known overflow)
filtered_reqs = [r for r in requirements if r[1] != 'XII-3']
print(f"\nSolving for {len(filtered_reqs)} requirements (excluding XII-3)")

# ============================================================
# 5. BUILD MODEL WITH CORRECT CONSTRAINTS
# ============================================================
model = cp_model.CpModel()

req_by_class = defaultdict(list)
req_by_teacher = defaultdict(list)
for req in filtered_reqs:
    req_by_class[req[1]].append(req[0])
    req_by_teacher[req[3]].append(req[0])

# Variables: only create for allowed teacher slots
x = {}
var_count = 0
for req_id, kelas, mapel, guru, jumlah, pola in filtered_reqs:
    allowed = teacher_allowed_slots[guru]
    for s_idx, (day, period) in enumerate(slots):
        if (day, period) in allowed:
            x[(req_id, s_idx)] = model.NewBoolVar(f"x_req{req_id}_slot{s_idx}")
            var_count += 1

print(f"Variables created: {var_count} (only allowed slots)")

# Constraint 1: Each requirement gets exactly its required number of slots
for req_id, kelas, mapel, guru, jumlah, pola in filtered_reqs:
    allowed = teacher_allowed_slots[guru]
    allowed_indices = [slot_index[(day, period)] for (day, period) in allowed]
    model.Add(sum(x[(req_id, s)] for s in allowed_indices) == jumlah)

# Constraint 2: Each class at most one per slot
for kelas in req_by_class:
    for s in range(NUM_SLOTS):
        vars_at_slot = [x[(req_id, s)] for req_id in req_by_class[kelas] if (req_id, s) in x]
        if vars_at_slot:
            model.Add(sum(vars_at_slot) <= 1)

# Constraint 3: Each teacher at most one per slot
for guru in req_by_teacher:
    for s in range(NUM_SLOTS):
        vars_at_slot = [x[(req_id, s)] for req_id in req_by_teacher[guru] if (req_id, s) in x]
        if vars_at_slot:
            model.Add(sum(vars_at_slot) <= 1)

# Constraint 4: Teacher max hours per day
for guru in req_by_teacher:
    for day in hari_list:
        day_slots_idx = [slot_index[(day, p)] for p in range(1, hari_max_jp[day] + 1)]
        # Only include slots that are in allowed set
        allowed_day_slots = [s for s in day_slots_idx if slots[s] in teacher_allowed_slots[guru]]
        if allowed_day_slots:
            max_day = teachers[guru]['maxPerHari']
            model.Add(sum(x[(req_id, s)] for req_id in req_by_teacher[guru] for s in allowed_day_slots) <= max_day)

# Constraint 5: Teacher max hours per week
for guru in req_by_teacher:
    max_week = teachers[guru]['maxJam']
    if max_week > 0:
        allowed_indices = [slot_index[(day, period)] for (day, period) in teacher_allowed_slots[guru]]
        model.Add(sum(x[(req_id, s)] for req_id in req_by_teacher[guru] for s in allowed_indices) <= max_week)

print("All constraints added. Solving...", flush=True)

# ============================================================
# 6. SOLVE
# ============================================================
solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = 120
solver.parameters.num_search_workers = 8
solver.parameters.log_search_progress = True

status = solver.Solve(model)
print(f"\nSolver status: {solver.StatusName(status)}")

if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
    print("SOLUTION FOUND!")
    schedule = defaultdict(dict)
    for req_id, kelas, mapel, guru, jumlah, pola in filtered_reqs:
        allowed_indices = [slot_index[(day, period)] for (day, period) in teacher_allowed_slots[guru]]
        for s in allowed_indices:
            if solver.Value(x[(req_id, s)]) == 1:
                day, period = slots[s]
                schedule[kelas][(day, period)] = (mapel, guru)
    
    # Print schedule for each class
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
        allowed_indices = [slot_index[(day, period)] for (day, period) in teacher_allowed_slots[guru]]
        for s in allowed_indices:
            if solver.Value(x[(req_id, s)]) == 1:
                day, period = slots[s]
                teacher_load[guru][day] += 1
    
    for guru in sorted(teacher_load.keys()):
        total = sum(teacher_load[guru].values())
        day_str = ", ".join(f"{day}:{teacher_load[guru][day]}" for day in hari_list if teacher_load[guru][day] > 0)
        print(f"  Guru {guru} ({teachers[guru]['nama']}): {total} jam total [{day_str}]")
    
    # Export to markdown
    print("\n=== MARKDOWN TABLE ===")
    print(generate_markdown(schedule, hari_list, hari_max_jp))
    
else:
    print("INFEASIBLE - Need to analyze further")
    # Try to find minimal conflict set
    analyze_infeasibility(model, solver, filtered_reqs, req_by_class, req_by_teacher, 
                          teacher_allowed_slots, slots, slot_index, hari_list, hari_max_jp, teachers)

def generate_markdown(schedule, hari_list, hari_max_jp):
    """Generate markdown table of schedule"""
    classes = sorted(schedule.keys())
    lines = []
    # Header
    header = "| Hari | Jam | " + " | ".join(classes) + " |"
    lines.append(header)
    lines.append("|" + "---|" * (3 + len(classes)))
    
    for day in hari_list:
        max_p = hari_max_jp[day]
        for p in range(1, max_p + 1):
            row = f"| {day} | J{p} |"
            for kelas in classes:
                if (day, p) in schedule[kelas]:
                    mapel, guru = schedule[kelas][(day, p)]
                    row += f" {mapel}(G{guru}) |"
                else:
                    row += "  |"
            lines.append(row)
        # Add separator between days
        if day != hari_list[-1]:
            lines.append("|" + "---|" * (3 + len(classes)))
    
    return "\n".join(lines)

def analyze_infeasibility(model, solver, filtered_reqs, req_by_class, req_by_teacher, 
                          teacher_allowed_slots, slots, slot_index, hari_list, hari_max_jp, teachers):
    """Try to identify which constraints cause infeasibility"""
    print("\n=== INFEASIBILITY ANALYSIS ===")
    
    # Check each teacher's capacity vs requirements
    print("\nTeacher capacity check:")
    for guru in req_by_teacher:
        reqs = req_by_teacher[guru]
        total_needed = sum(r[3] for r in filtered_reqs if r[3] == guru)
        allowed = len(teacher_allowed_slots[guru])
        max_week = teachers[guru]['maxJam']
        max_day = teachers[guru]['maxPerHari']
        
        # Max possible given day limits
        max_possible_days = sum(1 for day in hari_list 
                               if any(slots[s][0] == day for s in range(NUM_SLOTS) if slots[s] in teacher_allowed_slots[guru]))
        max_possible = min(allowed, max_week, max_day * max_possible_days)
        
        if total_needed > max_possible:
            print(f"  GURU {guru} ({teachers[guru]['nama']}): needs {total_needed}, max possible {max_possible} "
                  f"(allowed slots={allowed}, maxJam={max_week}, maxDay={max_day}, availableDays={max_possible_days})")
    
    # Check class capacity
    print("\nClass capacity check:")
    for kelas in req_by_class:
        reqs = req_by_class[kelas]
        total_needed = sum(r[3] for r in filtered_reqs if r[1] == kelas)
        if total_needed > NUM_SLOTS:
            print(f"  KELAS {kelas}: needs {total_needed}, slots={NUM_SLOTS}")
    
    # Try solving per-class to find which class causes issues
    print("\nTrying per-class feasibility...")
    for kelas in sorted(req_by_class.keys()):
        class_reqs = [r for r in filtered_reqs if r[1] == kelas]
        print(f"  {kelas}: {len(class_reqs)} reqs, {sum(r[3] for r in class_reqs)} hours")