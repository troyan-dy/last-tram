// Tick zero is 07:00. Residents stay where their last trip ended.
const CityDay = {
  length:14400, evening:6600,
  next(t,d,city) {
    const market=city.dest[1].id, station=city.dest[0].id;
    const errands=d.id%3===1?[[3000,d.dest===market?station:market],[4500,d.dest]]:[];
    const daily=[[0,d.dest],...errands,[this.evening,d.home]];
    const dayStart=t-t%this.length, offset=Math.max(1,d.start);
    let origin=d.home;
    for(const [phase,dest] of daily){
      if(dayStart+phase+offset>t)return {start:dayStart+phase+offset,origin,dest};
      origin=dest;
    }
    return {start:dayStart+this.length+offset,origin:d.home,dest:d.dest};
  }
};
