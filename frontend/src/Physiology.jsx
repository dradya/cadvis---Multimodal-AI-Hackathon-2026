import React from"react";

export default function Physiology({items=[]}){
  return <section className="physio">
    <div className="sec-head"><small>REFERENCE CONTEXT</small><h3>Measured vs. reference</h3></div>
    {items.length?<div className="physio-list">{items.slice(0,8).map(x=><div key={x.label}
      className="physio-row" title={x.note||""}>
      <div className="pr-top"><span>{x.label}</span>
        <b>{x.value??"—"}{x.unit?<i>{x.unit}</i>:null}</b></div>
      <em>ref · {x.reference}</em>
    </div>)}</div>:<p className="muted">Reference rows appear after a prediction returns.</p>}
    <p className="rd-note">Rule-based context for the inputs shown. Reference ranges vary by
      person and guideline; this is not an interpretation.</p>
  </section>;
}
