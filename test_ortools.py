from ortools.sat.python import cp_model

model = cp_model.CpModel()
x = model.NewBoolVar('x')
model.Add(x == 1)
solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = 5
status = solver.Solve(model)
print('Status:', solver.StatusName(status))
print('Value:', solver.Value(x))