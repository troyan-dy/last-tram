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
