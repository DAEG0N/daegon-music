const rows=document.getElementById("chartRows");
const colors=[["#ff5f6d","#ffc371"],["#7048e8","#4dabf7"],["#0ca678","#96f2d7"],["#f06595","#fcc2d7"],["#495057","#adb5bd"],["#e8590c","#ffd43b"],["#1971c2","#74c0fc"],["#9c36b5","#e599f7"]];
const fmt=n=>new Intl.NumberFormat("en-US").format(n);
const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
function movementClass(d){if(d==="↑")return"up";if(d==="↓")return"down";if(d==="NEW")return"new";if(d==="RE")return"re";return"same"}
function movementText(d){if(d==="↑")return"▲";if(d==="↓")return"▼";if(d==="0")return"—";return d}
function initials(s){return s.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()}
function render(data=window.DAEGON_WEEKLY){
 rows.innerHTML=data.map((r,i)=>{const c=colors[i%colors.length];return `
<tr>
<td class="rank"><span>${r.rank}</span></td>
<td><span class="change ${movementClass(r.dif)}">${movementText(r.dif)}</span></td>
<td><div class="track-cell"><div class="cover loading-art" data-art-rank="${r.rank}" style="--c1:${c[0]};--c2:${c[1]}">${initials(r.artist)}</div><div class="track-copy"><b title="${r.song}">${r.song}</b><span>${r.artist}</span></div></div></td>
<td class="num streams">${fmt(r.streams)}</td>
<td class="num desktop-only">${r.peak}</td>
<td class="num desktop-only">${r.weeks}</td>
<td class="num total desktop-only">${fmt(r.total)}</td>
<td><button class="more-btn" data-rank="${r.rank}">•••</button></td>
</tr>`}).join("");
}
render();

async function appleSearch(term,entity="song"){
 const url="https://itunes.apple.com/search?term="+encodeURIComponent(term)+"&entity="+entity+"&limit=8&country=us";
 const res=await fetch(url,{mode:"cors"}); if(!res.ok) throw new Error("Apple search failed"); return res.json();
}
function pickTrack(results,row){
 const a=norm(row.artist),s=norm(row.song.replace(/\s*\([^)]*\)\s*/g," "));
 return results.find(x=>norm(x.artistName)===a&&norm(x.trackName)===s)
 ||results.find(x=>norm(x.artistName).includes(a.split(" ")[0])&&norm(x.trackName).includes(s.split(" ").slice(0,3).join(" ")))
 ||results.find(x=>norm(x.artistName).includes(a.split(" ")[0]));
}
async function resolveArtwork(row){
 const key="appleArt:"+norm(row.artist+" "+row.song);
 const cached=localStorage.getItem(key); if(cached)return cached==="__none__"?null:cached;
 try{
   let data=await appleSearch(row.song+" "+row.artist,"song");
   let hit=pickTrack(data.results||[],row);
   if(!hit&&row.album){data=await appleSearch(row.album+" "+row.artist,"album");hit=(data.results||[])[0]}
   const art=hit?.artworkUrl100?.replace(/100x100bb/,"300x300bb")||null;
   localStorage.setItem(key,art||"__none__");return art;
 }catch(e){return null}
}
async function hydrateArtwork(){
 const batch=window.DAEGON_WEEKLY.map(async row=>{
   const el=document.querySelector('[data-art-rank="'+row.rank+'"]');if(!el)return;
   const art=await resolveArtwork(row);el.classList.remove("loading-art");
   if(art){el.style.backgroundImage='url("'+art+'")';el.classList.add("has-artwork");}
 });
 await Promise.allSettled(batch);
}
hydrateArtwork();

document.getElementById("songsShortcut").onclick=()=>document.getElementById("songs").scrollIntoView({behavior:"smooth"});
const overlay=document.getElementById("searchOverlay"),input=document.getElementById("searchInput"),results=document.getElementById("searchResults");
function openSearch(){overlay.classList.add("open");overlay.setAttribute("aria-hidden","false");input.value="";renderSearch("");setTimeout(()=>input.focus(),30)}
function closeSearch(){overlay.classList.remove("open");overlay.setAttribute("aria-hidden","true")}
document.getElementById("searchToggle").onclick=openSearch;document.getElementById("searchRows").onclick=openSearch;document.getElementById("closeSearch").onclick=closeSearch;overlay.onclick=e=>{if(e.target===overlay)closeSearch()};
function renderSearch(q){q=q.toLowerCase().trim();const data=window.DAEGON_WEEKLY.filter(r=>!q||r.song.toLowerCase().includes(q)||r.artist.toLowerCase().includes(q));results.innerHTML=data.slice(0,12).map(r=>`<div class="search-result"><b>#${r.rank}</b><span><strong>${r.song}</strong><br>${r.artist}</span><em>${fmt(r.streams)} streams</em></div>`).join("")||'<div class="search-result"><span>No results</span></div>'}
input.oninput=()=>renderSearch(input.value);document.addEventListener("keydown",e=>{if(e.key==="Escape")closeSearch();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();openSearch()}});
document.getElementById("downloadCsv").onclick=()=>{const head=["Rank","Change","Song","Artist","Album","LW","Peak","Weeks","Weeks at #1","Streams","Total Streams"];const data=[head,...window.DAEGON_WEEKLY.map(r=>[r.rank,r.dif,r.song,r.artist,r.album,r.lw,r.peak,r.weeks,r.weeks1,r.streams,r.total])];const csv=data.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(",")).join("\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download="daegon-music-weekly-global-2026-10-03.csv";a.click();URL.revokeObjectURL(u)};
document.addEventListener("click",e=>{const b=e.target.closest(".more-btn");if(!b)return;const r=window.DAEGON_WEEKLY.find(x=>x.rank===+b.dataset.rank);alert(`${r.song}\n${r.artist}\nAlbum: ${r.album}\nPeak: #${r.peak}\nWeeks: ${r.weeks}\nTotal streams: ${fmt(r.total)}`)});
