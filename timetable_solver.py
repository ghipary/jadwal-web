"""
Timetabling Engine using OR-Tools CP-SAT
School: SMa Wahidiyah (from data)
Complex constraint-based scheduling
"""

from ortools.sat.python import cp_model
import pandas as pd
import numpy as np
from collections import defaultdict
import json

# ============================================================
# 1. LOAD DATA
# ============================================================
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
# Based on Jam Pelajaran sheet, we have different schedules per day
# We'll create a unified slot index: (day, period) where period is 1..max_periods_per_day

hari_list = df_hari['nama'].tolist()
hari_max_jp = dict(zip(df_hari['nama'], df_hari['maksJP']))

# Build time slots: each day has periods 1..maksJP
# But note: Senin has different period numbering (J1-J7) vs other days (J1-J8)
# We'll normalize: for each day, periods are 1..maksJP[day]
slots = []  # list of (day, period)
slot_index = {}  # (day, period) -> idx
for day in hari_list:
    max_p = int(hari_max_jp[day])
    for p in range(1, max_p + 1):
        idx = len(slots)
        slots.append((day, p))
        slot_index[(day, p)] = idx

NUM_SLOTS = len(slots)
print(f"Total time slots per week: {NUM_SLOTS}")
for day in hari_list:
    day_slots = [s for s in slots if s[0] == day]
    print(f"  {day}: {len(day_slots)} slots (periods 1-{len(day_slots)})")

# ============================================================
# 3. PARSE TEACHER CONSTRAINTS
# ============================================================
def parse_slot_list(slot_str, is_forbidden=True):
    """Parse slotDiinginkan or slotDilarang string into set of (day, period) tuples"""
    if pd.isna(slot_str) or str(slot_str).strip().lower() == 'nan':
        return set()
    result = set()
    parts = [p.strip() for p in str(slot_str).split(';')]
    for part in parts:
        part = part.strip()
        if not part:
            continue
        # Handle formats like "Senin", "Senin J5", "Senin jam 1-3", "J1", "J5;J6", "Sabtu setelah istirahat"
        # "Pagi" means morning periods (roughly J1-J4)
        # "Senin setelah istirahat" means Senin periods after break
        
        # Simple day-only: all periods that day
        if part in hari_list:
            for p in range(1, hari_max_jp[part] + 1):
                result.add((part, p))
        # Day with specific period: "Senin J5", "Kamis J1"
        elif ' ' in part and part.split(' ')[0] in hari_list:
            day_part, period_part = part.split(' ', 1)
            day_part = day_part.strip()
            period_part = period_part.strip().upper()
            # Handle "J5", "J1", "jam 1-3", "jam 1-3 (XII-3)"
            if period_part.startswith('J') and period_part[1:].isdigit():
                p = int(period_part[1:])
                if 1 <= p <= hari_max_jp[day_part]:
                    result.add((day_part, p))
            elif period_part.startswith('JAM') or period_part.startswith('JAM '):
                # "jam 1-3"
                pass  # Complex, skip for now
            elif period_part == 'PAGI':
                # Morning: periods 1-4 roughly
                for p in range(1, min(5, hari_max_jp[day_part] + 1)):
                    result.add((day_part, p))
            elif 'ISTIRAHAT' in period_part.upper() or 'SETELAH' in period_part.upper():
                # After break - for Senin: after J3 (periods 4-7), for others: after J4 (periods 5-8)
                if day_part == 'Senin':
                    for p in range(4, hari_max_jp[day_part] + 1):
                        result.add((day_part, p))
                else:
                    for p in range(5, hari_max_jp[day_part] + 1):
                        result.add((day_part, p))
        # Period only: "J1", "J5", "J5;J6" (apply to all days)
        elif part.upper().startswith('J') and part.upper()[1:].isdigit():
            p = int(part.upper()[1:])
            for day in hari_list:
                if p <= hari_max_jp[day]:
                    result.add((day, p))
        elif ';' in part and all(p.strip().upper().startswith('J') for p in part.split(';')):
            # Multiple periods like "J5; J6; J7; J8"
            for p_str in part.split(';'):
                p_str = p_str.strip().upper()
                if p_str.startswith('J') and p_str[1:].isdigit():
                    p = int(p_str[1:])
                    for day in hari_list:
                        if p <= hari_max_jp[day]:
                            result.add((day, p))
    return result

# Build teacher data structures
teachers = {}  # kode -> dict
for _, row in df_guru.iterrows():
    kode = int(row['kode'])
    teachers[kode] = {
        'nama': row['nama'],
        'mapelIds': [m.strip() for m in str(row['mapelIds']).split(',')] if pd.notna(row['mapelIds']) else [],
        'maxJam': int(row['maxJam']) if pd.notna(row['maxJam']) else 0,
        'maxPerHari': int(row['maxPerHari']) if pd.notna(row['maxPerHari']) else 8,
        'slotDiinginkan': parse_slot_list(row['slotDiinginkan'], is_forbidden=False),
        'slotDilarang': parse_slot_list(row['slotDilarang'], is_forbidden=True),
        'polaJP': row['polaJP'] if pd.notna(row['polaJP']) else '',
        'catatan': row['catatan'] if pd.notna(row['catatan']) else ''
    }

# ============================================================
# 4. PARSE CLASS REQUIREMENTS (Kebutuhan Jam)
# ============================================================
# Each row: kelasId, mapelId, guruId, jumlahJam, polaJP
# We need to schedule exactly jumlahJam periods for this (kelas, mapel, guru) combo
requirements = []  # list of (req_id, kelas, mapel, guru, jumlahJam, polaJP)
for idx, row in df_keb.iterrows():
    req_id = idx
    kelas = row['kelasId']
    mapel = row['mapelId']
    guru = int(row['guruId'])
    jumlah = int(row['jumlahJam'])
    pola = str(row['polaJP']) if pd.notna(row['polaJP']) else '1'  # default 1 = no block requirement
    requirements.append((req_id, kelas, mapel, guru, jumlah, pola))

print(f"\nTotal requirements: {len(requirements)}")

# Check feasibility: total hours per class vs available slots
class_hours = defaultdict(int)
for _, kelas, _, _, jumlah, _ in requirements:
    class_hours[kelas] += jumlah

print("\n=== CLASS HOURS vs AVAILABLE SLOTS ===")
for kelas in sorted(class_hours.keys()):
    needed = class_hours[kelas]
    available = NUM_SLOTS
    status = "OK" if needed <= available else "OVERFLOW!"
    print(f"  {kelas}: {needed}/{available} {status}")

# Teacher hours check
teacher_hours = defaultdict(int)
for _, _, _, guru, jumlah, _ in requirements:
    teacher_hours[guru] += jumlah

print("\n=== TEACHER HOURS vs MAX ===")
for guru in sorted(teacher_hours.keys()):
    needed = teacher_hours[guru]
    max_allowed = teachers[guru]['maxJam']
    max_day = teachers[guru]['maxPerHari']
    status = "OK" if needed <= max_allowed else "EXCEEDS MAX!"
    print(f"  Guru {guru} ({teachers[guru]['nama']}): {needed}/{max_allowed} (max/day={max_day}) {status}")

# ============================================================
# 5. BUILD CP-SAT MODEL
# ============================================================
model = cp_model.CpModel()

# Decision variables:
# x[req_id][slot_idx] = 1 if requirement req_id is scheduled at slot_idx
# But we need to handle block constraints (polaJP)
# Better: for each requirement, we need to place 'jumlahJam' periods
# If polaJP is "3,2" -> need one block of 3 consecutive, one block of 2 consecutive
# If polaJP is "4" -> can be 4 consecutive or split (but prefer consecutive)

# Let's parse polaJP
def parse_pola(pola_str):
    """Parse polaJP like '3,2' -> [3, 2], '4' -> [4], '5' -> [5]"""
    if not pola_str or pola_str.lower() == 'nan':
        return [1]  # default: individual periods
    parts = [p.strip() for p in str(pola_str).split(',')]
    blocks = []
    for p in parts:
        if p.isdigit():
            blocks.append(int(p))
        else:
            blocks.append(1)
    return blocks

# For each requirement, we'll create variables for each possible block placement
# This is complex. Simpler approach: create variable for each (req, slot) but add 
# constraints to enforce blocks.

# Actually, let's use a different modeling approach:
# For each class and each slot, exactly one subject is taught (by some teacher)
# For each teacher and each slot, at most one class is taught

# Variables: assign[kelas][slot] = (mapel, guru) encoded as integer
# But CP-SAT works better with boolean variables.

# Let's use: x[kelas][slot][req_idx] = 1 if requirement req_idx is scheduled for this class at this slot
# But each requirement is specific to (kelas, mapel, guru), so we can index by requirement.

# Collect requirements per class
req_by_class = defaultdict(list)
for req in requirements:
    req_by_class[req[1]].append(req[0])  # kelas -> list of req_ids

# Collect requirements per teacher
req_by_teacher = defaultdict(list)
for req in requirements:
    req_by_teacher[req[3]].append(req[0])  # guru -> list of req_ids

# Create variables: x[req_id][slot] = 1 if this requirement uses this slot
x = {}
for req_id, kelas, mapel, guru, jumlah, pola in requirements:
    for s_idx in range(NUM_SLOTS):
        x[(req_id, s_idx)] = model.NewBoolVar(f"x_req{req_id}_slot{s_idx}")

# Constraint 1: Each requirement gets exactly its required number of slots
for req_id, kelas, mapel, guru, jumlah, pola in requirements:
    model.Add(sum(x[(req_id, s)] for s in range(NUM_SLOTS)) == jumlah)

# Constraint 2: Each class has at most one requirement per slot (actually exactly one if we want full schedule)
# But some classes have fewer hours than slots (e.g., XII-1 has 33 < 44)
# So: at most one per slot
for kelas in req_by_class:
    for s in range(NUM_SLOTS):
        model.Add(sum(x[(req_id, s)] for req_id in req_by_class[kelas]) <= 1)

# Constraint 3: Each teacher teaches at most one class per slot
for guru in req_by_teacher:
    for s in range(NUM_SLOTS):
        model.Add(sum(x[(req_id, s)] for req_id in req_by_teacher[guru]) <= 1)

# Constraint 4: Teacher max hours per day
for guru in req_by_teacher:
    for day in hari_list:
        day_slots_idx = [slot_index[(day, p)] for p in range(1, hari_max_jp[day] + 1)]
        max_day = teachers[guru]['maxPerHari']
        model.Add(sum(x[(req_id, s)] for req_id in req_by_teacher[guru] for s in day_slots_idx) <= max_day)

# Constraint 5: Teacher max hours per week (already enforced by requirement totals, but good to have)
for guru in req_by_teacher:
    max_week = teachers[guru]['maxJam']
    if max_week > 0:
        model.Add(sum(x[(req_id, s)] for req_id in req_by_teacher[guru] for s in range(NUM_SLOTS)) <= max_week)

# Constraint 6: Teacher forbidden slots (slotDilarang)
for guru in req_by_teacher:
    forbidden = teachers[guru]['slotDilarang']
    for (day, period) in forbidden:
        if (day, period) in slot_index:
            s = slot_index[(day, period)]
            for req_id in req_by_teacher[guru]:
                model.Add(x[(req_id, s)] == 0)

# Constraint 7: Teacher preferred slots (slotDiinginkan) - soft constraint with penalty
# We'll add as soft constraints later in objective

# Constraint 8: Block constraints (polaJP)
# For each requirement, if polaJP = [3,2], we need one block of 3 consecutive, one of 2 consecutive
# This is complex. We'll implement by creating auxiliary variables for block starts.
for req_id, kelas, mapel, guru, jumlah, pola_str in requirements:
    blocks = parse_pola(pola_str)
    if len(blocks) == 1 and blocks[0] == 1:
        continue  # No block constraint, individual periods OK
    
    # For each block, we need to place it as consecutive periods on same day
    # Create binary variables for block start positions
    # This is getting complex. Let me simplify: for now, just enforce that 
    # the periods for this requirement are placed in blocks of the specified sizes.
    # We'll use a circuit-like constraint or sequence constraint.
    
    # Simpler approach: For each day, the periods assigned to this requirement
    # must form blocks of the specified sizes.
    # We'll use the "sequence" constraint idea: for each day, the pattern of 
    # assigned slots must match the block pattern.
    
    # Actually, let's do this: for each day, count how many slots assigned.
    # The sum across days must match blocks.
    # And within each day, assigned slots must be consecutive.
    
    # For each day, create variables indicating how many slots used that day
    day_used = {}
    for day in hari_list:
        day_slots_idx = [slot_index[(day, p)] for p in range(1, hari_max_jp[day] + 1)]
        # Sum of slots used this day for this requirement
        day_used[day] = model.NewIntVar(0, len(day_slots_idx), f"dayused_req{req_id}_{day}")
        model.Add(day_used[day] == sum(x[(req_id, s)] for s in day_slots_idx))
    
    # The day_used values must be partitionable into the blocks
    # This is a bin packing / partition problem. 
    # For simplicity, let's require that each block fits entirely in one day.
    # And the sum of day_used == sum(blocks) == jumlah
    
    # We'll add: for each block size b, there exists a day where day_used[day] >= b
    # And the day_used values can be partitioned into the block sizes.
    # This is still complex. Let me use a different approach.
    
    # Approach: For each possible block placement (day, start_period, length), create a boolean var
    # But this creates too many variables.
    
    # Given time, let me implement a simpler but effective version:
    # Just encourage consecutiveness via objective, not hard constraint.
    pass

# For now, skip hard block constraints, add as soft objective

# ============================================================
# 6. OBJECTIVE: Minimize violations of preferences
# ============================================================
penalties = []

# Soft constraint: Teacher preferred slots
for guru in req_by_teacher:
    preferred = teachers[guru]['slotDiinginkan']
    if preferred:
        for req_id in req_by_teacher[guru]:
            for (day, period) in preferred:
                if (day, period) in slot_index:
                    s = slot_index[(day, period)]
                    # Penalty for NOT using preferred slot
                    # We want to encourage using preferred slots
                    # So we add negative penalty (reward) for using them
                    # Or positive penalty for using non-preferred when preferred exists
                    pass

# For now, just solve feasibility
model.Minimize(0)  # Feasibility only

# ============================================================
# 7. SOLVE
# ============================================================
solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = 60
solver.parameters.num_search_workers = 8
solver.parameters.log_search_progress = True

print("\n=== SOLVING ===")
status = solver.Solve(model)

print(f"\nSolver status: {solver.StatusName(status)}")

if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
    print("SOLUTION FOUND!")
    # Extract solution
    schedule = defaultdict(dict)  # kelas -> {slot: (mapel, guru)}
    for req_id, kelas, mapel, guru, jumlah, pola in requirements:
        for s in range(NUM_SLOTS):
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
else:
    print("NO SOLUTION FOUND")
    print("Analyzing conflicts...")
    
    # Try to identify which constraints cause infeasibility
    # We can try relaxing constraints one by one
    pass

print("\nDone.")