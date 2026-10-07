import re,io,zipfile
from urllib.request import urlopen
import numpy as np
import pandas as pd
TARGETS={"CAD":"cath","LAD":"lad","LCX":"lcx","RCA":"rca"}
LEAKAGE_COLS={"cath","lad","lcx","rca"}
POS={"1","1.0","yes","y","true","positive","cad","stenosis","stenotic","disease","present"}
NEG={"0","0.0","no","n","false","negative","normal","none","absent","non-stenotic","nonstenotic"}
UCI_ARCHIVE="https://archive.ics.uci.edu/static/public/411/extention%2Bof%2Bz%2Balizadeh%2Bsani%2Bdataset.zip"
def canonical(s):
    return re.sub(r"_+","_",re.sub(r"[^a-z0-9]+","_",str(s).strip().lower())).strip("_")
def load_dataset(path=None):
    if path:return pd.read_excel(path) if str(path).lower().endswith((".xlsx",".xls")) else pd.read_csv(path)
    with urlopen(UCI_ARCHIVE,timeout=60) as response:archive=zipfile.ZipFile(io.BytesIO(response.read()))
    workbook=next((n for n in archive.namelist() if n.lower().endswith((".xlsx",".xls"))),None)
    if workbook is None:raise RuntimeError("UCI archive did not contain an Excel workbook.")
    return pd.read_excel(io.BytesIO(archive.read(workbook)))
def prepare_targets_and_features(df):
    d=df.copy();d.columns=[canonical(c) for c in d.columns]
    if d.columns.duplicated().any():raise ValueError("Duplicate columns after name normalization.")
    missing=set(TARGETS.values())-set(d.columns)
    if missing:raise ValueError(f"UCI target columns missing: {sorted(missing)}. Check workbook/header.")
    ys={}
    for name,col in TARGETS.items():
        def binary(v):
            if pd.isna(v):raise ValueError(f"Missing label in {name}.")
            key=str(v).strip().lower()
            if key in POS:return 1
            if key in NEG:return 0
            try:
                n=float(key)
                if n in (0,1):return int(n)
            except ValueError:pass
            raise ValueError(f"Unrecognized {name} label: {v!r}")
        ys[name]=d[col].map(binary).astype(int).reset_index(drop=True)
    X=d.drop(columns=list(LEAKAGE_COLS)).copy()
    assert not set(X.columns)&LEAKAGE_COLS
    for c in X:
        s=X[c].replace(["?","-",""],np.nan);n=pd.to_numeric(s,errors="coerce")
        if n.notna().sum()>=max(1,int(s.notna().sum()*.9)):X[c]=n
        else:
            values=s.astype("string").str.strip()
            if c=="sex":values=values.replace({"Fmale":"Female","female":"Female","male":"Male"})
            X[c]=values
    return X.reset_index(drop=True),ys

