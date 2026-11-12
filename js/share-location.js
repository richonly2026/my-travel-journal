// Never publish source URLs or embed HTML; only public-place numeric coordinates.
const publicCategories=new Set(['관광','관광지','박물관','미술관','성당','교회','공원','정원','전망대','공항','기차역','지하철역','버스 정류장']);
export function publicLocation(raw,safe){
 if(raw.reservationId||!publicCategories.has(safe.category)||/숙소|호텔|아파트|집|자택|hotel|apartment|private|비공개/i.test(safe.title))return null;
 let lat=raw.latitude,lng=raw.longitude;
 if((lat===undefined||lat==='')&&(raw.embedUrl||raw.streetview)){
  try{const u=new URL(raw.embedUrl||raw.streetview);if(u.protocol!=='https:'||!['www.google.com','maps.google.com'].includes(u.hostname))return null;
   const location=u.searchParams.get('location')||u.searchParams.get('viewpoint'),pb=u.searchParams.get('pb')||'';
   const match=location?.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/)||pb.match(/!2m2!1d(-?\d+(?:\.\d+)?)!2d(-?\d+(?:\.\d+)?)(?:!|$)/);
   if(match){lat=match[1];lng=match[2];}
  }catch{return null;}
 }
 if(lat===undefined||lat===''||lng===undefined||lng==='')return null;
 const latitude=Number(lat),longitude=Number(lng);
 if(!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180)return null;
 return {latitude:Math.round(latitude*1e4)/1e4,longitude:Math.round(longitude*1e4)/1e4};
}
export function publicMapURLs(e){
 if(!e.location)return null;
 const {latitude,longitude}=e.location;
 if(!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180)return null;
 const point=latitude+','+longitude;
 return {map:'https://www.google.com/maps?q='+encodeURIComponent(point)+'&output=embed',street:'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint='+encodeURIComponent(point)};
}
