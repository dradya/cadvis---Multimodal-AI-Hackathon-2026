import React,{useMemo,useRef,useState,useEffect}from"react";
import {Canvas,useFrame,useThree}from"@react-three/fiber";
import {OrbitControls,Html,Environment,Lightformer}from"@react-three/drei";
import * as THREE from"three";
import {vesselColor,pct}from"./theme.js";

const TAU=Math.PI*2,D2R=Math.PI/180;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(e0,e1,x)=>{const t=clamp((x-e0)/(e1-e0),0,1);return t*t*(3-2*t)};
const angD=(a,b)=>{let d=(a-b)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d};
const TILT_X=-0.30,TILT_Z=0.42;
const CAM=[1.2,0.6,5.4];
const NEUTRAL_SHAPE={lvWall:0,dilation:0};
function readNum(values,k,fb){const n=Number(values&&values[k]);return Number.isFinite(n)?n:fb;}
function heartParams(values,probabilities){
  const pr=readNum(values,"pr",72),ef=readNum(values,"ef_tte",58),bp=readNum(values,"bp",120);
  const htn=readNum(values,"htn",0),bmi=readNum(values,"bmi",26.8);
  const rate=clamp(pr/60,0.5,2.2);
  const strength=clamp(0.45+(ef-28)/95,0.35,1.25);
  const lvWall=clamp(0.65*clamp((bp-110)/80,0,1)+0.35*clamp(htn,0,1),0,1);
  const dilation=clamp((58-ef)/40,0,1);
  const mass=1+0.09*lvWall+0.03*clamp((bmi-25)/15,0,1)+0.04*dilation;
  const risk=probabilities&&probabilities.CAD!=null?probabilities.CAD:null;
  return {pr,ef,bp,rate,strength,lvWall,dilation,mass,risk};
}

/* ---------- parametric ventricular mass ---------- */
function vPoint(v,th,out,sh){
  sh=sh||NEUTRAL_SHAPE;
  const lv=sh.lvWall||0,dila=sh.dilation||0;
  v=clamp(v,0,1);
  const g=Math.pow(v,2.6);
  let R=2*Math.sqrt(Math.max(0,g*(1-g)));
  R*=1-0.17*Math.exp(-Math.pow((v-0.94)/0.06,2));                                              // coronary sulcus
  R*=1+0.16*Math.exp(-Math.pow((v-0.52)/0.36,2))*Math.exp(-Math.pow(angD(th,125*D2R)/0.58,2)); // RV free wall (anterior wrap)
  R*=1+(0.07+0.18*lv)*Math.exp(-Math.pow((v-0.42)/0.42,2))*Math.exp(-Math.pow(angD(th,-20*D2R)/0.75,2)); // LV fullness (left border)
  R*=1+0.10*dila*Math.exp(-Math.pow((v-0.45)/0.4,2));
  R*=0.8+0.2*smooth(0,0.38,v);                                                                // taper to a pointed apex
  const gIv=smooth(0.04,0.16,v)*smooth(0.99,0.86,v);
  R*=1-0.12*gIv*Math.exp(-Math.pow(angD(th,lerp(66,100,v)*D2R)/0.12,2));                       // anterior IV groove
  R*=1-0.095*gIv*Math.exp(-Math.pow(angD(th,lerp(296,276,v)*D2R)/0.145,2));                   // posterior IV groove
  const ap=smooth(0.3,0.99,v);                                                                  // apex sweeps down, forward, left
  const y=-1.18+2.06*v-0.1*smooth(0.4,0.05,v)*Math.exp(-Math.pow(angD(th,252*D2R)/0.9,2));     // diaphragmatic underside
  return out.set(R*Math.cos(th)*0.88+0.17*ap,y,R*Math.sin(th)*0.74+0.26*ap);
}
function vNormal(v,th,out,sh){
  const vv=Math.max(v,0.035),e=0.005,et=0.008;
  const a=vPoint(vv+e,th,new THREE.Vector3(),sh),b=vPoint(Math.max(0,vv-e),th,new THREE.Vector3(),sh);
  const c=vPoint(vv,th+et,new THREE.Vector3(),sh),d=vPoint(vv,th-et,new THREE.Vector3(),sh);
  out.crossVectors(a.sub(b),c.sub(d));
  if(!isFinite(out.x)||out.lengthSq()<1e-12)return out.set(0,-1,0);
  return out.normalize();
}
function buildVentricle(sh,nV=96,nT=112){
  const pos=[],nor=[],uv=[],idx=[],p=new THREE.Vector3(),n=new THREE.Vector3();
  for(let i=0;i<=nV;i++){
    const v=i/nV;
    for(let j=0;j<=nT;j++){
      const th=j/nT*TAU;
      vPoint(v,th,p,sh);vNormal(v,th,n,sh);
      pos.push(p.x,p.y,p.z);nor.push(n.x,n.y,n.z);uv.push(j/nT*2,v*1.9);
    }
  }
  for(let i=0;i<nV;i++)for(let j=0;j<nT;j++){
    const a=i*(nT+1)+j,b=a+1,c=a+nT+1,d=c+1;
    idx.push(a,c,b,b,c,d);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute("normal",new THREE.Float32BufferAttribute(nor,3));
  g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx);g.computeBoundingSphere();
  return g;
}
function hexa(hex,a){const n=parseInt(hex.slice(1),16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;}
function myocardiumTexture(size=1024){
  const c=document.createElement("canvas");c.width=c.height=size;
  const g=c.getContext("2d");
  g.fillStyle="#96604f";g.fillRect(0,0,size,size);
  const pal=["#7c3f3a","#ab7460","#6b3236","#bd8f70","#87484b","#a06854"];
  for(let i=0;i<340;i++){
    const x=Math.random()*size,y=Math.random()*size,r=size*(0.015+Math.random()*0.06);
    const col=pal[i%pal.length],gr=g.createRadialGradient(x,y,0,x,y,r);
    gr.addColorStop(0,hexa(col,0.30));gr.addColorStop(1,hexa(col,0));
    g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();
  }
  for(let i=0;i<2600;i++){
    const x=Math.random()*size,y=Math.random()*size;
    const len=size*(0.012+Math.random()*0.05);
    const ang=(Math.random()-0.5)*0.8+(Math.random()<0.72?Math.PI/2:0);
    g.strokeStyle=Math.random()<0.5
      ?`rgba(214,164,138,${0.04+Math.random()*0.07})`
      :`rgba(74,26,30,${0.05+Math.random()*0.09})`;
    g.lineWidth=0.5+Math.random()*1.4;
    const cx=x+Math.cos(ang)*len*0.5+(Math.random()-0.5)*len*0.3;
    const cy=y+Math.sin(ang)*len*0.5+(Math.random()-0.5)*len*0.3;
    g.beginPath();g.moveTo(x,y);
    g.quadraticCurveTo(cx,cy,x+Math.cos(ang)*len,y+Math.sin(ang)*len);g.stroke();
  }
  const branch=(x,y,ang,w,d)=>{
    if(d<=0||w<0.5)return;
    const len=size*(0.03+Math.random()*0.05);
    const nx=x+Math.cos(ang)*len,ny=y+Math.sin(ang)*len;
    g.strokeStyle=`rgba(140,40,52,${0.14+0.1*d})`;g.lineWidth=w;
    g.beginPath();g.moveTo(x,y);
    g.quadraticCurveTo(x+Math.cos(ang+0.4)*len*0.5,y+Math.sin(ang+0.4)*len*0.5,nx,ny);g.stroke();
    if(Math.random()<0.85)branch(nx,ny,ang+(Math.random()-0.5)*1.1,w*0.66,d-1);
    if(Math.random()<0.55)branch(nx,ny,ang+(Math.random()<0.5?-1:1)*(0.5+Math.random()*0.6),w*0.55,d-1);
  };
  for(let i=0;i<22;i++)branch(Math.random()*size,Math.random()*size,Math.random()*TAU,2.2+Math.random()*1.6,4);
  for(let i=0;i<640;i++){
    const x=Math.random()*size,y=Math.random()*size,r=0.8+Math.random()*2.6;
    g.fillStyle=`rgba(232,205,150,${0.05+Math.random()*0.13})`;
    g.beginPath();g.arc(x,y,r,0,TAU);g.fill();
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;
  return t;
}
let MYO=null;
function getMyoTex(){if(!MYO)MYO=myocardiumTexture();return MYO;}

/* ---------- variable-radius tube geometry ---------- */
function tubeGeom(curve,rFn,tub=64,rad=10,caps=true){
  const frames=curve.computeFrenetFrames(tub,false);
  const pos=[],nor=[],uv=[],idx=[];
  const P=new THREE.Vector3(),N=new THREE.Vector3(),B=new THREE.Vector3();
  for(let i=0;i<=tub;i++){
    const t=i/tub;curve.getPointAt(t,P);
    N.copy(frames.normals[i]);B.copy(frames.binormals[i]);
    const r=rFn(t);
    for(let j=0;j<=rad;j++){
      const a=j/rad*TAU,c=Math.cos(a),s=Math.sin(a);
      const nx=c*N.x+s*B.x,ny=c*N.y+s*B.y,nz=c*N.z+s*B.z;
      nor.push(nx,ny,nz);pos.push(P.x+r*nx,P.y+r*ny,P.z+r*nz);uv.push(t*5,j/rad);
    }
  }
  for(let i=0;i<tub;i++)for(let j=0;j<rad;j++){
    const a=i*(rad+1)+j,b=a+1,c=a+rad+1,d=c+1;
    idx.push(a,b,c,b,d,c);
  }
  if(caps){
    const Tg=new THREE.Vector3();
    const addCap=(i,fwd)=>{
      const t=i/tub;curve.getPointAt(t,P);curve.getTangentAt(t,Tg);
      N.copy(frames.normals[i]);B.copy(frames.binormals[i]);
      const r=rFn(t),c0=pos.length/3;
      const sgn=fwd?1:-1;
      nor.push(sgn*Tg.x,sgn*Tg.y,sgn*Tg.z);pos.push(P.x,P.y,P.z);uv.push(0.5,0.5);
      for(let j=0;j<=rad;j++){
        const a=j/rad*TAU,co=Math.cos(a),si=Math.sin(a);
        const rx=co*N.x+si*B.x,ry=co*N.y+si*B.y,rz=co*N.z+si*B.z;
        nor.push(sgn*Tg.x,sgn*Tg.y,sgn*Tg.z);pos.push(P.x+r*rx,P.y+r*ry,P.z+r*rz);uv.push(j/rad,1);
      }
      for(let j=0;j<rad;j++){
        if(fwd)idx.push(c0,c0+1+j,c0+2+j);
        else idx.push(c0,c0+2+j,c0+1+j);
      }
    };
    addCap(0,false);addCap(tub,true);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute("normal",new THREE.Float32BufferAttribute(nor,3));
  g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx);g.computeBoundingSphere();
  return g;
}

/* ---------- paths on the myocardial surface ---------- */
function surfPath(vs,degs,lift){
  return vs.map((v,i)=>{
    const th=degs[i]*D2R;
    const p=vPoint(v,th,new THREE.Vector3()),n=vNormal(v,th,new THREE.Vector3());
    p.add(n.multiplyScalar(typeof lift==="function"?lift(v,i):lift));
    return[p.x,p.y,p.z];
  });
}
function arc(vFrom,vTo,n,thFn,lift){
  const vs=[],ds=[];
  for(let i=0;i<n;i++){const t=i/(n-1),v=lerp(vFrom,vTo,t);vs.push(v);ds.push(thFn(v,t));}
  return surfPath(vs,ds,lift);
}
const LAD_TH=v=>lerp(62,96,v)+4;
const PDA_TH=v=>lerp(292,272,v)+4;
const withRoot=(pts,root)=>[...root,...pts];

const MAIN={
  LAD:{pts:withRoot(arc(0.96,0.015,13,LAD_TH,0.055),[[0.0,0.94,0.16],[-0.04,0.88,0.26]]),r:0.028,tub:84,lab:0.52},
  LCX:{pts:withRoot(surfPath([0.945,0.935,0.925,0.915,0.905,0.895,0.885],[96,72,48,20,-12,-45,-76],0.05),[[0.0,0.94,0.16],[-0.04,0.89,0.25]]),r:0.026,tub:64,lab:0.42},
  RCA:{pts:withRoot(surfPath([0.93,0.93,0.925,0.915,0.905,0.895,0.875],[130,152,176,200,224,248,268],0.05),[[0.0,0.94,0.15],[-0.12,0.9,0.24],[-0.24,0.84,0.31]]),r:0.028,tub:76,lab:0.55}
};
const BRANCHES=[
  {v:"LAD",pts:arc(0.88,0.72,5,t=>lerp(96,128,(0.88-t)/0.16),0.01),r:0.012,tub:28},
  {v:"LAD",pts:arc(0.74,0.42,6,t=>lerp(84,26,(0.74-t)/0.32),0.012),r:0.017,tub:36},
  {v:"LAD",pts:arc(0.64,0.36,6,t=>lerp(80,24,(0.64-t)/0.28),0.012),r:0.013,tub:32},
  {v:"LAD",pts:arc(0.55,0.3,6,t=>lerp(78,20,(0.55-t)/0.25),0.012),r:0.015,tub:36},
  {v:"LAD",pts:arc(0.16,0.02,5,v=>LAD_TH(v)-8,0.008),r:0.01,tub:24},
  {v:"LCX",pts:surfPath([0.93,0.96,0.98],[30,36,44],0.012),r:0.011,tub:24},
  {v:"LCX",pts:surfPath([0.9,0.78,0.62,0.44],[44,30,14,-2],0.014),r:0.017,tub:36},
  {v:"LCX",pts:surfPath([0.9,-0.05,-0.4,-0.72,-0.78],[-8,-24,-40,-56,-64],0.014),r:0.015,tub:36},
  {v:"RCA",pts:surfPath([0.9,0.76,0.6,0.45],[182,172,162,152],0.014),r:0.017,tub:36},
  {v:"RCA",pts:surfPath([0.88,0.72,0.55,0.4],[196,188,180,172],0.013),r:0.014,tub:32},
  {v:"RCA",pts:surfPath([0.93,0.84,0.74],[146,138,130],0.012),r:0.013,tub:30},
  {v:"RCA",pts:arc(0.88,0.03,10,PDA_TH,0.014),r:0.02,tub:60}
];
/* Blue venous anatomy (context only — not risk-weighted) */
const VEINS=[
  {pts:arc(0.93,0.06,11,v=>LAD_TH(v)+7,0.03),r:0.016,tub:64},
  {pts:arc(0.86,0.05,9,v=>PDA_TH(v)-7,0.03),r:0.015,tub:56},
  {pts:surfPath([0.88,0.7,0.5,0.3],[150,140,128,116],0.03),r:0.013,tub:40},
  {pts:surfPath([0.93,0.92,0.9,0.87],[150,175,200,225],0.032),r:0.014,tub:44},
  {pts:surfPath([0.9,0.905,0.9,0.885],[228,252,276,300],0.035),r:0.02,tub:44}
];
const FAT={
  ring:{pts:surfPath(Array.from({length:25},(_,i)=>0.9+0.035*Math.sin(i*1.4)),
    Array.from({length:25},(_,i)=>i/25*360),
    v=>{const t=clamp((v-0.78)/(0.995-0.78),0,1);
      return -0.02+0.11*Math.pow(smooth(0,1,t),1.2)+0.028;}),
    r:t=>0.056+0.02*Math.pow(Math.max(0,Math.sin(t*Math.PI*6)),2),close:true},
  iv:{pts:arc(0.9,0.14,9,LAD_TH,0.008),r:0.04,close:false},
  post:{pts:surfPath([0.9,0.86,0.82],[272,278,284],0.03),r:0.05,close:false}
};
function extendEnd(pts,fromStart,n=2,step=0.45){
  const a=new THREE.Vector3(...(fromStart?pts[0]:pts[pts.length-1]));
  const b=new THREE.Vector3(...(fromStart?pts[1]:pts[pts.length-2]));
  const d=a.clone().sub(b).multiplyScalar(step);
  const out=[...pts];
  for(let i=1;i<=n;i++){
    const q=[a.x+d.x*i,a.y+d.y*i,a.z+d.z*i];
    if(fromStart)out.unshift(q);else out.push(q);
  }
  return out;
}
const GREAT=[
  {k:"aorta",ext:"root",pts:[[-0.03,0.9,0.1],[0.0,1.18,0.07],[0.02,1.42,0.02],[0.06,1.6,-0.12],[0.15,1.66,-0.3],[0.23,1.52,-0.44],[0.26,1.24,-0.5],[0.25,0.9,-0.53],[0.22,0.55,-0.55],[0.18,0.3,-0.56]],
    r:t=>0.115+0.02*Math.exp(-Math.pow((t-0.04)/0.06,2))-0.03*smooth(0.15,0.95,t),tub:80},
  {k:"aorta",pts:[[0.06,1.62,-0.18],[0.0,1.85,-0.14],[-0.1,2.05,-0.1]],r:t=>lerp(0.044,0.036,t),tub:28},
  {k:"aorta",pts:[[0.1,1.66,-0.25],[0.08,1.9,-0.26],[0.06,2.08,-0.27]],r:t=>lerp(0.04,0.034,t),tub:28},
  {k:"aorta",pts:[[0.16,1.64,-0.33],[0.24,1.86,-0.4],[0.3,2.0,-0.46]],r:t=>lerp(0.038,0.032,t),tub:28},
  {k:"pa",ext:"root",pts:[[-0.1,0.88,0.3],[-0.1,1.16,0.3],[-0.05,1.4,0.22],[0.04,1.52,0.1]],r:t=>lerp(0.115,0.1,t),tub:56},
  {k:"pa",pts:[[0.04,1.52,0.1],[0.2,1.48,-0.02],[0.38,1.42,-0.12],[0.5,1.4,-0.18]],r:t=>lerp(0.075,0.05,t),tub:44},
  {k:"pa",pts:[[0.0,1.5,0.12],[-0.18,1.5,0.02],[-0.36,1.46,-0.08],[-0.5,1.44,-0.16]],r:t=>lerp(0.07,0.05,t),tub:44},
  {k:"sys",ext:"tip",pts:[[-0.44,1.9,0.12],[-0.44,1.6,0.1],[-0.42,1.3,0.08],[-0.4,1.0,0.06]],r:t=>lerp(0.085,0.095,t),tub:40},
  {k:"sys",ext:"tip",pts:[[-0.4,0.28,-0.3],[-0.42,0.55,-0.15],[-0.4,0.78,0.0]],r:t=>lerp(0.1,0.09,t),tub:32},
  {k:"pv",pts:[[0.45,1.25,-0.45],[0.62,1.34,-0.62]],r:0.05,tub:20},
  {k:"pv",pts:[[0.45,0.9,-0.48],[0.6,0.85,-0.62]],r:0.05,tub:20},
  {k:"pv",pts:[[0.14,1.24,-0.44],[-0.05,1.36,-0.62]],r:0.05,tub:20},
  {k:"pv",pts:[[0.12,0.9,-0.5],[-0.02,0.86,-0.62]],r:0.05,tub:20}
];
GREAT.forEach(g=>{if(g.ext==="root")g.pts=extendEnd(g.pts,true);else if(g.ext==="tip")g.pts=extendEnd(g.pts,false);});
const TERR={
  LAD:{v0:0.06,v1:0.93,t0:46,t1:114},
  LCX:{v0:0.2,v1:0.9,t0:-80,t1:42},
  RCA:{v0:0.1,v1:0.88,t0:124,t1:260}
};
const TERR_ALPHA=(u,w)=>smooth(0,0.2,u)*smooth(1,0.8,u)*smooth(0,0.16,w)*smooth(1,0.84,w);

function buildPatch(spec,sh){
  const nv=26,nt=24,pos=[],col=[],idx=[],p=new THREE.Vector3(),n=new THREE.Vector3();
  for(let i=0;i<=nv;i++){
    const v=lerp(spec.v0,spec.v1,i/nv);
    for(let j=0;j<=nt;j++){
      const th=lerp(spec.t0,spec.t1,j/nt)*D2R;
      vPoint(v,th,p,sh);vNormal(v,th,n,sh);
      const q=p.clone().add(n.multiplyScalar(0.016));
      pos.push(q.x,q.y,q.z);
      const a=TERR_ALPHA(i/nv,j/nt);
      col.push(1,1,1,a);
    }
  }
  for(let i=0;i<nv;i++)for(let j=0;j<nt;j++){
    const a=i*(nt+1)+j,b=a+1,c=a+nt+1,d=c+1;
    idx.push(a,c,b,b,c,d);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute("color",new THREE.Float32BufferAttribute(col,4));
  g.setIndex(idx);g.computeBoundingSphere();
  return g;
}

/* Atrial skirt: a shell that starts buried in the ventricular wall and swells
   outward over the base rim, fusing the ventricular mass into the atrial mass */
function buildSkirt(sh,nV=14,nT=112){
  const v0=0.78,v1=0.995;
  const pos=[],nor=[],uv=[],idx=[],p=new THREE.Vector3(),n=new THREE.Vector3();
  for(let i=0;i<=nV;i++){
    const t=i/nV,v=lerp(v0,v1,t);
    const off=-0.02+0.11*Math.pow(smooth(0,1,t),1.2);
    for(let j=0;j<=nT;j++){
      const th=j/nT*TAU;
      vPoint(v,th,p,sh);vNormal(v,th,n,sh);
      pos.push(p.x+n.x*off,p.y+n.y*off,p.z+n.z*off);
      nor.push(n.x,n.y,n.z);uv.push(j/nT*2,v*1.9);
    }
  }
  for(let i=0;i<nV;i++)for(let j=0;j<nT;j++){
    const a=i*(nT+1)+j,b=a+1,c=a+nT+1,d=c+1;
    idx.push(a,c,b,b,c,d);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute("normal",new THREE.Float32BufferAttribute(nor,3));
  g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx);g.computeBoundingSphere();
  return g;
}

/* ---------- components ---------- */
const Ventricle=React.forwardRef(function Ventricle({ghost,shape,tint},ref){
  const geo=useMemo(()=>buildVentricle(shape),[shape.lvWall,shape.dilation]);
  const tex=useMemo(()=>getMyoTex(),[]);
  const mat=useMemo(()=>new THREE.MeshPhysicalMaterial({
    color:"#ffffff",map:tex,roughness:0.92,metalness:0,
    clearcoat:0.05,clearcoatRoughness:0.85,
    bumpMap:tex,bumpScale:0.07,envMapIntensity:0.4,
    sheen:0.3,sheenRoughness:0.9,sheenColor:new THREE.Color("#c98d8d")
  }),[tex]);
  useEffect(()=>()=>{geo.dispose();mat.dispose()},[geo,mat]);
  useEffect(()=>{if(tint)mat.color.copy(tint)},[mat,tint]);
  useFrame((s,dt)=>{
    const k=1-Math.pow(0.004,dt),target=ghost?0.2:1;
    if(ghost&&!mat.transparent){mat.transparent=true;mat.depthWrite=false;mat.needsUpdate=true;}
    mat.opacity+=(target-mat.opacity)*k;
    if(!ghost&&mat.opacity>0.985){mat.opacity=1;
      if(mat.transparent){mat.transparent=false;mat.depthWrite=true;mat.needsUpdate=true;}}
  });
  return <mesh ref={ref} geometry={geo} material={mat}/>;
});

function Atria({mats}){
  const parts=useMemo(()=>[
    {p:[-0.42,0.94,0.0],s:[0.42,0.4,0.36],r:[0,0,0]},
    {p:[0.3,0.99,-0.3],s:[0.39,0.37,0.37],r:[0,0,0]},
    {p:[-0.3,0.98,0.4],s:[0.24,0.17,0.13],r:[0.3,0.25,-0.35]},
    {p:[0.4,0.97,0.14],s:[0.2,0.15,0.12],r:[0.25,-0.35,0.3]}
  ],[]);
  const geo=useMemo(()=>new THREE.SphereGeometry(1,32,24),[]);
  useEffect(()=>()=>geo.dispose(),[geo]);
  return <>{parts.map((x,i)=><mesh key={i} position={x.p} scale={x.s} rotation={x.r}
    geometry={geo} material={mats.atria}/>)}</>;
}

function AtrialSkirt({material,ghost,shape}){
  const geo=useMemo(()=>buildSkirt(shape),[shape.lvWall,shape.dilation]);
  useEffect(()=>()=>geo.dispose(),[geo]);
  useFrame((s,dt)=>{
    const k=1-Math.pow(0.004,dt),target=ghost?0.2:1;
    if(ghost&&!material.transparent){material.transparent=true;material.depthWrite=false;material.needsUpdate=true;}
    material.opacity+=(target-material.opacity)*k;
    if(!ghost&&material.opacity>0.985){material.opacity=1;
      if(material.transparent){material.transparent=false;material.depthWrite=true;material.needsUpdate=true;}}
  });
  return <mesh geometry={geo} material={material} raycast={()=>null}/>;
}

function Tube({pts,r,tub=64,rad=10,closed=false,material}){
  const curve=useMemo(()=>new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)),closed,"catmullrom",0.4),[pts,closed]);
  const geo=useMemo(()=>tubeGeom(curve,typeof r==="function"?r:()=>r,tub,rad,!closed),[curve,r,tub,rad,closed]);
  return <mesh geometry={geo} material={material}/>;
}

function Artery({name,probabilities,selected,hovered,onSelect,onHover,bodyRef}){
  const p=probabilities[name]??null,pv=p??0;
  const path=MAIN[name];
  const branches=useMemo(()=>BRANCHES.filter(b=>b.v===name),[name]);
  const curve=useMemo(()=>new THREE.CatmullRomCurve3(path.pts.map(x=>new THREE.Vector3(...x)),false,"catmullrom",0.4),[path]);
  const geo=useMemo(()=>tubeGeom(curve,t=>{
    const bell=Math.exp(-Math.pow((t-0.5)/0.45,2));
    const taper=1-0.2*(Math.exp(-Math.pow(t/0.05,2))+Math.exp(-Math.pow((1-t)/0.05,2)));
    return path.r*taper*(1-0.3*pv*bell)*(1-0.35*t);
  },path.tub,10,true),[curve,path,pv]);
  const glowGeo=useMemo(()=>tubeGeom(curve,()=>path.r*1.95,Math.round(path.tub*0.7),8,false),[curve,path]);
  const branchGeos=useMemo(()=>branches.map(b=>({
    g:tubeGeom(new THREE.CatmullRomCurve3(b.pts.map(x=>new THREE.Vector3(...x)),false,"catmullrom",0.4),
      t=>b.r*(1-0.25*pv*Math.exp(-Math.pow((t-0.5)/0.45,2)))*(1-0.4*t),b.tub,8,true)
  })),[branches,pv]);
  const mat=useMemo(()=>new THREE.MeshPhysicalMaterial({
    color:"#c9505c",roughness:0.5,clearcoat:0.18,clearcoatRoughness:0.55,
    emissive:new THREE.Color("#c9505c"),emissiveIntensity:0.12,envMapIntensity:0.6
  }),[]);
  const glowMat=useMemo(()=>new THREE.MeshBasicMaterial({
    transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,
    side:THREE.BackSide
  }),[]);
  useEffect(()=>()=>{geo.dispose();glowGeo.dispose();mat.dispose();glowMat.dispose();
    branchGeos.forEach(b=>b.g.dispose())},[geo,glowGeo,mat,glowMat,branchGeos]);
  const base=useMemo(()=>new THREE.Color(p==null?"#7d8f99":vesselColor(p)),[p]);
  const slate=useMemo(()=>new THREE.Color("#485763"),[]);
  const colTmp=useMemo(()=>new THREE.Color(),[]);
  const vA=useMemo(()=>new THREE.Vector3(),[]);
  const vB=useMemo(()=>new THREE.Vector3(),[]);
  const anchor=useRef(),center=useMemo(()=>new THREE.Vector3(),[]);
  const [vis,setVis]=useState(true);
  const active=selected===name,hot=hovered===name;
  useFrame((state,dt)=>{
    const k=1-Math.pow(0.003,dt);
    const dim=active||selected==="CAD"?0:(hot?0.12:0.45);
    colTmp.copy(base).lerp(slate,dim);
    mat.color.lerp(colTmp,k);mat.emissive.copy(mat.color);
    const pulse=active?0.4+0.3*Math.sin(state.clock.elapsedTime*3.4):0;
    const target=(p==null?0.06:0.1+0.55*pv)+(hot?0.3:0)+pulse;
    mat.emissiveIntensity+=(target-mat.emissiveIntensity)*k;
    const gT=(p==null?0.04:0.05+0.3*pv)+(active?0.3+0.14*Math.sin(state.clock.elapsedTime*3.4):0)+(hot?0.16:0);
    glowMat.opacity+=(gT-glowMat.opacity)*(1-Math.pow(0.01,dt));
    glowMat.color.copy(mat.color);
    if(anchor.current){
      anchor.current.getWorldPosition(vA);
      bodyRef.current?bodyRef.current.getWorldPosition(center):center.set(0,0,0);
      vB.copy(state.camera.position).sub(center).normalize();
      const facing=vA.sub(center).dot(vB);
      const show=facing>-0.1;
      if(show!==vis)setVis(show);
    }
  });
  const mid=curve.getPointAt(path.lab??0.5);
  const hit={onClick:e=>{e.stopPropagation();onSelect(name)},
    onPointerOver:e=>{e.stopPropagation();onHover(name);document.body.style.cursor="pointer"},
    onPointerOut:()=>{onHover(null);document.body.style.cursor=""}};
  return <group>
    <mesh geometry={geo} material={mat} {...hit}/>
    {branchGeos.map((b,i)=><mesh key={i} geometry={b.g} material={mat} {...hit}/>)}
    <mesh geometry={glowGeo} material={glowMat} raycast={()=>null}/>
    <object3D ref={anchor} position={mid}/>
    {vis&&<Html position={mid} center zIndexRange={[8,0]} style={{pointerEvents:"none"}}>
      <button className={"vtag"+(active?" on":"")+(hot?" hot":"")} style={{pointerEvents:"auto"}}
        onClick={e=>{e.stopPropagation();onSelect(name)}}
        onPointerEnter={()=>onHover(name)} onPointerLeave={()=>onHover(null)}>
        <i style={{background:vesselColor(p)}}/>{name}<b>{pct(p)}</b>
      </button>
    </Html>}
  </group>;
}

function Territory({spec,color,strength,shape}){
  const geo=useMemo(()=>buildPatch(spec,shape),[spec,shape.lvWall,shape.dilation]);
  const mat=useMemo(()=>new THREE.MeshBasicMaterial({
    transparent:true,opacity:0,vertexColors:true,blending:THREE.AdditiveBlending,
    depthWrite:false,color:"#ffffff"
  }),[]);
  useEffect(()=>()=>{geo.dispose();mat.dispose()},[geo,mat]);
  useEffect(()=>{mat.color.set(color)},[mat,color]);
  useFrame((s,dt)=>{mat.opacity+=(strength-mat.opacity)*(1-Math.pow(0.006,dt))});
  return <mesh geometry={geo} material={mat} raycast={()=>null}/>;
}

function Veins({material}){
  const items=useMemo(()=>VEINS.map(o=>({
    g:tubeGeom(new THREE.CatmullRomCurve3(o.pts.map(p=>new THREE.Vector3(...p)),false,"catmullrom",0.4),
      t=>o.r*(1-0.35*t),o.tub,8,true)
  })),[]);
  useEffect(()=>()=>items.forEach(o=>o.g.dispose()),[items]);
  return <group>{items.map((o,i)=><mesh key={i} geometry={o.g} material={material} raycast={()=>null}/>)}</group>;
}

function buildAuricle(len=0.42,wid=0.17){
  const g=new THREE.SphereGeometry(1,28,20);
  const p=g.attributes.position,v=new THREE.Vector3();
  for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i);
    const t=(v.y*0.5+0.5);
    const th=Math.atan2(v.z,v.x);
    const taper=1-0.62*Math.pow(t,1.4);
    const wr=1+0.09*Math.sin(th*5+t*9)*Math.sin(t*14+1.7)+0.05*Math.sin(th*9-t*6);
    p.setXYZ(i,v.x*wid*taper*wr,t*len,v.z*wid*taper*wr+0.3*len*t*t);
  }
  g.computeVertexNormals();
  return g;
}

function Auricles({material}){
  const geos=useMemo(()=>[buildAuricle(0.42,0.17),buildAuricle(0.38,0.15)],[]);
  useEffect(()=>()=>geos.forEach(g=>g.dispose()),[geos]);
  return <group>
    <mesh geometry={geos[0]} material={material} position={[-0.44,0.7,0.38]} rotation={[-0.5,0,2.3]} raycast={()=>null}/>
    <mesh geometry={geos[1]} material={material} position={[0.4,0.7,0.36]} rotation={[-0.45,0,-2.25]} raycast={()=>null}/>
  </group>;
}

const VIEWS={
  ant:{short:"Anterior",title:"Fig.1 · Anterior view",p:[1.2,0.6,5.4]},
  left:{short:"Left",title:"Fig.3 · Left lateral view",p:[5.2,0.7,1.4]},
  post:{short:"Posterior",title:"Fig.2 · Posterior view",p:[-1.4,0.7,-5.3]},
  right:{short:"Right",title:"Fig.4 · Right lateral view",p:[-5.2,0.7,-1.2]}
};
function Rig({controlsRef,apiRef}){
  const {camera}=useThree();
  useEffect(()=>{
    apiRef.current=(v)=>{
      if(!controlsRef.current)return;
      const P=(v&&VIEWS[v]&&VIEWS[v].p)||CAM;
      camera.position.set(P[0],P[1],P[2]);
      controlsRef.current.target.set(0,0,0);
      controlsRef.current.update();
    };
    return()=>{apiRef.current=null};
  },[camera]);
  return null;
}

function Scene({probabilities,selected,hovered,onSelect,onHover,beat,ghost,autoRotate,controlsRef,apiRef,onUserRotate,params}){
  const bodyRef=useRef(),beatRef=useRef();
  const shape=useMemo(()=>({lvWall:params.lvWall,dilation:params.dilation}),[params.lvWall,params.dilation]);
  const tint=useMemo(()=>{const c=new THREE.Color(1,1,1);if(params.risk!=null)c.lerp(new THREE.Color("#e0998f"),clamp(params.risk,0,1)*0.35);return c;},[params.risk]);
  const mats=useMemo(()=>{
    const tex=getMyoTex();
    const amap=tex.clone();amap.repeat.set(2,1.9);amap.needsUpdate=true;
    const sheen={sheen:0.25,sheenRoughness:0.9,sheenColor:new THREE.Color("#c98d8d")};
    return {
      atria:new THREE.MeshPhysicalMaterial({color:"#ffffff",map:amap,bumpMap:amap,bumpScale:0.05,
        roughness:0.9,clearcoat:0.05,clearcoatRoughness:0.9,envMapIntensity:0.4,...sheen}),
      fat:new THREE.MeshPhysicalMaterial({color:"#e6d3a3",roughness:0.95,metalness:0,clearcoat:0,envMapIntensity:0.35}),
      aorta:new THREE.MeshPhysicalMaterial({color:"#c97b78",roughness:0.62,clearcoat:0.14,clearcoatRoughness:0.6,envMapIntensity:0.5}),
      vein:new THREE.MeshPhysicalMaterial({color:"#5f87c4",roughness:0.6,clearcoat:0.1,clearcoatRoughness:0.6,
        envMapIntensity:0.5,emissive:new THREE.Color("#1c2f55"),emissiveIntensity:0.25}),
      pa:new THREE.MeshPhysicalMaterial({color:"#5c7fb8",roughness:0.6,clearcoat:0.14,clearcoatRoughness:0.6,envMapIntensity:0.5}),
      sys:new THREE.MeshPhysicalMaterial({color:"#54739f",roughness:0.62,clearcoat:0.12,clearcoatRoughness:0.65,envMapIntensity:0.5}),
      pv:new THREE.MeshPhysicalMaterial({color:"#b2606b",roughness:0.62,clearcoat:0.14,clearcoatRoughness:0.6,envMapIntensity:0.5})
    };
  },[]);
  useEffect(()=>{mats.atria.color.copy(tint)},[mats,tint]);
  useEffect(()=>()=>Object.values(mats).forEach(m=>{if(m.map)m.map.dispose();m.dispose()}),[mats]);
  useFrame((state,dt)=>{
    if(!beatRef.current)return;
    const t=(state.clock.elapsedTime*params.rate)%1;
    const amp=0.055*params.strength;
    const k=beat?Math.min(Math.exp(-Math.pow((t-0.05)/0.055,2))+0.35*Math.exp(-Math.pow((t-0.33)/0.07,2)),1.15):0;
    const s=beatRef.current.scale;
    s.x+=((1-amp*k)-s.x)*(1-Math.pow(0.002,dt));
    s.y+=((1+0.02*params.strength*k)-s.y)*(1-Math.pow(0.002,dt));
    s.z+=((1-amp*k)-s.z)*(1-Math.pow(0.002,dt));
  });
  const terrColor=n=>vesselColor(probabilities[n]??null);
  const terrStr=n=>{
    const p=probabilities[n];
    if(p==null)return 0;
    if(selected===n)return 0.4+0.5*p;
    if(selected==="CAD")return 0.16*p;
    if(hovered===n)return 0.16*p;
    return 0;
  };
  return <>
    <Environment resolution={160} frames={1} background={false}>
      <Lightformer form="rect" intensity={2.6} position={[0,5,3]} scale={[10,7,1]} rotation-x={Math.PI/2} color="#ffffff"/>
      <Lightformer form="rect" intensity={1.5} position={[-6,1,-4]} scale={[8,8,1]} rotation-y={Math.PI/2.6} color="#bfd9ff"/>
      <Lightformer form="rect" intensity={1.0} position={[6,-2,4]} scale={[6,6,1]} rotation-y={-Math.PI/3} color="#ffd9c9"/>
      <Lightformer form="ring" intensity={1.6} position={[3,3,-5]} scale={[5,5,1]} color="#8fb6ff"/>
    </Environment>
    <ambientLight intensity={0.32}/>
    <directionalLight position={[3.2,4,4]} intensity={1.7} color="#fff6ee"/>
    <directionalLight position={[-4.5,1.2,-3.5]} intensity={0.85} color="#a8c8ff"/>
    <directionalLight position={[0,-3,2.5]} intensity={0.3} color="#ffffff"/>
    <group position={[0,-0.45,0]}>
      <group rotation-x={TILT_X}>
        <group rotation-z={TILT_Z}>
          <group scale={params.mass}>
          <group ref={beatRef}>
            <Ventricle ref={bodyRef} ghost={ghost} shape={shape} tint={tint}/>
            <Atria mats={mats}/>
            <AtrialSkirt material={mats.atria} ghost={ghost} shape={shape}/>
            <Auricles material={mats.atria}/>
            <Tube pts={FAT.ring.pts} r={FAT.ring.r} tub={80} rad={8} closed material={mats.fat}/>
            <Tube pts={FAT.iv.pts} r={FAT.iv.r} tub={56} rad={8} material={mats.fat}/>
            <Tube pts={FAT.post.pts} r={FAT.post.r} tub={32} rad={8} material={mats.fat}/>
            {GREAT.map((g,i)=><Tube key={i} pts={g.pts} r={g.r} tub={g.tub} rad={12} material={mats[g.k]}/>)}
            {Object.keys(MAIN).map(n=><Artery key={n} name={n} probabilities={probabilities}
              selected={selected} hovered={hovered} onSelect={onSelect} onHover={onHover} bodyRef={bodyRef}/>)}
            <Veins material={mats.vein}/>
            {Object.keys(TERR).map(n=><Territory key={"t"+n} spec={TERR[n]} color={terrColor(n)} strength={terrStr(n)} shape={shape}/>)}
          </group>
          </group>
        </group>
      </group>
    </group>
    <OrbitControls ref={controlsRef} makeDefault enablePan={false} enableDamping dampingFactor={0.06}
      minDistance={3.4} maxDistance={9} target={[0,0,0]} autoRotate={autoRotate} autoRotateSpeed={0.85}
      onStart={onUserRotate}/>
    <Rig controlsRef={controlsRef} apiRef={apiRef}/>
  </>;
}

export default function Heart3D({probabilities={},values,selectedVessel,hoveredVessel,onSelectVessel,onHoverVessel}){
  const calm=typeof window!=="undefined"&&window.matchMedia&&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [autoRotate,setAuto]=useState(!calm);
  const [beat,setBeat]=useState(!calm);
  const [ghost,setGhost]=useState(false);
  const [view,setView]=useState("ant");
  const controlsRef=useRef(),apiRef=useRef();
  const params=useMemo(()=>heartParams(values,probabilities),[values,probabilities]);
  useEffect(()=>()=>{document.body.style.cursor=""},[]);
  const tools=[
    {t:"Auto-rotate",on:autoRotate,fn:()=>setAuto(v=>!v),i:"↻"},
    {t:"Heartbeat",on:beat,fn:()=>setBeat(v=>!v),i:"♡"},
    {t:"Translucent myocardium",on:ghost,fn:()=>setGhost(v=>!v),i:"◌"},
    {t:"Reset view",on:false,fn:()=>apiRef.current&&apiRef.current(),i:"⌖"}
  ];
  return <div className="stage3d">
    <Canvas dpr={[1,2]} gl={{antialias:true,alpha:true}} camera={{position:CAM,fov:34}}>
      <Scene probabilities={probabilities} selected={selectedVessel} hovered={hoveredVessel}
        onSelect={onSelectVessel} onHover={onHoverVessel} beat={beat} ghost={ghost} params={params}
        autoRotate={autoRotate} controlsRef={controlsRef} apiRef={apiRef} onUserRotate={()=>setView(null)}/>
    </Canvas>
    <div className="hud-tools">
      {tools.map(x=><button key={x.t} title={x.t} className={x.on?"on":""} onClick={x.fn}>{x.i}</button>)}
    </div>
    <div className="hud-views">
      {Object.keys(VIEWS).map(k=><button key={k} title={VIEWS[k].title} className={view===k?"on":""}
        onClick={()=>{apiRef.current&&apiRef.current(k);setView(k)}}>{VIEWS[k].short}</button>)}
    </div>
    <div className="hud-legend">
      <span>Model probability</span>
      <i className="ramp"/>
      <em>low</em><em>high</em>
      <i className="vein"/>
      <em>veins</em>
    </div>
    <div className="hud-hint">Drag to rotate · scroll to zoom · select a vessel</div>
    <div className="hud-note">Educational illustration — shape/thickness reflect inputs, not a patient's anatomy. Lesion location and severity are not predicted.</div>
  </div>;
}
