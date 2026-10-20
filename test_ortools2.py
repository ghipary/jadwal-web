from ortools.sat.python import cp_model
import sys

print("Starting test", flush=True)
sys.stdout.flush()

model = cp_model.CpModel()
print("Model created", flush=True)
sys.stdout.flush()

x = model.NewBoolVar('x')
print("Var created", flush=True)
sys.stdout.flush()

model.Add(x == 1)
print("Constraint added", flush=True)
sys.stdout.flush()

solver = cp_model.CpSolver()
print("Solver created", flush=True)
sys.stdout.flush()

solver.parameters.max_time_in_seconds = 5
print("Params set", flush=True)
sys.stdout.flush()

status = solver.Solve(model)
print('Status:', solver.StatusName(status), flush=True)
sys.stdout.flush()

print('Value:', solver.Value(x), flush=True)
sys.stdout.flush()

print("Done", flush=True)