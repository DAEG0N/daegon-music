const SHEET_ID="1t6_7SOlspmNYrXq8PSfJ74frIdrWwQBFITQ3bQmRzeg";
const CHARTS={
  songs:{sheet:"Streaming Songs",title:"Weekly Top Songs Global",subtitle:"Your weekly update of the most played tracks right now.",item:"Track",entity:"song"},
  albums:{sheet:"Top Streaming Albums",title:"Weekly Top Albums Global",subtitle:"The albums generating the most streams this week.",item:"Album",entity:"album"},
  artists:{sheet:"Top 50 Artists",title:"Weekly Top Artists Global",subtitle:"The artists generating the most streams this week.",item:"Artist",entity:"musicArtist"}
};
let currentChart="songs";
let currentDate="2026-10-03";
let currentRows=[];

const rows=document.getElementById("chartRows");
const fmt=n=>new Intl.NumberFormat("en-US").format(n||0);
const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
const parseNum=v=>{if(v==null||v==="")return 0;const s=String(v).trim().replace(/\./g,"").replace(",",".");const n=Number(s);return Number.isFinite(n)?n:0};
const toMillions=v=>parseNum(v)*1000;
const isoFromDisplay=s=>{const m=String(s||"").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);return m?`${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`:""};
const displayDate=iso=>new Date(iso+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});

function parseGviz(text){
 const start=text.indexOf("{"),end=text.lastIndexOf("}");
 if(start<0||end<0) throw new Error("Invalid Google Sheets response");
 return JSON.parse(text.slice(start,end+1));
}
function cell(row,i){return row.c?.[i]?.f ?? row.c?.[i]?.v ?? ""}
function sheetUrl(sheet,tq){
 return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${encodeURIComponent(sheet)}&tqx=out:json&tq=${encodeURIComponent(tq)}`;
}
async function gviz(sheet,tq){
 const res=await fetch(sheetUrl(sheet,tq));
 if(!res.ok) throw new Error("Unable to read Google Sheets");
 return parseGviz(await res.text());
}
async function loadDates(){
 try{
   const j=await gviz("Streaming Songs","select A where A is not null");
   const dates=[...new Set((j.table.rows||[]).map(r=>isoFromDisplay(cell(r,0))).filter(Boolean))].sort().reverse();
   const sel=document.getElementById("weekSelect");
   sel.innerHTML=dates.map(d=>`<option value="${d}">${displayDate(d)}</option>`).join("");
   currentDate=dates.includes("2026-10-03")?"2026-10-03":dates[0];
   sel.value=currentDate;
 }catch(e){
   const sel=document.getElementById("weekSelect");
   sel.innerHTML='<option value="2026-10-03">Oct 3, 2026</option>';
   currentDate="2026-10-03";
 }
}

function parseChartRows(j,type){
 return (j.table.rows||[]).map(r=>{
   if(type==="songs") return {rank:parseNum(cell(r,1)),dif:String(cell(r,2)||"0"),song:String(cell(r,3)||""),artist:String(cell(r,4)||""),album:String(cell(r,5)||""),lw:String(cell(r,6)||"-"),peak:parseNum(cell(r,7)),weeks:parseNum(cell(r,8)),weeks1:parseNum(cell(r,9)),streams:toMillions(cell(r,10)),total:toMillions(cell(r,11))};
   if(type==="albums") return {rank:parseNum(cell(r,1)),dif:String(cell(r,2)||"0"),album:String(cell(r,3)||""),artist:String(cell(r,4)||""),lw:String(cell(r,5)||"-"),peak:parseNum(cell(r,6)),weeks:parseNum(cell(r,7)),weeks1:parseNum(cell(r,8)),streams:toMillions(cell(r,9)),total:toMillions(cell(r,10))};
   return {rank:parseNum(cell(r,1)),dif:String(cell(r,2)||"0"),artist:String(cell(r,3)||""),lw:String(cell(r,4)||"-"),peak:parseNum(cell(r,5)),weeks:parseNum(cell(r,6)),weeks1:parseNum(cell(r,7)),streams:toMillions(cell(r,10)),total:toMillions(cell(r,11))};
 });
}
function dateQuery(iso){
 const [y,m,d]=iso.split("-");
 return `select * where A = date '${y}-${m}-${d}'`;
}
async function loadWeek(type,date){
 const cfg=CHARTS[type];
 try{
   let j=await gviz(cfg.sheet,dateQuery(date));
   let data=parseChartRows(j,type).filter(x=>x.rank);
   if(!data.length){
     const [y,m,d]=date.split("-");
     j=await gviz(cfg.sheet,`select * where A = '${Number(d)}/${Number(m)}/${y}'`);
     data=parseChartRows(j,type).filter(x=>x.rank);
   }
   if(!data.length) throw new Error("No rows");
   return data;
 }catch(e){
   if(type==="songs"&&date==="2026-10-03"&&window.DAEGON_WEEKLY){
     return window.DAEGON_WEEKLY.map(r=>({...r,streams:r.streams*1000,total:r.total*1000}));
   }
   throw e;
 }
}

function initials(s){return String(s||"").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()}
function move(r){
 if(r.dif==="NEW") return {text:"New",cls:""};
 if(r.dif==="RE") return {text:"Re-Entry",cls:"reentry"};
 if(r.dif==="↑") return {text:"↑ "+Math.max(1,Number(r.lw)-r.rank),cls:"up"};
 if(r.dif==="↓") return {text:"↓ "+Math.max(1,r.rank-Number(r.lw)),cls:"down"};
 return {text:"—",cls:"same"};
}
function mainText(r){return currentChart==="songs"?r.song:currentChart==="albums"?r.album:r.artist}
function subText(r){return currentChart==="artists"?"":r.artist}
function albumText(r){return currentChart==="songs"?r.album:currentChart==="albums"?r.album:"—"}

function render(){
 rows.innerHTML=currentRows.map(r=>{
   const m=move(r), main=mainText(r), sub=subText(r);
   return `
<tr class="song-row" data-row="${r.rank}">
<td class="rank-cell"><div class="rank-stack"><span class="rank-number">${r.rank}</span><span class="move-badge ${m.cls}">${m.text}</span></div></td>
<td><div class="track-cell"><div class="cover" data-art-rank="${r.rank}">${initials(sub||main)}</div><div class="track-copy"><b>${main}</b>${sub?'<span>'+sub+'</span>':""}</div></div></td>
<td class="metric">${r.peak}</td>
<td class="metric">${r.lw==="-"?"—":r.lw}</td>
<td class="metric">${r.weeks}</td>
<td class="metric streams">${fmt(r.streams)}</td>
<td class="metric"><button class="expand-btn" data-expand="${r.rank}">More⌄</button></td>
</tr>
<tr class="details-row" id="details-${r.rank}">
<td colspan="7" class="details-cell"><div class="details-panel"><div></div><div>
<div class="detail-grid">
<b>${currentChart==="artists"?"Chart":"Album"}</b><span>${currentChart==="artists"?"Top 50 Artists":albumText(r)}</span>
<b>Last week</b><span>${r.lw==="-"?"New entry":r.lw}</span>
<b>Peak position</b><span>${r.peak}</span>
<b>Total weeks on chart</b><span>${r.weeks}</span>
<b>Weeks at #1</b><span>${r.weeks1}</span>
<b>Total streams</b><span>${fmt(r.total)}</span>
<b>Source</b><span>Daegon Charts · ${CHARTS[currentChart].sheet}</span>
</div></div></div></td></tr>`}).join("");
}

async function appleSearch(term,entity){
 const url="https://itunes.apple.com/search?term="+encodeURIComponent(term)+"&entity="+entity+"&limit=8&country=us";
 const res=await fetch(url); if(!res.ok) throw new Error("Apple"); return res.json();
}
function pickTrack(results,row){
 const artist=norm(row.artist),title=norm(mainText(row).replace(/\s*\([^)]*\)\s*/g," "));
 return results.find(x=>norm(x.artistName)===artist&&(norm(x.trackName||x.collectionName||x.artistName)===title))
 ||results.find(x=>norm(x.artistName).includes(artist.split(" ")[0])&&norm(x.trackName||x.collectionName||x.artistName).includes(title.split(" ").slice(0,3).join(" ")))
 ||results[0];
}
async function resolveArtwork(row){
 const entity=CHARTS[currentChart].entity;
 const term=currentChart==="artists"?row.artist:mainText(row)+" "+row.artist;
 const key="appleArt:"+currentChart+":"+norm(term);
 const c=localStorage.getItem(key);if(c)return c==="__none__"?null:c;
 try{const d=await appleSearch(term,entity);const h=pickTrack(d.results||[],row);const art=(h?.artworkUrl100||h?.artworkUrl60)?.replace(/100x100bb|60x60bb/,"600x600bb")||null;localStorage.setItem(key,art||"__none__");return art}catch(e){return null}
}
async function hydrateArtwork(){
 for(const r of currentRows.slice(0,50)){
   const art=await resolveArtwork(r); if(!art)continue;
   document.querySelectorAll('[data-art-rank="'+r.rank+'"]').forEach(el=>{el.style.backgroundImage='url("'+art+'")';el.classList.add("has-artwork")});
 }
 const highestNew=currentRows.find(r=>r.dif==="NEW")||currentRows[0];
 const title=mainText(highestNew), who=currentChart==="artists"?"":highestNew.artist;
 document.getElementById("heroHeadline").textContent=currentChart==="artists"
   ?`${title} is the highest new entry on Top Artists Global at #${highestNew.rank}.`
   :`“${title}” by ${who} is the highest new entry on ${currentChart==="songs"?"Top Songs":"Top Albums"} Global at #${highestNew.rank}.`;
 const art=await resolveArtwork(highestNew);const hero=document.getElementById("weeklyHeroArt");
 hero.style.backgroundImage=art?'url("'+art+'")':"";hero.classList.toggle("has-artwork",!!art);hero.textContent=art?"":initials(who||title);
}

function updateLabels(){
 const c=CHARTS[currentChart];
 document.getElementById("chartTitle").textContent=c.title;
 document.getElementById("chartSubtitle").textContent=c.subtitle;
 document.getElementById("itemHeader").textContent=c.item;
 document.getElementById("heroPeriod").textContent=`${currentChart==="songs"?"Top Songs":currentChart==="albums"?"Top Albums":"Top Artists"} Global · Week of ${displayDate(currentDate)}`;
}
async function refresh(){
 updateLabels();rows.innerHTML='<tr><td colspan="7" class="loading-row">Loading weekly chart…</td></tr>';
 try{currentRows=await loadWeek(currentChart,currentDate);render();hydrateArtwork();}
 catch(e){rows.innerHTML='<tr><td colspan="7" class="loading-row">This week could not be loaded from the live spreadsheet.</td></tr>'}
}
document.getElementById("chartTypeSelect").onchange=e=>{currentChart=e.target.value;refresh()};
document.getElementById("weekSelect").onchange=e=>{currentDate=e.target.value;refresh()};
document.addEventListener("click",e=>{const b=e.target.closest("[data-expand]");if(!b)return;const d=document.getElementById("details-"+b.dataset.expand);const open=d.classList.toggle("open");b.textContent=open?"Less⌃":"More⌄"});
document.getElementById("downloadCsv").onclick=()=>{if(!currentRows.length)return;const head=["Rank","Change",CHARTS[currentChart].item,"Artist","LW","Peak","Weeks","Weeks at #1","Streams","Total Streams"];const data=[head,...currentRows.map(r=>[r.rank,r.dif,mainText(r),r.artist||"",r.lw,r.peak,r.weeks,r.weeks1,r.streams,r.total])];const csv=data.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(",")).join("\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download=`daegon-music-${currentChart}-${currentDate}.csv`;a.click();URL.revokeObjectURL(u)};
(async()=>{await loadDates();await refresh()})();