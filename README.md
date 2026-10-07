# CADViz — Cardiovascular Risk Explorer

A solo-build educational prototype for overall CAD and vessel-level LAD/LCX/RCA model probabilities.

## Run
1. Python 3.10+ and Node.js 20+.
2. Create a virtual environment; install with `pip install -r backend/requirements.txt`.
3. Train from a local UCI workbook: `python ml/train.py --data path/to/dataset.xlsx`. Without `--data`, the official UCI workbook is downloaded directly.
4. Start API: `.\run_backend.ps1`.
5. In another terminal: `cd frontend; npm install; npm run dev`; open Vite's local URL.
6. API defaults to http://localhost:8000; set VITE_API_URL to change it.

Four independent L2 logistic models, schemas, metrics, and weights are included in ml/artifacts. The source training implementation uses NumPy/pandas because this environment blocks scikit-learn native extensions. Preprocessing, cross-validation, holdout evaluation, sigmoid calibration, and linear SHAP are implemented explicitly.

## Safety
Experimental and educational only, not a diagnosis or substitute for medical care or diagnostic imaging. Uniform vessel coloring shows vessel-level probability; lesion location is not predicted. The small historical dataset does not establish clinical validity. Reference measurements are illustrative context, not clinical classifications.
