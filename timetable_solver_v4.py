"""
Comprehensive Conflict Analysis and Relaxed Solver
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
all_slots_set = set(slots)
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

# Compute allowed slots (HARD interpretation)
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
    
    if diinginkan:
        allowed = diinginkan - dilarang
    else:
        allowed = all_slots_set - dilarang
    
    teachers[kode] = {
        'nama': nama,
        'mapelIds': mapelIds,
        'maxJam': maxJam,
        'maxPerHari': maxPerHari,
        'catatan': catatan,
    }
    teacher_allowed_slots[kode] = allowed

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
# 5. COMPREHENSIVE CONFLICT ANALYSIS
# ============================================================
print("\n" + "="*80)
print("COMPREHENSIVE CONFLICT ANALYSIS")
print("="*80)

# A. Class overflow
print("\n### A. CLASS OVERFLOW (hours > 44 slots) ###")
class_hours = defaultdict(int)
class_reqs = defaultdict(list)
for req_id, kelas, mapel, guru, jumlah, pola in requirements:
    class_hours[kelas] += jumlah
    class_reqs[kelas].append((req_id, mapel, guru, jumlah, pola))

for kelas in sorted(class_hours.keys()):
    needed = class_hours[kelas]
    if needed > NUM_SLOTS:
        print(f"  [CONFLICT] {kelas}: {needed} hours needed, only {NUM_SLOTS} slots (excess: {needed - NUM_SLOTS})")
    elif needed == NUM_SLOTS:
        print(f"  [FULL] {kelas}: {needed} hours = FULL schedule (no free periods)")
    else:
        print(f"  [OK] {kelas}: {needed}/{NUM_SLOTS} hours ({NUM_SLOTS - needed} free periods)")

# B. Teacher capacity vs allowed slots
print("\n### B. TEACHER CAPACITY vs ALLOWED SLOTS (HARD constraints) ###")
teacher_hours = defaultdict(int)
teacher_reqs = defaultdict(list)
for req_id, kelas, mapel, guru, jumlah, pola in requirements:
    teacher_hours[guru] += jumlah
    teacher_reqs[guru].append((req_id, kelas, mapel, jumlah, pola))

conflicts = []
for guru in sorted(teacher_hours.keys()):
    needed = teacher_hours[guru]
    allowed = len(teacher_allowed_slots[guru])
    maxJam = teachers[guru]['maxJam']
    maxPerHari = teachers[guru]['maxPerHari']
    
    # Calculate theoretical max possible given day limits
    allowed_days = set(d for d, p in teacher_allowed_slots[guru])
    max_possible_by_days = sum(
        min(maxPerHari, len([p for d, p in teacher_allowed_slots[guru] if d == day]))
        for day in allowed_days
    )
    max_possible = min(allowed, maxJam, max_possible_by_days)
    
    status = "[OK]"
    issues = []
    if needed > allowed:
        issues.append(f"needs {needed} > allowed slots {allowed}")
    if needed > maxJam:
        issues.append(f"needs {needed} > maxJam {maxJam}")
    if needed > max_possible_by_days:
        issues.append(f"needs {needed} > max possible by day limits {max_possible_by_days}")
    
    if issues:
        status = "[CONFLICT]"
        conflicts.append(f"Guru {guru} ({teachers[guru]['nama']}): {'; '.join(issues)}")
    elif needed == max_possible:
        status = "[FULL]"
    
    allowed_days_str = ", ".join(sorted(allowed_days))
    print(f"  {status} Guru {guru} ({teachers[guru]['nama']}): need={needed}, allowed={allowed}, maxJam={maxJam}, max/day={maxPerHari}, days={{{allowed_days_str}}}, maxPossible={max_possible}")

# C. Teacher hard conflicts (zero allowed days for requirements)
print("\n### C. TEACHERS WITH ZERO ALLOWED DAYS ###")
for guru in sorted(teacher_hours.keys()):
    if len(teacher_allowed_slots[guru]) == 0 and teacher_hours[guru] > 0:
        conflicts.append(f"Guru {guru} ({teachers[guru]['nama']}): 0 allowed slots but needs {teacher_hours[guru]} hours")

# D. Subject-teacher-class specific conflicts
print("\n### D. DETAILED TEACHER CONFLICTS (requirements vs allowed) ###")
for guru in sorted(teacher_hours.keys()):
    if teacher_hours[guru] > len(teacher_allowed_slots[guru]):
        print(f"\n  [CONFLICT] Guru {guru} ({teachers[guru]['nama']}) - NEEDS {teacher_hours[guru]}h, ALLOWED {len(teacher_allowed_slots[guru])} slots:")
        for req_id, kelas, mapel, jumlah, pola in teacher_reqs[guru]:
            print(f"    - {kelas} {mapel}: {jumlah}h (pola:{pola})")

print(f"\n{'='*80}")
print(f"TOTAL HARD CONFLICTS: {len(conflicts)}")
for c in conflicts:
    print(f"  - {c}")

# ============================================================
# 6. RELAXED MODEL: slotDiinginkan as SOFT PREFERENCE
# ============================================================
print("\n\n### RELAXED MODEL: slotDiinginkan as SOFT PREFERENCE ###")
print("Treating slotDiinginkan as preference (penalty) not hard constraint...")

# Recompute allowed slots: ONLY slotDilarang is hard forbidden
teacher_allowed_slots_relaxed = {}
for _, row in df_guru.iterrows():
    kode = int(row['kode'])
    dilarang = parse_slot_list(row['slotDilarang'])
    allowed = all_slots_set - dilarang
    teacher_allowed_slots_relaxed[kode] = allowed
    print(f"  Guru {kode} ({teachers[kode]['nama']}): relaxed allowed = {len(allowed)} slots")

# Check capacity with relaxed constraints
print("\n### RELAXED CAPACITY CHECK ###")
relaxed_conflicts = []
for guru in sorted(teacher_hours.keys()):
    needed = teacher_hours[guru]
    allowed = len(teacher_allowed_slots_relaxed[guru])
    maxJam = teachers[guru]['maxJam']
    maxPerHari = teachers[guru]['maxPerHari']
    
    allowed_days = set(d for d, p in teacher_allowed_slots_relaxed[guru])
    max_possible_by_days = sum(
        min(maxPerHari, len([p for d, p in teacher_allowed_slots_relaxed[guru] if d == day]))
        for day in allowed_days
    )
    max_possible = min(allowed, maxJam, max_possible_by_days)
    
    if needed > max_possible:
        relaxed_conflicts.append(f"Guru {guru} ({teachers[guru]['nama']}): need={needed}, maxPossible={max_possible}")
        print(f"  [CONFLICT] Guru {guru}: need={needed}, allowed={allowed}, maxJam={maxJam}, maxPossible={max_possible}")
    else:
        print(f"  [OK] Guru {guru}: need={needed}, maxPossible={max_possible}")

print(f"\nRELAXED CONFLICTS: {len(relaxed_conflicts)}")
for c in relaxed_conflicts:
    print(f"  - {c}")

# ============================================================
# 7. BUILD RELAXED MODEL WITH PENALTIES
# ============================================================
print("\n\n### BUILDING RELAXED MODEL WITH PENALTIES ###")

# Exclude XII-3 (known class overflow)
filtered_reqs = [r for r in requirements if r[1] != 'XII-3']
print(f"Solving for {len(filtered_reqs)} requirements (excluding XII-3)")

model = cp_model.CpModel()

req_by_class = defaultdict(list)
req_by_teacher = defaultdict(list)
for req in filtered_reqs:
    req_by_class[req[1]].append(req[0])
    req_by_teacher[req[3]].append(req[0])

# Variables: create for all relaxed-allowed slots
x = {}
for req_id, kelas, mapel, guru, jumlah, pola in filtered_reqs:
    allowed = teacher_allowed_slots_relaxed[guru]
    for s_idx, (day, period) in enumerate(slots):
        if (day, period) in allowed:
            x[(req_id, s_idx)] = model.NewBoolVar(f"x_req{req_id}_slot{s_idx}")

print(f"Variables: {len(x)}")

# Constraint 1: Each requirement gets exactly its required slots
for req_id, kelas, mapel, guru, jumlah, pola in filtered_reqs:
    allowed_indices = [slot_index[(day, period)] for (day, period) in teacher_allowed_slots_relaxed[guru]]
    model.Add(sum(x[(req_id, s)] for s in allowed_indices) == jumlah)

# Constraint 2: Class at most one per slot
for kelas in req_by_class:
    for s in range(NUM_SLOTS):
        vars_at_slot = [x[(req_id, s)] for req_id in req_by_class[kelas] if (req_id, s) in x]
        if vars_at_slot:
            model.Add(sum(vars_at_slot) <= 1)

# Constraint 3: Teacher at most one per slot
for guru in req_by_teacher:
    for s in range(NUM_SLOTS):
        vars_at_slot = [x[(req_id, s)] for req_id in req_by_teacher[guru] if (req_id, s) in x]
        if vars_at_slot:
            model.Add(sum(vars_at_slot) <= 1)

# Constraint 4: Teacher max hours per day
for guru in req_by_teacher:
    for day in hari_list:
        day_slots_idx = [slot_index[(day, p)] for p in range(1, hari_max_jp[day] + 1)]
        allowed_day_slots = [s for s in day_slots_idx if slots[s] in teacher_allowed_slots_relaxed[guru]]
        if allowed_day_slots:
            max_day = teachers[guru]['maxPerHari']
            model.Add(sum(x[(req_id, s)] for req_id in req_by_teacher[guru] for s in allowed_day_slots) <= max_day)

# Constraint 5: Teacher max hours per week
for guru in req_by_teacher:
    max_week = teachers[guru]['maxJam']
    if max_week > 0:
        allowed_indices = [slot_index[(day, period)] for (day, period) in teacher_allowed_slots_relaxed[guru]]
        model.Add(sum(x[(req_id, s)] for req_id in req_by_teacher[guru] for s in allowed_indices) <= max_week)

# ============================================================
# 8. SOFT CONSTRAINTS: PREFERRED SLOTS PENALTIES
# ============================================================
penalty_vars = []
penalty_weights = []

# Parse preferred slots for penalty
teacher_preferred_slots = {}
for _, row in df_guru.iterrows():
    kode = int(row['kode'])
    diinginkan = parse_slot_list(row['slotDiinginkan'])
    teacher_preferred_slots[kode] = diinginkan

# For each assignment outside preferred slots, add penalty
for req_id, kelas, mapel, guru, jumlah, pola in filtered_reqs:
    preferred = teacher_preferred_slots[guru]
    allowed = teacher_allowed_slots_relaxed[guru]
    # Non-preferred but allowed slots
    non_preferred = allowed - preferred
    for (day, period) in non_preferred:
        s = slot_index[(day, period)]
        if (req_id, s) in x:
            # Penalty variable: 1 if this non-preferred slot is used
            penalty_var = model.NewBoolVar(f"penalty_req{req_id}_slot{s}")
            model.Add(x[(req_id, s)] == penalty_var)
            penalty_vars.append(penalty_var)
            penalty_weights.append(1)  # Weight 1 per period outside preference

print(f"Soft penalty variables: {len(penalty_vars)}")

# Objective: minimize penalties
model.Minimize(sum(w * v for w, v in zip(penalty_weights, penalty_vars)))

# ============================================================
# 9. SOLVE RELAXED MODEL
# ============================================================
print("\nSolving relaxed model...", flush=True)
solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = 120
solver.parameters.num_search_workers = 8
solver.parameters.log_search_progress = True

status = solver.Solve(model)
print(f"\nSolver status: {solver.StatusName(status)}")

if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
    print("SOLUTION FOUND!")
    total_penalty = sum(solver.Value(v) * w for v, w in zip(penalty_vars, penalty_weights))
    print(f"Total penalty (periods outside preference): {total_penalty}")
    
    # Extract solution
    schedule = defaultdict(dict)
    for req_id, kelas, mapel, guru, jumlah, pola in filtered_reqs:
        allowed_indices = [slot_index[(day, period)] for (day, period) in teacher_allowed_slots_relaxed[guru]]
        for s in allowed_indices:
            if (req_id, s) in x and solver.Value(x[(req_id, s)]) == 1:
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
                    pref_mark = "*" if (day, p) in teacher_preferred_slots[guru] else ""
                    day_schedule.append(f"J{p}: {mapel}(G{guru}){pref_mark}")
                else:
                    day_schedule.append(f"J{p}: ---")
            print(f"  {day}: " + " | ".join(day_schedule))
    
    # Teacher load report
    print("\n=== TEACHER LOAD REPORT ===")
    teacher_load = defaultdict(lambda: defaultdict(int))
    for req_id, kelas, mapel, guru, jumlah, pola in filtered_reqs:
        allowed_indices = [slot_index[(day, period)] for (day, period) in teacher_allowed_slots_relaxed[guru]]
        for s in allowed_indices:
            if (req_id, s) in x and solver.Value(x[(req_id, s)]) == 1:
                day, period = slots[s]
                teacher_load[guru][day] += 1
    
    for guru in sorted(teacher_load.keys()):
        total = sum(teacher_load[guru].values())
        day_str = ", ".join(f"{day}:{teacher_load[guru][day]}" for day in hari_list if teacher_load[guru][day] > 0)
        pref_str = ""
        for day in hari_list:
            if teacher_load[guru][day] > 0:
                day_slots = [(day, p) for p in range(1, hari_max_jp[day]+1) if teacher_load[guru].get(day, 0) > 0]
                non_pref = sum(1 for d, p in day_slots if (d, p) not in teacher_preferred_slots[guru])
                if non_pref > 0:
                    pref_str += f" {day}:{non_pref}non-pref"
        print(f"  Guru {guru} ({teachers[guru]['nama']}): {total} jam [{day_str}]{pref_str}")
    
    # Generate markdown
    print("\n" + "="*80)
    print("MARKDOWN SCHEDULE TABLE")
    print("="*80)
    print(generate_markdown(schedule, hari_list, hari_max_jp))
    
else:
    print("RELAXED MODEL ALSO INFEASIBLE")
    print("Need to check remaining hard conflicts (maxJam, maxPerHari, slotDilarang)")

def generate_markdown(schedule, hari_list, hari_max_jp):
    classes = sorted(schedule.keys())
    lines = []
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
        if day != hari_list[-1]:
            lines.append("|" + "---|" * (3 + len(classes)))
    return "\n".join(lines)