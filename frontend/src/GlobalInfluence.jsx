import React from"react";
import {displayFeature}from"./theme.js";

export default function GlobalInfluence({items=[]}){
  const top=items.slice(0,8);
  const max=Math.max(...top.map(x=>x.mean_abs_shap||0),1e-9);
  return <section className="influence">
    <div className="sec-head"><small>MODEL</small><h3>Global feature influence</h3></div>
    {top.length?<div className="infl-list">{top.map(x=>{
      const d=displayFeature(x.feature);
      return <div key={x.feature} className="infl-row">
        <span>{d.label}</span>
        <i><b style={{width:Math.max(3,(x.mean_abs_shap/max)*100)+"%"}}/></i>
        <em>{(x.mean_abs_shap||0).toFixed(3)}</em>
      </div>;
    })}</div>:<p className="muted">Global summary unavailable.</p>}
    <p className="rd-note">Mean absolute SHAP across the training set — how much the model
      generally leans on each feature, not how physiology works.</p>
  </section>;
}
