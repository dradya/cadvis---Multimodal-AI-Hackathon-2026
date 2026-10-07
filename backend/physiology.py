import pandas as pd
# Reference descriptions are educational context only; they do not classify a patient.
REFS=[
 (("bp","trestbps","blood_pressure"),"Systolic blood pressure","mmHg","normal criterion <120 systolic and <80 diastolic; dataset includes systolic only"),
 (("fbs","fasting_blood_sugar"),"Fasting blood sugar","mg/dL","70–99 when fasting 8–12 hours"),
 (("ldl",),"LDL cholesterol","mg/dL","<100 (general reference; personal targets vary)"),
 (("hdl",),"HDL cholesterol","mg/dL","≥40 men; ≥50 women"),
 (("ef_tte","ef","ejection_fraction"),"Ejection fraction","%","55–70"),
 (("hb","hemoglobin"),"Hemoglobin","g/dL","Varies by sex and laboratory"),
]
def reference_breakdown(row):
    out=[]
    for aliases,label,unit,reference in REFS:
        key=next((k for k in aliases if k in row.columns),None)
        if key is None:continue
        raw=pd.to_numeric(row.iloc[0][key],errors="coerce");value=None if pd.isna(raw) else float(raw)
        out.append({"label":label,"value":value,"unit":unit,"reference":reference,
                    "status":"reference_context_only","note":"Illustrative context only, not model output or a clinical interpretation"})
    return out


