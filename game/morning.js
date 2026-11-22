// Each row describes a finished simulation, never a forecast. Revenue is
// counted on boarding network-wide; arrivals are counted at the market door.
const Morning = {
  end:600,
  variants:{base:"Контроль · 30 ₽, 1 поезд",fare:"Билет 20 ₽",train:"Два поезда",same:"Без изменений"},
  result(g,variant) {
    const arrivals=g.arr.filter(p=>p.dest===g.city.dest[1].id);
    return {variant,walk:arrivals.filter(p=>p.paid===null).length,tram:arrivals.filter(p=>p.paid!==null).length,
      revenue:g.rev,mean:arrivals.length?arrivals.reduce((sum,p)=>sum+p.time,0)/arrivals.length:null};
  }
};
