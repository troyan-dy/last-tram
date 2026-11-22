const Flows = {
  filters: () => ({to:true,from:true,walk:true,tram:true}),
  active: p => p.phase!=="home" && p.phase!=="done",
  mode: p => p.paid!==null || p.decision?.use ? "tram" : "walk",
  atBuilding(p,door,f) {
    return this.active(p) && f[this.mode(p)] && ((f.to&&p.dest===door)||(f.from&&p.home===door));
  }
};
