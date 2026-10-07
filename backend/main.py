import json
from pathlib import Path
from typing import Any
import numpy as np,pandas as pd
from fastapi import FastAPI,HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel,ConfigDict
from backend.physiology import reference_breakdown
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/"ml"/"artifacts";TARGETS=["CAD","LAD","LCX","RCA"]
app=FastAPI(title="CADViz Educational Prototype",version="1.0")
app.add_middleware(CORSMiddleware,allow_origins=["*"],allow_methods=["*"],allow_headers=["*"])
class Input(BaseModel):
    model_config=ConfigDict(extra="forbid")
    features:dict[str,Any]
def sigmoid(z):return 1/(1+np.exp(-np.clip(z,-35,35)))
def load():
    if not (ART/"feature_schema.json").exists():raise RuntimeError("Model artifacts missing. Run ml/train.py first.")
    schema=json.loads((ART/"feature_schema.json").read_text());metrics=json.loads((ART/"metrics.json").read_text())
    models={t:json.loads((ART/f"model_{t.lower()}.json").read_text()) for t in TARGETS}
    return schema,metrics,models
try:SCHEMA,METRICS,MODELS=load();ERROR=None
except Exception as e:SCHEMA=METRICS=None;MODELS={};ERROR=str(e)
@app.get("/health")
def health():return {"ok":ERROR is None,"message":ERROR or "ready"}
@app.get("/schema")
def schema():
    if SCHEMA is None:raise HTTPException(503,ERROR)
    return SCHEMA
@app.get("/metrics")
def metrics():
    if METRICS is None:raise HTTPException(503,ERROR)
    return METRICS
def encode_one(model,values):
    z=[];raw={}
    for m in model["meta"]:
        name=m["name"];v=values.get(name,m["default"]);raw[name]=v
        if m["type"]=="number":
            try:x=float(v)
            except (ValueError,TypeError):x=float(m["default"])
            z.append((x-m["mean"])/m["scale"])
        else:
            key=str(v) if str(v) in m["options"] else str(m["default"])
            z.extend([1.0 if key==opt else 0.0 for opt in m["options"]])
    return np.asarray(z,dtype=float),raw
@app.post("/predict")
def predict(req:Input):
    if SCHEMA is None:raise HTTPException(503,ERROR)
    fields=SCHEMA["fields"];names=[f["name"] for f in fields];unknown=sorted(set(req.features)-set(names))
    if unknown:raise HTTPException(422,f"Unknown fields: {unknown}")
    defaults={f["name"]:f["default"] for f in fields};values=defaults|req.features
    missing=[n for n in names if req.features.get(n) in (None,"")]
    probs={};explanations={}
    for target,model in MODELS.items():
        z,raw=encode_one(model,values);margin=float(np.dot(z,model["weights"])+model["intercept"])
        calibrated=float(model["calibration_slope"]*margin+model["calibration_intercept"]);probs[target]=float(sigmoid(calibrated))
        contributions=(z-np.asarray(model["background"]))*np.asarray(model["weights"])*model["calibration_slope"]
        names2=model["encoded_names"];rank=sorted(zip(names2,contributions),key=lambda a:abs(float(a[1])),reverse=True)[:8]
        explanations[target]=[{"feature":n,"contribution":float(c),"raw_value":raw.get(n.split("=")[0]),"direction":"increases" if c>0 else "decreases"} for n,c in rank]
    row=pd.DataFrame([values]);physiology=reference_breakdown(row)
    return {"probabilities":probs,"explanations":explanations,"physiology":physiology,"imputed_count":len(missing),
      "explanation_note":"Exact linear SHAP contributions on calibrated log-odds under an independent-feature assumption; they describe model output, not physiological cause."}

