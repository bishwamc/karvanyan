"""Apply the Block 1 hotfixes (T10, T11, T12) to legacy/index.html.

Starts from baseline/index.html every time, so the result is reproducible and
the frozen baseline is never touched. Each replacement must match exactly once;
otherwise the script stops, so a silent half-patch is impossible.

Run: python3 tools/patch_legacy.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
src = (ROOT / "baseline" / "index.html").read_text(encoding="utf-8")
patches = []


def P(tag, old, new):
    patches.append((tag, old, new))


# ---------------------------------------------------------------- T11 layout + labels (CSS)
P("T11 header wraps on narrow phones",
  ".top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px}",
  ".top{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px}")
P("T11 ribbon: line inset matches node anchors",
  ".ribbon .line{position:absolute;top:44px;left:6%;right:6%;height:0;border-top:2px dashed var(--gold-line)}\n"
  ".ribbon .node{position:absolute;top:22px;transform:translateX(-50%);text-align:center;width:74px}",
  ".ribbon .line{position:absolute;top:44px;left:10%;right:10%;height:0;border-top:2px dashed var(--gold-line)}\n"
  "/* Nodes are 20% wide so five of them never overflow, even at 320 px.\n"
  "   First and last nodes are anchored to the edges instead of centred. */\n"
  ".ribbon .node{position:absolute;top:22px;transform:translateX(-50%);text-align:center;width:20%}\n"
  ".ribbon .node.first{transform:none;left:0!important}\n"
  ".ribbon .node.last{transform:none;left:auto!important;right:0}")
P("T11 ribbon labels shrink and wrap",
  ".node span{display:block;font-size:.8rem;line-height:1.1;margin-top:2px}",
  ".node span{display:block;font-size:.8rem;line-height:1.1;margin-top:2px;overflow-wrap:anywhere}\n"
  "@media (max-width:420px){.node span{font-size:.72rem}}")
P("T11 segmented buttons may shrink and wrap their text",
  ".seg{display:flex;gap:6px}.seg .btn{text-align:center;margin:0;padding:.4rem .3rem}",
  ".seg{display:flex;gap:6px}.seg .btn{flex:1 1 0;min-width:0;text-align:center;margin:0;padding:.4rem .3rem;overflow-wrap:anywhere}")
P("T11 pace/rations stack below 520 px",
  ".ctl{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:.8rem 0}",
  ".ctl{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:.8rem 0}\n"
  ".ctl>div{min-width:0}\n"
  "@media (max-width:520px){.ctl{grid-template-columns:1fr}}\n"
  "/* Codex 'new' badge: a dot, so the button never wraps */\n"
  ".dot{display:inline-block;width:.55em;height:.55em;border-radius:50%;background:var(--accent);margin-left:.35em;vertical-align:.15em}\n"
  ".treat{display:inline-block;width:auto;min-height:44px;margin:0 0 0 .4rem;padding:.2rem .6rem;font-size:.85rem;text-align:center}\n"
  "/* Modal focus target: the heading gets focus but needs no ring of its own */\n"
  ".overlay h2:focus{outline:none}\n"
  ".overlay h2:focus-visible{outline:3px solid var(--accent);outline-offset:2px}")
P("T11 party rows: treat button fits on phones",
  "@media (max-width:480px){body{font-size:17px}.mem{grid-template-columns:1fr 1fr 60px}.scen{grid-template-columns:1fr}}",
  "@media (max-width:480px){body{font-size:17px}.mem{grid-template-columns:1fr 1fr 60px}.scen{grid-template-columns:1fr}.field-row{grid-template-columns:90px 1fr}}\n"
  ".mem>span:first-child{min-width:0;overflow-wrap:break-word}\n"
  "@media (max-width:400px){.mem{grid-template-columns:minmax(0,1.5fr) minmax(0,.9fr) 52px;font-size:.92rem}}")

# ---------------------------------------------------------------- T11 header buttons
P("T11 theme toggle gets a visible label",
  '<button class="tool" id="btnCodex" type="button">📖 Codex</button>\n'
  '      <button class="tool" id="btnTheme" type="button" aria-label="Switch between light and dark">◐</button>',
  '<button class="tool" id="btnCodex" type="button" data-testid="btn-codex">📖 Codex</button>\n'
  '      <button class="tool" id="btnTheme" type="button" data-testid="btn-theme" aria-label="Theme: switch between light and dark">◐ Theme</button>')

# ---------------------------------------------------------------- T10 registry + modal manager
P("T10 unique, never-reset button ids (fixes S1 root cause)",
  "let G=null, reg=[], timer=null;",
  "let G=null, timer=null;\n"
  "// Button registry. Each button gets an id that is never reused, so re-rendering one\n"
  "// part of the page can never re-point a button in another part (audit defect S1).\n"
  "const reg=new Map(); let regNext=0;")
P("T10 B() uses the unique registry; adds test ids; disabled may be a function",
  "function B(label,fn,cls,dis){ reg.push(fn); return '<button type=\"button\" class=\"btn '+(cls||'')+'\" data-r=\"'+(reg.length-1)+'\"'+(dis?' disabled':'')+'>'+label+'</button>'; }\n"
  "document.addEventListener('click',e=>{ const b=e.target.closest('[data-r]'); if(!b||b.disabled)return; const f=reg[+b.dataset.r]; if(f)f(); });",
  "// `dis` may be a boolean or a function (D5); it is evaluated once, at render time.\n"
  "const isDis=d=>typeof d==='function'?!!d():!!d;\n"
  "function B(label,fn,cls,dis,testid){ const id=String(++regNext); reg.set(id,fn);\n"
  "  return '<button type=\"button\" class=\"btn '+(cls||'')+'\" data-r=\"'+id+'\"'+(testid?' data-testid=\"'+testid+'\"':'')+(isDis(dis)?' disabled':'')+'>'+label+'</button>'; }\n"
  "// Drop handlers whose buttons are gone, so the map does not grow for ever.\n"
  "function gcReg(){ const live=new Set(); document.querySelectorAll('[data-r]').forEach(b=>live.add(b.dataset.r)); for(const k of reg.keys()) if(!live.has(k)) reg.delete(k); }\n"
  "document.addEventListener('click',e=>{\n"
  "  const b=e.target.closest('[data-r]'); if(!b||b.disabled)return;\n"
  "  // While a dialog is open, only buttons inside the top dialog may act.\n"
  "  const top=topOverlay(); if(top && !top.contains(b)) return;\n"
  "  const f=reg.get(b.dataset.r); if(f)f();\n"
  "  if(reg.size>400) gcReg();\n"
  "});\n"
  "\n"
  "/* ---------- dialogs: one manager for every overlay (T10) ----------\n"
  "   Any time an overlay appears in #modalHost or #codexHost, this code makes it a\n"
  "   proper dialog: role/aria-modal, background made inert, focus moved in and\n"
  "   trapped, and focus given back when the dialog closes. It watches the two hosts,\n"
  "   so every existing innerHTML write is covered without changing it. */\n"
  "const HOSTS=['#modalHost','#codexHost'];\n"
  "const canInert=('inert' in HTMLElement.prototype);\n"
  "let returnFocus=null, lastTop=null;\n"
  "function topOverlay(){ const c=document.querySelector('#codexHost .overlay'); return c||document.querySelector('#modalHost .overlay'); }\n"
  "function focusables(root){ return [...root.querySelectorAll('button,input,[href],[tabindex]:not([tabindex=\"-1\"])')].filter(el=>!el.disabled && el.getClientRects().length); }\n"
  "function syncDialogs(){\n"
  "  const top=topOverlay();\n"
  "  const bg=[...document.querySelectorAll('.wrap > *')];\n"
  "  bg.forEach(el=>{\n"
  "    const off=!!top && !el.contains(top);\n"
  "    if(off){ el.setAttribute('aria-hidden','true'); if(canInert) el.inert=true; }\n"
  "    else { el.removeAttribute('aria-hidden'); if(canInert) el.inert=false; }\n"
  "  });\n"
  "  if(top){\n"
  "    if(!lastTop){ const a=document.activeElement; returnFocus=(a&&a!==document.body)?a:null; }\n"
  "    const panel=top.querySelector('.panel')||top;\n"
  "    panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true'); panel.setAttribute('data-testid','modal');\n"
  "    const h=panel.querySelector('h2');\n"
  "    if(h){ if(!h.id) h.id='dlg-title-'+(++regNext); panel.setAttribute('aria-labelledby',h.id); h.setAttribute('tabindex','-1'); }\n"
  "    if(top!==lastTop || !top.contains(document.activeElement)){ (h||focusables(panel)[0]||panel).focus({preventScroll:false}); }\n"
  "  } else if(lastTop){\n"
  "    const back=(returnFocus&&returnFocus.isConnected&&!returnFocus.disabled)?returnFocus:(document.querySelector('#screen h2')||null);\n"
  "    if(back){ if(back.tagName==='H2') back.setAttribute('tabindex','-1'); back.focus({preventScroll:true}); }\n"
  "    returnFocus=null;\n"
  "  }\n"
  "  lastTop=top;\n"
  "}\n"
  "document.addEventListener('keydown',e=>{\n"
  "  const top=topOverlay(); if(!top) return;\n"
  "  if(e.key==='Escape' && top.closest('#codexHost')){ e.preventDefault(); openCodex(); return; }\n"
  "  if(e.key!=='Tab') return;\n"
  "  const f=focusables(top); if(!f.length){ e.preventDefault(); return; }\n"
  "  const first=f[0], last=f[f.length-1], a=document.activeElement;\n"
  "  if(!top.contains(a)){ e.preventDefault(); first.focus(); return; }\n"
  "  if(e.shiftKey && (a===first || !f.includes(a))){ e.preventDefault(); last.focus(); }\n"
  "  else if(!e.shiftKey && a===last){ e.preventDefault(); first.focus(); }\n"
  "});\n"
  "new MutationObserver(syncDialogs).observe(document.querySelector('#modalHost'),{childList:true});\n"
  "new MutationObserver(syncDialogs).observe(document.querySelector('#codexHost'),{childList:true});")

P("T10 never re-render the screen under an open dialog",
  "function rerender(){ if(G.screen==='stop')renderStop(); else if(G.screen==='travel')renderTravel(); }",
  "function rerender(){ if(G.modal||topOverlay()) return; if(G.screen==='stop')renderStop(); else if(G.screen==='travel')renderTravel(); }")

# remove the per-render registry resets (ids are unique now; resets would orphan live dialogs)
for tag, old, new in [
    ("T10 reg reset: stop", "G.screen='stop'; stopTimer(); reg=[]; updateRibbon();", "G.screen='stop'; stopTimer(); updateRibbon();"),
    ("T10 reg reset: travel", "G.screen='travel'; reg=[]; const e=G.edge;", "G.screen='travel'; const e=G.edge;"),
    ("T10 reg reset: moment", "reg=[]; const mo=G.mo, d=mo.def;", "const mo=G.mo, d=mo.def;"),
    ("T10 reg reset: title", "stopTimer(); reg=[]; G=null; showChrome(false);", "stopTimer(); G=null; showChrome(false);"),
    ("T10 reg reset: setup 1", "reg=[]; let month=9;", "let month=9;"),
    ("T10 reg reset: setup 2", "  const draw=()=>{\n    reg=[];\n", "  const draw=()=>{\n"),
    ("T10 reg reset: end", "stopTimer(); G.screen='end'; reg=[]; G.modal=false;", "stopTimer(); G.screen='end'; G.modal=false;"),
]:
    P(tag, old, new)

# ---------------------------------------------------------------- T11 codex badge
P("T11 codex badge is a dot (no wrapping)",
  "function updateCodexBtn(){ $('#btnCodex').textContent='📖 Codex'+(G&&G.newCards?' ('+G.newCards+' new)':''); }",
  "function updateCodexBtn(){ const b=$('#btnCodex'), n=G&&G.newCards?G.newCards:0;\n"
  "  b.innerHTML='📖 Codex'+(n?'<span class=\"dot\" aria-hidden=\"true\"></span>':'');\n"
  "  b.setAttribute('aria-label', n?'Codex, '+n+' new':'Codex'); }")

# ---------------------------------------------------------------- T11 ribbon anchors
P("T11 ribbon node positions (10%..90%, ends anchored)",
  "  const pos=i=>6+88*i/(ROUTE.length-1);\n"
  "  return '<div class=\"ribbon\" aria-hidden=\"true\"><div class=\"line\"></div>'+ROUTE.map((id,i)=>'<div class=\"node\" id=\"n-'+id+'\" style=\"left:'+pos(i)+'%\"><div class=\"minar\"></div><span>'+STOPS[id].name+'</span></div>').join('')+'<div class=\"caravan\" id=\"caravan\" style=\"left:6%\">🐫</div></div>';",
  "  const pos=i=>10+80*i/(ROUTE.length-1), last=ROUTE.length-1;\n"
  "  return '<div class=\"ribbon\" aria-hidden=\"true\"><div class=\"line\"></div>'+ROUTE.map((id,i)=>'<div class=\"node'+(i===0?' first':i===last?' last':'')+'\" id=\"n-'+id+'\" style=\"left:'+pos(i)+'%\"><div class=\"minar\"></div><span>'+STOPS[id].name+'</span></div>').join('')+'<div class=\"caravan\" id=\"caravan\" style=\"left:10%\">🐫</div></div>';")
P("T11 caravan follows the new positions",
  "$('#caravan').style.left=(6+88*(idx+frac)/(ROUTE.length-1))+'%';",
  "$('#caravan').style.left=(10+80*(idx+frac)/(ROUTE.length-1))+'%';")

# ---------------------------------------------------------------- test ids: HUD, controls, stop
P("testids: HUD",
  "'<div class=\"chip\"><span class=\"ic\" aria-hidden=\"true\">'+i[1]+'</span><span class=\"lb\">'+i[2]+'</span><b id=\"h-'+i[0]+'\">0</b></div>'",
  "'<div class=\"chip\"><span class=\"ic\" aria-hidden=\"true\">'+i[1]+'</span><span class=\"lb\">'+i[2]+'</span><b id=\"h-'+i[0]+'\" data-testid=\"hud-'+i[0]+'\">0</b></div>'")
P("testids: HUD date",
  "<div class=\"dateline\" id=\"h-date\"></div>", "<div class=\"dateline\" id=\"h-date\" data-testid=\"hud-date\"></div>")
P("testids: pace/rations",
  "const seg=(obj,key)=>'<div class=\"seg\">'+Object.keys(obj).map(k=>B(obj[k].label,()=>{G[key]=k;rerender();},G[key]===k?'on':'')).join('')+'</div>';",
  "const seg=(obj,key,pre)=>'<div class=\"seg\">'+Object.keys(obj).map(k=>B(obj[k].label,()=>{G[key]=k;rerender();},G[key]===k?'on':'',false,pre+k)).join('')+'</div>';")
P("testids: pace/rations call sites",
  "seg(PACES,'pace')", "seg(PACES,'pace','pace-')")
P("testids: rations call site",
  "seg(RATIONS,'rations')", "seg(RATIONS,'rations','ration-')")
P("testids: forecast",
  "return '<div class=\"'+(warn?'msg warn':'msg')+'\">'+t+'</div>';",
  "return '<div class=\"'+(warn?'msg warn':'msg')+'\" data-testid=\"forecast\">'+t+'</div>';")

# ---------------------------------------------------------------- T12 medicine: Treat button (D3 / C2)
P("T12 party rows get a Treat button for every sick traveler",
  "    return '<div class=\"mem '+lb[1]+'\"><span>'+p.name+(i===0?' (leader)':'')+(p.sick?' 🤒 '+(p.ill||'fever'):'')+'</span><span class=\"bar\"><i style=\"width:'+(p.alive?Math.max(4,p.hp):0)+'%\"></i></span><em>'+lb[0]+'</em></div>';",
  "    const tr=(p.alive&&p.sick&&!G.over&&(G.screen==='stop'||G.screen==='travel'))\n"
  "      ? B('💊 Treat',()=>treat(i),'treat',G.med<1||G.modal,'treat-'+i) : '';\n"
  "    return '<div class=\"mem '+lb[1]+'\"><span>'+p.name+(i===0?' (leader)':'')+(p.sick?' 🤒 '+(p.ill||'fever'):'')+tr+'</span><span class=\"bar\"><i style=\"width:'+(p.alive?Math.max(4,p.hp):0)+'%\"></i></span><em>'+lb[0]+'</em></div>';")
P("T12 treat() rule: fever always cured, dysentery 70%",
  "function makeSick(p,ill){",
  "// Medicine (sprint change C2): fever is always cured; dysentery is cured 70% of the time.\n"
  "const MED_CURE={fever:1,dysentery:0.7};\n"
  "function treat(i){\n"
  "  const p=G.party[i]; if(!p||!p.alive||!p.sick||G.med<1||G.modal) return;\n"
  "  G.med--; const ill=p.ill||'fever';\n"
  "  let t;\n"
  "  if(chance(ill in MED_CURE?MED_CURE[ill]:1)){ p.sick=false; p.ill=null; t=p.name+' takes the medicine and recovers from '+(ill==='dysentery'?'dysentery':'the fever')+'.'; }\n"
  "  else t=p.name+' takes the medicine, but the dysentery holds on. Rest gives a better chance to recover.';\n"
  "  L(t);\n"
  "  if(G.screen==='stop'){ G.msg=t; renderStop(); } else { updateTravel(); }\n"
  "  updateHud();\n"
  "}\n"
  "function makeSick(p,ill){")
P("T12 dysentery notice tells the truth about medicine",
  "Medicine helps; rest gives a better chance to recover.'",
  "Medicine (the Treat button) cures it more often than not; rest gives a better chance to recover.'")
P("T12 fever notice points at the Treat button",
  "Medicine cures fever, and resting gives a better chance to recover.');",
  "Medicine cures fever: press Treat beside his name. Resting also gives a better chance to recover.');")
P("T12 buy-medicine label matches the rule",
  "you pay '+MED_COST+' rupees. Cures one fever</small>'",
  "you pay '+MED_COST+' rupees. Treats one sick traveler</small>'")

# ---------------------------------------------------------------- T12 pay() + affordability (D6 / C3)
P("T12 pay() reports goods used and any shortfall",
  "function pay(a){\n"
  "  if(G.money>=a){ G.money-=a; return 'You pay '+a+' rupees.'; }\n"
  "  const m=G.money, short=a-m, bundles=Math.min(G.goods,Math.ceil(short/35));\n"
  "  G.money=0; G.goods-=bundles; return 'You pay '+m+' rupees and '+bundles+' bundles of goods.';\n"
  "}",
  "// Goods count as 35 rupees a bundle when coins run out (baseline rule, now explained to the player).\n"
  "const GOODS_AS_CASH=35;\n"
  "const canPay=a=>G.money+G.goods*GOODS_AS_CASH>=a;\n"
  "function payDetail(a){\n"
  "  if(G.money>=a){ G.money-=a; return {paid:a,goodsGiven:0,ok:true}; }\n"
  "  const m=G.money, short=a-m, bundles=Math.min(G.goods,Math.ceil(short/GOODS_AS_CASH));\n"
  "  G.money=0; G.goods-=bundles; return {paid:m,goodsGiven:bundles,ok:m+bundles*GOODS_AS_CASH>=a};\n"
  "}\n"
  "function pay(a){\n"
  "  const r=payDetail(a);\n"
  "  if(!r.goodsGiven) return 'You pay '+r.paid+' rupees.';\n"
  "  let t='You do not have '+a+' rupees in coin, so you pay '+r.paid+' rupees and '+r.goodsGiven+' bundle'+(r.goodsGiven>1?'s':'')+' of goods (each counts as '+GOODS_AS_CASH+' rupees).';\n"
  "  if(!r.ok) t+=' Even that is not enough, but they take everything you offer.';\n"
  "  return t;\n"
  "}")
P("T12 Khyber toll disabled if you cannot pay it",
  "ch.push({label:'Pay the toll (pay 120 rupees).',fn:",
  "ch.push({label:'Pay the toll (pay 120 rupees).'+(canPay(120)?'':' You cannot afford it.'),dis:()=>!canPay(120),fn:")
P("T12 Khyber haggle needs at least the offer",
  "ch.push({label:'Haggle. Offer 70 rupees.',fn:",
  "ch.push({label:'Haggle. Offer 70 rupees.',dis:()=>!canPay(70),fn:")
P("T12 Attock uses the shared affordability rule",
  "const can=c=>G.money+G.goods*35>=c;", "const can=canPay;")

# ---------------------------------------------------------------- D5 one rule for `disabled`
P("D5 moment choices use isDis", "h+=B(c.label,()=>chooseMoment(i),'',c.dis&&c.dis());",
  "h+=B(c.label,()=>chooseMoment(i),'',c.dis,'moment-choice-'+i);")
P("D5 event choices use isDis + testids",
  "  ev.choices.forEach(c=>{ h+=B(c.label,()=>resolveEvent(ev,c.fn()),'',c.dis); });",
  "  ev.choices.forEach((c,n)=>{ h+=B(c.label,()=>resolveEvent(ev,c.fn()),'',c.dis,'modal-choice-'+n); });")

# ---------------------------------------------------------------- T12 sarai sickness via makeSick (D7 / C4)
P("T12 sarai kitchen illness goes through makeSick",
  "if(chance(.4)){ p.sick=true; L(p.name+' has fallen ill.'); return t+'But crowds spread sickness. By evening, '+p.name+' has a fever.'; }",
  "if(chance(.4)){ makeSick(p,'fever'); return t+'But crowds spread sickness. By evening, '+p.name+' has a fever.'; }")

# ---------------------------------------------------------------- T12 cargo casing (D8 / C5)
P("T12 cargo helper",
  "const alive=()=>G.party.filter(p=>p.alive);",
  "const alive=()=>G.party.filter(p=>p.alive);\n"
  "// Lower-case only the first letter, so proper nouns survive: 'Chinese silk' stays capitalised (D8).\n"
  "const cargoText=m=>m.cargo.charAt(0).toLowerCase()+m.cargo.slice(1);")
P("T12 cargo casing: stop", "'+G.m.cargo.toLowerCase()+'. Buyers", "'+cargoText(G.m)+'. Buyers")
P("T12 cargo casing: departure log", "L('You leave Kabul with '+m.cargo.toLowerCase()+'.');", "L('You leave Kabul with '+cargoText(m)+'.');")

# ---------------------------------------------------------------- T12 Hijri year computed (D9 / C6)
P("T12 Hijri year from the date (tabular civil calendar)",
  "function dateText(){ const d=new Date(1665,(G?G.month:9),15+(G?G.day:0)); return d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})+' (1076 AH)'; }",
  "// Hijri year by the tabular (arithmetic) Islamic calendar, civil epoch 16 July 622 Julian = JDN 1948440.\n"
  "// It can differ from the moon-sighted calendar by a day or two; we only show the year.\n"
  "function hijriYear(y,m,d){\n"
  "  const jdn=Math.floor(Date.UTC(y,m,d)/86400000)+2440588;       // Julian Day Number (Gregorian date)\n"
  "  return Math.floor((30*(jdn-1948440)+10646)/10631);\n"
  "}\n"
  "function dateText(){ const d=new Date(1665,(G?G.month:9),15+(G?G.day:0));\n"
  "  return d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})+' ('+hijriYear(d.getFullYear(),d.getMonth(),d.getDate())+' AH)'; }")

# ---------------------------------------------------------------- more test ids (Section 8 contract)
P("testids: sell/buy",
  "    h+='<div class=\"grid2\">'+B('Sell 1 bundle<br><small>you get '+u.price+' rupees</small>',()=>sell(1),'sell',G.goods<1)+\n"
  "       B('Sell 5 bundles<br><small>you get '+u.price*Math.min(5,G.goods)+' rupees</small>',()=>sell(5),'sell',G.goods<1)+'</div>'+\n"
  "       B('Sell all '+G.goods+' bundles<br><small>you get '+u.price*G.goods+' rupees</small>',()=>sell(G.goods),'sell',G.goods<1);",
  "    h+='<div class=\"grid2\">'+B('Sell 1 bundle<br><small>you get '+u.price+' rupees</small>',()=>sell(1),'sell',G.goods<1,'sell-1')+\n"
  "       B('Sell 5 bundles<br><small>you get '+u.price*Math.min(5,G.goods)+' rupees</small>',()=>sell(5),'sell',G.goods<1,'sell-5')+'</div>'+\n"
  "       B('Sell all '+G.goods+' bundles<br><small>you get '+u.price*G.goods+' rupees</small>',()=>sell(G.goods),'sell',G.goods<1,'sell-all');")
P("testids: buy food", "()=>buy('food',FOOD_PACK,FOOD_COST,FOOD_PACK+' food'),'buy',G.money<FOOD_COST)",
  "()=>buy('food',FOOD_PACK,FOOD_COST,FOOD_PACK+' food'),'buy',G.money<FOOD_COST,'buy-food')")
P("testids: buy fodder", "()=>buy('fodder',FODDER_PACK,FODDER_COST,FODDER_PACK+' fodder'),'buy',G.money<FODDER_COST)",
  "()=>buy('fodder',FODDER_PACK,FODDER_COST,FODDER_PACK+' fodder'),'buy',G.money<FODDER_COST,'buy-fodder')")
P("testids: buy med", "()=>buy('med',1,MED_COST,'1 medicine'),'buy',G.money<MED_COST)",
  "()=>buy('med',1,MED_COST,'1 medicine'),'buy',G.money<MED_COST,'buy-med')")
P("testids: guide", "},'',!locked.length||G.money<GUIDE_COST);", "},'',!locked.length||G.money<GUIDE_COST,'guide');")
P("testids: stop rest",
  "    flushNotes(()=>{ if(G.over) endGame('dead'); else renderStop(); });\n  });",
  "    flushNotes(()=>{ if(G.over) endGame('dead'); else renderStop(); });\n  },'',false,'action-rest');")
P("testids: set out / finish",
  "  if(edge) h+=B('Set out for '+STOPS[edge.to].name+' ('+edge.kos+' kos)',()=>startTravel(edge),'primary');\n"
  "  else h+=B('Finish the demo journey',()=>endGame('win'),'primary');",
  "  if(edge) h+=B('Set out for '+STOPS[edge.to].name+' ('+edge.kos+' kos)',()=>startTravel(edge),'primary',false,'action-setout');\n"
  "  else h+=B('Finish the demo journey',()=>endGame('win'),'primary',false,'action-setout');")
P("testids: travel buttons + progress",
  "    '<div class=\"prog\"><i id=\"prog\"></i></div><p id=\"progTxt\"></p>'+controlsHTML()+'<div id=\"forecast\"></div>'+\n"
  "    '<div class=\"row\">'+B(G.paused?'▶ Resume':'⏸ Pause',()=>{ G.paused=!G.paused; renderTravel(); })+B('🏹 Hunt',()=>startHunt())+\n"
  "    B('Rest a day',()=>{ if(G.modal)return; dailyTick('rest','You rest by the road for a day.'); updateTravel(); flushNotes(()=>{ if(G.over){stopTimer();endGame('dead');} else updateTravel(); }); })+'</div>'+",
  "    '<div class=\"prog\" data-testid=\"travel-progress\"><i id=\"prog\"></i></div><p id=\"progTxt\"></p>'+controlsHTML()+'<div id=\"forecast\"></div>'+\n"
  "    '<div class=\"row\">'+B(G.paused?'▶ Resume':'⏸ Pause',()=>{ G.paused=!G.paused; renderTravel(); },'',false,'travel-pause')+B('🏹 Hunt',()=>startHunt(),'',false,'travel-hunt')+\n"
  "    B('Rest a day',()=>{ if(G.modal)return; dailyTick('rest','You rest by the road for a day.'); updateTravel(); flushNotes(()=>{ if(G.over){stopTimer();endGame('dead');} else updateTravel(); }); },'',false,'travel-rest')+'</div>'+")
P("testids: moment continue",
  "} else h+=B('Continue',()=>flushNotes(()=>{ if(G.over) endGame('dead'); else renderStop(); }),'primary');",
  "} else h+=B('Continue',()=>flushNotes(()=>{ if(G.over) endGame('dead'); else renderStop(); }),'primary',false,'moment-continue');")
P("testids: notice OK",
  "B('OK',()=>{ $('#modalHost').innerHTML=''; G.modal=false; flushNotes(after); },'primary')",
  "B('OK',()=>{ $('#modalHost').innerHTML=''; G.modal=false; flushNotes(after); },'primary',false,'modal-continue')")
P("testids: event continue",
  "  $('#modalHost').innerHTML='<div class=\"overlay\"><section class=\"panel\"><h2>'+ev.icon+' '+ev.title+'</h2><div class=\"result\">'+text+'</div><p class=\"muted\"><b>Did you know?</b> '+CARDS[ev.card].text+'</p>'+\n"
  "    B('Continue',()=>{ $('#modalHost').innerHTML=''; G.modal=false; flushNotes(()=>{ if(G.over){ stopTimer(); endGame('dead'); return; } updateTravel(); }); },'primary')+'</section></div>';",
  "  $('#modalHost').innerHTML='<div class=\"overlay\"><section class=\"panel\"><h2>'+ev.icon+' '+ev.title+'</h2><div class=\"result\">'+text+'</div><p class=\"muted\"><b>Did you know?</b> '+CARDS[ev.card].text+'</p>'+\n"
  "    B('Continue',()=>{ $('#modalHost').innerHTML=''; G.modal=false; flushNotes(()=>{ if(G.over){ stopTimer(); endGame('dead'); return; } updateTravel(); }); },'primary',false,'modal-continue')+'</section></div>';")
P("testids: hunt field", "<div class=\"huntfield\" id=\"field\"></div>", "<div class=\"huntfield\" id=\"field\" data-testid=\"hunt-field\"></div>")
P("testids: merchants",
  "B('Travel as the '+m.name,()=>startGame(m),'primary')", "B('Travel as the '+m.name,()=>startGame(m),'primary',false,'merchant-'+m.id)")
P("testids: setup names",
  "<input id=\"nm'+i+'\" maxlength=\"16\" value=\"'+esc(n)+'\">", "<input id=\"nm'+i+'\" data-testid=\"setup-name-'+i+'\" maxlength=\"16\" value=\"'+esc(n)+'\">")
P("testids: setup months",
  "()=>{ keep(); month=o[0]; draw(); },month===o[0]?'on':'')).join('')+",
  "()=>{ keep(); month=o[0]; draw(); },month===o[0]?'on':'',false,'setup-month-'+o[0])).join('')+")
P("testids: setup begin",
  "B('Begin the journey',()=>{ keep(); begin(); },'primary')", "B('Begin the journey',()=>{ keep(); begin(); },'primary',false,'setup-begin')")
P("testids: end epitaph + grave",
  "<input id=\"epi\" maxlength=\"60\" placeholder=\"Here lies a brave merchant\">", "<input id=\"epi\" data-testid=\"end-epitaph\" maxlength=\"60\" placeholder=\"Here lies a brave merchant\">")
P("testids: end leave grave",
  "saveGrave(x?x.value.trim():''); renderTitle(); },'primary');", "saveGrave(x?x.value.trim():''); renderTitle(); },'primary',false,'end-leave-grave');")
P("testids: end score", "<tr class=\"tot\"><td>Final score</td><td>'+total+'</td></tr>", "<tr class=\"tot\"><td>Final score</td><td data-testid=\"end-score\">'+total+'</td></tr>")

# ---------------------------------------------------------------- version marker
P("version marker in footer note",
  "<p class=\"note\">Demo slice: Kabul to Attock.",
  "<p class=\"note\"><span data-testid=\"version\">v0.1.0</span> · Demo slice: Kabul to Attock.")

out = src
for tag, old, new in patches:
    n = out.count(old)
    if n != 1:
        raise SystemExit(f"PATCH FAILED [{tag}]: expected 1 match, found {n}")
    out = out.replace(old, new)

leftover = [k for k in ("reg=[]", "reg[+", "1076 AH", "toLowerCase()+'. Buyers") if k in out]
if leftover:
    raise SystemExit(f"leftover baseline patterns: {leftover}")
(ROOT / "legacy" / "index.html").write_text(out, encoding="utf-8")
print(f"legacy/index.html written: {len(patches)} patches, {out.count(chr(10))} lines")
