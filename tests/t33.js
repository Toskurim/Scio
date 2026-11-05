const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const pg=await b.newPage();const err=[];pg.on('pageerror',e=>err.push(e.message));
const ok=(c,m)=>console.log((c?'OK   ':'FALLITO ')+m);
await pg.goto('http://localhost:8766/');await pg.waitForTimeout(400);
await pg.evaluate(()=>{V.vista='fam';render()});await pg.waitForTimeout(200);
ok((await pg.$$eval('#prov option',o=>o.map(x=>x.value))).join()==='demo,anthropic,compat,openrouter','menu servizio senza Gemini e Groq');
await pg.selectOption('#prov','anthropic');
ok((await pg.$$eval('#mod-sugg option',o=>o.map(x=>x.value))).join()==='claude-haiku-5-5','Claude: solo Haiku nei suggerimenti');
ok(await pg.getAttribute('#modello','placeholder')==='claude-haiku-5-5','segnaposto Haiku');
await pg.selectOption('#prov','compat');
ok((await pg.$$eval('#mod-sugg option',o=>o.map(x=>x.value))).join()==='gemma4:26b','PC di casa: solo modelli locali');
await pg.selectOption('#prov','openrouter');
ok(await pg.locator('#mod-sugg option').count()===0,'OpenRouter: nessun suggerimento di altri servizi');
await pg.evaluate(()=>{FAM.ai={provider:'compat',preset:'gemini',url:'https://generativelanguage.googleapis.com/v1beta/openai',model:'gemini-3.8-flash',key:'',kc:''};V.bozzaFam=null;V.vista='fam';render()});
ok((await pg.$$eval('#prov option',o=>o.map(x=>x.value))).includes('gemini')&&await pg.inputValue('#prov')==='gemini','chi aveva già Gemini lo vede ancora');
ok(err.length===0,'errori '+err.join('|'));await b.close()})()
