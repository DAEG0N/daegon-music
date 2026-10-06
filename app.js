const SHEET_ID="1t6_7SOlspmNYrXq8PSfJ74frIdrWwQBFITQ3bQmRzeg";
const CHARTS={
  songs:{sheet:"Streaming Songs",title:"Weekly Top Songs Global",subtitle:"Your weekly update of the most played tracks right now.",item:"Track",entity:"song"},
  albums:{sheet:"Top Streaming Albums",title:"Weekly Top Albums Global",subtitle:"The albums generating the most streams this week.",item:"Album",entity:"album"},
  artists:{sheet:"Top 50 Artists",title:"Weekly Top Artists Global",subtitle:"The artists generating the most streams this week.",item:"Artist",entity:"musicArtist"}
};
let currentChart=document.body.dataset.chart||"songs";
let currentDate="2026-10-03";
let currentRows=[];
let heroSlides=[];
let heroIndex=0;
let heroTimer=null;

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
function sheetUrl(sheet,tq){return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${encodeURIComponent(sheet)}&tqx=out:json&tq=${encodeURIComponent(tq)}`}
async function gviz(sheet,tq){const res=await fetch(sheetUrl(sheet,tq));if(!res.ok)throw new Error("Unable to read Google Sheets");return parseGviz(await res.text())}

async function loadDates(){
 try{
   const j=await gviz(CHARTS[currentChart].sheet,"select A where A is not null");
   const dates=[...new Set((j.table.rows||[]).map(r=>isoFromDisplay(cell(r,0))).filter(Boolean))].sort().reverse();
   const sel=document.getElementById("weekSelect");
   sel.innerHTML=dates.map(d=>`<option value="${d}">${displayDate(d)}</option>`).join("");
   currentDate=dates.includes("2026-10-03")?"2026-10-03":dates[0];
   sel.value=currentDate;
 }catch(e){
   const sel=document.getElementById("weekSelect");
   sel.innerHTML='<option value="2026-10-03">Oct 3, 2026</option>'; currentDate="2026-10-03";
 }
}

function parseChartRows(j,type){
 return (j.table.rows||[]).map(r=>{
   if(type==="songs") return {rank:parseNum(cell(r,1)),dif:String(cell(r,2)||"0"),song:String(cell(r,3)||""),artist:String(cell(r,4)||""),album:String(cell(r,5)||""),lw:String(cell(r,6)||"-"),peak:parseNum(cell(r,7)),weeks:parseNum(cell(r,8)),weeks1:parseNum(cell(r,9)),streams:toMillions(cell(r,10)),total:toMillions(cell(r,11))};
   if(type==="albums") return {rank:parseNum(cell(r,1)),dif:String(cell(r,2)||"0"),album:String(cell(r,3)||""),artist:String(cell(r,4)||""),lw:String(cell(r,5)||"-"),peak:parseNum(cell(r,6)),weeks:parseNum(cell(r,7)),weeks1:parseNum(cell(r,8)),streams:toMillions(cell(r,9)),total:toMillions(cell(r,10))};
   return {rank:parseNum(cell(r,1)),dif:String(cell(r,2)||"0"),artist:String(cell(r,3)||""),lw:String(cell(r,4)||"-"),peak:parseNum(cell(r,5)),weeks:parseNum(cell(r,6)),weeks1:parseNum(cell(r,7)),streams:toMillions(cell(r,10)),total:toMillions(cell(r,11))};
 });
}
function dateQuery(iso){const [y,m,d]=iso.split("-");return `select * where A = date '${y}-${m}-${d}'`}
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
   if(type==="songs"&&date==="2026-10-03"&&window.DAEGON_WEEKLY) return window.DAEGON_WEEKLY.map(r=>({...r,streams:r.streams*1000,total:r.total*1000}));
   throw e;
 }
}

function initials(s){return String(s||"").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()}
function movementDirection(dif){
 const d=String(dif||"").trim().toUpperCase();
 if(d==="NEW") return "new";
 if(d==="RE"||d==="RE-ENTRY"||d==="REENTRY") return "re";
 if(d==="↑"||d==="▲"||d==="UP") return "up";
 if(d==="↓"||d==="▼"||d==="DOWN") return "down";
 return "same";
}
function move(r){
 const dir=movementDirection(r.dif);
 if(dir==="new") return {text:"New",cls:""};
 if(dir==="re") return {text:"Re-Entry",cls:"reentry"};
 const lw=Number(r.lw), rank=Number(r.rank);
 if(dir==="up"&&Number.isFinite(lw)&&lw>rank) return {text:"↑ "+(lw-rank),cls:"up"};
 if(dir==="down"&&Number.isFinite(lw)&&lw<rank) return {text:"↓ "+(rank-lw),cls:"down"};
 return {text:"—",cls:"same"};
}
function mainText(r){return currentChart==="songs"?r.song:currentChart==="albums"?r.album:r.artist}
function subText(r){return currentChart==="artists"?"":r.artist}
function albumText(r){return currentChart==="songs"?r.album:currentChart==="albums"?r.album:"—"}

function render(){
 rows.innerHTML=currentRows.map(r=>{
   const m=move(r),main=mainText(r),sub=subText(r);
   return `<tr class="song-row" data-row="${r.rank}">
<td class="rank-cell"><div class="rank-stack"><span class="rank-number">${r.rank}</span><span class="move-badge ${m.cls}">${m.text}</span></div></td>
<td><div class="track-cell"><div class="cover" data-art-rank="${r.rank}">${initials(sub||main)}</div><div class="track-copy"><b>${main}</b>${sub?'<span>'+sub+'</span>':""}</div></div></td>
<td class="metric">${r.peak}</td><td class="metric">${r.lw==="-"?"—":r.lw}</td><td class="metric">${r.weeks}</td><td class="metric streams">${fmt(r.streams)}</td>
<td class="metric"><button class="expand-btn" data-expand="${r.rank}">More⌄</button></td></tr>
<tr class="details-row" id="details-${r.rank}"><td colspan="7" class="details-cell"><div class="details-panel"><div></div><div>
<div class="detail-grid"><b>${currentChart==="artists"?"Chart":"Album"}</b><span>${currentChart==="artists"?"Top 50 Artists":albumText(r)}</span><b>Last week</b><span>${r.lw==="-"?"New entry":r.lw}</span><b>Peak position</b><span>${r.peak}</span><b>Total weeks on chart</b><span>${r.weeks}</span><b>Weeks at #1</b><span>${r.weeks1}</span><b>Total streams</b><span>${fmt(r.total)}</span><b>Source</b><span>Daegon Charts · ${CHARTS[currentChart].sheet}</span></div>
<div class="detail-actions"><button class="promo-btn">Share Promo Card</button></div></div></div></td></tr>`
 }).join("");
}

function exactish(a,b){const x=norm(a),y=norm(b);return !!x&&!!y&&x===y}
function exactArtist(a,b){return exactish(a,b)}
function exactTitle(a,b){return exactish(a,b)}
function artworkIdentityTitle(kind,value){
 let x=norm(value);
 if(kind==="song"){
   x=x.replace(/\bpt\s*(\d+)\b/g,"part $1")
      .replace(/\bpart\s*(\d+)\b/g,"part $1")
      .replace(/\b(?:radio edit|single version|album version|edit|remaster(?:ed)?(?: \d{4})?|mono|stereo|explicit|clean)\b/g,"")
      .replace(/\b(?:with|feat|ft|featuring)\b.*$/g,"")
      .replace(/\s+/g," ").trim();
 }
 return x;
}
function artworkSearchTitle(kind,value){
 let x=String(value||"").trim();
 if(kind!=="song")return x;
 return x
   .replace(/\s*[\(\[]\s*(?:with|feat\.?|ft\.?|featuring)\b[^\)\]]*[\)\]]/gi,"")
   .replace(/\s+(?:with|feat\.?|ft\.?|featuring)\s+.+$/gi,"")
   .replace(/\s*[\(\[]\s*(?:radio edit|single version|album version|edit|remaster(?:ed)?(?:\s+\d{4})?|mono|stereo|explicit|clean)\s*[\)\]]\s*$/gi,"")
   .replace(/\s+/g," ").trim();
}
function usableImage(url){
 if(!url)return false;
 const u=String(url).toLowerCase();
 return !u.includes("2a96cbd8b46e442fc41c2b86b821562f")&&!u.includes("default_album")&&!u.includes("noimage")&&!u.includes("no-image");
}
async function jsonFetch(url,timeout=7000){
 try{
   const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeout);
   const r=await fetch(url,{signal:ctrl.signal});clearTimeout(timer);
   if(!r.ok)return null;return await r.json();
 }catch{return null}
}
function compactKey(v){return norm(v).replace(/[^a-z0-9]/g,"")}
function extractYear(name){const m=String(name||"").match(/\b(19|20)\d{2}\b/);return{year:m?m[0]:null,stripped:m?String(name).replace(m[0],"").trim():String(name||"")}}
function albumVariants(name){const{year,stripped}=extractYear(name);const out=[String(name||"")];if(year&&stripped&&stripped!==name)out.push(stripped);return[...new Set(out)]}

const HARDCODED_ALBUM_IMAGES={
 checkmate:"https://image-cdn-ak.spotifycdn.com/image/ab67706c0000da841ebe14cc216c7be9269638d7",
 solo:"https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02c0f23c0d2af5ec63daef87f0",
 ritalee1979:"https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02471646faaecf4b53e95b5c1c",
 rebeldes:"https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e025637ea9091a58684212c8fea",
 equals:"https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02dc806722f6802a8ea9953c89",
 brasileirinha:"https://static.wikia.nocookie.net/anitta/images/0/0c/BRASILEIRINHA.png/revision/latest?cb=20210622000705&path-prefix=pt-br",
 girlfromrio:"https://i.pinimg.com/736x/9d/1a/66/9d1a663dae6e7251e69c75e8605b9ce9.jpg",
 acontece:"https://i.pinimg.com/736x/72/c5/fd/72c5fdbdcb418854b7aee2c12720007b.jpg",
 wanessacamargo:"https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02b3053279804f33dd993d032c",
 wanessacamargo2002:"https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02a492ad852a3ff45542494af6",
 w:"https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e022cd46c56308c5aba148c03dc",
 deadline:"https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e028db56c674b13b3a4c6a4dbb8"
};
const HARDCODED_TRACK_IMAGES={saveyourtearsremix:"https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02c6af5ffa661a365b77df6ef6"};

async function searchTheAudioDB(name,kind,artistName=""){
 if(kind==="artist"){
   const d=await jsonFetch("https://www.theaudiodb.com/api/v1/json/123/search.php?s="+encodeURIComponent(name),7000);
   const hit=(d?.artists||[]).find(a=>exactArtist(a?.strArtist,name));
   return hit?.strArtistThumb||"";
 }
 const d=await jsonFetch("https://www.theaudiodb.com/api/v1/json/123/searchalbum.php?s="+encodeURIComponent(artistName)+"&a="+encodeURIComponent(name),7000);
 const hit=(d?.album||[]).find(a=>exactTitle(a?.strAlbum,name)&&exactArtist(a?.strArtist,artistName));
 return hit?.strAlbumThumb||"";
}
async function searchWikidataArtist(name){
 const s=await jsonFetch("https://www.wikidata.org/w/api.php?action=wbsearchentities&search="+encodeURIComponent(name)+"&language=en&limit=5&format=json&origin=*",7000);
 for(const item of s?.search||[]){
   if(!exactArtist(item?.label,name))continue;
   const d=await jsonFetch("https://www.wikidata.org/w/api.php?action=wbgetclaims&entity="+encodeURIComponent(item.id)+"&property=P18&format=json&origin=*",7000);
   const fn=d?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
   if(fn)return "https://commons.wikimedia.org/wiki/Special:FilePath/"+encodeURIComponent(String(fn).replace(/ /g,"_"))+"?width=600";
 }
 return "";
}
function appleArtSize(url){return String(url||"").replace(/\/\d+x\d+bb(?:-\d+)?\.(jpg|png)$/i,"/1200x1200bb.$1").replace(/\/100x100bb\.(jpg|png)$/i,"/1200x1200bb.$1")}
async function searchApple(name,artist,kind){
 const entity=kind==="song"?"song":kind==="album"?"album":"musicArtist";
 const term=kind==="artist"?name:(name+" "+artist);
 const d=await jsonFetch("https://itunes.apple.com/search?term="+encodeURIComponent(term)+"&entity="+entity+"&limit=25&country=br",10000);
 const results=d?.results||[];
 if(kind==="artist"){
   const hit=results.find(x=>exactArtist(x.artistName,name))||results[0];
   return usableImage(hit?.artworkUrl100||hit?.artworkUrl60)?appleArtSize(hit.artworkUrl100||hit.artworkUrl60):"";
 }
 if(kind==="album"){
   for(const variant of albumVariants(name)){
     const hit=results.find(x=>exactTitle(x.collectionName,variant)&&exactArtist(x.artistName,artist));
     if(hit&&usableImage(hit.artworkUrl100||hit.artworkUrl60))return appleArtSize(hit.artworkUrl100||hit.artworkUrl60);
   }
   return "";
 }
 const wanted=artworkIdentityTitle("song",name);
 const hit=results.find(x=>artworkIdentityTitle("song",x.trackName)===wanted&&exactArtist(x.artistName,artist))
   ||results.find(x=>artworkIdentityTitle("song",x.trackName)===wanted);
 return hit&&usableImage(hit.artworkUrl100||hit.artworkUrl60)?appleArtSize(hit.artworkUrl100||hit.artworkUrl60):"";
}
async function resolveArtwork(row){
 const kind=currentChart==="songs"?"song":currentChart==="albums"?"album":"artist";
 const name=mainText(row),artist=row.artist||name;
 const key="img-public-v1|"+kind+"|"+artworkIdentityTitle(kind,name)+"|"+norm(artist);
 const cached=localStorage.getItem(key);if(cached)return cached==="__none__"?null:cached;

 // Same exact public overrides used by Daegon Charts.
 if(kind==="song"&&norm(artist)==="rebeldes"){
   try{
     const d=await jsonFetch("https://itunes.apple.com/lookup?id=721250427&entity=song&country=br",10000);
     const results=d?.results||[],track=results.find(x=>String(x.wrapperType||"").toLowerCase()==="track"&&norm(x.trackName)===norm(name));
     const collection=results.find(x=>String(x.wrapperType||"").toLowerCase()==="collection"||String(x.collectionType||"").toLowerCase()==="album");
     const art=appleArtSize(track?.artworkUrl100||track?.artworkUrl60||collection?.artworkUrl100||collection?.artworkUrl60||"");
     if(usableImage(art)){localStorage.setItem(key,art);return art}
   }catch{}
 }
 if(kind==="album"&&norm(name)==="the life of a showgirl"&&norm(artist)==="taylor swift"){
   try{
     const d=await jsonFetch("https://itunes.apple.com/lookup?id=6814997249&country=br",10000);
     const hit=(d?.results||[]).find(x=>String(x.collectionId||"")==="6814997249")||(d?.results||[])[0];
     const art=appleArtSize(hit?.artworkUrl100||hit?.artworkUrl60||"");
     if(usableImage(art)){localStorage.setItem(key,art);return art}
   }catch{}
 }

 if(kind==="album"){
   const hard=HARDCODED_ALBUM_IMAGES[compactKey(name)];
   if(usableImage(hard)){localStorage.setItem(key,hard);return hard}
 }
 if(kind==="song"){
   const hard=HARDCODED_TRACK_IMAGES[compactKey(name)];
   if(usableImage(hard)){localStorage.setItem(key,hard);return hard}
 }

 let url=await searchApple(artworkSearchTitle(kind,name),artist,kind);

 if(!url&&kind==="album")url=await searchTheAudioDB(name,"album",artist);
 if(!url&&kind==="artist")url=await searchTheAudioDB(name,"artist");
 if(!url&&kind==="artist")url=await searchWikidataArtist(name);

 // Same Daegon Charts final visual fallback: song/album -> artist square image.
 if(!url&&kind!=="artist"&&artist){
   const artistRow={artist};
   const previous=currentChart;
   currentChart="artists";
   try{url=await resolveArtwork(artistRow)}finally{currentChart=previous}
 }

 if(usableImage(url)){localStorage.setItem(key,url);return url}
 localStorage.setItem(key,"__none__");return null;
}

function pickHeroSlides(){
 const newEntry=currentRows.find(r=>r.dif==="NEW")||currentRows[0];
 const gainers=currentRows
   .filter(r=>movementDirection(r.dif)==="up"&&Number.isFinite(Number(r.lw))&&Number(r.lw)>r.rank)
   .map(r=>({...r,_gain:Number(r.lw)-r.rank}))
   .filter(r=>r._gain>0)
   .sort((a,b)=>b._gain-a._gain);
 const gainer=gainers[0]||null;
 const longest=[...currentRows].sort((a,b)=>b.weeks-a.weeks)[0]||currentRows[0];
 let extra=currentRows[0];
 let extraText="";
 if(currentChart==="albums"){
   const counts={};currentRows.forEach(r=>counts[r.artist]=(counts[r.artist]||0)+1);
   const topArtist=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
   if(topArtist){extra=currentRows.find(r=>r.artist===topArtist[0])||currentRows[0];extraText=`${topArtist[0]} has the most spots on Top Albums Global. “${extra.album}” is the highest at #${extra.rank}.`;}
 } else if(currentChart==="artists"){
   extra=currentRows[0];extraText=`${extra.artist} leads Top Artists Global at #1 this week.`;
 } else {
   extra=currentRows[0];extraText=`“${extra.song}” by ${extra.artist} leads Top Songs Global at #1 this week.`;
 }
 const chartName=currentChart==="songs"?"Top Songs":currentChart==="albums"?"Top Albums":"Top Artists";
 const newText=currentChart==="artists"?`${newEntry.artist} is the highest new entry on ${chartName} Global at #${newEntry.rank}.`:`“${mainText(newEntry)}” by ${newEntry.artist} is the highest new entry on ${chartName} Global at #${newEntry.rank}.`;
 const longText=currentChart==="artists"?`${longest.artist} has been on ${chartName} Global the longest, at ${longest.weeks} weeks straight.`:`“${mainText(longest)}” by ${longest.artist} has been on ${chartName} Global the longest, at ${longest.weeks} weeks straight.`;
 const slides=[
   {row:newEntry,text:newText},
   {row:extra,text:extraText},
   gainer ? {row:gainer,text:currentChart==="artists"
      ? `${gainer.artist} is the biggest gainer on ${chartName} Global, up ${gainer._gain} spots to #${gainer.rank}.`
      : `“${mainText(gainer)}” by ${gainer.artist} is the biggest gainer on ${chartName} Global, up ${gainer._gain} spots to #${gainer.rank}.`} : null,
   {row:longest,text:longText}
 ].filter(Boolean);

 const seen=new Set();
 return slides.filter(s=>{
   const key=mainText(s.row)+"|"+s.text;
   if(seen.has(key)) return false;
   seen.add(key);
   return true;
 });
}
async function dominantColor(url,fallback="#ef006f"){
 if(!url)return fallback;
 return new Promise(resolve=>{
   const img=new Image();img.crossOrigin="anonymous";img.onload=()=>{
     try{const c=document.createElement("canvas");c.width=c.height=24;const x=c.getContext("2d");x.drawImage(img,0,0,24,24);const d=x.getImageData(0,0,24,24).data;let r=0,g=0,b=0,n=0;for(let i=0;i<d.length;i+=16){r+=d[i];g+=d[i+1];b+=d[i+2];n++}r=Math.round(r/n*.62);g=Math.round(g/n*.62);b=Math.round(b/n*.62);resolve(`rgb(${r},${g},${b})`)}catch(e){resolve(fallback)}
   };img.onerror=()=>resolve(fallback);img.src=url;
 });
}
async function showHero(i){
 if(!heroSlides.length)return;heroIndex=(i+heroSlides.length)%heroSlides.length;
 const slide=heroSlides[heroIndex],row=slide.row,art=await resolveArtwork(row),hero=document.getElementById("weeklyHeroArt");
 document.getElementById("heroHeadline").textContent=slide.text;
 hero.style.backgroundImage=art?'url("'+art+'")':"";hero.classList.toggle("has-artwork",!!art);hero.textContent=art?"":initials(row.artist||mainText(row));
 document.querySelectorAll(".hero-pager i").forEach((d,idx)=>d.classList.toggle("active",idx===heroIndex));
 document.querySelector(".chart-hero").style.backgroundColor=await dominantColor(art,currentChart==="songs"?"#ef006f":currentChart==="albums"?"#6e4747":"#3147ad");
}
function startHero(){
 clearInterval(heroTimer);heroSlides=pickHeroSlides();showHero(0);
 document.querySelectorAll(".hero-pager i").forEach((d,i)=>d.onclick=()=>{showHero(i);clearInterval(heroTimer);heroTimer=setInterval(()=>showHero(heroIndex+1),6500)});
 heroTimer=setInterval(()=>showHero(heroIndex+1),6500);
}

async function hydrateArtwork(){
 for(const r of currentRows.slice(0,50)){const art=await resolveArtwork(r);if(!art)continue;document.querySelectorAll('[data-art-rank="'+r.rank+'"]').forEach(el=>{el.style.backgroundImage='url("'+art+'")';el.classList.add("has-artwork")})}
 startHero();
}
function updateLabels(){
 const c=CHARTS[currentChart];document.getElementById("chartTitle").textContent=c.title;document.getElementById("chartSubtitle").textContent=c.subtitle;document.getElementById("itemHeader").textContent=c.item;
 document.getElementById("heroPeriod").textContent=`${currentChart==="songs"?"Top Songs":currentChart==="albums"?"Top Albums":"Top Artists"} Global · Week of ${displayDate(currentDate)}`;
}
async function refresh(){
 updateLabels();rows.innerHTML='<tr><td colspan="7" class="loading-row">Loading weekly chart…</td></tr>';
 try{currentRows=await loadWeek(currentChart,currentDate);render();hydrateArtwork()}catch(e){rows.innerHTML='<tr><td colspan="7" class="loading-row">This week could not be loaded from the live spreadsheet.</td></tr>'}
}
document.getElementById("weekSelect").onchange=e=>{currentDate=e.target.value;refresh()};
document.addEventListener("click",e=>{const b=e.target.closest("[data-expand]");if(!b)return;const d=document.getElementById("details-"+b.dataset.expand);const open=d.classList.toggle("open");b.textContent=open?"Less⌃":"More⌄"});
document.getElementById("downloadCsv").onclick=()=>{if(!currentRows.length)return;const head=["Rank","Change",CHARTS[currentChart].item,"Artist","LW","Peak","Weeks","Weeks at #1","Streams","Total Streams"];const data=[head,...currentRows.map(r=>[r.rank,r.dif,mainText(r),r.artist||"",r.lw,r.peak,r.weeks,r.weeks1,r.streams,r.total])];const csv=data.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(",")).join("\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download=`daegon-music-${currentChart}-${currentDate}.csv`;a.click();URL.revokeObjectURL(u)};
(async()=>{await loadDates();await refresh()})();