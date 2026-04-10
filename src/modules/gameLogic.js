/**
 * gameLogic.js - All game calculation logic
 * Extracted from GolfWizard main application
 * Includes: Nassau, Vegas, Match Play, Hi-Low, Skins, Hammer, Wolf, 
 *           Best Ball, Stableford, 5-3-1, Sixes, Team Day, Snake, Dots, Junk, Fidget
 */

// ══════════════════════════════════════════════════════════════════
// GAME LOGIC FUNCTIONS
// ══════════════════════════════════════════════════════════════════

/**
 * gameLogic.js - All game calculation logic
 * Extracted from GolfWizard main application
 * Includes: Nassau, Vegas, Match Play, Hi-Low, Skins, Hammer, Wolf, 
 *           Best Ball, Stableford, 5-3-1, Sixes, Team Day, Snake, Dots, Junk, Fidget
 */

function computeFidgetResult(rid,tData){
    var tSrc=tData||T;
    var g=(tSrc.gameRounds?.[rid]||[]).find(function(x){return x.type==='fidget';});
    if(!g)return null;
    var c=g.config||{};
    var ppp=c.ppp||c.ppt||10;
    var r=tSrc.rounds.find(function(x){return x.id===rid;});
    if(!r)return null;
    var pids=c.players?.length?c.players:(tSrc===T?roundPlayers(rid):[]);
    if(pids.length<2)return null;
    var nc=holeCount(r.course);
    var fromH=tSrc===T?roundFromH(rid):1;
    var toH=tSrc===T?roundToH(rid):nc;
    // Track which players have won a hole outright
    var hasWon={};
    pids.forEach(function(p){hasWon[p]=false;});
    var holeLog=[];
    var completedHoles=0;
    for(var h=fromH;h<=toH;h++){
      var nets=pids.map(function(pid){
        var raw=tSrc===T?getScore(rid,pid,h):(tSrc.scores?.[rid]?.[pid]?.[h]||null);
        if(raw==null)return{pid:pid,net:null};
        var hcp=tSrc===T?primaryGameHcp(pid,rid).hcp:(function(){var p=tSrc.players.find(function(pl){return pl.id===pid;});return p?.roundHcp?.[rid]??Math.round(p?.ghin||0);})();
        return{pid:pid,net:raw-strokesOnHole(hcp,holeSI(r.course,h))};
      });
      if(nets.some(function(n){return n.net===null;})){holeLog.push({h:h,winner:null,reason:'incomplete'});continue;}
      completedHoles++;
      var minNet=Math.min.apply(null,nets.map(function(n){return n.net;}));
      var winners=nets.filter(function(n){return n.net===minNet;});
      if(winners.length===1){
        var winner=winners[0].pid;
        hasWon[winner]=true;
        holeLog.push({h:h,winner:winner});
      }else{
        holeLog.push({h:h,winner:null,reason:'tie'});
      }
    }
    // Players who haven't won a hole owe each other player $ppp
    var fidgeters=pids.filter(function(p){return !hasWon[p];});
    var settlements=[];
    fidgeters.forEach(function(loser){
      pids.forEach(function(other){
        if(other===loser)return;
        settlements.push({from:loser,to:other,amt:ppp,fromName:pDisplay(loser),toName:pDisplay(other)});
      });
    });
    var totalHoles=toH-fromH+1;
    return{ppp:ppp,pids:pids,hasWon:hasWon,holeLog:holeLog,settlements:settlements,fidgeters:fidgeters,completedHoles:completedHoles,totalHoles:totalHoles};
  }

    function setHammerHole(rid,hole,field,val){
    var games=T.gameRounds[rid]||[];
    var g=games.find(function(x){return x.type==='hammer';});
    if(!g)return;
    if(!g.config.holes)g.config.holes={};
    var hkey=String(hole);
    if(!g.config.holes[hkey])g.config.holes[hkey]={mult:1,t1won:null};
    g.config.holes[hkey][field]=val;
    saveData();
  }
  function getHammerHole(rid,hole){
    var g=(T.gameRounds[rid]||[]).find(function(x){return x.type==='hammer';});
    if(!g||!g.config.holes)return{mult:1,t1won:null};
    return g.config.holes[String(hole)]||{mult:1,t1won:null};
  }
  function computeHammerResult(rid){
    var g=(T.gameRounds[rid]||[]).find(function(x){return x.type==='hammer';});
    if(!g)return null;
    var r=T.rounds.find(function(r){return r.id===rid;});
    if(!r)return null;
    var c=g.config;
    var ppt=c.ppt||5;
    var t1=c.team1||[];
    var t2=c.team2||[];
    if(!t1.length||!t2.length)return null;
    var t1n=t1.map(function(p){return pDisplay(p);}).join('+');
    var t2n=t2.map(function(p){return pDisplay(p);}).join('+');
    var holes=c.holes||{};
    var nc=holeCount(r.course);
    var carryMult=1;
    var t1total=0,t2total=0;
    var holeResults=[];
    for(var h=1;h<=nc;h++){
      var hd=holes[String(h)]||{mult:1,t1won:null};
      var effMult=hd.mult*carryMult;
      var holePPT=ppt*effMult;
      if(hd.t1won===true){t1total+=holePPT;carryMult=1;holeResults.push({h:h,effMult:effMult,winner:'t1',amt:holePPT});}
      else if(hd.t1won===false){t2total+=holePPT;carryMult=1;holeResults.push({h:h,effMult:effMult,winner:'t2',amt:holePPT});}
      else{carryMult=effMult;holeResults.push({h:h,effMult:effMult,winner:null,amt:holePPT});}
    }
    var net=t1total-t2total;
    return{t1n:t1n,t2n:t2n,t1total:t1total,t2total:t2total,net:net,holeResults:holeResults,ppt:ppt,carryMult:carryMult};
  }

  // ══════════════════════════════════════════════════
  // ── VEGAS HOLE-BY-HOLE WITH FLIP RULES ──
  // Config-aware: birdieFlip, sevenFlip, penaltyThreshold, eagleFlip
  // Double birdie/eagle cancel: if both teams birdie/eagle, flips cancel
  // Eagle: flip opponent + double the hole diff
  // ══════════════════════════════════════════════════

function computeVegasHoles(rid,team1,team2,gameObj){
    var r=T.rounds.find(function(r){return r.id===rid;});
    if(!r)return[];
    var vhc=gameObj?(gameObj.config||gameObj):{};
    var vhUseNet=vhc.netGross!=='gross';
    var vhHcpPct=(vhc.hcpPercent||100)/100;
    var useBirdieFlip=vhc.birdieFlip!==false;
    var useSevenFlip=vhc.sevenFlip!==false;
    var penaltyAt=vhc.penaltyThreshold||7; // 7, 8, or 10
    var useEagleFlip=vhc.eagleFlip!==false;
    var vhHcpMode=vhc.hcpMode||'lowman';
    var allPids=team1.concat(team2);
    var out=[];
    var cumDiff=0;
    var from=roundFromH(rid),to=roundToH(rid);
    for(var h=from;h<=to;h++){
      var t1nets=team1.map(function(pid){
        var g=getScore(rid,pid,h);
        var hcp=vhHcpMode==='course'?pRoundHcp(pid,rid):gameAdjHcp(pid,rid,allPids);
        return g!=null?(vhUseNet?g-strokesOnHole(Math.round(hcp*vhHcpPct),holeSI(r.course,h)):g):null;
      });
      var t2nets=team2.map(function(pid){
        var g=getScore(rid,pid,h);
        var hcp=vhHcpMode==='course'?pRoundHcp(pid,rid):gameAdjHcp(pid,rid,allPids);
        return g!=null?(vhUseNet?g-strokesOnHole(Math.round(hcp*vhHcpPct),holeSI(r.course,h)):g):null;
      });
      if(t1nets.some(function(x){return x===null;})||t2nets.some(function(x){return x===null;})){
        out.push({h:h,t1num:null,t2num:null,diff:null,cumDiff:cumDiff});
        continue;
      }
      // Floor net scores to 1 (standard house rule for net Vegas)
      var s1=t1nets.map(function(x){return Math.max(1,x);}).sort(function(a,b){return a-b;});
      var s2=t2nets.map(function(x){return Math.max(1,x);}).sort(function(a,b){return a-b;});
      var par=holePar(r.course,h);
      // Birdie: net <= par-1, Eagle: net <= par-2
      var t1Birdie=t1nets.some(function(n){return n<=(par-1);});
      var t2Birdie=t2nets.some(function(n){return n<=(par-1);});
      var t1Eagle=t1nets.some(function(n){return n<=(par-2);});
      var t2Eagle=t2nets.some(function(n){return n<=(par-2);});
      function vegasNum(arr){
        if(arr.length<2)return Math.max(1,arr[0])||1;
        var lo=arr[0],hi=arr[arr.length-1];
        if(useSevenFlip&&hi>=penaltyAt){return hi*10+lo;}
        return lo*10+hi;
      }
      function flipNum(n){
        var tens=Math.floor(n/10),ones=n%10;
        return ones*10+tens;
      }
      var v1=vegasNum(s1);
      var v2=vegasNum(s2);
      // Eagle flip+double: if team eagles, opponent flips (cancels if both eagle)
      // Eagle supersedes birdie — don't apply birdie flip separately if eagle applies
      var holeMult=1;
      if(useEagleFlip&&(t1Eagle||t2Eagle)){
        if(t1Eagle&&t2Eagle){
          // Both eagle: cancel — no flips, no double
        }else if(t1Eagle){
          v2=flipNum(v2);
          holeMult=2;
        }else{
          v1=flipNum(v1);
          holeMult=2;
        }
      }else if(useBirdieFlip&&(t1Birdie||t2Birdie)){
        // Double birdie cancel: if both teams birdie, no flips
        if(t1Birdie&&t2Birdie){
          // Both birdie: cancel — no flips
        }else if(t1Birdie){
          v2=flipNum(v2);
        }else{
          v1=flipNum(v1);
        }
      }
      // Both partners birdie: treat like eagle (flip opponent + double)
      var t1DoubleBirdie=useBirdieFlip&&t1nets.every(function(n){return n<=(par-1);});
      var t2DoubleBirdie=useBirdieFlip&&t2nets.every(function(n){return n<=(par-1);});
      if(!t1Eagle&&!t2Eagle&&(t1DoubleBirdie||t2DoubleBirdie)){
        if(t1DoubleBirdie&&t2DoubleBirdie){
          // Both double birdie: cancel
        }else if(t1DoubleBirdie){
          // Already flipped above or not — redo: double birdie always flips+doubles
          // Reset and recompute
          v1=vegasNum(s1);v2=vegasNum(s2);
          v2=flipNum(v2);
          holeMult=2;
        }else{
          v1=vegasNum(s1);v2=vegasNum(s2);
          v1=flipNum(v1);
          holeMult=2;
        }
      }
      var diff=(v2-v1)*holeMult;
      cumDiff+=diff;
      out.push({h:h,t1num:v1,t2num:v2,diff:diff,cumDiff:cumDiff,t1birdie:t1Birdie,t2birdie:t2Birdie,t1eagle:t1Eagle,t2eagle:t2Eagle,mult:holeMult});
    }
    return out;
  }

  // ══════════════════════════════════════════════════
  // ── FULL SETTLEMENT BREAKDOWN ──
  // ══════════════════════════════════════════════════

function computeVegasHoleVariant(rid, h, team1, team2, variant, gameConfig, tData) {
    // variant: 'standard'|'montecarlo'|'daytona'|'newtown'
    // tData: optional tournament object — if provided, reads from tData instead of T
    var tSrc = tData || T;
    var r = tSrc.rounds.find(function (r) { return r.id === rid; });
    if (!r) return null;
    var gc2 = gameConfig || {};
    var vUseNet = gc2.netGross !== 'gross';
    var vHcpPct = (gc2.hcpPercent || 100) / 100;
    var hcpMode = gc2.hcpMode || 'lowman'; // 'lowman' or 'course'
    var allPids = team1.concat(team2);

    // Pre-compute minHcp for low-man mode
    var minHcp = Infinity;
    if (hcpMode === 'lowman') {
      allPids.forEach(function(pid){
        var pl = tData ? tData.players.find(function(x){return x.id===pid;}) : null;
        var rawHcp = tData ? (pl?.roundHcp?.[rid]??Math.round(pl?.ghin||0)) : pRoundHcp(pid, rid);
        if(rawHcp < minHcp) minHcp = rawHcp;
      });
    }

    var getAdj = function (pids) {
      return pids.map(function (pid) {
        var sc = tData ? (tData.scores?.[rid]?.[pid]?.[h]||null) : getScore(rid, pid, h);
        var pl = tData ? tData.players.find(function(x){return x.id===pid;}) : null;
        var rawHcp = tData ? (pl?.roundHcp?.[rid]??Math.round(pl?.ghin||0)) : pRoundHcp(pid, rid);
        var hcp = hcpMode === 'course' ? rawHcp : Math.max(0, rawHcp - (minHcp === Infinity ? 0 : minHcp));
        return sc != null ? (vUseNet ? sc - strokesOnHole(Math.round(hcp * vHcpPct), holeSI(r.course, h)) : sc) : null;
      });
    };

    if (variant === 'newtown') {
      // All 4 players' nets, sort ascending: [a,b,c,d]
      // Middle two (b,c) are partners vs outer two (a,d)
      var allNets = allPids.map(function (pid) {
        var sc = tData ? (tData.scores?.[rid]?.[pid]?.[h]||null) : getScore(rid, pid, h);
        var pl = tData ? tData.players.find(function(x){return x.id===pid;}) : null;
        var rawHcp = tData ? (pl?.roundHcp?.[rid]??Math.round(pl?.ghin||0)) : pRoundHcp(pid, rid);
        var hcp = hcpMode === 'course' ? rawHcp : Math.max(0, rawHcp - (minHcp === Infinity ? 0 : minHcp));
        var adj = sc != null ? (vUseNet ? sc - strokesOnHole(Math.round(hcp * vHcpPct), holeSI(r.course, h)) : sc) : null;
        return { pid: pid, net: adj != null ? Math.max(1, adj) : null };
      });
      if (allNets.some(function (x) { return x.net === null; })) return null;
      allNets.sort(function (a, b) { return a.net - b.net; });
      var midTeam = [allNets[1].pid, allNets[2].pid];
      var outTeam = [allNets[0].pid, allNets[3].pid];
      // Use vegasNum-style construction: lo in tens, hi in ones, 7+ flips
      var nUseSevenFlip = gc2.sevenFlip !== false;
      var nPenaltyAt = gc2.penaltyThreshold || 7;
      var midLo = allNets[1].net, midHi = allNets[2].net;
      var midNum = (nUseSevenFlip && midHi >= nPenaltyAt) ? midHi * 10 + midLo : midLo * 10 + midHi;
      var outLo = allNets[0].net, outHi = allNets[3].net;
      var outNum = (nUseSevenFlip && outHi >= nPenaltyAt) ? outHi * 10 + outLo : outLo * 10 + outHi;
      return { t1num: midNum, t2num: outNum, diff: outNum - midNum, t1pids: midTeam, t2pids: outTeam };
    }

    var t1nets = getAdj(team1);
    var t2nets = getAdj(team2);
    if (t1nets.some(function (x) { return x === null; }) || t2nets.some(function (x) { return x === null; })) return null;
    // Min-1 floor: net scores below 1 become 1 (standard house rule for net Vegas)
    var t1raw = t1nets.slice(); var t2raw = t2nets.slice(); // keep raw for birdie/eagle check
    t1nets = t1nets.map(function (x) { return Math.max(1, x); });
    t2nets = t2nets.map(function (x) { return Math.max(1, x); });

    // Config-aware rules
    var useBirdieFlip2 = gc2.birdieFlip !== false;
    var useSevenFlip2 = gc2.sevenFlip !== false;
    var penaltyAt2 = gc2.penaltyThreshold || 7;
    var useEagleFlip2 = gc2.eagleFlip !== false;

    function vegasNum2(nets) {
      if (nets.length < 2) return nets[0] || 1;
      var sorted = nets.slice().sort(function (a, b) { return a - b; });
      var lo = sorted[0], hi = sorted[sorted.length - 1];
      if (useSevenFlip2 && hi >= penaltyAt2) return hi * 10 + lo;
      return lo * 10 + hi;
    }
    function flipNum2(n) { var t = Math.floor(n / 10), o = n % 10; return o * 10 + t; }

    if (variant === 'montecarlo') {
      return { t1num: Math.min.apply(null, t1nets), t2num: Math.min.apply(null, t2nets), diff: Math.min.apply(null, t2nets) - Math.min.apply(null, t1nets), t1pids: team1, t2pids: team2 };
    }

    var vv1 = vegasNum2(t1nets), vv2 = vegasNum2(t2nets);
    var par_v = holePar(r.course, h);
    var t1B = t1raw.some(function(n){return n<=par_v-1;});
    var t2B = t2raw.some(function(n){return n<=par_v-1;});
    var t1E = t1raw.some(function(n){return n<=par_v-2;});
    var t2E = t2raw.some(function(n){return n<=par_v-2;});
    var t1DB = useBirdieFlip2 && t1raw.every(function(n){return n<=par_v-1;});
    var t2DB = useBirdieFlip2 && t2raw.every(function(n){return n<=par_v-1;});

    // Eagle: flip opponent + double (cancels if both eagle)
    var holeMult2 = 1;
    if (useEagleFlip2 && (t1E || t2E)) {
      if (t1E && t2E) { /* cancel */ }
      else if (t1E) { vv2 = flipNum2(vv2); holeMult2 = 2; }
      else { vv1 = flipNum2(vv1); holeMult2 = 2; }
    } else if (useBirdieFlip2 && (t1B || t2B)) {
      // Double birdie cancel
      if (t1B && t2B) { /* cancel */ }
      else if (t1B) { vv2 = flipNum2(vv2); }
      else { vv1 = flipNum2(vv1); }
    }
    // Both partners birdie (not eagle): flip + double
    if (!t1E && !t2E && (t1DB || t2DB)) {
      if (t1DB && t2DB) { /* cancel */ }
      else if (t1DB) { vv1 = vegasNum2(t1nets); vv2 = vegasNum2(t2nets); vv2 = flipNum2(vv2); holeMult2 = 2; }
      else { vv1 = vegasNum2(t1nets); vv2 = vegasNum2(t2nets); vv1 = flipNum2(vv1); holeMult2 = 2; }
    }
    var vDiff = (vv2 - vv1) * holeMult2;
    return { t1num: vv1, t2num: vv2, diff: vDiff, t1pids: team1, t2pids: team2, mult: holeMult2 };
  }

// ══════════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════════

export {
  computeSkins,
  computeMatch,
  computeMatchTeam,
  compute1v1Holes,
  computeHiLow,
  computeSixes,
  computeScotch6s,
  computeFiveThreeOne,
  computeStableford,
  computeStablefordIndividual,
  computeTeamDay,
  computeBestBall,
  computeWolfResult,
  computeVegasHoles,
  computeVegasHoleVariant,
  computeVegasVariantFull,
  computeHammerResult,
  computeHammerResultV2,
  computeSnakeResult,
  computeDotsResult,
  computeBbbResult,
  computeFidgetResult,
};
