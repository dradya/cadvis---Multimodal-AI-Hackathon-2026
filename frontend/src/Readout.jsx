import React from"react";
import {displayFeature,fmtValue}from"./theme.js";

function ShapRow({s,max}){
  const d=displayFeature(s.feature);
  const w=Math.min(Math.abs(s.contribution)/max,1)*48;
  const up=s.contribution>0;
  const raw=fmtValue(s.raw_value);
  return <div className="shap-row" title={raw?`${d.label} = ${raw}`:d.label}>
    <span className="nm">{d.label}{d.value!=null&&<i>{d.value}</i>}</span>
    <span className={"bar "+(up?"up":"dn")}>
      <i style={{width:w+"%"}}/>
      <u/>
    </span>
    <b className={up?"up":"dn"}>{up?"+":"−"}{Math.abs(s.contribution).toFixed(3)}</b>
  </div>;
}

export default function Readout({target,result}){
  const shap=(result?.explanations?.[target]||[]).slice(0,9);
  const max=Math.max(...shap.map(s=>Math.abs(s.contribution)||0),1e-6);
  return <div className="report-body">
    <div className="sec-head"><small>LOCAL EXPLANATION</small><h3>Top contributing features</h3></div>
    {shap.length?<div className="shap">{shap.map(s=><ShapRow key={s.feature} s={s} max={max}/>)}</div>
      :<p className="muted">Estimates appear once the API responds.</p>}
    <p className="rd-note">{result?.explanation_note||
      "Bars show each feature's contribution to this target's model output (linear SHAP; positive pushes the estimate up, negative pulls it down). Associations are not causal."}
      {" "}Lesion location and stenosis severity are not predicted.</p>
  </div>;
}