"""
Timetabling Engine v5 - MAX-SAT approach (Fixed markdown generation)
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

# Exclude XII-3 (known class overflow)
filtered_reqs = [r for r in requirements if r[1] != 'XII-3']
print(f"Solving for {len(filtered_reqs)} requirements (excluding XII-3)")

# ============================================================
# 5. MAX-SAT MODEL: All constraints soft with penalties
# ============================================================
model = cp_model.CpModel()

req_by_class = defaultdict(list)
req_by_teacher = defaultdict(list)
for req in filtered_reqs:
    req_by_class[req[1]].append(req[0])
    req_by_teacher[req[3]].append(req[0])

# Variables: x[req_id][slot] = 1 if requirement scheduled at slot
# Allow ALL slots (only hard constraint: not in dilarang)
x = {}
for req_id, kelas, mapel, guru, jumlah, pola in filtered_reqs:
    allowed = all_slots_set - teacher_dilarang[guru]
    for s_idx, (day, period) in enumerate(slots):
        if (day, period) in allowed:
            x[(req_id, s_idx)] = model.NewBoolVar(f"x_{req_id}_{s_idx}")

print(f"Variables: {len(x)}")

# Penalty variables and weights
penalty_vars = []
penalty_weights = []

# --- SOFT CONSTRAINT 1: Requirement fulfillment ---
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

# --- SOFT CONSTRAINT 2: Class conflict ---
for kelas in req_by_class:
    for s in range(NUM_SLOTS):
        vars_at_slot = [x[(req_id, s)] for req_id in req_by_class[kelas] if (req_id, s) in x]
        if len(vars_at_slot) > 1:
            conflict = model.NewBoolVar(f"class_conflict_{kelas}_{s}")
            model.Add(sum(vars_at_slot) <= 1 + len(vars_at_slot) * conflict)
            penalty_vars.append(conflict)
            penalty_weights.append(50)

# --- SOFT CONSTRAINT 3: Teacher conflict ---
for guru in req_by_teacher:
    for s in range(NUM_SLOTS):
        vars_at_slot = [x[(req_id, s)] for req_id in req_by_teacher[guru] if (req_id, s) in x]
        if len(vars_at_slot) > 1:
            conflict = model.NewBoolVar(f"teacher_conflict_{guru}_{s}")
            model.Add(sum(vars_at_slot) <= 1 + len(vars_at_slot) * conflict)
            penalty_vars.append(conflict)
            penalty_weights.append(50)

# --- SOFT CONSTRAINT 4: Teacher max hours per day ---
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

# --- SOFT CONSTRAINT 5: Teacher max hours per week ---
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

# --- SOFT CONSTRAINT 6: Preferred slots (diinginkan) ---
for req_id, kelas, mapel, guru, jumlah, pola in filtered_reqs:
    preferred = teacher_diinginkan[guru]
    allowed = all_slots_set - teacher_dilarang[guru]
    non_preferred = allowed - preferred
    for (day, period) in non_preferred:
        s = slot_index[(day, period)]
        if (req_id, s) in x:
            penalty_vars.append(x[(req_id, s)])
            penalty_weights.append(1)

print(f"Soft penalty terms: {len(penalty_vars)}")

# Objective: minimize weighted penalties
model.Minimize(sum(w * v for w, v in zip(penalty_weights, penalty_vars)))

# ============================================================
# 6. SOLVE
# ============================================================
print("\nSolving MAX-SAT model...", flush=True)
solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = 120
solver.parameters.num_search_workers = 8
solver.parameters.log_search_progress = True

status = solver.Solve(model)
print(f"\nSolver status: {solver.StatusName(status)}")

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

if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
    print(f"SOLUTION FOUND! Objective value: {solver.ObjectiveValue()}")
    
    # Analyze penalties
    print("\n=== PENALTY BREAKDOWN ===")
    penalty_summary = defaultdict(int)
    for v, w in zip(penalty_vars, penalty_weights):
        val = solver.Value(v)
        if val > 0:
            penalty_summary[f"weight_{w}"] += val * w
    for k, v in penalty_summary.items():
        print(f"  {k}: {v}")
    
    # Extract schedule
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
    
    # Print schedule
    for kelas in sorted(schedule.keys()):
        print(f"\n=== {kelas} ===")
        for day in hari_list:
            day_schedule = []
            for p in range(1, hari_max_jp[day] + 1):
                if (day, p) in schedule[kelas]:
                    mapel, guru = schedule[kelas][(day, p)]
                    pref = "*" if (day, p) in teacher_diinginkan[guru] else ""
                    day_schedule.append(f"J{p}: {mapel}(G{guru}){pref}")
                else:
                    day_schedule.append(f"J{p}: ---")
            print(f"  {day}: " + " | ".join(day_schedule))
    
    # Requirement fulfillment report
    print("\n=== REQUIREMENT FULFILLMENT ===")
    unfulfilled = 0
    for req_id, (assigned, needed, slots_list) in req_fulfillment.items():
        if assigned < needed:
            unfulfilled += 1
            kelas = next(r[1] for r in filtered_reqs if r[0] == req_id)
            mapel = next(r[2] for r in filtered_reqs if r[0] == req_id)
            guru = next(r[3] for r in filtered_reqs if r[0] == req_id)
            print(f"  [PARTIAL] Req {req_id}: {kelas} {mapel} by Guru {guru} - got {assigned}/{needed} hours")
    if unfulfilled == 0:
        print("  All requirements fully satisfied!")
    else:
        print(f"  Total partially fulfilled: {unfulfilled}")
    
    # Teacher load report
    print("\n=== TEACHER LOAD REPORT ===")
    teacher_load = defaultdict(lambda: defaultdict(int))
    teacher_week_total = defaultdict(int)
    for req_id, kelas, mapel, guru, jumlah, pola in filtered_reqs:
        allowed_indices = [slot_index[(day, period)] for (day, period) in (all_slots_set - teacher_dilarang[guru])]
        for s in allowed_indices:
            if (req_id, s) in x and solver.Value(x[(req_id, s)]) == 1:
                day, period = slots[s]
                teacher_load[guru][day] += 1
                teacher_week_total[guru] += 1
    
    for guru in sorted(teacher_week_total.keys()):
        total = teacher_week_total[guru]
        max_week = teachers[guru]['maxJam']
        max_day = teachers[guru]['maxPerHari']
        day_str = ", ".join(f"{day}:{teacher_load[guru][day]}" for day in hari_list if teacher_load[guru][day] > 0)
        over_week = " [OVER MAXWEEK]" if total > max_week else ""
        over_day = ""
        for day in hari_list:
            if teacher_load[guru][day] > max_day:
                over_day += f" [DAY {day} OVER MAXDAY({max_day})]"
        print(f"  Guru {guru} ({teachers[guru]['nama']}): {total}/{max_week} jam [{day_str}]{over_week}{over_day}")
    
    # Class load report
    print("\n=== CLASS LOAD REPORT ===")
    for kelas in sorted(schedule.keys()):
        total = sum(1 for day in hari_list for p in range(1, hari_max_jp[day]+1) if (day, p) in schedule[kelas])
        print(f"  {kelas}: {total}/{NUM_SLOTS} jam terisi")
    
    # Generate markdown
    print("\n" + "="*80)
    print("MARKDOWN SCHEDULE TABLE")
    print("="*80)
    print(generate_markdown(schedule, hari_list, hari_max_jp))
    
    # Save markdown to file
    with open('jadwal_output.md', 'w', encoding='utf-8') as f:
        f.write(generate_markdown(schedule, hari_list, hari_max_jp))
    print("\nMarkdown saved to jadwal_output.md")
    
else:
    print("Even MAX-SAT failed")

print("\nDone.")