import React,{useState}from"react";
import {RotateCcw}from"lucide-react";

const TABS=[["risk","Risk"],["pres","Presentation"],["labs","Vitals & labs"],["test","ECG / echo"]];

function Slider({label,unit,value,min,max,step=1,onChange}){
  const dec=step<1?1:0;
  const v=Number(value);
  const disp=dec?v.toFixed(1):String(Math.round(v));
  const pos=max>min?((v-min)/(max-min))*100:0;
  return <div className="ctl">
    <div className="ctl-head"><span>{label}</span><b>{disp}<i>{unit}</i></b></div>
    <input className="range" type="range" min={min} max={max} step={step} value={v}
      style={{"--p":pos+"%"}} onChange={e=>onChange(Number(e.target.value))}/>
  </div>;
}

function Seg({label,options,value,onChange}){
  return <div className="ctl">
    {label&&<div className="ctl-head"><span>{label}</span></div>}
    <div className="seg">{options.map(o=><button type="button" key={o.v}
      className={String(value)===String(o.v)?"on":""} onClick={()=>onChange(o.v)}>{o.t}</button>)}</div>
  </div>;
}

function Chips({items}){
  return <div className="chips">{items.map(c=><button type="button" key={c.label}
    className={c.on?"on":""} onClick={c.onClick}>{c.label}</button>)}</div>;
}

const ADV=[
  ["weight","Weight","kg",1],["length","Height","cm",1],["cr","Creatinine","mg/dL",0.1],
  ["bun","Urea nitrogen","mg/dL",1],["esr","ESR","mm/h",1],["k","Potassium","mmol/L",0.1],
  ["na","Sodium","mmol/L",1],["wbc","White blood cells","/µL",100],["lymph","Lymphocytes","%",1],
  ["neut","Neutrophils","%",1],["plt","Platelets","×10³/µL",1]
];

export default function Inputs({schema,values,onChange,onReset}){
  const [tab,setTab]=useState("risk");
  const [adv,setAdv]=useState(false);
  if(!schema||!values)return <div className="rail-head"><h2>Clinical inputs</h2>
    <p className="muted">Loading profile schema…</p></div>;

  const F={};schema.fields.forEach(f=>F[f.name]=f);
  const set=(k,v)=>onChange({...values,[k]:v});
  const S=(k,label,unit,step)=>{
    const f=F[k];
    return <Slider label={label} unit={unit} step={step??1} value={values[k]??f.default}
      min={f.min??0} max={f.max??1} onChange={v=>set(k,v)}/>;
  };
  const chip=(label,k,cat)=>({label,on:cat?values[k]==="Y":Number(values[k])===1,
    onClick:()=>set(k,cat?(values[k]==="Y"?"N":"Y"):(Number(values[k])===1?0:1))});
  const bin=(k,cat)=>[{v:cat?"N":"0",t:"No"},{v:cat?"Y":"1",t:"Yes"}];
  const binVal=(k,cat)=>cat?values[k]:Number(values[k])===1?"1":"0";
  const binSet=(k,cat,v)=>set(k,cat?v:(v==="1"?1:0));

  const smoking=values.current_smoker==1?"C":values.ex_smoker==1?"E":"N";
  const chest=values.typical_chest_pain==1?"T":values.atypical==="Y"?"A":values.nonanginal==="Y"?"N":"0";

  return <div className="rail-head">
    <div className="rail-title">
      <h2>Clinical inputs</h2>
      <button className="ghost-btn" title="Reset to dataset defaults" onClick={onReset}><RotateCcw size={13}/> Reset</button>
    </div>
    <div className="tabs">{TABS.map(([id,t])=><button key={id} className={tab===id?"on":""}
      onClick={()=>setTab(id)}>{t}</button>)}</div>

    <div className="tab-body" key={tab}>
      {tab==="risk"&&<>
        {S("age","Age","yrs")}
        <Seg label="Sex" options={[{v:"Female",t:"Female"},{v:"Male",t:"Male"}]}
          value={values.sex} onChange={v=>set("sex",v)}/>
        <Seg label="Smoking" options={[{v:"N",t:"Never"},{v:"C",t:"Current"},{v:"E",t:"Ex"}]}
          value={smoking} onChange={v=>onChange({...values,current_smoker:v==="C"?1:0,ex_smoker:v==="E"?1:0})}/>
        <div className="group-label">Risk factors</div>
        <Chips items={[
          chip("Family history","fh"),chip("Diabetes","dm"),chip("Hypertension","htn"),
          chip("Dyslipidemia","dlp"),chip("Obesity","obesity",true)
        ]}/>
        <div className="group-label">Comorbidity</div>
        <Chips items={[
          chip("Kidney disease","crf",true),chip("Prior stroke","cva",true),chip("Heart failure","chf",true),
          chip("Thyroid disease","thyroid_disease",true),chip("Airway disease","airway_disease",true)
        ]}/>
      </>}

      {tab==="pres"&&<>
        <Seg label="Chest pain pattern" options={[
          {v:"T",t:"Typical"},{v:"A",t:"Atypical"},{v:"N",t:"Non-anginal"},{v:"0",t:"None"}]}
          value={chest} onChange={v=>onChange({...values,typical_chest_pain:v==="T"?1:0,
            atypical:v==="A"?"Y":"N",nonanginal:v==="N"?"Y":"N"})}/>
        <Seg label="Dyspnea" options={bin("dyspnea",true)} value={binVal("dyspnea",true)}
          onChange={v=>binSet("dyspnea",true,v)}/>
        <Seg label="NYHA functional class" options={[{v:0,t:"None"},{v:1,t:"I"},{v:2,t:"II"},{v:3,t:"III"}]}
          value={Number(values.function_class)} onChange={v=>set("function_class",v)}/>
        <div className="group-label">Examination</div>
        <Chips items={[
          chip("Edema","edema"),chip("Lung rales","lung_rales",true),
          chip("Systolic murmur","systolic_murmur",true),chip("Weak pulses","weak_peripheral_pulse",true)
        ]}/>
        <div className="group-label">Angina pattern</div>
        <Chips items={[chip("Low-threshold angina","lowth_ang",true)]}/>
      </>}

      {tab==="labs"&&<>
        {S("bp","Systolic blood pressure","mmHg")}
        {S("pr","Pulse","bpm")}
        {S("bmi","Body mass index","kg/m²",0.1)}
        <div className="group-label">Lipids & metabolism</div>
        {S("ldl","LDL cholesterol","mg/dL")}
        {S("hdl","HDL cholesterol","mg/dL")}
        {S("tg","Triglycerides","mg/dL")}
        {S("fbs","Fasting glucose","mg/dL")}
        <div className="group-label">Haemoglobin</div>
        {S("hb","Haemoglobin","g/dL",0.1)}
        <div className={"disc"+(adv?" open":"")}>
          <button className="disc-btn" onClick={()=>setAdv(v=>!v)}>
            <span>More labs & body metrics</span><b>{adv?"–":"+"}</b>
          </button>
          {adv&&<div className="disc-body">{ADV.map(([k,l,u,st])=><Slider key={k} label={l} unit={u}
            step={st} value={values[k]??F[k].default} min={F[k].min} max={F[k].max}
            onChange={v=>set(k,v)}/>)}</div>}
        </div>
      </>}

      {tab==="test"&&<>
        <div className="group-label">ECG</div>
        <Chips items={[
          chip("Q waves","q_wave"),chip("ST elevation","st_elevation"),chip("ST depression","st_depression"),
          chip("T inversion","tinversion"),chip("LV hypertrophy","lvh",true),chip("Poor R progression","poor_r_progression",true)
        ]}/>
        <Seg label="Bundle branch block" options={[{v:"N",t:"None"},{v:"LBBB",t:"LBBB"},{v:"RBBB",t:"RBBB"}]}
          value={values.bbb} onChange={v=>set("bbb",v)}/>
        <div className="group-label">Echocardiography</div>
        {S("ef_tte","Ejection fraction","%")}
        <Seg label="Regional wall motion abnormality"
          options={[{v:0,t:"0"},{v:1,t:"1"},{v:2,t:"2"},{v:3,t:"3"},{v:4,t:"4"}]}
          value={Number(values.region_rwma)} onChange={v=>set("region_rwma",v)}/>
        <Seg label="Valvular disease" options={[{v:"N",t:"None"},{v:"mild",t:"Mild"},{v:"Moderate",t:"Moderate"},{v:"Severe",t:"Severe"}]}
          value={values.vhd} onChange={v=>set("vhd",v)}/>
      </>}
    </div>

    <p className="rail-note">Unlisted inputs are held at dataset defaults. Estimates recompute automatically.</p>
  </div>;
}
