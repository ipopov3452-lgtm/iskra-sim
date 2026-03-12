import { useState, useRef, useEffect } from "react";

// ─── НОРМЫ РФ ─────────────────────────────────────────────────────────────────
const RF = { singleAxle:10000, tandem:18000, tridem:22500, totalMax:44000 };

// ─── ТИПЫ ПОЛУПРИЦЕПОВ ───────────────────────────────────────────────────────
const TRAILERS = {
  tented:    { label:"Тентованный",    sub:"13.6м", icon:"🚛", color:"#5b9cf6", tw:6500, tL:13.6, pW:2.45, mH:2.70, pH:0.30, fO:0,     walls:true,  wH:2.70, wC:"#5b9cf6", nAx:3, axOff:0,   desc:"Унив. · ~26т · 2.45×2.70м" },
  reefer:    { label:"Рефрижератор",   sub:"13.3м", icon:"❄️", color:"#38bdf8", tw:8500, tL:13.3, pW:2.35, mH:2.50, pH:0.45, fO:0,     walls:true,  wH:2.60, wC:"#cceeff", nAx:3, axOff:0,   desc:"Рефриж. · ~22т · 2.35×2.50м" },
  mega:      { label:"Длинномер/Mega", sub:"16.5м", icon:"📏", color:"#f59e0b", tw:7800, tL:16.5, pW:2.45, mH:2.70, pH:0.20, fO:0,     walls:false, wH:2.70, wC:"#f59e0b", nAx:3, axOff:0,   desc:"Mega · ~24т · 2.45×2.70м" },
  lowbed:    { label:"Низкорамник",    sub:"12.0м", icon:"⬇️", color:"#a78bfa", tw:9000, tL:12.0, pW:2.50, mH:3.50, pH:0.55, fO:-0.35, walls:false, wH:0,    wC:"#a78bfa", nAx:2, axOff:0.5, desc:"Тяжёлые · 40т · 2.50×3.50м" },
  container: { label:"Контейнеровоз", sub:"13.6м", icon:"📦", color:"#34d399", tw:6800, tL:13.6, pW:2.45, mH:2.90, pH:0.30, fO:0,     walls:false, wH:0,    wC:"#34d399", nAx:3, axOff:0,   desc:"ISO-фит. · 2.45×2.90м" },
};

const CAB = { cw:8000, fa:1.2, da1:4.8, da2:5.6, kp:3.5, ts:4.0, faL:4000, daL:4000 };

function trAxles(tt) {
  const t=TRAILERS[tt], base=CAB.ts+t.tL, off=t.axOff;
  return t.nAx===3?[base-1.6+off,base-0.8+off,base+off]:[base-1.2+off,base-0.4+off];
}

function calcAxles(cargos, tt) {
  const t=TRAILERS[tt], axes=trAxles(tt);
  const tCog=axes.reduce((s,v)=>s+v,0)/axes.length, kp=CAB.kp;
  let tcw=0,tm=0;
  for(const c of cargos){ const cog=CAB.ts+c.posX+c.length/2; tcw+=c.weight; tm+=c.weight*cog; }
  let kpL=0,taL=0;
  if(tcw>0){ kpL=(tm-tcw*tCog)/(kp-tCog); taL=tcw-kpL; }
  const dCog=(CAB.da1+CAB.da2)/2; let fE=0,dE=0;
  if(Math.abs(dCog-CAB.fa)>0.01){ fE=(kpL*(dCog-kp))/(dCog-CAB.fa); dE=kpL-fE; }
  return { front:Math.round(CAB.faL+fE), drive:Math.round(CAB.daL+dE), trailer:Math.round(2500+taL),
           total:Math.round(CAB.cw+t.tw+tcw), tcw, tLim:t.nAx===3?RF.tridem:RF.tandem, nAx:t.nAx };
}

function axOk(axles) {
  return axles.front<=RF.singleAxle && axles.drive<=RF.tandem &&
         axles.trailer<=axles.tLim && axles.total<=RF.totalMax;
}

function status(v,lim){ return v/lim>1?"over":v/lim>0.9?"warn":"ok"; }

const CS = {
  "20ft":    { label:"20' DC", L:5.9,  W:2.35, H:2.39, tare:2200, maxP:21770, maxG:24000, color:"#1a6bb5" },
  "40ft":    { label:"40' DC", L:12.0, W:2.35, H:2.39, tare:3700, maxP:26780, maxG:30480, color:"#b55a1a" },
  "40ft-hc": { label:"40' HC", L:12.0, W:2.35, H:2.69, tare:3870, maxP:26610, maxG:30480, color:"#1ab56b" },
};

const PRESETS = [
  { name:"Паллет 800кг",   weight:800,  L:1.2, W:0.8, H:1.4 },
  { name:"Паллет 1000кг",  weight:1000, L:1.2, W:0.8, H:1.5 },
  { name:"Еврокуб 1200кг", weight:1200, L:1.2, W:1.0, H:1.15 },
  { name:"Катушка 2000кг", weight:2000, L:1.5, W:1.3, H:1.3 },
  { name:"Блок 5000кг",    weight:5000, L:2.0, W:1.5, H:1.2 },
  { name:"Техника 8000кг", weight:8000, L:4.0, W:2.2, H:2.0 },
];

const GC = ["#f59e0b","#ef4444","#22c55e","#a78bfa","#38bdf8","#fb923c","#e879f9","#84cc16"];

// ─── АВТОПОГРУЗКА ────────────────────────────────────────────────────────────
function autoLoad(items, tt, mode, cType, allowStack, heavyCenter) {
  const tr = TRAILERS[tt];
  const cs = CS[cType];
  const maxL = mode==="container" ? cs.L : tr.tL;
  const maxW = mode==="container" ? cs.W : tr.pW;
  const maxH = mode==="container" ? cs.H : tr.mH;

  // Expand items list
  let queue = [];
  for(const item of items){
    for(let i=0;i<item.qty;i++){
      queue.push({ name:item.name, weight:item.weight, L:item.L, W:item.W, H:item.H,
                   color:item.color, groupId:item.groupId });
    }
  }

  // Sort: heaviest first if heavyCenter, otherwise by volume desc
  if(heavyCenter){
    queue.sort((a,b)=>b.weight-a.weight);
  } else {
    queue.sort((a,b)=>(b.L*b.W*b.H)-(a.L*a.W*a.H));
  }

  // 3D bin — track occupied voxels as list of placed boxes
  const placed = [];   // {posX, posZ, posY, length, width, height, ...item}
  const failed = [];

  const STEP = 0.05;

  // Check if a box fits at position without collision
  function fits(px, pz, py, bl, bw, bh) {
    if(px<-0.001||px+bl>maxL+0.001) return false;
    if(pz<-0.001||pz+bw>maxW+0.001) return false;
    if(py<-0.001||py+bh>maxH+0.001) return false;
    for(const p of placed){
      if(px+bl>p.posX+0.001 && px<p.posX+p.length-0.001 &&
         pz+bw>p.posZ+0.001 && pz<p.posZ+p.width-0.001 &&
         py+bh>p.posY+0.001 && py<p.posY+p.height-0.001) return false;
    }
    return true;
  }

  // Get support height at (px,pz,bl,bw) — highest top of any box below
  function supportY(px, pz, bl, bw) {
    let maxTop = 0;
    for(const p of placed){
      if(px+bl>p.posX+0.001 && px<p.posX+p.length-0.001 &&
         pz+bw>p.posZ+0.001 && pz<p.posZ+p.width-0.001){
        maxTop = Math.max(maxTop, p.posY+p.height);
      }
    }
    return maxTop;
  }

  // Try to place a box — returns best placement or null
  function tryPlace(bl, bw, bh) {
    // Candidate X positions: 0 and right edges of placed boxes
    const xCandidates = [0, ...placed.map(p=>p.posX+p.length)].sort((a,b)=>a-b);
    const zCandidates = [0, ...placed.map(p=>p.posZ+p.width)].sort((a,b)=>a-b);
    const yCandidates = [0];

    let best = null;
    for(const px of xCandidates){
      if(px+bl > maxL+0.001) continue;
      for(const pz of zCandidates){
        if(pz+bw > maxW+0.001) continue;
        const py = allowStack ? supportY(px,pz,bl,bw) : 0;
        if(!allowStack && py > 0.001) continue;
        if(py+bh > maxH+0.001) continue;
        if(!fits(px,pz,py,bl,bw,bh)) continue;
        // Score: prefer low Y, then low X (front-loading), then centered Z
        const score = py*1000 + px*10 + Math.abs(pz+bw/2 - maxW/2);
        if(best===null || score < best.score) best = {px,pz,py,score};
      }
    }
    return best;
  }

  // Try placement with rotation
  function tryPlaceWithRotation(item) {
    const orientations = [{l:item.L, w:item.W, rotated:false}];
    if(Math.abs(item.L-item.W)>0.01) orientations.push({l:item.W, w:item.L, rotated:true});

    let bestResult = null;
    for(const o of orientations){
      const r = tryPlace(o.l, o.w, item.H);
      if(r && (!bestResult || r.score < bestResult.score)){
        bestResult = {...r, length:o.l, width:o.w, rotated:o.rotated};
      }
    }
    return bestResult;
  }

  for(const item of queue){
    const r = tryPlaceWithRotation(item);
    if(r){
      placed.push({ ...item, posX:Math.round(r.px*100)/100, posZ:Math.round(r.pz*100)/100,
                    posY:Math.round(r.py*100)/100, length:r.length, width:r.width, height:item.H,
                    rotated:r.rotated, id:Date.now()+Math.random() });
    } else {
      failed.push(item);
    }
  }

  // Check axle loads after placement
  let axleWarning = null;
  if(mode==="truck"){
    const ax = calcAxles(placed, tt);
    if(!axOk(ax)) axleWarning = ax;
  }

  return { placed, failed, axleWarning };
}

// ─── 3D ──────────────────────────────────────────────────────────────────────
function draw3D(canvas, cargos, groups, mode, cType, tType, cam, failed) {
  if(!canvas) return;
  const ctx=canvas.getContext("2d"); const W=canvas.width,H=canvas.height;
  ctx.clearRect(0,0,W,H);
  const bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,"#080b0f"); bg.addColorStop(1,"#10151e");
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle="rgba(255,255,255,0.02)"; ctx.lineWidth=1;
  for(let x=0;x<W;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=50){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

  const iso=(x,y,z)=>{
    const rx=x*Math.cos(cam.rotY)-z*Math.sin(cam.rotY);
    const rz=x*Math.sin(cam.rotY)+z*Math.cos(cam.rotY);
    return [W/2+(rx-rz)*cam.scale*0.707+cam.panX, H*0.55+(-y+rz*0.38)*cam.scale*0.707+cam.panY];
  };

  const face=(pts,fill,stroke="rgba(0,0,0,0.4)",lw=0.8)=>{
    ctx.beginPath(); ctx.moveTo(...pts[0]);
    for(let i=1;i<pts.length;i++) ctx.lineTo(...pts[i]);
    ctx.closePath(); ctx.fillStyle=fill; ctx.fill();
    ctx.strokeStyle=stroke; ctx.lineWidth=lw; ctx.stroke();
  };

  const box=(x,y,z,w,h,d,top,side,front,a=1)=>{
    ctx.globalAlpha=a;
    face([iso(x,y,z+d),iso(x+w,y,z+d),iso(x+w,y+h,z+d),iso(x,y+h,z+d)],front);
    face([iso(x+w,y,z),iso(x+w,y,z+d),iso(x+w,y+h,z+d),iso(x+w,y+h,z)],side);
    face([iso(x,y+h,z),iso(x+w,y+h,z),iso(x+w,y+h,z+d),iso(x,y+h,z+d)],top);
    ctx.globalAlpha=1;
  };

  const wire=(x,y,z,w,h,d,col,lw=1.5)=>{
    ctx.strokeStyle=col; ctx.lineWidth=lw;
    const E=[[[x,y,z],[x+w,y,z]],[[x,y,z+d],[x+w,y,z+d]],[[x,y+h,z],[x+w,y+h,z]],[[x,y+h,z+d],[x+w,y+h,z+d]],
             [[x,y,z],[x,y+h,z]],[[x,y,z+d],[x,y+h,z+d]],[[x+w,y,z],[x+w,y+h,z]],[[x+w,y,z+d],[x+w,y+h,z+d]],
             [[x,y,z],[x,y,z+d]],[[x,y+h,z],[x,y+h,z+d]],[[x+w,y,z],[x+w,y,z+d]],[[x+w,y+h,z],[x+w,y+h,z+d]]];
    for(const[a,b]of E){ctx.beginPath();ctx.moveTo(...iso(...a));ctx.lineTo(...iso(...b));ctx.stroke();}
  };

  const lgt=(hex,n)=>{const v=parseInt(hex.replace('#',''),16);return `rgb(${Math.min(255,((v>>16)&255)+n)},${Math.min(255,((v>>8)&255)+n)},${Math.min(255,(v&255)+n)})`;};
  const drk=(hex,n)=>lgt(hex,-n);

  const cargoCol=(c)=>{
    if(c.groupId){ const g=groups.find(g=>g.id===c.groupId); if(g) return g.color; }
    return c.color||"#c8a04a";
  };

  if(mode==="container"){
    const s=CS[cType]; const[L,Wd,Ht]=[s.L,s.W,s.H];
    box(0,-0.04,0,L,0.04,Wd,"rgba(0,0,0,0.2)","rgba(0,0,0,0.1)","rgba(0,0,0,0.1)",0.5);
    box(0,0,0,L,Ht,Wd,lgt(s.color,10)+"44",drk(s.color,20)+"44",s.color+"44",0.4);
    wire(0,0,0,L,Ht,Wd,s.color,2);
    ctx.strokeStyle=drk(s.color,15); ctx.lineWidth=0.7; ctx.globalAlpha=0.4;
    for(let lx=1;lx<L;lx+=1){ctx.beginPath();ctx.moveTo(...iso(lx,0,Wd));ctx.lineTo(...iso(lx,Ht,Wd));ctx.stroke();}
    ctx.globalAlpha=1;
    box(0,0,0,L,0.02,Wd,"#2a1e0e","#160e04","#2a1e0e");
    for(const c of cargos){
      const col=cargoCol(c);
      const cz=c.posZ!==undefined ? c.posZ : (Wd-c.width)/2;
      const cy=c.posY||0;
      box(c.posX,0.02+cy,cz,c.length,c.height,c.width,lgt(col,35),drk(col,25),col);
      if(c.groupId){ const g=groups.find(g=>g.id===c.groupId); if(g) box(c.posX,0.02+cy+c.height,cz,c.length,0.06,c.width,g.color,g.color,g.color,0.7); }
    }
  } else {
    const tt=TRAILERS[tType]; const tL=tt.tL,tW=tt.pW,pH=tt.pH,fO=tt.fO;
    const trAx=trAxles(tType); const platY=pH+fO;

    box(-5.8,0.22,0.1,5.5,0.30,tW-0.2,"#222","#1a1a1a","#222");
    box(-5.8,0.52,0.15,2.6,2.10,tW-0.3,"#1e3a6a","#162e55","#2255aa");
    box(-5.55,1.25,0.1,1.9,0.95,0.06,"#6aabee88","#6aabee88","#aaddff99",0.9);
    box(-4.05,1.95,0.1,0.13,0.85,0.13,"#3a3a3a","#2a2a2a","#404040");
    box(-4.05,1.95,tW-0.23,0.13,0.85,0.13,"#3a3a3a","#2a2a2a","#404040");

    if(tType==="lowbed"){ box(0,0.2,0.05,tL,0.17,tW-0.1,"#292929","#1e1e1e","#242424"); box(-0.8,0.2,0.15,0.8,0.32,tW-0.3,"#323232","#272727","#303030"); }

    box(0,platY,0,tL,0.27,tW,"#3a3a3a","#2a2a2a","#333");

    if(tType!=="lowbed"&&tType!=="mega"){ box(0,platY+0.27,-0.02,tL,0.10,0.07,"#444","#333","#444"); box(0,platY+0.27,tW-0.05,tL,0.10,0.07,"#444","#333","#444"); }

    if(tType==="tented"){
      box(0,platY+0.27,0,tL,tt.wH,tW,tt.wC+"1e",tt.wC+"16",tt.wC+"1e",0.35);
      wire(0,platY+0.27,0,tL,tt.wH,tW,tt.wC+"99",1.2);
      ctx.strokeStyle=tt.wC+"44"; ctx.lineWidth=0.9;
      for(let lx=0;lx<=tL;lx+=1.36){ ctx.beginPath();ctx.moveTo(...iso(lx,platY+0.27,0));ctx.lineTo(...iso(lx,platY+0.27+tt.wH,tW/2));ctx.lineTo(...iso(lx,platY+0.27,tW));ctx.stroke(); }
    }
    if(tType==="reefer"){
      box(0,platY+0.27,0,tL,tt.wH,tW,"#cceeff30","#aaddff28","#cceeff30",0.55);
      wire(0,platY+0.27,0,tL,tt.wH,tW,"#88ddff",1.8);
      box(-0.58,platY+0.02,0.08,0.58,2.25,tW-0.16,"#1a3a50","#12283a","#1e4560");
      box(-0.50,platY+0.28,0.18,0.30,1.55,tW-0.36,"#0a2030","#081828","#1a3a50");
      ctx.strokeStyle="#88ddff33"; ctx.lineWidth=0.6;
      for(let ly=0.5;ly<tt.wH;ly+=0.38){ ctx.beginPath();ctx.moveTo(...iso(0,platY+0.27+ly,tW));ctx.lineTo(...iso(tL,platY+0.27+ly,tW));ctx.stroke();ctx.beginPath();ctx.moveTo(...iso(0,platY+0.27+ly,0));ctx.lineTo(...iso(tL,platY+0.27+ly,0));ctx.stroke(); }
    }
    if(tType==="mega"){
      wire(0,platY+0.27,0,tL,tt.wH,tW,tt.wC+"28",0.8);
      ctx.strokeStyle=tt.wC+"22"; ctx.lineWidth=0.8; ctx.setLineDash([7,10]);
      ctx.beginPath();ctx.moveTo(...iso(0,platY+0.27+tt.wH,0));ctx.lineTo(...iso(tL,platY+0.27+tt.wH,0));ctx.stroke();
      ctx.beginPath();ctx.moveTo(...iso(0,platY+0.27+tt.wH,tW));ctx.lineTo(...iso(tL,platY+0.27+tt.wH,tW));ctx.stroke();
      ctx.setLineDash([]);
    }
    if(tType==="container"){
      for(const fx of [0,3.08,6.0,9.52,13.56]){ if(fx<=tL){ box(fx-0.09,platY+0.27,0.07,0.18,0.13,0.18,"#34d399","#22aa77","#2add88"); box(fx-0.09,platY+0.27,tW-0.25,0.18,0.13,0.18,"#34d399","#22aa77","#2add88"); } }
      box(0,platY+0.27,0.02,tL,0.05,0.06,"#2a5a4a","#1e4438","#245040");
      box(0,platY+0.27,tW-0.08,tL,0.05,0.06,"#2a5a4a","#1e4438","#245040");
    }
    if(tType==="lowbed"){ box(0,platY+0.27,-0.22,tL,0.07,0.22,"#2e2e2e","#252525","#2a2a2a"); box(0,platY+0.27,tW,tL,0.07,0.22,"#2e2e2e","#252525","#2a2a2a"); }

    const cF=platY+0.27;
    for(const c of cargos){
      const col=cargoCol(c);
      const cz=c.posZ!==undefined ? c.posZ : (tW-c.width)/2;
      const cy=c.posY||0;
      box(c.posX,cF+cy,cz,c.length,c.height,c.width,lgt(col,35),drk(col,25),col);
      if(c.groupId){ const g=groups.find(g=>g.id===c.groupId); if(g) box(c.posX,cF+cy+c.height,cz,c.length,0.07,c.width,g.color,g.color,g.color,0.75); }
    }

    // Wheels
    const allAx=[CAB.fa-CAB.ts,CAB.da1-CAB.ts,CAB.da2-CAB.ts,...trAx.map(a=>a-CAB.ts)];
    for(const ax of allAx){
      box(ax-0.15,-0.02,-0.1,0.3,0.39,0.2,"#1a1a1a","#111","#1e1e1e");
      box(ax-0.15,-0.02,tW-0.1,0.3,0.39,0.2,"#1a1a1a","#111","#1e1e1e");
    }

    // Failed cargo shown beside trailer (ghost boxes)
    if(failed && failed.length>0){
      const startX = tL + 1.5;
      let offX = startX;
      let row = 0;
      for(let i=0;i<Math.min(failed.length,12);i++){
        const f=failed[i];
        const col=f.color||"#888";
        box(offX, platY+0.27, (tW-f.W)/2, f.L, f.H, f.W, col+"66",col+"44",col+"55",0.6);
        // Red X overlay
        const[sx,sy]=iso(offX+f.L/2, platY+0.27+f.H/2+0.3, tW/2);
        ctx.fillStyle="#ef4444cc"; ctx.font=`bold ${Math.max(10,12)}px monospace`; ctx.textAlign="center";
        ctx.fillText("✕", sx, sy);
        offX += f.L + 0.3;
        if(offX > tL+8){ offX=startX; row++; }
      }
    }
  }
}

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const canvasRef=useRef(null);
  const mouseRef=useRef(null);
  const [mode,setMode]=useState("truck");
  const [tType,setTType]=useState("tented");
  const [cType,setCType]=useState("20ft");
  const [cargos,setCargos]=useState([]);
  const [groups,setGroups]=useState([]);
  const [activeGroup,setActiveGroup]=useState(null);
  const [cam,setCam]=useState({rotY:0.62,scale:24,panX:-80,panY:20});
  const [failed,setFailed]=useState([]);
  const [axleWarn,setAxleWarn]=useState(null);

  // Auto-load state
  const [autoItems,setAutoItems]=useState([{mode:"preset",preset:0,qty:10,groupId:null,custom:{name:"Мой груз",weight:500,L:1.0,W:0.8,H:1.0}}]);
  const [allowStack,setAllowStack]=useState(false);
  const [heavyCenter,setHeavyCenter]=useState(true);
  const [autoTab,setAutoTab]=useState(false); // true=auto, false=manual
  const [autoProgress,setAutoProgress]=useState(null); // null | 0-100

  // Groups
  const [showNewGroup,setShowNewGroup]=useState(false);
  const [newGName,setNewGName]=useState("Заказ 1");
  const [newGColor,setNewGColor]=useState(GC[0]);
  const [collapsed,setCollapsed]=useState({});

  // Manual cargo
  const [selPreset,setSelPreset]=useState(0);
  const [custom,setCustom]=useState({name:"Груз",weight:1000,L:1.2,W:0.8,H:1.2});

  useEffect(()=>{
    const resize=()=>{
      if(!canvasRef.current) return;
      canvasRef.current.width=canvasRef.current.offsetWidth;
      canvasRef.current.height=canvasRef.current.offsetHeight;
      draw3D(canvasRef.current,cargos,groups,mode,cType,tType,cam,failed);
    };
    resize(); window.addEventListener("resize",resize);
    return ()=>window.removeEventListener("resize",resize);
  },[]);

  useEffect(()=>{ draw3D(canvasRef.current,cargos,groups,mode,cType,tType,cam,failed); },[cargos,groups,mode,cType,tType,cam,failed]);

  const onMD=e=>{ mouseRef.current={x:e.clientX,y:e.clientY,cam:{...cam}}; };
  const onMM=e=>{
    if(!mouseRef.current) return;
    const dx=e.clientX-mouseRef.current.x,dy=e.clientY-mouseRef.current.y;
    if(e.buttons===1) setCam(c=>({...c,rotY:mouseRef.current.cam.rotY+dx*0.01}));
    else if(e.buttons===2) setCam(c=>({...c,panX:mouseRef.current.cam.panX+dx,panY:mouseRef.current.cam.panY+dy}));
  };
  const onW=e=>{ e.preventDefault(); setCam(c=>({...c,scale:Math.max(8,Math.min(80,c.scale-e.deltaY*0.05))})); };

  // Manual add
  const addManual=(preset)=>{
    const tr=TRAILERS[tType],cs2=CS[cType];
    const mL=mode==="container"?cs2.L:tr.tL, mW=mode==="container"?cs2.W:tr.pW, mH=mode==="container"?cs2.H:tr.mH;
    const l=preset.L||preset.length, w=preset.W||preset.width, h=preset.H||preset.height;
    if(w>mW+0.05){alert(`Шире платформы (макс ${mW}м)`);return;}
    if(h>mH){alert(`Выше допустимого (макс ${mH}м)`);return;}
    const sorted=[...cargos].sort((a,b)=>a.posX-b.posX);
    let posX=0;
    for(const o of sorted){ if(posX+l<=o.posX+0.01) break; posX=Math.max(posX,o.posX+(o.length||o.L)+0.05); }
    if(posX+l>mL+0.01){alert("Нет места!");return;}
    const g=activeGroup?groups.find(g=>g.id===activeGroup):null;
    setCargos(p=>[...p,{...preset,length:l,width:w,height:h,posX,posZ:(mW-w)/2,posY:0,id:Date.now(),color:g?g.color:"#c8a04a",groupId:activeGroup||null}]);
  };

  // Auto-load run — chunked to show progress
  const runAutoLoad=()=>{
    const items=autoItems.map(ai=>{
      const g=ai.groupId?groups.find(g=>g.id===ai.groupId):null;
      const color=g?g.color:"#c8a04a";
      if(ai.mode==="custom") return {...ai.custom,qty:ai.qty,color,groupId:ai.groupId||null};
      const p=PRESETS[ai.preset];
      return {...p,qty:ai.qty,color,groupId:ai.groupId||null};
    });

    // Expand queue
    const tr=TRAILERS[tType]; const cs2=CS[cType];
    const maxL=mode==="container"?cs2.L:tr.tL;
    const maxW=mode==="container"?cs2.W:tr.pW;
    const maxH=mode==="container"?cs2.H:tr.mH;

    let queue=[];
    for(const item of items) for(let i=0;i<item.qty;i++) queue.push({...item});
    if(heavyCenter) queue.sort((a,b)=>b.weight-a.weight);
    else queue.sort((a,b)=>(b.L*b.W*b.H)-(a.L*a.W*a.H));

    const total=queue.length;
    if(total===0) return;

    setAutoProgress(0);
    setCargos([]);
    setFailed([]);
    setAxleWarn(null);

    const placed=[], failed=[];

    function fits(px,pz,py,bl,bw,bh){
      if(px<-0.001||px+bl>maxL+0.001) return false;
      if(pz<-0.001||pz+bw>maxW+0.001) return false;
      if(py<-0.001||py+bh>maxH+0.001) return false;
      for(const p of placed){
        if(px+bl>p.posX+0.001&&px<p.posX+p.length-0.001&&
           pz+bw>p.posZ+0.001&&pz<p.posZ+p.width-0.001&&
           py+bh>p.posY+0.001&&py<p.posY+p.height-0.001) return false;
      }
      return true;
    }
    function supportY(px,pz,bl,bw){
      let top=0;
      for(const p of placed){
        if(px+bl>p.posX+0.001&&px<p.posX+p.length-0.001&&
           pz+bw>p.posZ+0.001&&pz<p.posZ+p.width-0.001)
          top=Math.max(top,p.posY+p.height);
      }
      return top;
    }
    function tryPlace(bl,bw,bh){
      const xC=[0,...placed.map(p=>p.posX+p.length)].sort((a,b)=>a-b);
      const zC=[0,...placed.map(p=>p.posZ+p.width)].sort((a,b)=>a-b);
      let best=null;
      for(const px of xC){
        if(px+bl>maxL+0.001) continue;
        for(const pz of zC){
          if(pz+bw>maxW+0.001) continue;
          const py=allowStack?supportY(px,pz,bl,bw):0;
          if(!allowStack&&py>0.001) continue;
          if(py+bh>maxH+0.001) continue;
          if(!fits(px,pz,py,bl,bw,bh)) continue;
          const score=py*1000+px*10+Math.abs(pz+bw/2-maxW/2);
          if(best===null||score<best.score) best={px,pz,py,score};
        }
      }
      return best;
    }
    function tryWithRotation(item){
      const orients=[{l:item.L,w:item.W,rotated:false}];
      if(Math.abs(item.L-item.W)>0.01) orients.push({l:item.W,w:item.L,rotated:true});
      let best=null;
      for(const o of orients){
        const r=tryPlace(o.l,o.w,item.H);
        if(r&&(!best||r.score<best.score)) best={...r,length:o.l,width:o.w,rotated:o.rotated};
      }
      return best;
    }

    // Process in chunks of 5 items per frame
    const CHUNK=5;
    let idx=0;
    function processChunk(){
      const end=Math.min(idx+CHUNK,total);
      for(;idx<end;idx++){
        const item=queue[idx];
        const r=tryWithRotation(item);
        if(r) placed.push({...item,posX:Math.round(r.px*100)/100,posZ:Math.round(r.pz*100)/100,
                           posY:Math.round(r.py*100)/100,length:r.length,width:r.width,height:item.H,
                           rotated:r.rotated,id:Date.now()+Math.random()});
        else   failed.push(item);
      }
      const pct=Math.round((idx/total)*100);
      setAutoProgress(pct);
      // Update preview every chunk
      setCargos([...placed]);

      if(idx<total){
        setTimeout(processChunk,0);
      } else {
        // Done
        setFailed([...failed]);
        if(mode==="truck"){ const ax=calcAxles(placed,tType); if(!axOk(ax)) setAxleWarn(ax); }
        setTimeout(()=>setAutoProgress(null),800);
      }
    }
    setTimeout(processChunk,0);
  };

  const remCargo=id=>setCargos(p=>p.filter(c=>c.id!==id));
  const moveC=(id,dir)=>{
    const tr=TRAILERS[tType],cs2=CS[cType];
    const mL=mode==="container"?cs2.L:tr.tL;
    setCargos(p=>p.map(c=>c.id!==id?c:({...c,posX:Math.max(0,Math.min(mL-(c.length||c.L),c.posX+dir*0.2))})));
  };
  const moveGroup=(gid,dir)=>{
    const tr=TRAILERS[tType],cs2=CS[cType];
    const mL=mode==="container"?cs2.L:tr.tL;
    const gc=cargos.filter(c=>c.groupId===gid);
    if(!gc.length) return;
    const minX=Math.min(...gc.map(c=>c.posX)), maxX=Math.max(...gc.map(c=>c.posX+(c.length||c.L)));
    const step=dir*0.4; if(minX+step<0||maxX+step>mL+0.05) return;
    setCargos(p=>p.map(c=>c.groupId===gid?({...c,posX:c.posX+step}):c));
  };

  const createGroup=()=>{
    if(!newGName.trim()) return;
    const id=Date.now(); setGroups(g=>[...g,{id,name:newGName.trim(),color:newGColor}]);
    setActiveGroup(id); setShowNewGroup(false);
    setNewGName(`Заказ ${groups.length+2}`); setNewGColor(GC[(groups.length+1)%GC.length]);
  };
  const remGroup=gid=>{ setGroups(g=>g.filter(g=>g.id!==gid)); setCargos(p=>p.filter(c=>c.groupId!==gid)); if(activeGroup===gid) setActiveGroup(null); };

  const ax=calcAxles(cargos,tType);
  const cs=CS[cType]; const cPay=cargos.reduce((s,c)=>s+c.weight,0); const cGross=cPay+cs.tare;
  const tt=TRAILERS[tType];
  const SC={ok:"#22c55e",warn:"#f59e0b",over:"#ef4444"};
  const SLB={ok:"НОРМА",warn:"ВНИМАНИЕ",over:"ПЕРЕГРУЗ"};

  const Bar=({label,value,limit,sub})=>{
    const st=status(value,limit); const pct=Math.min(100,value/limit*100);
    return(<div style={{marginBottom:9}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#aaa",marginBottom:2}}>
        <span>{label}</span><span style={{color:SC[st],fontWeight:"bold"}}>{value.toLocaleString()} / {limit.toLocaleString()}</span>
      </div>
      {sub&&<div style={{fontSize:10,color:"#555",marginBottom:2}}>{sub}</div>}
      <div style={{background:"#0e1318",borderRadius:4,height:7}}>
        <div style={{width:`${pct}%`,height:"100%",background:SC[st],borderRadius:4,transition:"width 0.3s"}}/>
      </div>
      <div style={{fontSize:10,color:SC[st],textAlign:"right",marginTop:1}}>{SLB[st]}</div>
    </div>);
  };

  const ungrouped=cargos.filter(c=>!c.groupId);

  return(
    <div style={{background:"#080b0f",minHeight:"100vh",color:"#e0e0e0",fontFamily:"'Courier New',monospace",display:"flex",flexDirection:"column"}}>
      {/* Header */}
      <div style={{padding:"10px 18px",borderBottom:"1px solid #161d28",display:"flex",alignItems:"center",gap:14,background:"#0b0e15",flexWrap:"wrap"}}>
        <div style={{fontSize:14,fontWeight:"bold",color:"#5b9cf6",letterSpacing:2}}>▣ ИСКРА-ВЭД · СИМУЛЯТОР ПОГРУЗКИ</div>
        <div style={{fontSize:10,color:"#3a4a5a"}}>Симуляция погрузки · Нормы РФ · ISO 668</div>
        <div style={{marginLeft:"auto",display:"flex",gap:7}}>
          {[{k:"truck",l:"🚛 Автопоезд"},{k:"container",l:"📦 Контейнер"}].map(m=>(
            <button key={m.k} onClick={()=>{setMode(m.k);setCargos([]);setGroups([]);setActiveGroup(null);setFailed([]);setAxleWarn(null);}}
              style={{...Bs,padding:"6px 14px",background:mode===m.k?"#5b9cf6":"#161d28",color:mode===m.k?"#fff":"#667",border:"none"}}>
              {m.l}
            </button>
          ))}
        </div>
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden",minHeight:0}}>
        {/* Canvas */}
        <div style={{flex:1,position:"relative",minWidth:0}}>
          <canvas ref={canvasRef} style={{width:"100%",height:"100%",display:"block",cursor:"grab"}}
            onMouseDown={onMD} onMouseMove={onMM} onMouseUp={()=>mouseRef.current=null}
            onWheel={onW} onContextMenu={e=>e.preventDefault()}/>
          <div style={{position:"absolute",bottom:10,left:12,fontSize:10,color:"#2a3540"}}>ЛКМ — поворот · ПКМ — панорама · Колёсико — масштаб</div>
          <div style={{position:"absolute",top:10,left:12,display:"flex",gap:5}}>
            {[["◀",()=>setCam(c=>({...c,rotY:c.rotY-0.15}))],["▶",()=>setCam(c=>({...c,rotY:c.rotY+0.15}))],
              ["↺",()=>setCam({rotY:0.62,scale:24,panX:-80,panY:20})],["+",()=>setCam(c=>({...c,scale:c.scale+4}))],
              ["−",()=>setCam(c=>({...c,scale:Math.max(8,c.scale-4)}))]].map(([l,fn])=>(
              <button key={l} onClick={fn} style={{...Bs,padding:"4px 9px",fontSize:13}}>{l}</button>
            ))}
          </div>
          {/* Info */}
          <div style={{position:"absolute",top:10,right:10,background:"rgba(8,11,15,0.88)",borderRadius:8,padding:"8px 12px",fontSize:10,color:"#445",border:"1px solid #161d28",lineHeight:1.7}}>
            {mode==="truck"?<>
              <div style={{color:tt.color,fontWeight:"bold",marginBottom:2}}>{tt.icon} {tt.label}</div>
              <div>Длина: {tt.tL}м | Ширина: {tt.pW}м</div>
              <div>Max высота: {tt.mH}м</div>
            </>:<>
              <div style={{color:cs.color,fontWeight:"bold",marginBottom:2}}>{cs.label}</div>
              <div>{cs.L}×{cs.W}×{cs.H}м</div>
            </>}
          </div>
          {/* Active group badge */}
          {activeGroup&&(()=>{const g=groups.find(g=>g.id===activeGroup);return g?(<div style={{position:"absolute",bottom:30,left:"50%",transform:"translateX(-50%)",background:"rgba(8,11,15,0.92)",border:`1px solid ${g.color}`,borderRadius:20,padding:"5px 16px",fontSize:11,color:g.color,display:"flex",alignItems:"center",gap:8}}><div style={{width:9,height:9,borderRadius:"50%",background:g.color}}/><span>Группа: <strong>{g.name}</strong></span><button onClick={()=>setActiveGroup(null)} style={{...Bs,padding:"1px 5px",fontSize:10,border:"none",background:"transparent",color:"#666"}}>✕</button></div>):null;})()}
          {/* Axle warning overlay */}
          {axleWarn&&(<div style={{position:"absolute",bottom:60,left:"50%",transform:"translateX(-50%)",background:"rgba(239,68,68,0.15)",border:"1px solid #ef4444",borderRadius:8,padding:"8px 16px",fontSize:11,color:"#ef4444",textAlign:"center",maxWidth:320}}>
            ⚠️ Автопогрузка: перегруз осей!<br/>
            <span style={{fontSize:10,color:"#f87171"}}>Перераспределите груз вручную или уменьшите количество</span>
            <button onClick={()=>setAxleWarn(null)} style={{...Bs,display:"block",margin:"6px auto 0",fontSize:10,padding:"2px 8px"}}>✕</button>
          </div>)}
          {/* Failed cargo panel */}
          {failed.length>0&&(<div style={{position:"absolute",bottom:10,right:10,background:"rgba(8,11,15,0.94)",border:"1px solid #ef444466",borderRadius:8,padding:"10px 13px",fontSize:10,color:"#ef4444",maxWidth:220}}>
            <div style={{fontWeight:"bold",marginBottom:5}}>✕ Не поместилось ({failed.length} поз.)</div>
            {failed.slice(0,8).map((f,i)=>(<div key={i} style={{color:"#f87171",marginBottom:2}}>• {f.name} · {f.weight}кг · {f.L}×{f.W}×{f.H}м</div>))}
            {failed.length>8&&<div style={{color:"#666"}}>...и ещё {failed.length-8}</div>}
            <button onClick={()=>setFailed([])} style={{...Bs,marginTop:6,fontSize:10,padding:"2px 8px"}}>✕ Закрыть</button>
          </div>)}
        </div>

        {/* Right panel */}
        <div style={{width:300,background:"#0b0e15",borderLeft:"1px solid #161d28",overflowY:"auto",padding:13,display:"flex",flexDirection:"column",gap:11}}>

          {/* Trailer / Container selector */}
          {mode==="truck"&&(<div>
            <div style={SL}>ТИП ПОЛУПРИЦЕПА</div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {Object.entries(TRAILERS).map(([k,v])=>(
                <button key={k} onClick={()=>{setTType(k);setCargos([]);setGroups([]);setActiveGroup(null);setFailed([]);}}
                  style={{...Bs,textAlign:"left",padding:"7px 10px",fontSize:11,background:tType===k?v.color+"1e":"#111820",border:`1px solid ${tType===k?v.color:"#1c2535"}`,color:tType===k?v.color:"#5a6a7a"}}>
                  <div style={{fontWeight:"bold"}}>{v.icon} {v.label} <span style={{fontWeight:"normal",opacity:0.5}}>· {v.sub}</span></div>
                  <div style={{fontSize:10,color:"#445",marginTop:1}}>{v.desc}</div>
                </button>
              ))}
            </div>
          </div>)}

          {mode==="container"&&(<div>
            <div style={SL}>ТИП КОНТЕЙНЕРА</div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {Object.entries(CS).map(([k,v])=>(
                <button key={k} onClick={()=>{setCType(k);setCargos([]);setGroups([]);setActiveGroup(null);setFailed([]);}}
                  style={{...Bs,textAlign:"left",padding:"7px 10px",fontSize:11,background:cType===k?v.color+"1e":"#111820",border:`1px solid ${cType===k?v.color:"#1c2535"}`,color:cType===k?v.color:"#5a6a7a"}}>
                  <div style={{fontWeight:"bold"}}>{v.label}</div>
                  <div style={{fontSize:10,color:"#445",marginTop:1}}>Tare {v.tare.toLocaleString()}кг · Max {v.maxP.toLocaleString()}кг · Gross {v.maxG.toLocaleString()}кг</div>
                </button>
              ))}
            </div>
          </div>)}

          {/* Axle loads */}
          {mode==="truck"&&(<div style={{background:"#111820",borderRadius:8,padding:12,border:"1px solid #1c2535"}}>
            <div style={SL}>НАГРУЗКА НА ОСИ (РФ)</div>
            <Bar label="Передняя ось" value={ax.front} limit={RF.singleAxle} sub="Одиночная · лимит 10 000 кг"/>
            <Bar label="Ведущие (тандем тягача)" value={ax.drive} limit={RF.tandem} sub="Лимит 18 000 кг"/>
            <Bar label={`Оси прицепа (${ax.nAx===3?"тридем":"тандем"})`} value={ax.trailer} limit={ax.tLim} sub={`Лимит ${ax.tLim.toLocaleString()} кг`}/>
            <Bar label="Полная масса" value={ax.total} limit={RF.totalMax} sub="Макс. 44 000 кг"/>
            <div style={{fontSize:11,color:"#445",borderTop:"1px solid #1c2535",paddingTop:7,marginTop:4,lineHeight:1.8}}>
              Груз: <span style={{color:"#5b9cf6"}}>{ax.tcw.toLocaleString()} кг</span><br/>
              Остаток: <span style={{color:"#22c55e"}}>{Math.max(0,RF.totalMax-ax.total).toLocaleString()} кг</span>
            </div>
          </div>)}

          {mode==="container"&&(<div style={{background:"#111820",borderRadius:8,padding:12,border:"1px solid #1c2535"}}>
            <div style={SL}>ВЕСОВОЙ БАЛАНС</div>
            <Bar label="Груз / Max payload" value={cPay} limit={cs.maxP}/>
            <Bar label="Брутто / Max gross" value={cGross} limit={cs.maxG} sub={`Tare: ${cs.tare.toLocaleString()} кг`}/>
            <div style={{fontSize:11,color:"#445",borderTop:"1px solid #1c2535",paddingTop:7,marginTop:4}}>
              Остаток: <span style={{color:"#22c55e"}}>{Math.max(0,cs.maxP-cPay).toLocaleString()} кг</span>
            </div>
          </div>)}

          {/* Groups */}
          <div style={{background:"#111820",borderRadius:8,padding:12,border:"1px solid #1c2535"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
              <div style={SL}>ГРУППЫ ГРУЗОВ</div>
              <button onClick={()=>setShowNewGroup(v=>!v)} style={{...Bs,fontSize:10,padding:"3px 8px",color:"#5b9cf6",border:"1px solid #5b9cf640",background:"#5b9cf610"}}>{showNewGroup?"✕":"+ Группа"}</button>
            </div>
            {showNewGroup&&(<div style={{background:"#0c1018",borderRadius:6,padding:10,border:"1px solid #1c2535",marginBottom:8}}>
              <div style={{fontSize:10,color:"#445",marginBottom:4}}>Название:</div>
              <input value={newGName} onChange={e=>setNewGName(e.target.value)}
                style={{width:"100%",background:"#080b0f",border:"1px solid #2a3545",borderRadius:4,color:"#ddd",padding:"5px 8px",fontSize:11,fontFamily:"inherit",boxSizing:"border-box",marginBottom:7}}/>
              <div style={{fontSize:10,color:"#445",marginBottom:5}}>Цвет:</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:7}}>
                {GC.map(c=>(<div key={c} onClick={()=>setNewGColor(c)} style={{width:20,height:20,borderRadius:"50%",background:c,cursor:"pointer",border:`2px solid ${newGColor===c?"#fff":"transparent"}`}}/>))}
              </div>
              <button onClick={createGroup} style={{...Bs,width:"100%",padding:"6px",background:newGColor,border:"none",color:"#000",fontWeight:"bold",fontSize:11}}>Создать</button>
            </div>)}
            {groups.length===0&&<div style={{fontSize:10,color:"#2a3a4a",textAlign:"center",padding:"5px 0"}}>Нет групп</div>}
            {groups.map(g=>{
              const gc=cargos.filter(c=>c.groupId===g.id);
              const gw=gc.reduce((s,c)=>s+c.weight,0);
              const isA=activeGroup===g.id, isColl=collapsed[g.id];
              return(<div key={g.id} style={{marginBottom:5,border:`1px solid ${isA?g.color:g.color+"44"}`,borderRadius:6,overflow:"hidden"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 9px",background:isA?g.color+"18":"#0c1018",cursor:"pointer"}} onClick={()=>setActiveGroup(isA?null:g.id)}>
                  <div style={{width:9,height:9,borderRadius:"50%",background:g.color,flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,color:isA?g.color:"#bbb",fontWeight:isA?"bold":"normal"}}>{g.name}</div>
                    <div style={{fontSize:10,color:"#445"}}>{gc.length} поз. · {gw.toLocaleString()} кг</div>
                  </div>
                  <div style={{display:"flex",gap:3}}>
                    {isA&&<div style={{fontSize:9,color:g.color,border:`1px solid ${g.color}`,borderRadius:3,padding:"1px 4px"}}>●</div>}
                    <button onClick={e=>{e.stopPropagation();moveGroup(g.id,-1);}} style={{...Bs,padding:"2px 4px",fontSize:10}}>◀</button>
                    <button onClick={e=>{e.stopPropagation();moveGroup(g.id,1);}} style={{...Bs,padding:"2px 4px",fontSize:10}}>▶</button>
                    <button onClick={e=>{e.stopPropagation();setCollapsed(v=>({...v,[g.id]:!v[g.id]}));}} style={{...Bs,padding:"2px 4px",fontSize:10}}>{isColl?"▼":"▲"}</button>
                    <button onClick={e=>{e.stopPropagation();remGroup(g.id);}} style={{...Bs,padding:"2px 4px",fontSize:10,color:"#ef4444"}}>✕</button>
                  </div>
                </div>
                {!isColl&&gc.length>0&&(<div style={{padding:"4px 6px",borderTop:`1px solid ${g.color}22`}}>
                  {gc.map(c=>(<div key={c.id} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 4px",borderRadius:4,marginBottom:2,background:"#080b0f"}}>
                    <div style={{width:5,height:5,borderRadius:"50%",background:g.color,flexShrink:0}}/>
                    <div style={{flex:1}}><div style={{fontSize:10,color:"#aaa"}}>{c.name}</div><div style={{fontSize:9,color:"#3a4a5a"}}>{c.weight.toLocaleString()}кг · x:{c.posX.toFixed(1)}м{c.rotated?" ↺":""}</div></div>
                    <button onClick={()=>moveC(c.id,-1)} style={{...Bs,padding:"1px 4px",fontSize:9}}>◀</button>
                    <button onClick={()=>moveC(c.id,1)} style={{...Bs,padding:"1px 4px",fontSize:9}}>▶</button>
                    <button onClick={()=>remCargo(c.id)} style={{...Bs,padding:"1px 4px",fontSize:9,color:"#ef4444"}}>✕</button>
                  </div>))}
                </div>)}
              </div>);
            })}
          </div>

          {/* Cargo add tabs */}
          <div style={{background:"#111820",borderRadius:8,padding:12,border:"1px solid #1c2535"}}>
            <div style={{display:"flex",gap:4,marginBottom:10}}>
              {[{v:false,l:"✋ Вручную"},{v:true,l:"🤖 Автопогрузка"}].map(({v,l})=>(
                <button key={String(v)} onClick={()=>setAutoTab(v)}
                  style={{...Bs,flex:1,padding:"6px 4px",fontSize:11,background:autoTab===v?"#5b9cf622":"#0c1018",border:`1px solid ${autoTab===v?"#5b9cf6":"#1c2535"}`,color:autoTab===v?"#5b9cf6":"#556"}}>
                  {l}
                </button>
              ))}
            </div>

            {!autoTab&&(<>
              {/* Manual */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                <div style={{fontSize:10,color:"#445"}}>Пресет:</div>
                {activeGroup&&(()=>{const g=groups.find(g=>g.id===activeGroup);return g?<div style={{fontSize:9,color:g.color,border:`1px solid ${g.color}`,borderRadius:3,padding:"1px 5px"}}>→ {g.name}</div>:null;})()}
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
                {PRESETS.map((p,i)=>(<button key={i} onClick={()=>setSelPreset(i)}
                  style={{...Bs,fontSize:10,padding:"3px 6px",background:selPreset===i?"#5b9cf61e":"#0c1018",border:`1px solid ${selPreset===i?"#5b9cf6":"#1c2535"}`,color:selPreset===i?"#5b9cf6":"#556"}}>
                  {p.name}
                </button>))}
              </div>
              <button onClick={()=>addManual(PRESETS[selPreset])} style={{...Bs,width:"100%",padding:"7px",background:"#5b9cf6",border:"none",color:"#fff",fontWeight:"bold",fontSize:12,marginBottom:9}}>+ Добавить</button>
              <div style={{fontSize:10,color:"#3a4a5a",marginBottom:6,borderTop:"1px solid #1c2535",paddingTop:8}}>Свой груз:</div>
              {[["Название","name","text"],["Вес (кг)","weight","number"],["Длина (м)","L","number"],["Ширина (м)","W","number"],["Высота (м)","H","number"]].map(([lb,k,tp])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <span style={{fontSize:10,color:"#445"}}>{lb}</span>
                  <input type={tp} value={custom[k]} onChange={e=>setCustom(p=>({...p,[k]:tp==="number"?parseFloat(e.target.value)||0:e.target.value}))}
                    style={{width:90,background:"#080b0f",border:"1px solid #1c2535",borderRadius:4,color:"#ccc",padding:"3px 6px",fontSize:11,fontFamily:"inherit"}}/>
                </div>
              ))}
              <button onClick={()=>addManual({...custom,color:"#c8a04a"})} style={{...Bs,width:"100%",padding:"6px",background:"#0d1f12",border:"1px solid #22c55e",color:"#22c55e",fontSize:11,marginTop:5}}>+ Свой груз</button>
            </>)}

            {autoTab&&(<>
              {/* Auto-load */}
              <div style={{fontSize:10,color:"#445",marginBottom:7}}>Список грузовых мест:</div>
              {autoItems.map((ai,idx)=>{
                const upd=(patch)=>setAutoItems(p=>p.map((x,i)=>i===idx?{...x,...patch}:x));
                const updC=(patch)=>setAutoItems(p=>p.map((x,i)=>i===idx?{...x,custom:{...x.custom,...patch}}:x));
                const g=ai.groupId?groups.find(g=>g.id===ai.groupId):null;
                return(
                <div key={idx} style={{background:"#0c1018",borderRadius:5,padding:"8px 9px",border:`1px solid ${g?g.color+"44":"#1c2535"}`,marginBottom:6}}>
                  {/* Header row: mode toggle + qty + delete */}
                  <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:6}}>
                    <div style={{display:"flex",borderRadius:4,overflow:"hidden",border:"1px solid #1c2535",flexShrink:0}}>
                      {[{v:"preset",l:"Пресет"},{v:"custom",l:"Свой"}].map(({v,l})=>(
                        <button key={v} onClick={()=>upd({mode:v})}
                          style={{...Bs,border:"none",borderRadius:0,padding:"3px 7px",fontSize:9,
                            background:ai.mode===v?"#5b9cf6":"#111820",
                            color:ai.mode===v?"#fff":"#556"}}>
                          {l}
                        </button>
                      ))}
                    </div>
                    <input type="number" value={ai.qty} min={1} max={999}
                      onChange={e=>upd({qty:Math.max(1,+e.target.value)})}
                      style={{width:46,background:"#080b0f",border:"1px solid #1c2535",borderRadius:4,color:"#ccc",padding:"4px 6px",fontSize:11,fontFamily:"inherit",textAlign:"center"}}/>
                    <span style={{fontSize:10,color:"#445"}}>шт</span>
                    {autoItems.length>1&&<button onClick={()=>setAutoItems(p=>p.filter((_,i)=>i!==idx))} style={{...Bs,padding:"2px 5px",fontSize:10,color:"#ef4444",marginLeft:"auto"}}>✕</button>}
                  </div>

                  {/* Preset selector */}
                  {ai.mode==="preset"&&(
                    <select value={ai.preset} onChange={e=>upd({preset:+e.target.value})}
                      style={{width:"100%",background:"#080b0f",border:"1px solid #1c2535",borderRadius:4,color:"#ccc",padding:"4px 6px",fontSize:10,fontFamily:"inherit",marginBottom:5}}>
                      {PRESETS.map((p,i)=>(<option key={i} value={i}>{p.name} · {p.L}×{p.W}×{p.H}м</option>))}
                    </select>
                  )}

                  {/* Custom cargo fields */}
                  {ai.mode==="custom"&&(
                    <div style={{marginBottom:5}}>
                      <input placeholder="Название" value={ai.custom.name} onChange={e=>updC({name:e.target.value})}
                        style={{width:"100%",background:"#080b0f",border:"1px solid #1c2535",borderRadius:4,color:"#ccc",padding:"4px 6px",fontSize:10,fontFamily:"inherit",boxSizing:"border-box",marginBottom:4}}/>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                        {[["Вес кг","weight"],["Длина м","L"],["Ширина м","W"],["Высота м","H"]].map(([lb,k])=>(
                          <div key={k} style={{display:"flex",flexDirection:"column",gap:2}}>
                            <span style={{fontSize:9,color:"#445"}}>{lb}</span>
                            <input type="number" value={ai.custom[k]} onChange={e=>updC({[k]:parseFloat(e.target.value)||0})}
                              style={{background:"#080b0f",border:"1px solid #1c2535",borderRadius:4,color:"#ccc",padding:"3px 5px",fontSize:10,fontFamily:"inherit"}}/>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Group selector */}
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <span style={{fontSize:9,color:"#445",flexShrink:0}}>Группа:</span>
                    <select value={ai.groupId||""} onChange={e=>upd({groupId:e.target.value||null})}
                      style={{flex:1,background:"#080b0f",border:`1px solid ${g?g.color+"66":"#1c2535"}`,borderRadius:4,color:g?g.color:"#ccc",padding:"3px 5px",fontSize:10,fontFamily:"inherit"}}>
                      <option value="">— без группы —</option>
                      {groups.map(g=>(<option key={g.id} value={g.id}>{g.name}</option>))}
                    </select>
                  </div>
                </div>);
              })}
              <button onClick={()=>setAutoItems(p=>[...p,{mode:"preset",preset:0,qty:1,groupId:null,custom:{name:"Мой груз",weight:500,L:1.0,W:0.8,H:1.0}}])}
                style={{...Bs,width:"100%",padding:"5px",fontSize:10,marginBottom:8,color:"#5b9cf6",border:"1px solid #5b9cf640"}}>
                + Добавить позицию
              </button>

              {/* Options */}
              <div style={{background:"#0c1018",borderRadius:5,padding:"8px 10px",border:"1px solid #1c2535",marginBottom:8}}>
                <div style={{fontSize:10,color:"#445",marginBottom:6}}>Параметры автопогрузки:</div>
                {[
                  [allowStack,setAllowStack,"📦 Разрешить штабелирование"],
                  [heavyCenter,setHeavyCenter,"⚖️ Тяжёлые ближе к центру масс"],
                ].map(([val,setter,label])=>(
                  <div key={label} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,cursor:"pointer"}} onClick={()=>setter(v=>!v)}>
                    <div style={{width:16,height:16,borderRadius:3,border:`1px solid ${val?"#5b9cf6":"#2a3545"}`,background:val?"#5b9cf622":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {val&&<div style={{width:8,height:8,borderRadius:1,background:"#5b9cf6"}}/>}
                    </div>
                    <span style={{fontSize:11,color:val?"#bbb":"#555"}}>{label}</span>
                  </div>
                ))}
              </div>

              <button onClick={runAutoLoad} disabled={autoProgress!==null}
                style={{...Bs,width:"100%",padding:"9px",background:autoProgress!==null?"#0d1f12":"linear-gradient(135deg,#1a4a2a,#1a3a5a)",border:"1px solid #22c55e",color:"#22c55e",fontWeight:"bold",fontSize:12,cursor:autoProgress!==null?"default":"pointer"}}>
                {autoProgress===null ? "🤖 Запустить автопогрузку" : `⏳ Моделирование... ${autoProgress}%`}
              </button>
              {autoProgress!==null&&(
                <div style={{marginTop:6,background:"#0e1318",borderRadius:4,height:8,overflow:"hidden"}}>
                  <div style={{width:`${autoProgress}%`,height:"100%",background:"linear-gradient(90deg,#22c55e,#5b9cf6)",borderRadius:4,transition:"width 0.15s"}}/>
                </div>
              )}
              {autoProgress===null&&failed.length>0&&<div style={{fontSize:10,color:"#ef4444",textAlign:"center",marginTop:6}}>✕ Не поместилось: {failed.length} поз. — см. схему</div>}
            </>)}
          </div>

          {/* Ungrouped */}
          {ungrouped.length>0&&(<div style={{background:"#111820",borderRadius:8,padding:12,border:"1px solid #1c2535"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
              <div style={SL}>БЕЗ ГРУППЫ ({ungrouped.length})</div>
              <button onClick={()=>setCargos(p=>p.filter(c=>c.groupId))} style={{...Bs,fontSize:10,padding:"2px 7px",color:"#ef4444",border:"1px solid #ef444430",background:"#ef444410"}}>✕ Всё</button>
            </div>
            {ungrouped.map(c=>(<div key={c.id} style={{background:"#0c1018",borderRadius:5,padding:"5px 8px",border:"1px solid #1c2535",display:"flex",alignItems:"center",gap:4,marginBottom:4}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:"#c8a04a",flexShrink:0}}/>
              <div style={{flex:1}}><div style={{fontSize:10,color:"#bbb"}}>{c.name}{c.rotated?" ↺":""}</div><div style={{fontSize:9,color:"#3a4a5a"}}>{c.weight.toLocaleString()}кг · x:{c.posX.toFixed(1)}м</div></div>
              <button onClick={()=>moveC(c.id,-1)} style={{...Bs,padding:"1px 4px",fontSize:9}}>◀</button>
              <button onClick={()=>moveC(c.id,1)} style={{...Bs,padding:"1px 4px",fontSize:9}}>▶</button>
              <button onClick={()=>remCargo(c.id)} style={{...Bs,padding:"1px 4px",fontSize:9,color:"#ef4444"}}>✕</button>
            </div>))}
          </div>)}

          {/* Нормативы */}
          <div style={{background:"#111820",borderRadius:8,padding:11,border:"1px solid #1c2535",fontSize:10,color:"#3a4a5a",lineHeight:1.9}}>
            <div style={SL}>НОРМАТИВЫ</div>
            {mode==="truck"?<><div style={{color:"#445"}}>ПП РФ № 272</div><div>• Одиночная ось: 10 000 кг</div><div>• Тандем: 18 000 кг</div><div>• Тридем: 22 500 кг</div><div>• Полная масса: 44 000 кг</div></>
            :<><div style={{color:"#445"}}>ISO 668</div><div>• 20ft: gross 24 000 кг</div><div>• 40ft: gross 30 480 кг</div><div>• ЖД РФ: 24 т/ось</div></>}
          </div>
        </div>
      </div>
    </div>
  );
}

const Bs={background:"#161d28",border:"1px solid #1e2a3a",borderRadius:5,color:"#8a9ab0",cursor:"pointer",fontFamily:"'Courier New',monospace",padding:"5px 10px",fontSize:12};
const SL={fontSize:10,color:"#5b9cf6",letterSpacing:2,marginBottom:7,textTransform:"uppercase"};
