const rows=document.getElementById("chartRows");
const fmt=n=>new Intl.NumberFormat("en-US").format(n);
const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
function initials(s){return s.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()}
function move(r){
 if(r.dif==="NEW") return {text:"New",cls:""};
 if(r.dif==="RE") return {text:"Re",cls:""};
 if(r.dif==="↑") return {text:"↑ "+Math.max(1,Number(r.lw)-r.rank),cls:"up"};
 if(r.dif==="↓") return {text:"↓ "+Math.max(1,r.rank-Number(r.lw)),cls:"down"};
 return {text:"—",cls:"same"};
}
function streak(r){return r.weeks}
function render(){
 rows.innerHTML=window.DAEGON_WEEKLY.map(r=>{
   const m=move(r);
   return `
<tr class="song-row" data-row="${r.rank}">
<td class="rank-cell"><div class="rank-stack"><span class="rank-number">${r.rank}</span><span class="move-badge ${m.cls}">${m.text}</span></div></td>
<td><div class="track-cell"><div class="cover" data-art-rank="${r.rank}">${initials(r.artist)}</div><div class="track-copy"><b>${r.song}</b><span>${r.artist}</span></div></div></td>
<td class="metric">${r.peak}</td>
<td class="metric">${r.lw==="-"?"—":r.lw}</td>
<td class="metric">${streak(r)}</td>
<td class="metric streams">${fmt(r.streams)}</td>
<td class="metric"><button class="expand-btn" data-expand="${r.rank}">More⌄</button></td>
</tr>
<tr class="details-row" id="details-${r.rank}">
<td colspan="7" class="details-cell">
  <div class="details-panel">
    <div></div>
    <div>
      <div class="detail-grid">
        <b>Album</b><span>${r.album||"—"}</span>
        <b>Last week</b><span>${r.lw==="-"?"New entry":r.lw}</span>
        <b>Peak position</b><span>${r.peak}</span>
        <b>Total weeks on chart</b><span>${r.weeks}</span>
        <b>Weeks at #1</b><span>${r.weeks1}</span>
        <b>Total streams</b><span>${fmt(r.total)}</span>
        <b>Source</b><span>Daegon Charts · Streaming Songs</span>
      </div>
      <div class="detail-actions"><button class="promo-btn">Share Promo Card</button></div>
    </div>
  </div>
</td>
</tr>`}).join("");
}
render();

async function appleSearch(term,entity="song"){
 const url="https://itunes.apple.com/search?term="+encodeURIComponent(term)+"&entity="+entity+"&limit=8&country=us";
 const res=await fetch(url,{mode:"cors"});if(!res.ok)throw new Error("Apple search failed");return res.json();
}
function pickTrack(results,row){
 const a=norm(row.artist),s=norm(row.song.replace(/\s*\([^)]*\)\s*/g," "));
 return results.find(x=>norm(x.artistName)===a&&norm(x.trackName)===s)
 ||results.find(x=>norm(x.artistName).includes(a.split(" ")[0])&&norm(x.trackName).includes(s.split(" ").slice(0,3).join(" ")))
 ||results.find(x=>norm(x.artistName).includes(a.split(" ")[0]));
}
async function resolveArtwork(row){
 const key="appleArt:"+norm(row.artist+" "+row.song);const cached=localStorage.getItem(key);
 if(cached)return cached==="__none__"?null:cached;
 try{let d=await appleSearch(row.song+" "+row.artist,"song");let h=pickTrack(d.results||[],row);
   if(!h&&row.album){d=await appleSearch(row.album+" "+row.artist,"album");h=(d.results||[])[0]}
   const art=h?.artworkUrl100?.replace(/100x100bb/,"600x600bb")||null;localStorage.setItem(key,art||"__none__");return art;
 }catch(e){return null}
}
async function hydrate(){
 for(const r of window.DAEGON_WEEKLY){
   const art=await resolveArtwork(r);if(!art)continue;
   document.querySelectorAll('[data-art-rank="'+r.rank+'"]').forEach(el=>{el.style.backgroundImage='url("'+art+'")';el.classList.add("has-artwork")});
 }
 const highestNew=window.DAEGON_WEEKLY.find(r=>r.dif==="NEW")||window.DAEGON_WEEKLY[0];
 document.getElementById("heroHeadline").textContent='“'+highestNew.song+'” by '+highestNew.artist+' is the highest new entry on Top Songs Global at #'+highestNew.rank+'.';
 const art=await resolveArtwork(highestNew);if(art){const el=document.getElementById("weeklyHeroArt");el.style.backgroundImage='url("'+art+'")';el.classList.add("has-artwork")}
}
hydrate();

document.addEventListener("click",e=>{
 const b=e.target.closest("[data-expand]");if(!b)return;
 const rank=b.dataset.expand;const d=document.getElementById("details-"+rank);const open=d.classList.toggle("open");
 b.textContent=open?"Less⌃":"More⌄";
});
document.getElementById("downloadCsv").onclick=()=>{
 const head=["Rank","Change","Song","Artist","Album","LW","Peak","Weeks","Weeks at #1","Streams","Total Streams"];
 const data=[head,...window.DAEGON_WEEKLY.map(r=>[r.rank,r.dif,r.song,r.artist,r.album,r.lw,r.peak,r.weeks,r.weeks1,r.streams,r.total])];
 const csv=data.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(",")).join("\n");
 const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const u=URL.createObjectURL(blob);const a=document.createElement("a");
 a.href=u;a.download="daegon-music-weekly-global-2026-10-03.csv";a.click();URL.revokeObjectURL(u);
};