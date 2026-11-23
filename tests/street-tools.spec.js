const { test,expect }=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

test('buy the priced road in one click and run a tram between two player-placed stops on it',async({page})=>{
  await page.goto(pathToFileURL(path.resolve('game/prototype-map.html')).href+'?seed=Ива&start=empty');
  await page.locator('#pause').click();
  await expect(page.locator('#scene .signs [data-type=stop]')).toHaveCount(0);
  await page.getByRole('button',{name:'Строительство',exact:true}).click();
  // Use two real screen positions along a visible stretch of road, away from its junctions.
  const road=await page.evaluate(()=>{
    for(const g of document.querySelectorAll('#targets [data-type=section]')){
      const path=g.querySelector('.street-hit'), length=path.getTotalLength(), m=path.getScreenCTM();
      const spots=[.24,.74].map(t=>path.getPointAtLength(length*t).matrixTransform(m));
      if(length>45&&spots.every(p=>document.elementFromPoint(p.x,p.y)?.closest('[data-type=section]')===g))
        return {id:g.dataset.id,points:spots.map(({x,y})=>({x,y}))};
    }
  });
  expect(road).toBeTruthy();
  const label=page.locator(`#targets [data-id="${road.id}"] text.price`);
  const price=parseInt(await label.textContent()),cash=()=>page.locator('#cash').innerText().then(parseFloat);
  const balance=await cash(), click=p=>page.mouse.click(p.x,p.y);
  await click(road.points[0]);expect(await cash()).toBe(balance-price);
  await click(road.points[0]);expect(await cash()).toBe(balance-price);
  await page.getByRole('button',{name:'Остановки',exact:true}).click();
  for(const p of road.points)await click(p);
  await expect(page.locator('#scene .signs [data-type=stop]')).toHaveCount(2);
  await page.getByRole('button',{name:'Маршруты',exact:true}).click();
  const pins=page.locator('#targets [data-type=stop]');
  await expect(pins).toHaveCount(2);
  await pins.nth(0).click();await pins.nth(1).click();await page.locator('#save').click();
  await page.locator('#buy-train').click();await expect(page.locator('#fleet')).toHaveText('1');
  await expect(page.locator('#moving [data-type=train]')).toHaveCount(1);
});

test('a click on the pavement width can place a stop and a junction platform can serve either built arm',async({page})=>{
  await page.setViewportSize({width:1360,height:850});
  await page.goto(pathToFileURL(path.resolve('game/prototype-map.html')).href+'?seed=Клён&start=empty');
  await page.locator('#pause').click();
  await page.getByRole('button',{name:'Строительство',exact:true}).click();
  await page.locator('#targets [data-id="1-6"] .price').click();
  await page.getByRole('button',{name:'Остановки',exact:true}).click();
  const points=await page.evaluate(()=>{
    const c=LastTram.streetStudy.create('Клён'),find=id=>c.study.sections.find(s=>s.id===id).line;
    const at=(a,b,t,offset)=>{
      const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
      const [x,y]=LastTram.art.project(a.x+dx*t-dy/len*offset,a.y+dy*t+dx/len*offset);
      const pt=new DOMPoint(x,y).matrixTransform(document.querySelector('#map').getScreenCTM());
      return {x:pt.x,y:pt.y};
    };
    const [a,b]=find('1-6'),[j,k]=find('1-12');
    return [at(a,b,.5,-4.92),at(j,k,2/Math.hypot(k.x-j.x,k.y-j.y),0)];
  });
  for(const p of points)await page.mouse.click(p.x,p.y);
  await expect(page.locator('#scene .signs [data-type=stop]')).toHaveCount(2,{timeout:1500});
  await page.getByRole('button',{name:'Маршруты',exact:true}).click();
  const stops=page.locator('#targets [data-type=stop]');
  await stops.first().click();await stops.last().click();
  await page.locator('#save').click();await page.locator('#buy-train').click();
  await expect(page.locator('#fleet')).toHaveText('1');
});
