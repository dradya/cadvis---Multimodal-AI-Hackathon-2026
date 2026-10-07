export const TARGETS=["CAD","LAD","LCX","RCA"];
export const TARGET_LABEL={CAD:"Overall CAD",LAD:"LAD stenosis",LCX:"LCX stenosis",RCA:"RCA stenosis"};
export const VESSEL_LONG={CAD:"Overall coronary disease",LAD:"Left anterior descending",LCX:"Left circumflex",RCA:"Right coronary artery"};
export const pct=x=>x==null?"—":Math.round(x*100)+"%";

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const TEAL=[46,196,166],AMBER=[244,185,66],RED=[255,77,94],GREY=[125,143,153];
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const hex=c=>"#"+c.map(v=>Math.round(clamp(v,0,255)).toString(16).padStart(2,"0")).join("");

export function riskRGB(p){
  if(p==null||isNaN(p))return GREY;
  if(p<=0.5)return mix(TEAL,AMBER,clamp((p-0.1)/0.4,0,1));
  return mix(AMBER,RED,clamp((p-0.5)/0.3,0,1));
}
export function riskColor(p){return hex(riskRGB(p));}

const VDEEP=[70,24,32],VHOT=[255,60,84];
export function vesselRGB(p){
  if(p==null||isNaN(p))return GREY;
  const t=Math.pow(clamp(p,0,1),0.82);
  return mix(VDEEP,VHOT,t);
}
export function vesselColor(p){return hex(vesselRGB(p));}

export function riskBand(p){
  if(p==null||isNaN(p))return{label:"Awaiting",tone:"idle"};
  if(p<0.35)return{label:"Low",tone:"low"};
  if(p<0.65)return{label:"Intermediate",tone:"mid"};
  return{label:"High",tone:"high"};
}

export const LABELS={
  age:"Age",sex:"Sex",weight:"Weight",length:"Height",bmi:"Body mass index",
  dm:"Diabetes",htn:"Hypertension",current_smoker:"Current smoking",ex_smoker:"Ex-smoker",
  fh:"Family history",obesity:"Obesity",crf:"Chronic kidney disease",cva:"Prior stroke",
  airway_disease:"Airway disease",thyroid_disease:"Thyroid disease",chf:"Heart failure",
  dlp:"Dyslipidemia",bp:"Systolic blood pressure",pr:"Pulse",edema:"Edema",
  weak_peripheral_pulse:"Weak peripheral pulses",lung_rales:"Lung rales",
  systolic_murmur:"Systolic murmur",diastolic_murmur:"Diastolic murmur",
  typical_chest_pain:"Typical chest pain",dyspnea:"Dyspnea",function_class:"NYHA class",
  atypical:"Atypical chest pain",nonanginal:"Non-anginal pain",exertional_cp:"Exertional chest pain",
  lowth_ang:"Low-threshold angina",q_wave:"Q waves",st_elevation:"ST elevation",
  st_depression:"ST depression",tinversion:"T-wave inversion",lvh:"LV hypertrophy",
  poor_r_progression:"Poor R progression",bbb:"Bundle branch block",fbs:"Fasting glucose",
  cr:"Creatinine",tg:"Triglycerides",ldl:"LDL cholesterol",hdl:"HDL cholesterol",
  bun:"Urea nitrogen",esr:"ESR",hb:"Hemoglobin",k:"Potassium",na:"Sodium",wbc:"White blood cells",
  lymph:"Lymphocytes",neut:"Neutrophils",plt:"Platelets",ef_tte:"Ejection fraction",
  region_rwma:"Regional wall motion",vhd:"Valvular disease"
};

const pretty=s=>String(s).replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());

export function displayFeature(key){
  const [base,val]=String(key).split("=");
  const label=LABELS[base]||pretty(base);
  if(val==null)return{label,value:null};
  const v=val==="Y"?"Yes":val==="N"?"No":val;
  return{label,value:v};
}

export function fmtValue(v){
  if(v==null||v==="")return"";
  const n=Number(v);
  if(!isNaN(n)&&!Number.isInteger(n))return String(Math.round(n*10)/10);
  return String(v);
}
