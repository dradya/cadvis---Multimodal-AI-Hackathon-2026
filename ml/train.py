import argparse,json
from pathlib import Path
import numpy as np,pandas as pd
from features import LEAKAGE_COLS,TARGETS,load_dataset,prepare_targets_and_features

def sigmoid(z):return 1/(1+np.exp(-np.clip(z,-35,35)))
def auc(y,p):
    pos=p[y==1];neg=p[y==0]
    if not len(pos) or not len(neg):return None
    return float(((pos[:,None]>neg[None,:]).sum()+.5*(pos[:,None]==neg[None,:]).sum())/(len(pos)*len(neg)))
def average_precision(y,p):
    order=np.argsort(-p);ys=y[order];hits=np.cumsum(ys);ranks=np.arange(1,len(y)+1)
    return float((hits/ranks*ys).sum()/max(1,ys.sum()))
def metrics(y,p):
    pred=(p>=.5).astype(int);tp=int(((pred==1)&(y==1)).sum());fp=int(((pred==1)&(y==0)).sum());fn=int(((pred==0)&(y==1)).sum())
    prec=tp/max(1,tp+fp);rec=tp/max(1,tp+fn)
    return {"accuracy":float((pred==y).mean()),"precision":prec,"recall":rec,"f1":2*prec*rec/max(1e-15,prec+rec),"roc_auc":auc(y,p),"pr_auc":average_precision(y,p),"brier_score":float(np.mean((p-y)**2))}
class Encoder:
    def fit(self,X):
        self.meta=[]
        for c in X.columns:
            s=X[c]
            if pd.api.types.is_numeric_dtype(s):
                a=pd.to_numeric(s,errors="coerce").to_numpy(float); med=float(np.nanmedian(a)); a=np.where(np.isfinite(a),a,med); mean=float(a.mean());scale=float(a.std()) or 1.0
                self.meta.append({"name":c,"type":"number","default":med,"min":float(a.min()),"max":float(a.max()),"mean":mean,"scale":scale,"encoded":[c]})
            else:
                vals=s.dropna().astype(str); mode=str(vals.mode().iloc[0]) if len(vals) else ""; cats=sorted(vals.unique().tolist())
                if mode not in cats:cats.append(mode)
                self.meta.append({"name":c,"type":"category","default":mode,"options":cats,"encoded":[f"{c}={v}" for v in cats]})
        return self
    def transform(self,X):
        out=[]
        for m in self.meta:
            c=m["name"]
            if m["type"]=="number":
                a=pd.to_numeric(X[c],errors="coerce").to_numpy(float);a=np.where(np.isfinite(a),a,m["default"]);out.append(((a-m["mean"])/m["scale"])[:,None])
            else:
                vals=X[c].fillna(m["default"]).astype(str).to_numpy()
                vals=np.array([v if v in m["options"] else m["default"] for v in vals])
                out.extend([(vals==v).astype(float)[:,None] for v in m["options"]])
        return np.concatenate(out,axis=1) if out else np.zeros((len(X),0))
    @property
    def names(self):return [n for m in self.meta for n in m["encoded"]]
def fit_lr(X,y,epochs=1500,lr=.08,reg=.025,balanced=True):
    n,d=X.shape;w=np.zeros(d);b=0.0
    sample=np.ones(n)
    if balanced:
        pos=max(1,int(y.sum()));neg=max(1,n-pos);sample=np.where(y==1,n/(2*pos),n/(2*neg))
    for _ in range(epochs):
        p=sigmoid(X@w+b);err=(p-y)*sample
        gw=X.T@err/n+reg*w;gb=float(err.mean())
        w-=lr*gw;b-=lr*gb
        if np.linalg.norm(gw)<1e-6 and abs(gb)<1e-6:break
    return w,float(b)
def folds(y,k,seed):
    rng=np.random.default_rng(seed);parts=[[] for _ in range(k)]
    for label in (0,1):
        ids=np.flatnonzero(y==label);rng.shuffle(ids)
        for i,chunk in enumerate(np.array_split(ids,k)):parts[i].extend(chunk.tolist())
    return [np.array(sorted(x),dtype=int) for x in parts]
def split_indices(y,test=.2,seed=42):
    rng=np.random.default_rng(seed);tr=[];te=[]
    for label in (0,1):
        ids=np.flatnonzero(y==label);rng.shuffle(ids);n=max(1,int(round(len(ids)*test)))
        te.extend(ids[:n]);tr.extend(ids[n:])
    return np.array(sorted(tr)),np.array(sorted(te))
def calibration(margins,y):
    a=1.0;b=0.0
    for _ in range(1800):
        p=sigmoid(a*margins+b);err=p-y
        ga=float(np.mean(err*margins))+.0005*a;gb=float(np.mean(err))
        a-=.03*ga;b-=.03*gb
        if abs(ga)+abs(gb)<1e-7:break
    return float(a),float(b)
def fit_fold(X,y):
    enc=Encoder().fit(X);z=enc.transform(X);w,b=fit_lr(z,y);return enc,w,b
def schema_field(m):
    return {"name":m["name"],"label":m["name"].replace("_"," ").title(),"type":m["type"],"default":m["default"],"options":m.get("options",[]),"min":m.get("min"),"max":m.get("max")}
def train_all(df,out):
    X,ys=prepare_targets_and_features(df);assert not (set(X.columns)&LEAKAGE_COLS)
    out=Path(out);out.mkdir(parents=True,exist_ok=True)
    schema={"targets":list(TARGETS),"fields":[],"dataset":"UCI Extension of Z-Alizadeh Sani (id 411)"}
    report={"dataset":{"rows":len(X),"features":len(X.columns)},"targets":{}}
    for target,yseries in ys.items():
        y=yseries.to_numpy(int);tr,ho=split_indices(y);Xt=X.iloc[tr].reset_index(drop=True);yt=y[tr];Xh=X.iloc[ho].reset_index(drop=True);yh=y[ho]
        k=min(5,int(np.bincount(yt).min()))
        if k<2:raise ValueError(f"{target} has too few cases in one class for stratified CV.")
        cvrows=[]
        for repeat in range(5):
            for valid in folds(yt,k,42+repeat):
                train=np.setdiff1d(np.arange(len(yt)),valid)
                enc,w,b=fit_fold(Xt.iloc[train].reset_index(drop=True),yt[train]);pv=sigmoid(enc.transform(Xt.iloc[valid].reset_index(drop=True))@w+b)
                cvrows.append(metrics(yt[valid],pv))
        cv={key:{"mean":float(np.mean([r[key] for r in cvrows])),"std":float(np.std([r[key] for r in cvrows],ddof=1))} for key in cvrows[0]}
        # Cross-fitted margins calibrate the score without using the holdout.
        oof=np.zeros(len(yt));cal_k=min(3,int(np.bincount(yt).min()))
        for i,valid in enumerate(folds(yt,cal_k,73)):
            train=np.setdiff1d(np.arange(len(yt)),valid);enc0,w0,b0=fit_fold(Xt.iloc[train].reset_index(drop=True),yt[train])
            oof[valid]=enc0.transform(Xt.iloc[valid].reset_index(drop=True))@w0+b0
        ca,cb=calibration(oof,yt)
        encoder,w,b=fit_fold(Xt,yt);p=sigmoid(ca*(encoder.transform(Xh)@w+b)+cb)
        # Linear SHAP values on calibrated log-odds, using the training population as background.
        ztrain=encoder.transform(Xt);bg=ztrain.mean(axis=0);contrib=np.abs((ztrain-bg)*(w*ca)).mean(axis=0)
        grouped={}
        for name,val in zip(encoder.names,contrib):
            parent=name.split("=")[0];grouped[parent]=grouped.get(parent,0.0)+float(val)
        global_shap=[{"feature":n,"mean_abs_shap":v} for n,v in sorted(grouped.items(),key=lambda x:x[1],reverse=True)[:20]]
        artifact={"target":target,"features":[m["name"] for m in encoder.meta],"meta":encoder.meta,"encoded_names":encoder.names,"weights":w.tolist(),"intercept":b,"calibration_slope":ca,"calibration_intercept":cb,"background":bg.tolist()}
        (out/f"model_{target.lower()}.json").write_text(json.dumps(artifact,indent=2),encoding="utf-8")
        report["targets"][target]={"selected_model":"L2 logistic regression","cv":cv,"holdout":metrics(yh,p),"holdout_n":len(yh),"positive_rate":float(y.mean()),"global_shap":global_shap}
        if not schema["fields"]:schema["fields"]=[schema_field(m) for m in encoder.meta]
    (out/"feature_schema.json").write_text(json.dumps(schema,indent=2),encoding="utf-8")
    (out/"metrics.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    return report
if __name__=="__main__":
    ap=argparse.ArgumentParser();ap.add_argument("--data");ap.add_argument("--output",default=str(Path(__file__).parent/"artifacts"));args=ap.parse_args()
    result=train_all(load_dataset(args.data),args.output);print(f"Trained {len(result['targets'])} targets on {result['dataset']['rows']} records.")

