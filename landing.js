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
function exactish(a,b){return norm(a)===norm(b)&&!!norm(a)}
function usableImage(url){if(!url)return false;const u=String(url).toLowerCase();return !u.includes("default_album")&&!u.includes("noimage")&&!u.includes("no-image")}
async function jsonFetch(url,timeout=7000){try{const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);const r=await fetch(url,{signal:c.signal});clearTimeout(t);return r.ok?await r.json():null}catch{return null}}
function appleArtSize(url){return String(url||"").replace(/\/\d+x\d+bb(?:-\d+)?\.(jpg|png)$/i,"/1200x1200bb.$1").replace(/\/100x100bb\.(jpg|png)$/i,"/1200x1200bb.$1")}
async function searchApple(item,type){
 const entity=type==="songs"?"song":type==="albums"?"album":"musicArtist";
 const term=type==="artists"?item.artist:item.title+" "+item.artist;
 const d=await jsonFetch("https://itunes.apple.com/search?term="+encodeURIComponent(term)+"&entity="+entity+"&limit=25&country=br",10000);
 const rs=d?.results||[];
 let hit=null;
 if(type==="songs")hit=rs.find(x=>exactish(x.trackName,item.title)&&exactish(x.artistName,item.artist))||rs.find(x=>exactish(x.trackName,item.title));
 else if(type==="albums")hit=rs.find(x=>exactish(x.collectionName,item.title)&&exactish(x.artistName,item.artist));
 else hit=rs.find(x=>exactish(x.artistName,item.artist));
 const art=hit?.artworkUrl100||hit?.artworkUrl60||"";
 return usableImage(art)?appleArtSize(art):"";
}
async function searchTheAudioDB(name,type,artist=""){
 if(type==="artists"){const d=await jsonFetch("https://www.theaudiodb.com/api/v1/json/123/search.php?s="+encodeURIComponent(name));const h=(d?.artists||[]).find(x=>exactish(x.strArtist,name));return h?.strArtistThumb||""}
 const d=await jsonFetch("https://www.theaudiodb.com/api/v1/json/123/searchalbum.php?s="+encodeURIComponent(artist)+"&a="+encodeURIComponent(name));const h=(d?.album||[]).find(x=>exactish(x.strAlbum,name)&&exactish(x.strArtist,artist));return h?.strAlbumThumb||"";
}
async function searchWikidataArtist(name){
 const s=await jsonFetch("https://www.wikidata.org/w/api.php?action=wbsearchentities&search="+encodeURIComponent(name)+"&language=en&limit=5&format=json&origin=*");
 for(const x of s?.search||[]){if(!exactish(x.label,name))continue;const d=await jsonFetch("https://www.wikidata.org/w/api.php?action=wbgetclaims&entity="+x.id+"&property=P18&format=json&origin=*");const fn=d?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;if(fn)return "https://commons.wikimedia.org/wiki/Special:FilePath/"+encodeURIComponent(String(fn).replace(/ /g,"_"))+"?width=600"}return "";
}
async function artFor(item,type){
 let url=await searchApple(item,type);
 if(!url&&type==="albums")url=await searchTheAudioDB(item.title,"albums",item.artist);
 if(!url&&type==="artists")url=await searchTheAudioDB(item.artist,"artists");
 if(!url&&type==="artists")url=await searchWikidataArtist(item.artist);
 if(!url&&type!=="artists"){url=await searchTheAudioDB(item.artist,"artists")||await searchWikidataArtist(item.artist)}
 return usableImage(url)?url:null;
}
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