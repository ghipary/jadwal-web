from ortools.sat.python import cp_model
import sys
import traceback

print("Starting test", flush=True)

try:
    model = cp_model.CpModel()
    x = model.NewBoolVar('x')
    model.Add(x == 1)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5
    
    print("About to call Solve...", flush=True)
    status = solver.Solve(model)
    print('Status:', solver.StatusName(status), flush=True)
    print('Value:', solver.Value(x), flush=True)
except Exception as e:
    print(f"Exception: {e}", flush=True)
    traceback.print_exc()
    sys.exit(1)

print("Done", flush=True)