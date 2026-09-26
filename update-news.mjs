import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const sources = [
  {name:'総務省統計局',url:'https://www.stat.go.jp/whatsnew/news.rdf'},
  {name:'日本銀行',url:'https://www.boj.or.jp/rss/whatsnew.xml'}
];
const now = new Date();
const jst = new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',dateStyle:'medium',timeStyle:'short'}).format(now);
const hour = Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',hour:'2-digit',hourCycle:'h23'}).format(now));
const edition = hour < 12 ? 'MORNING' : 'EVENING';
const clean = s => String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/\s+/g,' ').trim();
const val = (x,t) => clean(x.match(new RegExp('<'+t+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+t+'>','i'))?.[1]);
const id = (s,u) => crypto.createHash('sha256').update(s+'\n'+u).digest('hex');
await fs.mkdir('data',{recursive:true}); await fs.mkdir('public',{recursive:true});
let memory={version:1,items:[],fetches:[]}; try{memory=JSON.parse(await fs.readFile('data/news-memory.json','utf8'));}catch{}
const byId=new Map(memory.items.map(x=>[x.id,x])); const results=[];
for(const source of sources){
  const fetchedAt=now.toISOString();
  try{
    const r=await fetch(source.url,{headers:{'user-agent':'MarketStudioNews/1.0 official RSS reader'}}); if(!r.ok)throw new Error('HTTP '+r.status);
    const xml=await r.text(); let read=0,added=0;
    for(const m of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)){
      const x=m[1],title=val(x,'title'),url=val(x,'link'); if(!title||!url)continue; read++;
      const published=val(x,'dc:date')||val(x,'pubDate')||null;
      const summary=val(x,'description'); const k=id(source.name,url); const old=byId.get(k);
      byId.set(k,{id:k,source:source.name,title,url,publishedAt:published,firstSeenAt:old?.firstSeenAt||fetchedAt,fetchedAt,officialSummary:summary||old?.officialSummary||null,contentStatus:summary&&summary.length>=30?'OFFICIAL_RSS_SUMMARY':'TITLE_ONLY'}); if(!old)added++;
    }
    results.push({source:source.name,status:'FETCHED',read,added,fetchedAt});
  }catch(e){results.push({source:source.name,status:'FAILED',read:0,added:0,fetchedAt,error:String(e.message).slice(0,120)});}
}
const items=[...byId.values()].sort((a,b)=>String(b.publishedAt||b.firstSeenAt).localeCompare(String(a.publishedAt||a.firstSeenAt))).slice(0,5000);
const important = x => /金融|金利|物価|消費|雇用|GDP|景気|貿易|為替|企業|産業|政策|見通し|結果|速報|変更|改正|決定/.test(x.title+' '+(x.officialSummary||''));
const cards=items.filter(x=>x.contentStatus==='OFFICIAL_RSS_SUMMARY'&&important(x)).slice(0,6).map(x=>({title:x.title,summary:x.officialSummary.slice(0,180),source:x.source,publishedAt:x.publishedAt,firstSeenAt:x.firstSeenAt,url:x.url,status:'NEW'}));
const weekend=[0,6].includes(new Date(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo'}).format(now)+'T12:00:00').getDay());
let presenter=edition==='EVENING'?'今日の市場を振り返ります。明日につながる材料も確認しましょう。':cards.length<=1?'今朝は大きな材料は少なめです。確認できたニュースを見ていきましょう。':cards.length>=5?'今朝は材料が多めです。重要なものから60秒で確認しましょう。':'今朝までの重要な材料を、60秒で確認しましょう。';
if(weekend)presenter='今日は休場ですが、次の営業日につながるニュースを確認しておきましょう。';
const program={generatedAt:now.toISOString(),asOf:jst,edition,heading:edition==='MORNING'?'今日見る材料':'今日の振り返り',presenterLine:presenter,counts:{newsMemoryTotal:items.length,adoptedCards:cards.length,failedSources:results.filter(x=>x.status==='FAILED').length},sourceResults:results,cards,qualityNote:'公式RSSの本文要約が確認できた情報だけを掲載。見出ししかない情報は内容を推測しない。株価予想・売買推奨は行わない。'};
const esc=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const cardHtml=cards.length?cards.map((c,i)=>'<article><small>'+(i+1)+' / '+cards.length+'　'+esc(c.source)+'</small><h2>'+esc(c.title)+'</h2><p>'+esc(c.summary)+'</p><a href="'+esc(c.url)+'">公式情報を見る</a></article>').join(''):'<article><h2>重要ニュースは確認中です</h2><p>内容を確認できた公式情報だけを掲載するため、現在表示できるカードはありません。</p></article>';
const html='<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>60秒ニュース | MARKET STUDIO</title><style>body{margin:0;background:linear-gradient(#dff1ff,#f8fbff);color:#0a3158;font-family:system-ui,sans-serif}.wrap{max-width:720px;margin:auto;padding:24px}header{background:#0b355c;color:white;border-radius:24px;padding:28px}article{background:white;border-radius:22px;padding:24px;margin:18px 0;box-shadow:0 8px 26px #0b355c18}h1{margin:0 0 12px}h2{font-size:1.3rem}p{line-height:1.75}a{color:#0674cc;font-weight:700}footer{font-size:.85rem;color:#567}</style><div class="wrap"><header><small>MARKET STUDIO</small><h1>60秒ニュース</h1><p>'+esc(presenter)+'</p><small>'+esc(jst)+' 更新</small></header>'+cardHtml+'<footer>'+esc(program.qualityNote)+'</footer></div></html>';
await fs.writeFile('data/news-memory.json',JSON.stringify({version:1,updatedAt:now.toISOString(),items,fetches:[...(memory.fetches||[]),...results].slice(-400)},null,2)+'\n');
await fs.writeFile('public/news-program.json',JSON.stringify(program,null,2)+'\n'); await fs.writeFile('public/status.json',JSON.stringify({ok:results.some(x=>x.status==='FETCHED'),generatedAt:now.toISOString(),results},null,2)+'\n'); await fs.writeFile('public/index.html',html);
console.log(JSON.stringify(program.counts)); if(results.every(x=>x.status==='FAILED'))process.exitCode=1;
