const SHEET_ID="1t6_7SOlspmNYrXq8PSfJ74frIdrWwQBFITQ3bQmRzeg";
const charts={songs:{sheet:"Streaming Songs",entity:"song"},albums:{sheet:"Top Streaming Albums",entity:"album"},artists:{sheet:"Top 50 Artists",entity:"musicArtist"}};
const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
const parseNum=v=>{if(v==null||v==="")return 0;const s=String(v).trim().replace(/\./g,"").replace(",",".");const n=Number(s);return Number.isFinite(n)?n:0};
function parseGviz(text){const a=text.indexOf("{"),b=text.lastIndexOf("}");return JSON.parse(text.slice(a,b+1))}
function cell(row,i){return row.c?.[i]?.f??row.c?.[i]?.v??""}
function url(sheet,tq){return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${encodeURIComponent(sheet)}&tqx=out:json&tq=${encodeURIComponent(tq)}`}
async function gviz(sheet,tq){const r=await fetch(url(sheet,tq));if(!r.ok)throw new Error("sheet");return parseGviz(await r.text())}
function isoFromDisplay(s){const m=String(s||"").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);return m?`${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`:""}
function displayDate(iso){return new Date(iso+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
function dateQuery(iso){const [y,m,d]=iso.split("-");return `select * where A = date '${y}-${m}-${d}'`}
async function latestDate(){const j=await gviz("Streaming Songs","select A where A is not null");return [...new Set((j.table.rows||[]).map(r=>isoFromDisplay(cell(r,0))).filter(Boolean))].sort().at(-1)}
function parseOne(j,type){const r=(j.table.rows||[])[0];if(!r)return null;if(type==="songs")return{rank:parseNum(cell(r,1)),title:String(cell(r,3)||""),artist:String(cell(r,4)||""),album:String(cell(r,5)||"")};if(type==="albums")return{rank:parseNum(cell(r,1)),title:String(cell(r,3)||""),artist:String(cell(r,4)||"")};return{rank:parseNum(cell(r,1)),title:String(cell(r,3)||""),artist:String(cell(r,3)||"")}}
async function no1(type,date){const j=await gviz(charts[type].sheet,dateQuery(date)+" and B = 1");let one=parseOne(j,type);if(one)return one;const [y,m,d]=date.split("-");const j2=await gviz(charts[type].sheet,`select * where A = '${Number(d)}/${Number(m)}/${y}' and B = 1`);return parseOne(j2,type)}
async function appleSearch(term,entity){const r=await fetch("https://itunes.apple.com/search?term="+encodeURIComponent(term)+"&entity="+entity+"&limit=6&country=us");if(!r.ok)throw new Error("apple");return r.json()}
async function artFor(item,type){try{const term=type==="artists"?item.artist:item.title+" "+item.artist;const d=await appleSearch(term,charts[type].entity);const hit=(d.results||[])[0];return (hit?.artworkUrl100||hit?.artworkUrl60)?.replace(/100x100bb|60x60bb/,"600x600bb")||null}catch(e){return null}}
function setArt(id,url){const el=document.getElementById(id);if(url){el.style.backgroundImage='url("'+url+'")';el.classList.add("has-artwork")}}
(async()=>{
 try{
  const date=await latestDate();
  const [song,artist,album]=await Promise.all([no1("songs",date),no1("artists",date),no1("albums",date)]);
  document.getElementById("landingPeriod").textContent="Weekly charts · "+displayDate(date);
  document.getElementById("landingHeadline").textContent='“'+album.title+'” by '+album.artist+' leads Weekly Top Albums Global.';
  document.getElementById("songsCardTitle").textContent=song.title;document.getElementById("songsCardArtist").textContent=song.artist;
  document.getElementById("artistsCardTitle").textContent=artist.title;
  document.getElementById("albumsCardTitle").textContent=album.title;document.getElementById("albumsCardArtist").textContent=album.artist;
  const [sa,aa,al]=await Promise.all([artFor(song,"songs"),artFor(artist,"artists"),artFor(album,"albums")]);
  setArt("songsCardArt",sa);setArt("artistsCardArt",aa);setArt("albumsCardArt",al);setArt("landingHeroArt",al||sa||aa);
 }catch(e){
  document.getElementById("landingHeadline").textContent="Weekly global charts, separated by songs, artists and albums.";
 }
})();