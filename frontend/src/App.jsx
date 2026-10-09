import React,{useEffect,useMemo,useRef,useState}from"react";
import {HeartPulse,AlertTriangle}from"lucide-react";
import Heart3D from"./Heart3D.jsx";
import Inputs from"./Inputs.jsx";
import Readout from"./Readout.jsx";
import Physiology from"./Physiology.jsx";
import GlobalInfluence from"./GlobalInfluence.jsx";
import {TARGETS,pct,riskBand,vesselColor,TARGET_LABEL,VESSEL_LONG}from"./theme.js";

const API=import.meta.env.VITE_API_URL||"http://localhost:8000";
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const DECK_TABS=[["report","Report"],["physio","Physiology"],["global","Global influence"]];
const EMPTY_PROBS={};

export default function App(){
  const [schema,setSchema]=useState(null);
  const [metrics,setMetrics]=useState(null);
  const [values,setValues]=useState(null);
  const [result,setResult]=useState(null);
  const [selected,setSelected]=useState("CAD");
  const [hovered,setHovered]=useState(null);
  const [status,setStatus]=useState("connecting");
  const [error,setError]=useState("");
  const [ok,setOk]=useState(()=>localStorage.getItem("cadviz-ok")==="1");
  const [railW,setRailW]=useState(()=>{
    const s=parseFloat(localStorage.getItem("cadviz-rail")||"");
    return Number.isFinite(s)?clamp(s,260,560):320;
  });
  const [heartW,setHeartW]=useState(()=>{
    const s=parseFloat(localStorage.getItem("cadviz-heart")||"");
    return Number.isFinite(s)?clamp(s,340,760):520;
  });
  const [deckTab,setDeckTab]=useState("report");
  const [resize,setResize]=useState({});
  const seq=useRef(0);
  const wsRef=useRef(null);
  const drag=useRef(null);
  const applyRail=w=>{setRailW(w);try{localStorage.setItem("cadviz-rail",String(w))}catch(e){}};
  const applyHeart=w=>{setHeartW(w);try{localStorage.setItem("cadviz-heart",String(w))}catch(e){}};

  const startHandle=(mode,e)=>{
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current={mode,x:e.clientX,y:e.clientY,rail:railW,heart:heartW};
    setResize({active:mode});
  };
  const moveHandle=e=>{
    const d=drag.current;if(!d)return;
    if(d.mode==="rail"){
      const w=wsRef.current?.getBoundingClientRect().width||900;
      applyRail(clamp(d.rail+(e.clientX-d.x),260,Math.max(260,w-380)));
    }else{
      const r=wsRef.current?.getBoundingClientRect();
      const w=r?.width||1200;
      applyHeart(clamp((r?r.left+r.width:w)-e.clientX,340,Math.min(760,Math.round(w*.55))));
    }
  };
  const endHandle=()=>{drag.current=null;setResize({});};

  useEffect(()=>{
    let alive=true;
    Promise.all([fetch(API+"/schema"),fetch(API+"/metrics")])
      .then(async([a,b])=>{
        if(!a.ok||!b.ok)throw Error("API error while loading schema/metrics.");
        const s=await a.json(),m=await b.json();
        if(!alive)return;
        setSchema(s);setMetrics(m);
        setValues(Object.fromEntries(s.fields.map(f=>[f.name,f.default])));
        setStatus("live");
      })
      .catch(()=>{if(alive){setStatus("error");
        setError("API unreachable at "+API+" — start the backend (uvicorn backend.main:app).")}});
    return()=>{alive=false};
  },[]);

  useEffect(()=>{
    if(!schema||!values)return;
    const id=++seq.current;
    setStatus(s=>s==="error"&&error.startsWith("API unreachable")?s:"computing");
    const t=setTimeout(async()=>{
      try{
        const r=await fetch(API+"/predict",{method:"POST",
          headers:{"Content-Type":"application/json"},body:JSON.stringify({features:values})});
        const d=await r.json();
        if(!r.ok)throw Error(d.detail||"Prediction failed");
        if(id===seq.current){setResult(d);setError("");setStatus("live")}
      }catch(e){if(id===seq.current){setError(e.message);setStatus("error")}}
    },320);
    return()=>clearTimeout(t);
  },[schema,values]); // eslint-disable-line

  const reset=()=>{
    if(!schema)return;
    setValues(Object.fromEntries(schema.fields.map(f=>[f.name,f.default])));
  };

  const p=result?.probabilities?.[selected]??null;
  const band=riskBand(p);
  const metric=metrics?.targets?.[selected]?.holdout??{};
  const imputed=result?.imputed_count||0;
  const probs=result?.probabilities;
  const heartInputs=useMemo(()=>values?{pr:values.pr,ef_tte:values.ef_tte,bp:values.bp,htn:values.htn,bmi:values.bmi}:null,
    [values?.pr,values?.ef_tte,values?.bp,values?.htn,values?.bmi]);

  return <div className="app">
    <header className="topbar">
      <div className="brand">
        <HeartPulse size={17}/>
        <b>CAD<em>viz</em></b>
        <span>Cardiovascular Risk Explorer</span>
      </div>
      <nav className="targetsel" aria-label="Target vessel">
        {TARGETS.map(t=><button key={t} className={selected===t?"on":""} onClick={()=>setSelected(t)}>
          {t==="CAD"?"CAD":t}</button>)}
      </nav>
      <div className={"status st-"+status}><i/>{status==="live"?"model ready":status==="computing"?"computing…":status==="error"?"api error":"connecting…"}</div>
    </header>

    <div className="safety-strip">
      <AlertTriangle size={13}/>
      <span><b>Educational prototype.</b> Experimental estimates only — not a diagnosis and never a
      basis for care. Diffuse vessel-level risk is shown; lesion location and stenosis severity are not predicted.</span>
    </div>

    {error&&<div className="error-bar">{error}</div>}

    <div className="workspace" ref={wsRef} style={{"--rail":railW+"px"}}>
      <aside className="col">
        <Inputs schema={schema} values={values} onChange={setValues} onReset={reset}/>
      </aside>

      <div className={"v-handle"+(resize.active==="rail"?" drag":"")}
        onPointerDown={e=>startHandle("rail",e)}
        onPointerMove={moveHandle} onPointerUp={endHandle} onPointerCancel={endHandle}/>

      <section className="col col-stage">
        <div className="stage-zone">
          <section className="deck">
            <div className="deck-head">
              <div className="deck-id">
                <small>RISK CONSOLE · {selected}</small>
                <h2>{TARGET_LABEL[selected]}</h2>
                <p>{VESSEL_LONG[selected]}</p>
              </div>

              <div className="deck-hero" style={{"--c":vesselColor(p)}}>
                <b>{pct(p)}</b>
                <span className={"band "+band.tone}>{band.label}</span>
              </div>

              <div className="deck-scale">
                <i className="track"/>
                <i className="mark" style={{left:p==null?"0%":Math.max(1,Math.min(99,p*100))+"%"}}/>
                <span className="lo">low</span><span className="hi">high</span>
              </div>

              <div className="deck-meta">
                <span>ROC-AUC<b className="hl">{metric.roc_auc!=null?metric.roc_auc.toFixed(3):"—"}</b></span>
                <span>Precision<b>{metric.precision!=null?metric.precision.toFixed(3):"—"}</b></span>
                <span>Recall<b>{metric.recall!=null?metric.recall.toFixed(3):"—"}</b></span>
                <span>Defaulted<b>{imputed>0?imputed:0}</b></span>
              </div>

              <div className="deck-tabs">
                {DECK_TABS.map(([id,t])=><button key={id} className={deckTab===id?"on":""}
                  onClick={()=>setDeckTab(id)}>{t}</button>)}
              </div>
            </div>

            <div className="deck-body">
              {deckTab==="report"&&<Readout target={selected} result={result}/>}
              {deckTab==="physio"&&<Physiology items={result?.physiology||[]}/>}
              {deckTab==="global"&&<GlobalInfluence items={metrics?.targets?.[selected]?.global_shap||[]}/>}
            </div>}
          </section>

          <div className={"split-handle"+(resize.active==="heart"?" drag":"")}
            onPointerDown={e=>startHandle("heart",e)}
            onPointerMove={moveHandle} onPointerUp={endHandle} onPointerCancel={endHandle}/>

          <div className="stage-card" style={{width:heartW+"px"}}>
            <div className="stage-head">
              <div><small>3D HEART · ANTERIOR VIEW</small>
                <h2>Risk-weighted coronary anatomy</h2></div>
              <div className="stage-head-r">
                <span className="sel-chip" style={{"--c":vesselColor(p)}}>
                  <i/> {selected} <b>{pct(p)}</b> <em className={band.tone}>{band.label}</em>
                </span>
              </div>
            </div>
            {schema?
              <Heart3D probabilities={probs||EMPTY_PROBS} values={heartInputs} selectedVessel={selected}
                hoveredVessel={hovered} onSelectVessel={setSelected} onHoverVessel={setHovered}/>
              :<div className="stage-fallback">{status==="error"?"Waiting on the API…":"Connecting to the API…"}</div>}
          </div>
        </div>
      </section>
    </div>

    <footer>
      <span>UCI Extension of Z-Alizadeh Sani dataset · CC BY 4.0</span>
      <span>CADViz · educational hackathon prototype · logistic models + linear SHAP</span>
    </footer>

    {!ok&&<div className="overlay">
      <article>
        <AlertTriangle size={26}/>
        <small>SAFETY ACKNOWLEDGEMENT</small>
        <h2>Educational demonstration only</h2>
        <p>These experimental estimates are not a diagnosis and must not guide care. They do not
        replace medical assessment, angiography, imaging, or advice from a qualified clinician.</p>
        <button className="primary" onClick={()=>{localStorage.setItem("cadviz-ok","1");setOk(true)}}>I understand</button>
      </article>
    </div>}
  </div>;
}