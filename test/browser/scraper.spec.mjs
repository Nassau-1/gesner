import { test, expect, chromium } from "@playwright/test";
import { createServer } from "node:http";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pageTask } from "../../dist/page.js";
let server, origin, context, worker, extensionId;
const table = (page=1) => '<table id="records"><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>Item '+page+'A</td><td>=1+1</td></tr><tr><td>Item '+page+'B</td><td>42</td></tr></tbody></table>';
test.beforeAll(async ({}, info) => {
  server = createServer((req,res) => {
    const url = new URL(req.url, "http://localhost");
    res.setHeader("Content-Type","text/html");
    const n = Number(url.searchParams.get("page") ?? "1");
    res.end('<!doctype html><html><head><title>Synthetic scraper test</title></head><body>'+table(n)+
      (n<3 ? '<a id="next" href="/?page='+(n+1)+'">Next</a>' : '<button id="next" disabled>Next</button>')+'</body></html>');
  });
  await new Promise(resolve => server.listen(0,"127.0.0.1",resolve));
  origin = "http://127.0.0.1:" + server.address().port;
  // Test-only host grant substitutes for a toolbar gesture unavailable in headless automation.
  // Production permissions are independently tested below and never modified.
  const extension = path.resolve("work/test-extension");
  await mkdir(extension,{recursive:true}); await cp(path.resolve("dist"),extension,{recursive:true});
  const manifest = JSON.parse(await readFile(path.join(extension,"manifest.json"),"utf8"));
  manifest.host_permissions = [origin+"/*"];
  await writeFile(path.join(extension,"manifest.json"),JSON.stringify(manifest));
  context = await chromium.launchPersistentContext("",{
    headless:true, executablePath:info.project.use.launchOptions.executablePath,
    args:["--disable-extensions-except="+extension,"--load-extension="+extension]
  });
  worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  extensionId = new URL(worker.url()).host;
});
test.afterAll(async () => { await context?.close(); await new Promise(resolve=>server?.close(resolve)); });
async function app() {
  const source = await context.newPage(); await source.goto(origin);
  const tabId = await worker.evaluate(async origin => (await chrome.tabs.query({})).find(tab=>tab.url===origin+"/").id,origin);
  const ui = await context.newPage(); await ui.goto("chrome-extension://"+extensionId+"/popup.html?tab="+tabId);
  await expect(ui.locator("#detect")).toBeEnabled(); return {source,ui,tabId};
}
test.afterEach(async () => { for(const page of context.pages()) await page.close(); });

test("table extraction omits hidden and editable values and normalizes spans", async ({page}) => {
  await page.goto(origin);
  await page.setContent('<table id="t"><tr><th>Name</th><th>Value</th></tr><tr><td rowspan="2">Visible<span hidden>SECRET</span><input value="PASSWORD"><span contenteditable>EDITABLE</span></td><td>One</td></tr><tr><td>Two</td></tr></table>');
  const reply = await page.evaluate(pageTask,{action:"discover",origin});
  expect(reply.candidates[0].kind).toBe("table");
  const result = await page.evaluate(pageTask,{action:"extract",origin,candidate:reply.candidates[0]});
  expect(result.snapshot.rows).toEqual([{c0:"Visible",c1:"One"},{c0:"Visible",c1:"Two"}]);
});
test("repeated cards retain text and safe links, not input values",async ({page})=>{
  await page.goto(origin); await page.setContent('<main><div id="cards">'+["Alpha","Beta","Gamma"].map(x=>'<article><h2>'+x+'</h2><a href="/'+x+'">Details</a><input value="SECRET"></article>').join("")+'</div></main>');
  const {candidates} = await page.evaluate(pageTask,{action:"discover",origin});
  const candidate = candidates.find(x=>x.selector==="#cards");
  expect(candidate).toBeTruthy();
  const {snapshot} = await page.evaluate(pageTask,{action:"extract",origin,candidate});
  expect(snapshot.rows).toHaveLength(3);
  expect(Object.values(snapshot.rows[0])).toContain(origin+"/Alpha");
  expect(JSON.stringify(snapshot)).not.toContain("SECRET");
});
test("empty and restricted-origin pages fail safely",async ({page})=>{
  await page.goto(origin); await page.setContent("<p>Nothing to scrape</p>");
  expect((await page.evaluate(pageTask,{action:"discover",origin})).candidates).toHaveLength(0);
  expect((await page.evaluate(pageTask,{action:"discover",origin:"https://elsewhere.invalid"})).error).toContain("changed origin");
});
test("collection is bounded for oversized tables",async ({page})=>{
  await page.goto(origin); await page.setContent('<table id="t"><tr><th>Name</th></tr>'+Array.from({length:1005},(_,i)=>'<tr><td>'+i+'</td></tr>').join("")+'</table>');
  const {snapshot} = await page.evaluate(pageTask,{action:"extract",origin,candidate:{selector:"#t",kind:"table",rowTag:"tr",count:1005,label:"Test"}});
  expect(snapshot.truncated).toBe(true); expect(snapshot.rows.length).toBeLessThanOrEqual(1000);
});
test("picker intercepts click and removes handlers on Escape",async ({page})=>{
  await page.goto(origin);
  const picked = page.evaluate(pageTask,{action:"pick",origin});
  await expect.poll(()=>page.evaluate(()=>typeof window.__privateScraperCancel)).toBe("function");
  await page.locator("#next").hover(); await page.locator("#next").click();
  expect((await picked).selector).toBe("#next"); expect(page.url()).toBe(origin+"/");
  const cancelled = page.evaluate(pageTask,{action:"pick",origin});
  await expect.poll(()=>page.evaluate(()=>typeof window.__privateScraperCancel)).toBe("function");
  await page.keyboard.press("Escape");
  expect((await cancelled).error).toContain("cancelled");
  await page.locator("#next").click(); await expect(page).toHaveURL(origin+"/?page=2");
});
test("pagination rejects external links and form submissions",async ({page})=>{
  await page.goto(origin); await page.setContent('<a id="external" href="https://elsewhere.invalid">Next</a><form><button id="submit">Submit</button></form>');
  expect((await page.evaluate(pageTask,{action:"next",origin,selector:"#external"})).error).toContain("same-origin");
  expect((await page.evaluate(pageTask,{action:"next",origin,selector:"#submit"})).error).toContain("Form submission");
});
test("scroll action targets an inner scrolling container",async ({page})=>{
  await page.goto(origin); await page.setContent('<div id="scroll" style="height:100px;overflow-y:auto"><div id="rows">'+Array.from({length:30},(_,i)=>'<article style="height:50px">Row '+i+'</article>').join("")+'</div></div>');
  await page.evaluate(pageTask,{action:"scroll",origin,candidate:{selector:"#rows",kind:"list",rowTag:"article",label:"Rows",count:30}});
  expect(await page.locator("#scroll").evaluate(x=>x.scrollTop)).toBeGreaterThan(0);
});
test("workspace collects, edits, filters and exports locally with no external requests",async ()=>{
  const {ui,source} = await app(); const external=[];
  context.on("request", request=>{if(!request.url().startsWith(origin)&&!request.url().startsWith("chrome-extension:")) external.push(request.url());});
  await ui.locator("#detect").click(); await expect(ui.locator("#stats")).toHaveText("2 rows · 1 pages");
  await ui.locator("#column-panel").evaluate(x=>x.open=true);
  await ui.getByRole("textbox",{name:"Column 1 name",exact:true}).fill("Product");
  await ui.locator("#filter").fill("Item 1A");
  await expect(ui.locator("tbody tr")).toHaveCount(1);
  const csvWait = ui.waitForEvent("download"); await ui.locator("#csv").click(); const csv = await csvWait;
  expect(csv.suggestedFilename()).toMatch(/^\d{4}\.\d{2}\.\d{2}_Synthetic scraper test\.csv$/);
  const csvText = await readFile(await csv.path(),"utf8");
  expect(csvText).toContain('"Product"'); expect(csvText).toContain("'=1+1"); expect(csvText).not.toContain("Item 1B");
  const xlsxWait = ui.waitForEvent("download"); await ui.locator("#xlsx").click();
  const xlsxDownload = await xlsxWait;
  expect(xlsxDownload.suggestedFilename()).toBe(csv.suggestedFilename().replace(/\.csv$/, ".xlsx"));
  const xlsx = await readFile(await xlsxDownload.path()); expect(xlsx.subarray(0,2).toString()).toBe("PK");
  expect(external).toEqual([]);
  await ui.setViewportSize({width:620,height:850});
  expect(await ui.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await ui.screenshot({path:"work/workspace.png",fullPage:true});
  await ui.locator("#clear").click(); await expect(ui.locator("#stats")).toHaveText("0 rows · 0 pages");
  expect(await source.locator("input").count()).toBe(0);
});
test("real Chrome injection crawls full same-origin navigations and stops at disabled Next",async ()=>{
  const {ui} = await app();
  await ui.locator("#detect").click(); await expect(ui.locator("#start")).toBeEnabled();
  await ui.locator("#next-panel").evaluate(x=>x.open=true); await ui.locator("#next").fill("#next"); await ui.locator("#delay").fill("0.5"); await ui.locator("#wait").fill("3");
  await ui.locator("#start").click();
  await expect(ui.locator("#stats")).toHaveText("6 rows · 3 pages",{timeout:12000});
  await expect(ui.locator("#status")).toContainText("disabled");
  await expect(ui.locator("#stop")).toBeDisabled();
});
test("stop interrupts waits and preserves collected rows",async ()=>{
  const {ui} = await app(); await ui.locator("#detect").click(); await expect(ui.locator("#start")).toBeEnabled();
  await ui.locator("#next-panel").evaluate(x=>x.open=true); await ui.locator("#next").fill("#next"); await ui.locator("#delay").fill("10"); await ui.locator("#start").click();
  await expect(ui.locator("#status")).toContainText("Waiting");
  await ui.locator("#stop").click(); await expect(ui.locator("#stop")).toBeDisabled();
  await expect(ui.locator("#stats")).toHaveText("2 rows · 1 pages");
});
test("extension CSP blocks outbound fetch",async ()=>{
  const {ui} = await app();
  const blocked = await ui.evaluate(async ()=>{try {await fetch("https://example.invalid/privacy-probe");return false;}catch{return true;}});
  expect(blocked).toBe(true);
});
test("production manifest cannot inject without a toolbar grant",async ({},info)=>{
  const extension=path.resolve("dist");
  const isolated=await chromium.launchPersistentContext("",{
    headless:true,executablePath:info.project.use.launchOptions.executablePath,
    args:["--disable-extensions-except="+extension,"--load-extension="+extension]
  });
  try {
    const sw=isolated.serviceWorkers()[0]??await isolated.waitForEvent("serviceworker");
    const denied=await sw.evaluate(async origin=>{
      const tab=await chrome.tabs.create({url:origin});
      try {await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>document.title});return false;}catch{return true;}
    },origin);
    expect(denied).toBe(true);
  } finally {await isolated.close();}
});

test("dynamic pagination updates rows without navigating",async ()=>{
  const {ui,source}=await app();
  await source.evaluate(()=>{
    const button=document.createElement("button"); button.id="dynamic"; button.type="button"; button.textContent="Next";
    let count=1; button.addEventListener("click",()=>{
      count++; document.querySelector("tbody").replaceChildren();
      for(const name of ["A","B"]) {
        const row=document.createElement("tr"), cell=document.createElement("td");cell.textContent="Dynamic "+count+name;
        row.append(cell);document.querySelector("tbody").append(row);
      }
      if(count===2)button.disabled=true;
    });document.body.append(button);
  });
  await ui.locator("#detect").click();await expect(ui.locator("#start")).toBeEnabled();
  await ui.locator("#next-panel").evaluate(x=>x.open=true); await ui.locator("#next").fill("#dynamic");await ui.locator("#delay").fill("0.5");await ui.locator("#wait").fill("3");
  await ui.locator("#start").click();await expect(ui.locator("#stats")).toHaveText("4 rows · 2 pages");
  await expect(ui.locator("#status")).toContainText("disabled");
});
test("infinite scroll appends and deduplicates cumulative rows",async ()=>{
  const {ui,source}=await app();
  await source.evaluate(()=>{
    const scroll=document.createElement("div");scroll.id="scroller";scroll.style.cssText="height:120px;overflow:auto";
    const rows=document.createElement("div");rows.id="cards";let count=0;
    const append=()=>{for(let i=0;i<6;i++){const row=document.createElement("article");row.style.height="50px";row.textContent="Card "+(++count);rows.append(row);}};
    append();scroll.append(rows);document.body.replaceChildren(scroll);
    scroll.addEventListener("scroll",()=>{if(count<12)append();});
  });
  await ui.locator("#detect").click();await expect(ui.locator("#stats")).toHaveText("6 rows · 1 pages");
  await ui.locator("#mode").selectOption("scroll");await ui.locator("#delay").fill("0.5");await ui.locator("#wait").fill("2");
  await ui.locator("#start").click();await expect(ui.locator("#stats")).toHaveText("12 rows · 2 pages");
  await expect(ui.locator("#status")).toContainText("No changed rows",{timeout:8000});
});
test("clearing an active crawl cannot repopulate the session",async ()=>{
  const {ui}=await app();await ui.locator("#detect").click();await expect(ui.locator("#start")).toBeEnabled();
  await ui.locator("#next-panel").evaluate(x=>x.open=true); await ui.locator("#next").fill("#next");await ui.locator("#delay").fill("10");await ui.locator("#start").click();
  await expect(ui.locator("#status")).toContainText("Waiting");await ui.locator("#clear").click();
  await expect(ui.locator("#stop")).toBeDisabled();await expect(ui.locator("#stats")).toHaveText("0 rows · 0 pages");
  await expect(ui.locator("#start")).toBeDisabled();await expect(ui.locator("#csv")).toBeDisabled();
});
test("clipboard copies text and column visibility affects exports",async ()=>{
  const {ui}=await app();await ui.locator("#detect").click();await expect(ui.locator("#copy")).toBeEnabled();
  await ui.locator("#column-panel").evaluate(x=>x.open=true);
  await ui.getByRole("checkbox",{name:"Include column 2",exact:true}).uncheck();
  await ui.locator("#copy").click();await expect(ui.locator("#status")).toContainText("Copied");
  const dl=ui.waitForEvent("download");await ui.locator("#csv").click();
  const text=await readFile(await(await dl).path(),"utf8");expect(text).not.toContain("=1+1");
});

test("boxless list wrappers and separators retain visible records without hidden data",async ({page})=>{
  await page.goto(origin);
  await page.setContent(`<main><div id="followers" style="display:contents">
    ${[1,2,3,4].map(i=>`<div style="display:contents"><a href="/person-${i}"><span style="display:contents">Person ${i}</span><p>Role ${i}</p></a><span hidden>Secret ${i}</span><input value="Private ${i}"></div><div style="display:flex;height:1px"></div>`).join('')}
    <div style="display:contents"><span hidden>Hidden-only record</span></div>
  </div><section style="display:none"><div id="hidden-list" style="display:contents"><div>Hidden A</div><div>Hidden B</div><div>Hidden C</div></div></section>
  <section style="opacity:0"><div style="display:contents">Invisible text</div></section></main>`);
  const result=await page.evaluate(pageTask,{action:"discover",origin});
  const candidate=result.candidates.find(x=>x.selector==="#followers");
  expect(candidate).toBeDefined();expect(candidate.count).toBe(4);
  expect(result.candidates.some(x=>x.selector==="#hidden-list")).toBe(false);
  const {snapshot}=await page.evaluate(pageTask,{action:"extract",origin,candidate});
  expect(snapshot.rows).toHaveLength(4);
  const values=JSON.stringify(snapshot.rows);
  for(const i of [1,2,3,4])expect(values).toContain(`Person ${i}`);
  expect(values).toContain('/person-1');
  expect(values).not.toMatch(/Secret|Private|Hidden|Invisible/);
});

test("compact workspace keeps controls and results inside the viewport",async ()=>{
  const {ui,source}=await app();
  await source.evaluate(()=>{
    const table=document.querySelector("table");
    table.replaceChildren();
    const header=table.createTHead().insertRow();
    for(const title of ["Name","Company","Role","Location","Sector","Status"]) {
      const cell=document.createElement("th");cell.textContent=title;header.append(cell);
    }
    const body=table.createTBody();
    for(let i=0;i<45;i++) {
      const row=body.insertRow();
      for(const value of ["Contact "+(i+1),["Northbridge","Oakfield","Westhaven"][i%3],"Investment Director",["Paris","London","Berlin"][i%3],"Technology",i%2?"Reviewed":"New"])
        row.insertCell().textContent=value;
    }
  });
  await ui.locator("#detect").click();
  await expect(ui.locator("#stats")).toHaveText("45 rows · 1 pages");
  await expect(ui.locator(".crawl-tools #delay")).toBeVisible();
  await expect(ui.locator(".crawl-tools #next-panel")).toBeVisible();
  await expect(ui.getByText("Local session",{exact:true})).toHaveCount(0);
  await expect(ui.getByText("Saved only on export",{exact:true})).toHaveCount(0);
  for(const size of [{width:1280,height:800},{width:1366,height:768},{width:1120,height:680},{width:800,height:600},{width:620,height:600}]) {
    await ui.setViewportSize(size);
    const layout=await ui.evaluate(()=>{
      const within=el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;};
      return {
        documentFits:document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth,
        controlsFit:["detect","another","pick","start","stop","csv","xlsx","copy","clear"].every(id=>within(document.getElementById(id))),
        tableHeight:document.querySelector(".table-wrap").getBoundingClientRect().height
      };
    });
    expect(layout.documentFits).toBe(true);expect(layout.controlsFit).toBe(true);expect(layout.tableHeight).toBeGreaterThan(150);
    const before=await ui.locator(".table-wrap").boundingBox();
    await ui.locator("#column-panel summary").click();
    await expect(ui.locator("#columns")).toBeVisible();
    expect(await ui.locator(".table-wrap").boundingBox()).toEqual(before);
    if(size.width===1280)await ui.screenshot({path:"work/store-columns.png"});
    if(size.width===1366)await ui.screenshot({path:"work/v1-columns.png"});
    await ui.keyboard.press("Escape");
    await expect(ui.locator("#column-panel")).not.toHaveAttribute("open","");
    if(size.width===1280)await ui.screenshot({path:"work/store-workspace.png"});
    if(size.width===1366)await ui.screenshot({path:"work/v1-workspace.png"});
    if(size.width===620)await ui.screenshot({path:"work/v1-compact.png"});
  }
});
