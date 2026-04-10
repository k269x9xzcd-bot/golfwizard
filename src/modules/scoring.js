/**
 * scoring.js - Pure scoring calculation helpers
 * Extracted from GolfWizard main application
 * No Vue reactivity - all pure functions
 */

// ══════════════════════════════════════════════════════════════════
// PURE SCORING HELPERS
// ══════════════════════════════════════════════════════════════════

function strokesOnHole(hcp,si){
    if(!hcp)return 0;
    const base=Math.floor(hcp/18),rem=hcp%18;
    return base+(rem>0&&si<=rem?1:0);
  }
function getScore(rid,pid,h){return T.scores?.[rid]?.[pid]?.[h]||null;}
function setScore(rid,pid,h,v){
    if(!T.scores[rid])T.scores[rid]={};
    if(!T.scores[rid][pid])T.scores[rid][pid]={};
    const n=parseInt(v);
    if(!isNaN(n)&&n>0)T.scores[rid][pid][h]=n;
    else delete T.scores[rid][pid][h];
    saveData();
    saveArchive();
  }
function editRoundHcp(pid,rid,val){
    const p=getP(pid);if(!p)return;
    if(!p.roundHcp)p.roundHcp={};
    const n=parseInt(val);
    p.roundHcp[rid]=isNaN(n)?0:Math.max(0,Math.min(54,n));
    saveData();
  }
function netScore(rid,pid,h){
    const g=getScore(rid,pid,h);if(!g)return null;
    const r=T.rounds.find(r=>r.id===rid);if(!r)return null;
    return g-strokesOnHole(pRoundHcp(pid,rid),holeSI(r.course,h));
  }
function gameNetScore(rid,pid,h){
    const g=getScore(rid,pid,h);if(!g)return null;
    const r=T.rounds.find(r=>r.id===rid);if(!r)return null;
    return g-strokesOnHole(primaryGameHcp(pid,rid).hcp,holeSI(r.course,h));
  }
function scoreClass(score,par){
    if(score==null||par==null)return'';
    if(score===1&&par>=3)return'sc-hio';
    const d=score-par;
    if(d<=-3)return'sc-alb';if(d===-2)return'sc-eagle';if(d===-1)return'sc-birdie';if(d===0)return'sc-par';if(d===1)return'sc-bogey';if(d===2)return'sc-dbl';return'sc-trip';
  }
function holeHasData(rid,h){return roundPlayers(rid).some(pid=>getScore(rid,pid,h));}
function grossTotal(rid,pid){
    const r=T.rounds.find(r=>r.id===rid);if(!r)return null;
    const from=roundFromH(rid),to=roundToH(rid);
    let sum=0;for(let h=from;h<=to;h++){const s=getScore(rid,pid,h);if(s)sum+=s;else return null;}
    return sum;
  }
function netTotal(rid,pid){
    var g=grossScore(rid,pid);if(g===null)return null;
    var p=getP(pid);if(!p)return g;
    var hcp=p.roundHcp&&p.roundHcp[rid]!==undefined?p.roundHcp[rid]:Math.round(p.ghin||0);
    var r=T.rounds&&T.rounds.find(function(x){return x.id===rid;});
    if(!r)return g;
    var from=r.holesMode==='back9'?10:1;
    var to=r.holesMode==='front9'?9:holeCount(r.course);
    var strokes=0;
    for(var h=from;h<=to;h++){strokes+=strokesOnHole(hcp,holeSI(r.course,h));}
    return g-strokes;
  }
function roundGroups(rid){
    var r=T.rounds.find(function(x){return x.id===rid;});
    return(r&&r.groups&&r.groups.length)?r.groups:[];
  }
function gameGroupIndex(rid,game){
    // Explicit groupIndex set by Tournament Wizard takes precedence
    if(game.hasOwnProperty('groupIndex')){
      if(game.groupIndex===null)return 'inter';
      if(typeof game.groupIndex==='number')return game.groupIndex;
    }
    var groups=roundGroups(rid);
    if(!groups.length)return null;
    var pids=[].concat(game.config.team1||[],game.config.team2||[],game.config.players||[]);
    if(!pids.length)return null;
    for(var gi=0;gi<groups.length;gi++){
      if(pids.every(function(pid){return groups[gi].indexOf(pid)>=0;}))return gi;
    }
    return 'inter';
  }
function groupGames(rid,groupIdx){
    var games=T.gameRounds[rid]||[];
    if(groupIdx===null||groupIdx===undefined)return games;
    return games.filter(function(g){
      var gi=gameGroupIndex(rid,g);
      return gi===groupIdx||gi==='inter'||gi===null;
    });
  }
function roundPlayers(rid){
    var r=T.rounds.find(function(x){return x.id===rid;});
    if(!r)return T.players.map(function(p){return p.id;});
    var groups=r.groups||[];
    var pids;
    // Build a set of valid T.players IDs — used ONLY to prevent ghost additions from T.players
    var validIds={};T.players.forEach(function(p){validIds[p.id]=1;});
    if(groups.length&&activeGroup.value!==null&&activeGroup.value<groups.length){
      // Single group view: show all group members (don't filter — they may use legacy IDs with valid scores)
      pids=groups[activeGroup.value].slice();
    }else if(groups.length){
      // All-players mode: flatten all groups, then add T.players not already seen (prevents ghost rows from ID mismatches)
      var seen={};pids=[];
      groups.forEach(function(g){g.forEach(function(pid){if(!seen[pid]){seen[pid]=1;pids.push(pid);}});});
      T.players.forEach(function(p){if(!seen[p.id]){pids.push(p.id);}});
    }else{
      pids=T.players.map(function(p){return p.id;});
    }
    if(T.type==='tournament'&&pids.some(function(pid){var pp=getP(pid);return pp&&pp.team;})){
      pids=[].concat(pids).sort(function(a,b){return((getP(a)||{}).team||99)-((getP(b)||{}).team||99);});
    }
    return pids;
  }
  // Returns pids of players with the lowest net score on a hole (all must have scored)
  function scorecardPlayers(rid){
    // If a 5-3-1 game is active with configured players, show only those 3
    var g=(T.gameRounds[rid]||[]).find(function(x){return x.type==='fiveThreeOne';});
    if(g&&g.config&&g.config.players&&g.config.players.length===3)return g.config.players;
    return roundPlayers(rid);
  }

  function holeNetWinners(rid,h){
    const r=T.rounds.find(r=>r.id===rid);if(!r)return[];
    const pids=roundPlayers(rid);
    const nets=pids.map(pid=>{const g=getScore(rid,pid,h);if(g==null)return null;return{pid,net:g-strokesOnHole(primaryGameHcp(pid,rid).hcp,holeSI(r.course,h))};});
    if(nets.some(x=>x===null))return[];
    const best=Math.min(...nets.map(x=>x.net));
    return nets.filter(x=>x.net===best).map(x=>x.pid);
  }
  function holeTeamWinner(rid,h){
    const games=T.gameRounds[rid]||[];
    const teamGame=games.find(g=>['nassau','vegas','match'].includes(g.type)&&g.config?.team1&&g.config?.team2);
    if(!teamGame)return null;
    const pids=roundPlayers(rid);
    const t1=[...(teamGame.config?.team1||[])];
    const t2=[...(teamGame.config?.team2||[])];
    const t1Best=Math.min(...pids.filter(p=>t1.includes(p)).map(p=>{const g=getScore(rid,p,h);if(g==null)return Infinity;return g-strokesOnHole(primaryGameHcp(p,rid).hcp,holeSI(T.rounds.find(r=>r.id===rid)?.course||'',h));}));
    const t2Best=Math.min(...pids.filter(p=>t2.includes(p)).map(p=>{const g=getScore(rid,p,h);if(g==null)return Infinity;return g-strokesOnHole(primaryGameHcp(p,rid).hcp,holeSI(T.rounds.find(r=>r.id===rid)?.course||'',h));}));
    if(t1Best===Infinity||t2Best===Infinity)return null;
    if(t1Best<t2Best)return 1;
    if(t2Best<t1Best)return 2;
    return 0; // tie/halved
  }
  // ── MY GROUP (persistent per-round scorer assignment) ──
  function setMyGroup(gi){
    myGroupIndex.value=gi;
    // Persist per round (groups change round-to-round)
    var rid=activeRound.value?activeRound.value.id:null;
    if(T.id&&rid!=null){
      try{
        var stored=JSON.parse(localStorage.getItem('gw_my_groups')||'{}');
        stored[T.id+'_'+rid]=gi;
        localStorage.setItem('gw_my_groups',JSON.stringify(stored));
      }catch(e){}
    }
    showGroupSelectModal.value=false;
    activeGroup.value=gi;
  }
  function loadMyGroup(){
    // Load persisted myGroup for the current round
    if(!T.id){myGroupIndex.value=null;return;}
    var rid=activeRound.value?activeRound.value.id:null;
    if(rid==null){myGroupIndex.value=null;return;}
    try{
      var stored=JSON.parse(localStorage.getItem('gw_my_groups')||'{}');
      // Try per-round key first, fall back to legacy per-tournament key
      var key=T.id+'_'+rid;
      if(stored[key]!=null){myGroupIndex.value=stored[key];}
      else if(stored[T.id]!=null){myGroupIndex.value=stored[T.id];}
      else{myGroupIndex.value=null;}
    }catch(e){myGroupIndex.value=null;}
  }
  function hasGroups(rid){
    var r=T.rounds.find(function(x){return x.id===rid;});
    return r&&r.groups&&r.groups.length>1;
  }
  function myGroupPids(rid){
    // Returns player IDs for my group in this round, or all players if no group set
    if(myGroupIndex.value===null)return roundPlayers(rid);
    var r=T.rounds.find(function(x){return x.id===rid;});
    if(!r||!r.groups||!r.groups[myGroupIndex.value])return roundPlayers(rid);
    return r.groups[myGroupIndex.value].slice();
  }
  function isMyGroupGame(rid,game){
    // Returns true if game involves players from my group
    if(myGroupIndex.value===null)return true;
    var gi=gameGroupIndex(rid,game);
    return gi===myGroupIndex.value||gi==='inter'||gi===null;
  }
  function myGroupLabel(gi,rid){
    var r=T.rounds.find(function(x){return x.id===rid;});
    if(!r||!r.groups||!r.groups[gi])return'Group '+(gi+1);
    return r.groups[gi].map(function(pid){return pShort(pid);}).join(' · ');
  }
  function promptMyGroupIfNeeded(){
    // Show the group selection modal if current round has groups and myGroup not set
    var rid=activeRound.value?activeRound.value.id:null;
    if(T.type==='tournament'&&rid&&hasGroups(rid)&&myGroupIndex.value===null){
      showGroupSelectModal.value=true;
    }
  }
  // Scoring-specific players: uses myGroup for hole entry, all players for card view
  function scoringPlayers(rid){
    // Active group toggle takes precedence over persisted "my group"
    var gi=activeGroup.value!==null?activeGroup.value:myGroupIndex.value;
    if(gi===null)return scorecardPlayers(rid);
    var r=T.rounds.find(function(x){return x.id===rid;});
    if(!r||!r.groups||!r.groups[gi])return scorecardPlayers(rid);
    // Return all group members — don't filter by T.players (legacy IDs may have valid scores)
    return r.groups[gi].slice();
  }
  function fmtLabel(id){const f=FORMATS.find(f=>f.id===id);return f?f.name:'—';}
  // ── 9-HOLE HELPERS ──
  function roundFromH(rid){const r=T.rounds.find(r=>r.id===rid);return(r?.holesMode==='back9')?10:1;}
  function roundToH(rid){const r=T.rounds.find(r=>r.id===rid);if(!r)return 18;if(r.holesMode==='front9')return Math.min(9,holeCount(r.course));return holeCount(r.course);}
  function roundPar(rid){const r=T.rounds.find(r=>r.id===rid);if(!r)return 0;let p=0;for(let h=roundFromH(rid);h<=roundToH(rid);h++)p+=holePar(r.course,h);return p;}
  function roundHoles(rid){const from=roundFromH(rid),to=roundToH(rid);return Array.from({length:to-from+1},(_,i)=>from+i);}

  // Returns interleaved columns: holes 1-9, OUT, holes 10-18, IN (like a paper scorecard)
  function scorecardCols(rid){
    var holes=roundHoles(rid);
    var front=holes.filter(function(h){return h<=9;});
    var back=holes.filter(function(h){return h>9;});
    var cols=[];
    front.forEach(function(h){cols.push({t:'h',h:h});});
    if(front.length&&back.length)cols.push({t:'out'});
    back.forEach(function(h){cols.push({t:'h',h:h});});
    if(front.length&&back.length)cols.push({t:'in'});
    return cols;
  }

  // ── SCORECARD GAME ROWS ──
  // Returns array of {label, color, cells:{[hole]:{text,style}}, outText, inText, totalText}
  function scorecardGameRows(rid){
    var games=groupGames(rid,activeGroup.value);
    var r=T.rounds.find(function(r2){return r2.id===rid;});
    if(!r||!games.length)return[];
    var rows=[];
    var from=roundFromH(rid),to=roundToH(rid);
    var allRoundGames=T.gameRounds[rid]||[];

    games.forEach(function(g){
      var gIdx=allRoundGames.indexOf(g);
      var rowStart=rows.length;
      var c=g.config||{};
      var t1=c.team1||[];
      var t2=c.team2||[];

      // ── VEGAS ──
      if(g.type==='vegas'){
        var vholes=computeVegasHoles(rid,t1,t2,g);
        var vmap={};var cumDiff=0;var outDiff=0;
        vholes.forEach(function(vh){
          vmap[vh.h]=vh;
          if(vh.diff!==null)cumDiff=vh.cumDiff;
          if(vh.h<=9&&vh.diff!==null)outDiff=vh.cumDiff;
        });
        var ppt=c.ppt||1;
        var vegGrp=[].concat(t1,t2);
        var t1n=t1.map(function(p){return pCompact(p,vegGrp);}).join('+');
        var t2n=t2.map(function(p){return pCompact(p,vegGrp);}).join('+');
        // T1 row: team-labeled, circled when winning
        rows.push({label:t1n,color:'rgba(96,165,250,.7)',cells:function(h){
          var vh=vmap[h];
          if(!vh||vh.t1num===null)return{text:'·',style:'opacity:.3'};
          var won=vh.diff>0;var lost=vh.diff<0;
          return{text:vh.t1num+'',style:won?'color:#4ade80;font-weight:700':lost?'color:#f87171;font-weight:700':'opacity:.5',circle:won};
        },outText:function(){return'';},inText:function(){return'';},totalText:function(){return'';}});
        // T2 row: team-labeled, circled when winning
        rows.push({label:t2n,color:'rgba(248,113,113,.7)',cells:function(h){
          var vh=vmap[h];
          if(!vh||vh.t2num===null)return{text:'·',style:'opacity:.3'};
          var won=vh.diff<0;var lost=vh.diff>0;
          return{text:vh.t2num+'',style:won?'color:#4ade80;font-weight:700':lost?'color:#f87171;font-weight:700':'opacity:.5',circle:won};
        },outText:function(){return'';},inText:function(){return'';},totalText:function(){return'';}});
        // Diff row: signed differential per hole, T1 perspective (+ = T1 winning)
        var fVt1n=t1n,fVt2n=t2n;
        rows.push({label:'±Diff',color:'rgba(212,175,55,.7)',cells:function(h){
          var vh=vmap[h];
          if(!vh||vh.diff===null||vh.diff===undefined)return{text:'·',style:'opacity:.3'};
          var d=vh.diff;
          if(d===0)return{text:'—',style:'opacity:.3'};
          return{text:(d>0?'+':'')+d,style:d>0?'color:#60a5fa;font-weight:700;font-size:9px':'color:#f87171;font-weight:700;font-size:9px'};
        },outText:function(){
          if(!outDiff)return'AS';
          return(outDiff>0?fVt1n:fVt2n)+' +'+Math.abs(outDiff);
        },inText:function(){
          var inD=cumDiff-outDiff;
          if(!inD)return'AS';
          return(inD>0?fVt1n:fVt2n)+' +'+Math.abs(inD);
        },totalText:function(){
          if(!cumDiff)return'AS';
          var amt=Math.abs(cumDiff)*ppt;
          return(cumDiff>0?fVt1n:fVt2n)+' $'+amt;
        }});
      }

      // ── NASSAU ──
      if(g.type==='nassau'){
        var nCfg=c;
        var nUseNet=nCfg.netGross!=='gross';var nHcpPct=(nCfg.hcpPercent||100)/100;
        var nt1=t1,nt2=t2;
        var allNassauPids=nt1.concat(nt2);
        var nCells={};var nFront=0;var nBack=0;var nOverall=0;var nOutScore=0;
        for(var nh=from;nh<=to;nh++){
          var nb1s=nt1.map(function(pid){var gs=getScore(rid,pid,nh);return gs!=null?(nUseNet?gs-strokesOnHole(Math.round(gameAdjHcp(pid,rid,allNassauPids)*nHcpPct),holeSI(r.course,nh)):gs):null;}).filter(function(x){return x!==null;});
          var nb2s=nt2.map(function(pid){var gs=getScore(rid,pid,nh);return gs!=null?(nUseNet?gs-strokesOnHole(Math.round(gameAdjHcp(pid,rid,allNassauPids)*nHcpPct),holeSI(r.course,nh)):gs):null;}).filter(function(x){return x!==null;});
          if(!nb1s.length||!nb2s.length){nCells[nh]={text:'·',style:'opacity:.3'};continue;}
          var nb1=Math.min.apply(null,nb1s),nb2=Math.min.apply(null,nb2s);
          var nw=nb1<nb2?1:nb2<nb1?2:0;
          if(nh<=9){if(nw===1)nFront++;else if(nw===2)nFront--;}
          else{if(nw===1)nBack++;else if(nw===2)nBack--;}
          if(nw===1)nOverall++;else if(nw===2)nOverall--;
          if(nh<=9)nOutScore=nFront;
          nCells[nh]={text:nw===1?'W':nw===2?'L':'\u00bd',style:nw===1?'color:#60a5fa;font-weight:700;font-size:9px':nw===2?'color:#f87171;font-weight:700;font-size:9px':'opacity:.5;font-size:9px'};
        }
        var fNCells=nCells;var fNFront=nFront;var fNBack=nBack;var fNOverall=nOverall;var fNOutScore=nOutScore;
        var nassGrp=[].concat(nt1,nt2);
        var nt1n=nt1.map(function(p){return pCompact(p,nassGrp);}).join('+');
        var nt2n=nt2.map(function(p){return pCompact(p,nassGrp);}).join('+');
        var fNassauFront=nCfg.front||10;var fNassauBack=nCfg.back||10;var fNassauOverall=nCfg.overall||20;
        var fNt1n=nt1n,fNt2n=nt2n;
        rows.push({label:'<span style="color:#60a5fa">'+nt1n+'</span> <span style="opacity:.4">v</span> <span style="color:#f87171">'+nt2n+'</span>',color:'rgba(74,222,128,.7)',cells:function(h){
          return fNCells[h]||{text:'·',style:'opacity:.3'};
        },outText:function(){
          if(!fNFront)return'AS';
          var winner=fNFront>0?fNt1n:fNt2n;
          return winner+' '+Math.abs(fNFront)+'up';
        },inText:function(){
          if(!fNBack)return'AS';
          var winner=fNBack>0?fNt1n:fNt2n;
          return winner+' '+Math.abs(fNBack)+'up';
        },totalText:function(){
          var lines=[];
          if(fNFront!==0)lines.push('F:'+Math.abs(fNFront)+(fNFront>0?'↑':'↓'));
          if(fNBack!==0)lines.push('B:'+Math.abs(fNBack)+(fNBack>0?'↑':'↓'));
          if(fNOverall!==0)lines.push('O:'+Math.abs(fNOverall)+(fNOverall>0?'↑':'↓'));
          if(!lines.length)return'AS';
          return lines.join(' ');
        }});
      }

      // ── MATCH PLAY (1v1 and 2v2) ──
      if(g.type==='match'){
        var mp1=t1.length===1?t1[0]:null;
        var mp2=t2.length===1?t2[0]:null;
        var mCfg=c;
        var mUseNet=mCfg.netGross!=='gross';
        var mHcpPct=(mCfg.hcpPercent||100)/100;
        var mScore=0;var outScore=0;
        var mCells={};
        for(var h=from;h<=to;h++){
          if(mp1&&mp2){
            var s1=getScore(rid,mp1,h),s2=getScore(rid,mp2,h);
            if(s1&&s2){
              var n1=mUseNet?s1-strokesOnHole(Math.round(gameAdjHcp(mp1,rid,[mp1,mp2])*mHcpPct),holeSI(r.course,h)):s1;
              var n2=mUseNet?s2-strokesOnHole(Math.round(gameAdjHcp(mp2,rid,[mp1,mp2])*mHcpPct),holeSI(r.course,h)):s2;
              if(n1<n2)mScore++;else if(n2<n1)mScore--;
              mCells[h]={w:n1<n2?1:n2<n1?2:0,run:mScore};
            }
          }else{
            // 2v2 best ball
            var allMatchPids=t1.concat(t2);
            var t1nets=t1.map(function(pid){var sc=getScore(rid,pid,h);return sc!=null?(mUseNet?sc-strokesOnHole(Math.round(gameAdjHcp(pid,rid,allMatchPids)*mHcpPct),holeSI(r.course,h)):sc):null;}).filter(function(x){return x!==null;});
            var t2nets=t2.map(function(pid){var sc=getScore(rid,pid,h);return sc!=null?(mUseNet?sc-strokesOnHole(Math.round(gameAdjHcp(pid,rid,allMatchPids)*mHcpPct),holeSI(r.course,h)):sc):null;}).filter(function(x){return x!==null;});
            if(t1nets.length&&t2nets.length){
              var b1=Math.min.apply(null,t1nets),b2=Math.min.apply(null,t2nets);
              if(b1<b2)mScore++;else if(b2<b1)mScore--;
              mCells[h]={w:b1<b2?1:b2<b1?2:0,run:mScore};
            }
          }
          if(h===9)outScore=mScore;
        }
        var fMScore=mScore;
        var matchGrp=[].concat(t1,t2);
        var mt1n=t1.map(function(p){return pCompact(p,matchGrp);}).join('+');
        var mt2n=t2.map(function(p){return pCompact(p,matchGrp);}).join('+');
        var mt1short=mt1n;
        var mt2short=mt2n;
        var mtLabel='<span style="color:#60a5fa">'+mt1short+'</span> <span style="opacity:.4">v</span> <span style="color:#f87171">'+mt2short+'</span>';
        rows.push({label:mtLabel,color:'rgba(96,165,250,.7)',cells:function(h){
          var mc=mCells[h];
          if(!mc)return{text:'·',style:'opacity:.3'};
          if(mc.w===1)return{text:'W',style:'color:#60a5fa;font-weight:700;font-size:9px'};
          if(mc.w===2)return{text:'L',style:'color:#f87171;font-weight:700;font-size:9px'};
          return{text:'½',style:'opacity:.5;font-size:9px'};
        },outText:function(){
          if(!outScore)return'AS';
          return(outScore>0?mt1short:mt2short)+' '+Math.abs(outScore)+'up';
        },inText:function(){
          var inS=fMScore-outScore;
          if(!inS)return'AS';
          return(inS>0?mt1short:mt2short)+' '+Math.abs(inS)+'up';
        },totalText:function(){
          if(!fMScore)return'AS';
          return(fMScore>0?mt1short:mt2short)+' '+Math.abs(fMScore)+'up';
        }});
      }

      // ── SKINS ──
      if(g.type==='skins'){
        var skRes=null;
        try{
          var skPids=c.skinsMode==='team'?[t1,t2].map(function(t){return t[0];}):roundPlayers(rid);
          var skPpt=c.ppt||5;
          // Recompute per-hole skins data inline
          var skFrom=roundFromH(rid),skTo=roundToH(rid);
          var skCarry=0;var skCells={};var skTotalWins={};
          var skUseNet=c.netGross!=='gross';var skHcpPct=(c.hcpPercent||80)/100;
          for(var sh=skFrom;sh<=skTo;sh++){
            var hScores=skPids.map(function(pid){
              var sc=getScore(rid,pid,sh);
              return sc!=null?{pid:pid,net:skUseNet?sc-strokesOnHole(Math.round(gameAdjHcp(pid,rid,skPids)*skHcpPct),holeSI(r.course,sh)):sc}:null;
            }).filter(function(x){return x!==null;});
            if(hScores.length<2){skCells[sh]={text:'·',style:'opacity:.3'};continue;}
            var minNet=Math.min.apply(null,hScores.map(function(x){return x.net;}));
            var winners=hScores.filter(function(x){return x.net===minNet;});
            if(winners.length===1){
              var skinVal=1+skCarry;
              var skWinTxt=pCompact(winners[0].pid,skPids);
              if(skinVal>1)skWinTxt+=' ×'+skinVal;
              skCells[sh]={text:skWinTxt,style:'color:#d4af37;font-weight:700;font-size:9px'+(skinVal>1?';text-shadow:0 0 4px rgba(212,175,55,.5)':'')};
              skTotalWins[winners[0].pid]=(skTotalWins[winners[0].pid]||0)+skinVal;
              skCarry=0;
            }else{
              skCarry++;
              skCells[sh]={text:'×'+(1+skCarry),style:'color:#f97316;font-weight:700;font-size:9px;opacity:.8'};
            }
          }
        }catch(e){}
        if(skCells){
          var fSkCells=skCells;var fSkTotals=skTotalWins;var fSkPpt=skPpt;
          rows.push({label:'Skins ($'+skPpt+')',color:'rgba(212,175,55,.7)',cells:function(h){
            return fSkCells[h]||{text:'·',style:'opacity:.3'};
          },outText:function(){return'';},inText:function(){return'';},totalText:function(){
            var entries=Object.keys(fSkTotals).map(function(pid){return{pid:pid,n:fSkTotals[pid]};}).sort(function(a,b){return b.n-a.n;});
            if(!entries.length)return'—';
            return entries.map(function(e){return pCompact(e.pid,Object.keys(fSkTotals))+':'+e.n;}).join(' ');
          }});
        }
      }

      // ── FIVE-THREE-ONE SCORECARD ROWS ──
      if(g.type==='fiveThreeOne'){
        var f31Data=computeFiveThreeOne(rid);
        if(f31Data&&f31Data.holeLog){
          var f31Pids=(c.players&&c.players.length===3)?c.players:null;
          if(f31Pids){
            var roleSuper={5:'\u2075',3:'\u00b3',1:'\u00b9',4:'\u2074',2:'\u00b2',9:'\u2079',0:'\u2070'};
            f31Pids.forEach(function(pid,pIdx){
              var fPid=pid;var fHoleLog=f31Data.holeLog;var fPids=f31Pids;
              var colors=['#60a5fa','#4ade80','#f97316'];
              var pColor=colors[pIdx]||'#ccc';
              var pTotal=0;var pOut=0;
              fHoleLog.forEach(function(hl){
                if(hl.pts){
                  var v=hl.pts[fPid]||0;
                  pTotal+=v;
                  if(hl.h<=9)pOut+=v;
                }
              });
              var fTotal=pTotal;var fOut=pOut;
              rows.push({label:pCompact(pid,fPids),color:pColor,cells:function(h){
                var hl=fHoleLog.find(function(x){return x.h===h;});
                if(!hl||!hl.pts)return{text:'·',style:'opacity:.3'};
                var pts=hl.pts[fPid]||0;
                var sup=roleSuper[pts]||'';
                if(pts===9)return{text:'9'+sup,style:'color:#d4af37;font-weight:700;font-size:9px;text-shadow:0 0 4px rgba(212,175,55,.5)'};
                if(pts>=5)return{text:pts+sup,style:'color:#4ade80;font-weight:700;font-size:9px'};
                if(pts>=3)return{text:pts+sup,style:'color:'+pColor+';font-weight:600;font-size:9px'};
                if(pts>=1)return{text:pts+sup,style:'color:#f87171;font-size:9px'};
                return{text:'0',style:'opacity:.3;font-size:9px'};
              },outText:function(){return String(fOut);},inText:function(){return String(fTotal-fOut);},totalText:function(){return String(fTotal);}});
            });
          }
        }
      }

      // ── SCOTCH 6s SCORECARD ROWS ──
      // 7 rows: LB, LT, Prx, Brd (category winners), T1 pts, T2 pts, Net $
      if(g.type==='scotch6s'){
        var s6Res=computeScotch6s(rid);
        if(s6Res){
          var s6Map={};var s6T1cum=0,s6T2cum=0,s6OutT1=0,s6OutT2=0;
          s6Res.holes.forEach(function(hd){
            if(hd.t1pts!=null){s6T1cum+=hd.t1pts;s6T2cum+=hd.t2pts;}
            if(hd.h<=9){s6OutT1=s6T1cum;s6OutT2=s6T2cum;}
            s6Map[hd.h]=hd;
          });
          var fs6T1cum=s6T1cum,fs6T2cum=s6T2cum,fs6OutT1=s6OutT1,fs6OutT2=s6OutT2;
          // Category rows: LB (2pts), LT (2pts), Prox (1pt), Birdie (1pt)
          // Blue ● = T1 won, Red ● = T2 won, — = tie/none
          rows.push({label:'LB',color:'rgba(212,175,55,.5)',cells:function(h){
            var hd=s6Map[h];if(!hd||!hd.lowBall)return{text:'—',style:'opacity:.2;font-size:8px'};
            return hd.lowBall==='t1'?{text:'●2',style:'color:#60a5fa;font-weight:700;font-size:8px'}:{text:'●2',style:'color:#f87171;font-weight:700;font-size:8px'};
          },outText:function(){return'';},inText:function(){return'';},totalText:function(){return'';}});
          rows.push({label:'LT',color:'rgba(212,175,55,.5)',cells:function(h){
            var hd=s6Map[h];if(!hd||!hd.lowTotal)return{text:'—',style:'opacity:.2;font-size:8px'};
            return hd.lowTotal==='t1'?{text:'●2',style:'color:#60a5fa;font-weight:700;font-size:8px'}:{text:'●2',style:'color:#f87171;font-weight:700;font-size:8px'};
          },outText:function(){return'';},inText:function(){return'';},totalText:function(){return'';}});
          rows.push({label:'Prx',color:'rgba(212,175,55,.5)',cells:function(h){
            var hd=s6Map[h];if(!hd||!hd.prox)return{text:'—',style:'opacity:.2;font-size:8px'};
            return hd.prox==='t1'?{text:'🎯',style:'font-size:8px'}:{text:'🎯',style:'font-size:8px'};
          },outText:function(){return'';},inText:function(){return'';},totalText:function(){return'';}});
          rows.push({label:'Brd',color:'rgba(212,175,55,.5)',cells:function(h){
            var hd=s6Map[h];if(!hd||!hd.birdie)return{text:'—',style:'opacity:.2;font-size:8px'};
            if(hd.birdie==='both')return{text:'½½',style:'color:#d4af37;font-weight:700;font-size:8px'};
            return hd.birdie==='t1'?{text:'🐦',style:'font-size:8px'}:{text:'🐦',style:'font-size:8px'};
          },outText:function(){return'';},inText:function(){return'';},totalText:function(){return'';}});
          // Team total points per hole
          var s6Grp=[].concat(t1,t2);
          var s6t1n=t1.map(function(p){return pCompact(p,s6Grp);}).join('+');
          var s6t2n=t2.map(function(p){return pCompact(p,s6Grp);}).join('+');
          rows.push({label:s6t1n,color:'rgba(96,165,250,.7)',cells:function(h){
            var hd=s6Map[h];
            if(!hd||hd.t1pts==null)return{text:'·',style:'opacity:.3'};
            var txt=hd.t1pts+'';var won=hd.t1pts>hd.t2pts;
            if(hd.umbrella&&hd.t1pts>0)txt='☂'+txt;
            return{text:txt,style:won?'color:#4ade80;font-weight:700;font-size:9px':hd.t1pts>0?'color:#60a5fa;font-size:9px':'opacity:.4;font-size:9px'};
          },outText:function(){return fs6OutT1+'';},inText:function(){return(fs6T1cum-fs6OutT1)+'';},totalText:function(){return fs6T1cum+'';}});
          rows.push({label:s6t2n,color:'rgba(248,113,113,.7)',cells:function(h){
            var hd=s6Map[h];
            if(!hd||hd.t2pts==null)return{text:'·',style:'opacity:.3'};
            var txt=hd.t2pts+'';var won=hd.t2pts>hd.t1pts;
            if(hd.umbrella&&hd.t2pts>0)txt='☂'+txt;
            return{text:txt,style:won?'color:#4ade80;font-weight:700;font-size:9px':hd.t2pts>0?'color:#f87171;font-size:9px':'opacity:.4;font-size:9px'};
          },outText:function(){return fs6OutT2+'';},inText:function(){return(fs6T2cum-fs6OutT2)+'';},totalText:function(){return fs6T2cum+'';}});
          // Net $ row
          var fs6ppt=s6Res.ppt;
          rows.push({label:'S6s $',color:'rgba(212,175,55,.7)',cells:function(h){
            var hd=s6Map[h];
            if(!hd||hd.t1pts==null)return{text:'·',style:'opacity:.3'};
            var d=(hd.t1pts||0)-(hd.t2pts||0);
            if(d===0)return{text:'—',style:'opacity:.3;font-size:9px'};
            return{text:Math.abs(d)+'',style:d>0?'color:#4ade80;font-weight:700;font-size:9px':'color:#f87171;font-weight:700;font-size:9px'};
          },outText:function(){
            var d=fs6OutT1-fs6OutT2;return d===0?'AS':Math.abs(d)+'';
          },inText:function(){
            var d=(fs6T1cum-fs6OutT1)-(fs6T2cum-fs6OutT2);return d===0?'AS':Math.abs(d)+'';
          },totalText:function(){
            var d=fs6T1cum-fs6T2cum;
            if(d===0)return'AS';
            var amt=Math.abs(d)*fs6ppt;
            return(d>0?'+':'-')+'$'+amt;
          }});
        }
      }

      // ── STABLEFORD SCORECARD ROWS ──
      if(g.type==='stableford'){
        var stCfg=c;var stV=stCfg.variant||'standard';var stScale2=stCfg.scale||null;
        var stUseNet2=stCfg.netGross!=='gross';var stHcpPct2=(stCfg.hcpPercent||100)/100;
        var stT1cells={};var stT2cells={};var stT1cum=0;var stT2cum=0;var stOutT1=0;var stOutT2=0;
        for(var stH=from;stH<=to;stH++){
          var st1pts=t1.map(function(pid){var sc=getScore(rid,pid,stH);if(sc==null)return null;var net=stUseNet2?sc-strokesOnHole(Math.round(pRoundHcp(pid,rid)*stHcpPct2),holeSI(r.course,stH)):sc;return stablefordPoints(net,holePar(r.course,stH),stV,stScale2);}).filter(function(x){return x!==null;});
          var st2pts=t2.map(function(pid){var sc=getScore(rid,pid,stH);if(sc==null)return null;var net=stUseNet2?sc-strokesOnHole(Math.round(pRoundHcp(pid,rid)*stHcpPct2),holeSI(r.course,stH)):sc;return stablefordPoints(net,holePar(r.course,stH),stV,stScale2);}).filter(function(x){return x!==null;});
          if(!st1pts.length||!st2pts.length){stT1cells[stH]=null;stT2cells[stH]=null;continue;}
          var stIsBB=stCfg.teamMode==='bestball';
          var stB1=stIsBB?Math.max.apply(null,st1pts):st1pts.reduce(function(a,b){return a+b;},0);
          var stB2=stIsBB?Math.max.apply(null,st2pts):st2pts.reduce(function(a,b){return a+b;},0);
          stT1cum+=stB1;stT2cum+=stB2;
          if(stH<=9){stOutT1+=stB1;stOutT2+=stB2;}
          stT1cells[stH]=stB1;stT2cells[stH]=stB2;
        }
        var fT1c=stT1cells;var fT2c=stT2cells;var fStT1cum=stT1cum;var fStT2cum=stT2cum;var fStOutT1=stOutT1;var fStOutT2=stOutT2;
        var stGrp=[].concat(t1,t2);
        var stT1n=t1.map(function(p){return pCompact(p,stGrp);}).join('+');
        var stT2n=t2.map(function(p){return pCompact(p,stGrp);}).join('+');
        // Row 1: Team 1 stableford points per hole
        rows.push({label:stT1n,color:'#60a5fa',cells:function(h){
          var v=fT1c[h];if(v==null)return{text:'·',style:'opacity:.3'};
          return{text:String(v),style:'color:#60a5fa;font-weight:700;font-size:9px'};
        },outText:function(){return String(fStOutT1);},inText:function(){return String(fStT1cum-fStOutT1);},totalText:function(){return String(fStT1cum);}});
        // Row 2: Team 2 stableford points per hole
        rows.push({label:stT2n,color:'#f87171',cells:function(h){
          var v=fT2c[h];if(v==null)return{text:'·',style:'opacity:.3'};
          return{text:String(v),style:'color:#f87171;font-weight:700;font-size:9px'};
        },outText:function(){return String(fStOutT2);},inText:function(){return String(fStT2cum-fStOutT2);},totalText:function(){return String(fStT2cum);}});
      }

      // ── HILOW SCORECARD ROWS ──
      // 3 rows: Low Ball, High Ball, Aggregate — each shows which team won the point
      if(g.type==='hilow'){
        var hlRes=computeHiLow(rid,g);
        if(hlRes){
          var hlHoleMap={};
          hlRes.holes.forEach(function(hd){hlHoleMap[hd.h]=hd;});
          var t1Color='#60a5fa';var t2Color='#f87171';var tieColor='rgba(240,237,224,.3)';
          var hlT1Name=hlRes.t1n.split('+').map(function(s){return s.trim().charAt(0);}).join('');
          var hlT2Name=hlRes.t2n.split('+').map(function(s){return s.trim().charAt(0);}).join('');
          // Helper: cell for a point category
          function hlPointCell(hd,winKey){
            if(!hd||hd[winKey]==null)return{text:'·',style:'opacity:.3'};
            var w=hd[winKey];
            if(w===1)return{text:'W',style:'color:'+t1Color+';font-weight:700;font-size:9px'};
            if(w===2)return{text:'W',style:'color:'+t2Color+';font-weight:700;font-size:9px'};
            return{text:'½',style:tieColor+';font-size:9px'};
          }
          // Row 1: Low Ball
          var hlLowOut=0;var hlLowIn=0;var hlLowT1=0;var hlLowT2=0;
          for(var lh=from;lh<=to;lh++){var ld=hlHoleMap[lh];if(ld&&ld.lowWin===1){hlLowT1++;if(lh<=9)hlLowOut++;}else if(ld&&ld.lowWin===2){hlLowT2++;if(lh<=9)hlLowOut--;}}
          rows.push({label:'Low',color:'rgba(168,85,247,.5)',dimmed:true,cells:function(h){
            var hd=hlHoleMap[h];return hlPointCell(hd,'lowWin');
          },outText:function(){var o1=0;var o2=0;for(var i=from;i<=Math.min(to,9);i++){var d=hlHoleMap[i];if(d&&d.lowWin===1)o1++;else if(d&&d.lowWin===2)o2++;}return o1+'/'+o2;},
          inText:function(){var i1=0;var i2=0;for(var i=10;i<=to;i++){var d=hlHoleMap[i];if(d&&d.lowWin===1)i1++;else if(d&&d.lowWin===2)i2++;}return i1+'/'+i2;},
          totalText:function(){var a=0;var b=0;for(var i=from;i<=to;i++){var d=hlHoleMap[i];if(d&&d.lowWin===1)a++;else if(d&&d.lowWin===2)b++;}return a+'/'+b;}});
          // Row 2: High Ball
          rows.push({label:'High',color:'rgba(168,85,247,.5)',dimmed:true,cells:function(h){
            var hd=hlHoleMap[h];return hlPointCell(hd,'highWin');
          },outText:function(){var o1=0;var o2=0;for(var i=from;i<=Math.min(to,9);i++){var d=hlHoleMap[i];if(d&&d.highWin===1)o1++;else if(d&&d.highWin===2)o2++;}return o1+'/'+o2;},
          inText:function(){var i1=0;var i2=0;for(var i=10;i<=to;i++){var d=hlHoleMap[i];if(d&&d.highWin===1)i1++;else if(d&&d.highWin===2)i2++;}return i1+'/'+i2;},
          totalText:function(){var a=0;var b=0;for(var i=from;i<=to;i++){var d=hlHoleMap[i];if(d&&d.highWin===1)a++;else if(d&&d.highWin===2)b++;}return a+'/'+b;}});
          // Row 3: Aggregate
          rows.push({label:'Agg',color:'rgba(168,85,247,.5)',dimmed:true,cells:function(h){
            var hd=hlHoleMap[h];return hlPointCell(hd,'aggWin');
          },outText:function(){var o1=0;var o2=0;for(var i=from;i<=Math.min(to,9);i++){var d=hlHoleMap[i];if(d&&d.aggWin===1)o1++;else if(d&&d.aggWin===2)o2++;}return o1+'/'+o2;},
          inText:function(){var i1=0;var i2=0;for(var i=10;i<=to;i++){var d=hlHoleMap[i];if(d&&d.aggWin===1)i1++;else if(d&&d.aggWin===2)i2++;}return i1+'/'+i2;},
          totalText:function(){var a=0;var b=0;for(var i=from;i<=to;i++){var d=hlHoleMap[i];if(d&&d.aggWin===1)a++;else if(d&&d.aggWin===2)b++;}return a+'/'+b;}});
          // Row 4: Total points (bold summary)
          rows.push({label:'Pts',color:'rgba(168,85,247,.8)',cells:function(h){
            var hd=hlHoleMap[h];if(!hd||hd.lowWin==null)return{text:'·',style:'opacity:.3'};
            var p1=0;var p2=0;
            if(hd.lowWin===1)p1++;else if(hd.lowWin===2)p2++;
            if(hd.highWin===1)p1++;else if(hd.highWin===2)p2++;
            if(hd.aggWin===1)p1++;else if(hd.aggWin===2)p2++;
            if(p1===0&&p2===0)return{text:'0-0',style:'opacity:.4;font-size:8px'};
            var clr=p1>p2?t1Color:p2>p1?t2Color:'rgba(240,237,224,.6)';
            return{text:p1+'-'+p2,style:'color:'+clr+';font-weight:700;font-size:9px'};
          },outText:function(){var a=0;var b=0;for(var i=from;i<=Math.min(to,9);i++){var d=hlHoleMap[i];if(!d)continue;if(d.lowWin===1)a++;else if(d.lowWin===2)b++;if(d.highWin===1)a++;else if(d.highWin===2)b++;if(d.aggWin===1)a++;else if(d.aggWin===2)b++;}return a+'-'+b;},
          inText:function(){var a=0;var b=0;for(var i=10;i<=to;i++){var d=hlHoleMap[i];if(!d)continue;if(d.lowWin===1)a++;else if(d.lowWin===2)b++;if(d.highWin===1)a++;else if(d.highWin===2)b++;if(d.aggWin===1)a++;else if(d.aggWin===2)b++;}return a+'-'+b;},
          totalText:function(){return hlRes.t1pts+'-'+hlRes.t2pts;}});
        }
      }

      // ── TEAM DAY SCORECARD ROWS ──
      // 3 rows per team: "N Net", "N Gross", "Team" (total)
      // Matches standard Team Day format: 2 best net + 1 best gross per hole
      if(g.type==='teamday'){
        var tdCfg=c;
        var tdBestNets=tdCfg.bestNets||2;var tdBestGross=tdCfg.bestGross||1;
        var tdGetScores=function(team){
          return function(h){
            return team.map(function(pid){var sc=getScore(rid,pid,h);if(sc==null)return null;var hcp=pRoundHcp(pid,rid);var net=sc-strokesOnHole(hcp,holeSI(r.course,h));return{gross:sc,net:net};}).filter(function(x){return x!==null;});
          };
        };
        // Determine which team the visible players belong to
        var visiblePids=roundPlayers(rid);
        var t1overlap=t1.filter(function(pid){return visiblePids.indexOf(pid)>=0;}).length;
        var t2overlap=t2.filter(function(pid){return visiblePids.indexOf(pid)>=0;}).length;
        var teamsToShow=[];
        if(t1overlap>t2overlap){teamsToShow=[{team:t1,label:'T1',fn:tdGetScores(t1),tColor:'rgba(96,165,250,.7)'},{team:t2,label:'T2',fn:tdGetScores(t2),tColor:'rgba(248,113,113,.7)'}];}
        else if(t2overlap>t1overlap){teamsToShow=[{team:t2,label:'T2',fn:tdGetScores(t2),tColor:'rgba(248,113,113,.7)'},{team:t1,label:'T1',fn:tdGetScores(t1),tColor:'rgba(96,165,250,.7)'}];}
        else{teamsToShow=[{team:t1,label:'T1',fn:tdGetScores(t1),tColor:'rgba(96,165,250,.7)'},{team:t2,label:'T2',fn:tdGetScores(t2),tColor:'rgba(248,113,113,.7)'}];}
        teamsToShow.forEach(function(tInfo){
          var netCells={};var grossCells={};var totalCells={};
          var netCum=0;var grossCum=0;var totalCum=0;
          var netOut=0;var grossOut=0;var totalOut=0;
          for(var tdH=from;tdH<=to;tdH++){
            var sc=tInfo.fn(tdH);
            if(sc.length<Math.max(tdBestNets,tdBestGross)){
              netCells[tdH]={text:'·',style:'opacity:.3'};
              grossCells[tdH]={text:'·',style:'opacity:.3'};
              totalCells[tdH]={text:'·',style:'opacity:.3'};
              continue;
            }
            var byNet=sc.slice().sort(function(a,b){return a.net-b.net;});
            var byGross=sc.slice().sort(function(a,b){return a.gross-b.gross;});
            var nSum=0;for(var ni=0;ni<tdBestNets&&ni<byNet.length;ni++)nSum+=byNet[ni].net;
            var gSum=0;for(var gi2=0;gi2<tdBestGross&&gi2<byGross.length;gi2++)gSum+=byGross[gi2].gross;
            var holeTotal=nSum+gSum;
            netCum+=nSum;grossCum+=gSum;totalCum+=holeTotal;
            if(tdH<=9){netOut+=nSum;grossOut+=gSum;totalOut+=holeTotal;}
            netCells[tdH]={text:''+nSum,style:'font-size:8px;opacity:.6'};
            grossCells[tdH]={text:''+gSum,style:'font-size:8px;opacity:.6'};
            totalCells[tdH]={text:''+holeTotal,style:'font-weight:700;font-size:9px'};
          }
          var fNet=netCells;var fGross=grossCells;var fTotal=totalCells;
          var fNetCum=netCum;var fGrossCum=grossCum;var fTotalCum=totalCum;
          var fNetOut=netOut;var fGrossOut=grossOut;var fTotalOut=totalOut;
          var dot={text:'·',style:'opacity:.3'};
          // Row 1: N Best Net
          rows.push({label:tdBestNets+' Net',color:'rgba(212,175,55,.45)',cells:function(h){return fNet[h]||dot;},
            outText:function(){return fNetOut||'·';},inText:function(){return(fNetCum-fNetOut)||'·';},totalText:function(){return fNetCum||'·';}});
          // Row 2: N Best Gross
          rows.push({label:tdBestGross+' Grs',color:'rgba(212,175,55,.45)',cells:function(h){return fGross[h]||dot;},
            outText:function(){return fGrossOut||'·';},inText:function(){return(fGrossCum-fGrossOut)||'·';},totalText:function(){return fGrossCum||'·';}});
          // Row 3: Team Total (bold, team-colored)
          rows.push({label:tInfo.label,color:tInfo.tColor,cells:function(h){return fTotal[h]||dot;},
            outText:function(){return fTotalOut||'·';},inText:function(){return(fTotalCum-fTotalOut)||'·';},totalText:function(){return fTotalCum||'·';}});
        });
      }

      // ── BEST BALL SCORECARD ROWS ──
      if(g.type==='bestball'){
        var bbResult=computeBestBall(rid,g);
        if(!bbResult)return;
        var bbG1cells={};var bbG2cells={};
        var bbG1cum=0;var bbG2cum=0;var bbOutG1=0;var bbOutG2=0;
        bbResult.holes.forEach(function(hd){
          if(hd.t1hole!=null){
            bbG1cum=hd.t1agg;bbG2cum=hd.t2agg;
            if(hd.h<=9){bbOutG1=hd.t1agg;bbOutG2=hd.t2agg;}
            var better=hd.t1hole<hd.t2hole?1:hd.t2hole<hd.t1hole?2:0;
            bbG1cells[hd.h]={text:String(hd.t1hole),style:better===1?'color:#4ade80;font-weight:700;font-size:9px':better===2?'color:#f87171;font-size:9px':'font-size:9px;opacity:.7'};
            bbG2cells[hd.h]={text:String(hd.t2hole),style:better===2?'color:#4ade80;font-weight:700;font-size:9px':better===1?'color:#f87171;font-size:9px':'font-size:9px;opacity:.7'};
          }else{
            bbG1cells[hd.h]={text:'·',style:'opacity:.3'};
            bbG2cells[hd.h]={text:'·',style:'opacity:.3'};
          }
        });
        var fBbG1cells=bbG1cells;var fBbG2cells=bbG2cells;
        var fBbG1cum=bbG1cum;var fBbG2cum=bbG2cum;var fBbOutG1=bbOutG1;var fBbOutG2=bbOutG2;
        rows.push({label:'G1',color:'rgba(96,165,250,.7)',cells:function(h){return fBbG1cells[h]||{text:'·',style:'opacity:.3'};},
          outText:function(){return fBbOutG1||'·';},inText:function(){return(fBbG1cum-fBbOutG1)||'·';},totalText:function(){return String(fBbG1cum);}});
        rows.push({label:'G2',color:'rgba(248,113,113,.7)',cells:function(h){return fBbG2cells[h]||{text:'·',style:'opacity:.3'};},
          outText:function(){return fBbOutG2||'·';},inText:function(){return(fBbG2cum-fBbOutG2)||'·';},totalText:function(){return String(fBbG2cum);}});
      }

      // ── HAMMER SCORECARD ROWS ──
      if(g.type==='hammer'){
        var hmCells={};var hmT1cum=0;var hmT2cum=0;var hmOutT1=0;var hmOutT2=0;
        var hmPpt=c.ppt||5;
        for(var hmH=from;hmH<=to;hmH++){
          var hmHole=getHammerHole(rid,hmH);
          var hmWin=hammerAutoWinner(rid,hmH);
          var hmMult=hmHole.mult||1;
          var hmVal=hmMult*hmPpt;
          if(hmHole.winner||hmWin){
            var hmW=hmHole.winner||(hmWin===1?'team1':'team2');
            if(hmW==='team1'){hmT1cum+=hmVal;hmCells[hmH]={text:'$'+hmVal,style:'color:#60a5fa;font-weight:700;font-size:8px'};}
            else{hmT2cum+=hmVal;hmCells[hmH]={text:'$'+hmVal,style:'color:#f87171;font-weight:700;font-size:8px'};}
            if(hmH<=9){if(hmW==='team1')hmOutT1+=hmVal;else hmOutT2+=hmVal;}
          }else{
            hmCells[hmH]={text:hmMult>1?'×'+hmMult:'·',style:hmMult>1?'color:#f97316;font-size:8px':'opacity:.3'};
          }
        }
        var fHmCells=hmCells;var fHmT1cum=hmT1cum;var fHmT2cum=hmT2cum;
        rows.push({label:'Hammer',color:'rgba(249,115,22,.7)',cells:function(h){
          return fHmCells[h]||{text:'·',style:'opacity:.3'};
        },outText:function(){return'';},inText:function(){return'';},totalText:function(){
          var d=fHmT1cum-fHmT2cum;
          if(d===0)return'Even';
          return(d>0?'T1 +$':'T2 +$')+Math.abs(d);
        }});
      }

      // ── WOLF SCORECARD ROWS ──
      if(g.type==='wolf'){
        var wc=c;var wTeeOrder=wc.teeOrder||[];var wPpt=wc.ppt||1;
        var wHoles=wc.holes||{};
        var wLpPid=(wc.wolfVariants&&wc.wolfVariants.lastPlaceWolf)?wolfLastPlace(rid,g):null;
        // Per-player rows with notation + cumulative points
        wTeeOrder.forEach(function(pid){
          var wCum=0;var wOutCum=0;
          var wCellData={};
          for(var wh=from;wh<=to;wh++){
            var wPts=wolfHolePoints(rid,wh,g,null,(wh>=17?wLpPid:null));
            var pPts=wPts[pid]||0;
            wCum+=pPts;
            if(wh<=9)wOutCum+=pPts;
            var hState=wHoles[String(wh)]||{};
            var isWolf=wolfOnHole(wTeeOrder,wh,(wh>=17?wLpPid:null))===pid;
            var mode2=hState.mode||'normal';
            var notation='';
            if(isWolf&&pPts!==0){
              if(mode2==='lone')notation='LW';
              else if(mode2==='blind')notation='BW';
              else if(hState.partnerId)notation='WP';
              else notation='W';
            }else if(!isWolf&&pPts!==0&&hState.partnerId===pid){
              notation='WP';
            }
            var absP=Math.abs(pPts);
            var txt=absP?(absP+''):'·';
            if(notation)txt=absP+notation;
            var sty=pPts>0?'color:#60a5fa;font-weight:700;font-size:9px':pPts<0?'color:#f87171;font-weight:700;font-size:9px':'opacity:.3;font-size:9px';
            wCellData[wh]={text:txt,style:sty};
          }
          var fWCellData=wCellData;var fWCum=wCum;var fWOutCum=wOutCum;
          rows.push({label:pCompact(pid,wTeeOrder),color:'rgba(96,165,250,.7)',cells:function(h){
            return fWCellData[h]||{text:'·',style:'opacity:.3'};
          },outText:function(){
            if(!fWOutCum)return'·';
            return(fWOutCum>0?'+':'')+fWOutCum;
          },inText:function(){
            var inD=fWCum-fWOutCum;
            if(!inD)return'·';
            return(inD>0?'+':'')+inD;
          },totalText:function(){
            if(!fWCum)return'E';
            return(fWCum>0?'+$':'-$')+Math.abs(fWCum*wPpt);
          }});
        });
      }

      // ── SUB-MATCH (1v1 side bet) ROWS ──
      var subMatches=c.subMatches||c.matches||[];
      subMatches.filter(function(m){return m.p1&&m.p2;}).forEach(function(m){
        var sm1=m.p1,sm2=m.p2;
        var smUseNet=c.netGross!=='gross';var smHcpPct=(c.hcpPercent||100)/100;
        // Low-man within the 1v1 pair
        var smH1=Math.round(pRoundHcp(sm1,rid)*smHcpPct);
        var smH2=Math.round(pRoundHcp(sm2,rid)*smHcpPct);
        var smDiff=smH1-smH2; // positive = sm1 gets strokes
        var smCells={};var smRunning=0;var smOut=0;
        for(var sh=from;sh<=to;sh++){
          var ss1=getScore(rid,sm1,sh),ss2=getScore(rid,sm2,sh);
          if(!ss1||!ss2){smCells[sh]={text:'·',style:'opacity:.3'};continue;}
          var smSi=holeSI(r.course,sh);
          var sn1=smUseNet&&smDiff>0?ss1-strokesOnHole(smDiff,smSi):ss1;
          var sn2=smUseNet&&smDiff<0?ss2-strokesOnHole(-smDiff,smSi):ss2;
          var sw=sn1<sn2?1:sn2<sn1?2:0;
          if(sw===1)smRunning++;else if(sw===2)smRunning--;
          if(sh<=9)smOut=smRunning;
          smCells[sh]={text:sw===1?'W':sw===2?'L':'\u00bd',style:sw===1?'color:#4ade80;font-weight:700;font-size:9px':sw===2?'color:#f87171;font-weight:700;font-size:9px':'opacity:.5;font-size:9px'};
        }
        var fSmCells=smCells;var fSmRunning=smRunning;var fSmOut=smOut;
        var smGrp=[sm1,sm2];
        var sm1n=pCompact(sm1,smGrp),sm2n=pCompact(sm2,smGrp);
        var fSm1n=sm1n,fSm2n=sm2n;
        var smPpt=m.ppt||5;
        rows.push({label:'<span style="color:#a78bfa">'+sm1n+'</span> <span style="opacity:.4">v</span> <span style="color:#a78bfa">'+sm2n+'</span>',color:'rgba(167,139,250,.6)',cells:function(h){
          return fSmCells[h]||{text:'·',style:'opacity:.3'};
        },outText:function(){
          if(!fSmOut)return'AS';
          return(fSmOut>0?fSm1n:fSm2n)+' '+Math.abs(fSmOut)+'up';
        },inText:function(){
          var inD=fSmRunning-fSmOut;
          if(!inD)return'AS';
          return(inD>0?fSm1n:fSm2n)+' '+Math.abs(inD)+'up';
        },totalText:function(){
          if(!fSmRunning)return'AS';
          var rem=to-from+1;
          var leader=fSmRunning>0?fSm1n:fSm2n;
          return leader+' '+Math.abs(fSmRunning)+'up';
        }});
      });

      // Tag rows with game index for tap-to-edit
      for(var ri=rowStart;ri<rows.length;ri++){rows[ri].gameIndex=gIdx;rows[ri].gameType=g.type;}
    });
    return rows;
  }

  // ── RUNNING TOTAL HELPERS ──
  function parThrough(course,maxHole){let p=0;for(let h=1;h<=maxHole;h++)p+=holePar(course,h);return p;}
  function grossThrough(rid,pid,maxHole){let s=0;for(let h=1;h<=maxHole;h++){const g=getScore(rid,pid,h);if(g)s+=g;}return s;}
  function netThrough(rid,pid,maxHole){
    let net=0;const r=T.rounds.find(r=>r.id===rid);if(!r)return 0;
    for(let h=1;h<=maxHole;h++){const g=getScore(rid,pid,h);if(g)net+=g-strokesOnHole(pRoundHcp(pid,rid),holeSI(r.course,h));}
    return net;
  }
  function holesPlayed(rid,pid){
    var count=0;
    var r=T.rounds.find(function(r){return r.id===rid;});
    if(!r)return 0;
    for(var h=1;h<=holeCount(r.course);h++){if(getScore(rid,pid,h))count++;}
    return count;
  }
  function lastScoredHole(rid,pid){
    var r=T.rounds.find(function(r){return r.id===rid;});
    if(!r)return 0;
    var last=0;
    for(var h=1;h<=holeCount(r.course);h++){if(getScore(rid,pid,h))last=h;}
    return last;
  }
  function grossVsParThru(rid,pid){
    // Returns {diff, thru} for the gross score vs par through holes played
    var r=T.rounds.find(function(r){return r.id===rid;});
    if(!r)return null;
    var gross=0,par=0,thru=0;
    for(var h=1;h<=holeCount(r.course);h++){
      var sc=getScore(rid,pid,h);
      if(!sc)continue;
      gross+=sc;par+=holePar(r.course,h);thru=h;
    }
    if(!thru)return null;
    return{diff:gross-par,thru:thru,gross:gross};
  }
  function fmtVsPar(diff){if(diff===0)return'E';return(diff>0?'+':'')+diff;}

  // ── LIVE GAME SUMMARY ──
  // Returns a Set of hole numbers where a Nassau press starts (for scorecard annotations)
  function nassauPressAt(rid){
    var games=(T.gameRounds&&T.gameRounds[rid]||[]).filter(function(g){return g.type==='nassau';});
    if(!games.length)return 2;
    return games[0].config&&games[0].config.pressAt||2;
  }

  function nassauPressHoles(rid){
    const s=new Set();
    const games=(T.gameRounds?.[rid]||[]).filter(g=>g.type==='nassau');
    if(!games.length)return s;
    const r=T.rounds.find(r=>r.id===rid);
    if(!r)return s;
    for(const g of games){
      const c=g.config||{};
      const npUseNet=c.netGross!=='gross';const npHcpPct=(c.hcpPercent||100)/100;
      const t1=c.team1||[],t2=c.team2||[];
      const pa=c.pressAt??2;
      if(!pa||!t1.length||!t2.length)continue;
      const minPH3=c.minPressHoles||1;
      const runSeg=(fromH,toH)=>{
        const bets=[{startH:fromH,score:0,pressed:false}];
        for(let h=fromH;h<=toH;h++){
          const b1s=t1.map(pid=>{const gs=getScore(rid,pid,h);return gs!=null?(npUseNet?gs-strokesOnHole(Math.round(pRoundHcp(pid,rid)*npHcpPct),holeSI(r.course,h)):gs):null;}).filter(x=>x!==null);
          const b2s=t2.map(pid=>{const gs=getScore(rid,pid,h);return gs!=null?(npUseNet?gs-strokesOnHole(Math.round(pRoundHcp(pid,rid)*npHcpPct),holeSI(r.course,h)):gs):null;}).filter(x=>x!==null);
          if(!b1s.length||!b2s.length)continue;
          const b1=Math.min(...b1s),b2=Math.min(...b2s);
          const newP=[];
          for(const bet of bets){
            if(b1<b2)bet.score++;
            else if(b2<b1)bet.score--;
            const rem=toH-h;
            // Standard: each bet fires exactly ONE press at pressAt threshold
            if(!bet.pressed&&pa>0&&rem>=minPH3&&Math.abs(bet.score)>=pa){
              bet.pressed=true;
              s.add(h+1);
              newP.push({startH:h+1,score:0,pressed:false});
            }
          }
          bets.push(...newP);
        }
      };
      const hc=holeCount(r.course);
      if(hc>=9)runSeg(1,Math.min(9,hc));
      if(hc>=18)runSeg(10,hc);
    }
    return s;
  }

  // nassauPressInfo(rid) — returns per-hole press data for scorecard display
  // {starts:{h:count}, active:{h:count}, presses:[{startH,seg}]}
  function nassauPressInfo(rid){
    var info={starts:{},active:{},presses:[]};
    var games=(T.gameRounds?.[rid]||[]).filter(function(g){return g.type==='nassau';});
    if(!games.length)return info;
    var r=T.rounds.find(function(r2){return r2.id===rid;});
    if(!r)return info;
    for(var gi2=0;gi2<games.length;gi2++){
      var c=games[gi2].config||{};
      var npUseNet=c.netGross!=='gross';var npHcpPct=(c.hcpPercent||100)/100;
      var t1p=c.team1||[],t2p=c.team2||[];
      var pa=c.pressAt??2;var minPH2=c.minPressHoles||1;
      if(!pa||!t1p.length||!t2p.length)continue;
      var runSeg2=function(fromH,toH,seg){
        var bets=[{startH:fromH,score:0,pressed:false}];
        for(var h=fromH;h<=toH;h++){
          var b1s=t1p.map(function(pid){var gs=getScore(rid,pid,h);return gs!=null?(npUseNet?gs-strokesOnHole(Math.round(pRoundHcp(pid,rid)*npHcpPct),holeSI(r.course,h)):gs):null;}).filter(function(x){return x!==null;});
          var b2s=t2p.map(function(pid){var gs=getScore(rid,pid,h);return gs!=null?(npUseNet?gs-strokesOnHole(Math.round(pRoundHcp(pid,rid)*npHcpPct),holeSI(r.course,h)):gs):null;}).filter(function(x){return x!==null;});
          if(!b1s.length||!b2s.length)continue;
          var b1=Math.min.apply(null,b1s),b2=Math.min.apply(null,b2s);
          var hRes=b1<b2?1:b2<b1?-1:0;
          var rem=toH-h;
          var newP2=[];
          for(var bi=0;bi<bets.length;bi++){
            var bet=bets[bi];
            if(h>=bet.startH)bet.score+=hRes;
            // Standard: each bet fires exactly ONE press at pressAt threshold
            if(!bet.pressed&&pa>0&&rem>=minPH2&&Math.abs(bet.score)>=pa){
              bet.pressed=true;
              var pressStartH=h+1;
              newP2.push({startH:pressStartH,score:0,pressed:false});
              info.starts[pressStartH]=(info.starts[pressStartH]||0)+1;
              info.presses.push({startH:pressStartH,seg:seg});
            }
          }
          for(var ni=0;ni<newP2.length;ni++)bets.push(newP2[ni]);
          // Count active presses on this hole (excluding main bet)
          var activeCount=0;
          for(var ai=1;ai<bets.length;ai++){if(h>=bets[ai].startH)activeCount++;}
          if(activeCount>0)info.active[h]=Math.max(info.active[h]||0,activeCount);
        }
      };
      var hc2=holeCount(r.course);
      if(hc2>=9)runSeg2(1,Math.min(9,hc2),'front');
      if(hc2>=18)runSeg2(10,hc2,'back');
    }
    return info;
  }

  // Nassau segment: match play per hole, best-ball for teams, auto-press support
  // team1/team2 are arrays of pids (single-element = 1v1)
  // Returns {slashStatus, pressCount, owed, owedStr, t1n, t2n, bets[]}
  // slashStatus: "+2/0/-1" slash notation (base/press1/press2...)
  // owed>0 = team1 won money; owed<0 = team2 won money
  function nassauMatchSeg(rid,team1,team2,fromH,toH,pressAt,betAmt,gameConfig){
    const r=T.rounds.find(r=>r.id===rid);if(!r)return null;
    const nc2=gameConfig||{};
    const nUseNet=nc2.netGross!=='gross';
    const nHcpPct=(nc2.hcpPercent||100)/100;
    const minPH=nc2.minPressHoles||1;
    const t1n=team1.map(p=>pDisplay(p)).join('+');
    const t2n=team2.map(p=>pDisplay(p)).join('+');
    const allPids=team1.concat(team2);
    const teamBest=(team,h)=>{
      const nets=team.map(pid=>{const g=getScore(rid,pid,h);if(g==null)return null;var hcp=gameAdjHcp(pid,rid,allPids);return nUseNet?g-strokesOnHole(Math.round(hcp*nHcpPct),holeSI(r.course,h)):g;}).filter(x=>x!==null);
      return nets.length?Math.min(...nets):null;
    };
    // bets: [{startH,score,pressed,amt}] — score>0 = team1 leads in holes
    // pressed: boolean — each bet fires at most ONE press (standard rules)
    // Scores always accumulate through all holes (no freeze at clinch)
    // Cascading comes from child bets independently hitting pressAt threshold
    const pvPct=(nc2.pressValuePct??100)/100;
    const pressAmt=Math.round(betAmt*pvPct*100)/100;
    const bets=[{startH:fromH,score:0,pressed:false,amt:betAmt}];
    let lastH=fromH-1;
    for(let h=fromH;h<=toH;h++){
      const b1=teamBest(team1,h),b2=teamBest(team2,h);
      if(b1===null||b2===null)continue;
      lastH=h;const rem=toH-h;
      const hRes=b1<b2?1:b2<b1?-1:0;
      const newPresses=[];
      for(const bet of bets){
        if(h>=bet.startH)bet.score+=hRes;
        // Standard press rule: each bet fires exactly ONE press when losing
        // side first falls pressAt holes down. No re-press from same bet.
        if(!bet.pressed&&pressAt>0&&rem>=minPH&&Math.abs(bet.score)>=pressAt){
          bet.pressed=true;
          newPresses.push({startH:h+1,score:0,pressed:false,amt:pressAmt});
        }
      }
      bets.push(...newPresses);
    }
    if(lastH<fromH)return null;
    const remH=toH-lastH;const allDone=remH===0;
    // Slash notation from the leader's perspective (all positive)
    // Determine leader from base match score
    const baseScore=bets[0].score;
    const flip=baseScore<0?-1:1; // flip signs if team2 leads
    const slashLeader=baseScore===0?'':(baseScore>0?t1n:t2n);
    const fmtScore=(bet)=>{
      const s=bet.score*flip;
      return s===0?'0':(s>0?'+':'')+s;
    };
    const slashScores=bets.map(b=>fmtScore(b)).join('/');
    // Full slash: "TeamName +9/+7/+5" or "A/S" or "Halved"
    let slashStatus;
    if(baseScore===0){slashStatus=allDone?'Halved':'A/S';}
    else{slashStatus=slashLeader+' '+slashScores;}
    // Verbose status for the main bet (used in settlement)
    const fmtBet=(bet)=>{
      if(bet.score===0)return allDone?'Halved':'A/S';
      const lead=bet.score>0?t1n:t2n;const up=Math.abs(bet.score);
      if(allDone)return`${lead} ${up}up`;
      if(up>remH)return`${lead} wins (${up}&${remH})`;
      return`${lead} ${up}up`;
    };
    // Settlement: bet is settled if segment complete OR clinched (abs(score) > remaining)
    let owed=0;
    bets.forEach(bet=>{if(allDone||Math.abs(bet.score)>remH){if(bet.score>0)owed+=bet.amt;else if(bet.score<0)owed-=bet.amt;}});
    const mainStatus=fmtBet(bets[0]);
    const pressCount=bets.length-1;
    let owedStr='';
    if(owed!==0){const payer=owed<0?t1n:t2n;owedStr=`${payer} owe $${Math.abs(owed)}`;}
    return{mainStatus,slashStatus,pressCount,owed,owedStr,t1n,t2n};
  }
  function computeSkins(rid,pids,gameObj){
    const r=T.rounds.find(r=>r.id===rid);if(!r)return{holes:[],totals:{},pids:[],ppt:5,carry:0,played:0,settlements:[]};
    var g=gameObj||(T.gameRounds[rid]||[]).find(function(x){return x.type==='skins';});
    var c=g?g.config||{}:{};
    var useNet=c.netGross!=='gross';
    var hcpPct=(c.hcpPercent||80)/100;
    var ppt=c.ppt||5;
    var carryover=c.carryover!==false;
    var hole18Tie=c.hole18Tie||'dead'; // 'dead' = nobody wins, 'split' = split carry
    var payoutModel=c.skinsPayout||'pot'; // 'pot' or 'perPlayer'
    var hcpMode=c.hcpMode||'lowman'; // 'lowman' or 'course'
    var numPlayers=pids.length;
    // Display value per skin: pot = everyone's ante, perPlayer = what losers pay
    var skinValue=payoutModel==='perPlayer'?ppt*(numPlayers-1):ppt*numPlayers;
    const from=roundFromH(rid),to=roundToH(rid);
    const holes=[];var carry=0;var played=0;
    var totals={}; // pid -> {skins:N, won:$, paid:$}
    pids.forEach(function(pid){totals[pid]={skins:0,won:0,paid:0};});
    for(var h=from;h<=to;h++){
      var sc=pids.map(function(pid){
        var g2=getScore(rid,pid,h);
        if(g2==null)return null;
        if(useNet){
          var rawHcp=hcpMode==='course'?pRoundHcp(pid,rid):gameAdjHcp(pid,rid,pids);
          var adjHcp2=Math.round(rawHcp*hcpPct);
          return{pid:pid,score:g2-strokesOnHole(adjHcp2,holeSI(r.course,h)),gross:g2};
        }
        return{pid:pid,score:g2,gross:g2};
      });
      if(sc.some(function(x){return x===null;})){
        holes.push({hole:h,winner:null,carry:carry,potValue:(1+carry)*skinValue,scores:{}});
        continue;
      }
      played++;
      var min=Math.min.apply(null,sc.map(function(x){return x.score;}));
      var winners=sc.filter(function(x){return x.score===min;});
      var holeScores={};
      sc.forEach(function(x){holeScores[x.pid]=x.score;});
      if(winners.length===1){
        var skinCount=1+(carryover?carry:0);
        var winPid=winners[0].pid;
        var winAmount=skinCount*skinValue; // total $ won from all opponents
        totals[winPid].skins+=skinCount;
        totals[winPid].won+=winAmount;
        // Everyone pays $ppt per skin into the pot (pot model) or each loser pays (per-player)
        if(payoutModel==='pot'){
          pids.forEach(function(pid){totals[pid].paid+=skinCount*ppt;});
        }else{
          pids.forEach(function(pid){if(pid!==winPid)totals[pid].paid+=skinCount*ppt;});
        }
        holes.push({hole:h,winner:winPid,winnerName:pDisplay(winPid),skins:skinCount,value:winAmount,carry:0,scores:holeScores});
        carry=0;
      }else{
        carry++;
        holes.push({hole:h,winner:null,carry:carry,potValue:(1+carry)*skinValue,scores:holeScores});
      }
    }
    // Handle unresolved carry at end of round
    var deadSkins=0;
    if(carry>0&&played>0){
      if(hole18Tie==='split'){
        // Split equally — each player wins carry/N skins from each other player
        // Net effect: zero, everyone gets the same amount. Just note it.
        deadSkins=carry;
      }else{
        // 'dead' — nobody wins them
        deadSkins=carry;
      }
    }
    // Compute net per player and pairwise settlements
    pids.forEach(function(pid){totals[pid].net=totals[pid].won-totals[pid].paid;});
    // Build who-owes-whom settlements (minimize transactions)
    var balances=pids.map(function(pid){return{pid:pid,bal:totals[pid].net};});
    var settlements=[];
    // Greedy settlement: pair largest debtor with largest creditor
    var debtors=balances.filter(function(b){return b.bal<0;}).sort(function(a,b){return a.bal-b.bal;});
    var creditors=balances.filter(function(b){return b.bal>0;}).sort(function(a,b){return b.bal-a.bal;});
    var di=0,ci=0;
    while(di<debtors.length&&ci<creditors.length){
      var amt=Math.min(-debtors[di].bal,creditors[ci].bal);
      if(amt>0){
        settlements.push({from:debtors[di].pid,to:creditors[ci].pid,amount:amt});
      }
      debtors[di].bal+=amt;
      creditors[ci].bal-=amt;
      if(debtors[di].bal>=0)di++;
      if(creditors[ci].bal<=0)ci++;
    }
    return{holes:holes,totals:totals,pids:pids,ppt:ppt,carry:carry,deadSkins:deadSkins,played:played,totalHoles:to-from+1,skinValue:skinValue,payoutModel:payoutModel,settlements:settlements};
  }
  function computeMatch(rid,p1,p2,gameConfig){
    const r=T.rounds.find(r=>r.id===rid);if(!r)return'—';
    var mc=gameConfig||{};var mUseNet=mc.netGross!=='gross';var mHcpPct=(mc.hcpPercent||100)/100;var hcpMode=mc.hcpMode||'lowman';
    const from=roundFromH(rid),to=roundToH(rid),totalH=to-from+1;
    let score=0,played=0;
    for(let h=from;h<=to;h++){
      const s1=getScore(rid,p1,h),s2=getScore(rid,p2,h);if(!s1||!s2)continue;
      const hcp1=hcpMode==='course'?pRoundHcp(p1,rid):gameAdjHcp(p1,rid,[p1,p2]);
      const hcp2=hcpMode==='course'?pRoundHcp(p2,rid):gameAdjHcp(p2,rid,[p1,p2]);
      const n1=mUseNet?s1-strokesOnHole(Math.round(hcp1*mHcpPct),holeSI(r.course,h)):s1;
      const n2=mUseNet?s2-strokesOnHole(Math.round(hcp2*mHcpPct),holeSI(r.course,h)):s2;
      if(n1<n2)score++;else if(n2<n1)score--;played++;
    }
    if(!played)return'—';
    if(score===0)return'All Square';
    const lead=score>0?(getP(p1)?.short||p1):(getP(p2)?.short||p2);
    const diff=Math.abs(score),rem=totalH-played;
    if(diff>rem)return`${lead} wins (${diff}&${rem})`;
    return`${lead} ${diff}up (thru ${played})`;
  }
  // (nassauSegTeam replaced by nassauMatchSeg above)
  // 2v2 best-ball match play
  function computeMatchTeam(rid,team1,team2,gameConfig){
    const r=T.rounds.find(r=>r.id===rid);if(!r)return'—';
    var mtc=gameConfig||{};var mtUseNet=mtc.netGross!=='gross';var mtHcpPct=(mtc.hcpPercent||100)/100;var hcpMode=mtc.hcpMode||'lowman';
    const from=roundFromH(rid),to=roundToH(rid),totalH=to-from+1;
    const allPids=team1.concat(team2);
    let score=0,played=0;
    for(let h=from;h<=to;h++){
      const t1nets=team1.map(pid=>{const g=getScore(rid,pid,h);if(g==null)return null;const hcp=hcpMode==='course'?pRoundHcp(pid,rid):gameAdjHcp(pid,rid,allPids);return mtUseNet?g-strokesOnHole(Math.round(hcp*mtHcpPct),holeSI(r.course,h)):g;}).filter(x=>x!==null);
      const t2nets=team2.map(pid=>{const g=getScore(rid,pid,h);if(g==null)return null;const hcp=hcpMode==='course'?pRoundHcp(pid,rid):gameAdjHcp(pid,rid,allPids);return mtUseNet?g-strokesOnHole(Math.round(hcp*mtHcpPct),holeSI(r.course,h)):g;}).filter(x=>x!==null);
      if(!t1nets.length||!t2nets.length)continue;
      const b1=Math.min(...t1nets),b2=Math.min(...t2nets);
      if(b1<b2)score++;else if(b2<b1)score--;played++;
    }
    if(!played)return'—';
    if(score===0)return'All Square';
    const t1n=team1.map(p=>pDisplay(p)).join('+');
    const t2n=team2.map(p=>pDisplay(p)).join('+');
    const lead=score>0?t1n:t2n;
    const diff=Math.abs(score),rem=totalH-played;
    if(diff>rem)return`${lead} wins (${diff}&${rem})`;
    return`${lead} ${diff}up (thru ${played})`;
  }
  // 1v1 hole-by-hole results for mini-grid: returns array of {h, result: 1|2|0|null, runScore} per hole
  function compute1v1Holes(rid, p1, p2){
    const r=T.rounds.find(r=>r.id===rid);if(!r)return[];
    const from=roundFromH(rid),to=roundToH(rid);
    // Low-man within the pair: higher HCP player gets the difference
    const h1=pRoundHcp(p1,rid),h2=pRoundHcp(p2,rid);
    const diff=h1-h2; // positive = p1 gets strokes
    const out=[];let score=0;
    for(let h=from;h<=to;h++){
      const s1=getScore(rid,p1,h),s2=getScore(rid,p2,h);
      if(!s1||!s2){out.push({h,result:null,runScore:score});continue;}
      const si=holeSI(r.course,h);
      // Only the higher-HCP player gets strokes (the diff)
      const p1adj=diff>0?strokesOnHole(diff,si):0;
      const p2adj=diff<0?strokesOnHole(-diff,si):0;
      const n1=s1-p1adj,n2=s2-p2adj;
      if(n1<n2)score++;else if(n2<n1)score--;
      out.push({h,result:n1<n2?1:n2<n1?2:0,runScore:score});
    }
    return out;
  }
  // (computeVegas removed — was dead code; summary uses computeVegasVariantFull, settlement uses computeVegasHoles)
  // Render side match results for any game, including $ owed
  function subMatchHoleWinner(rid,hole,p1,p2,gameConfig){
    var s1=getScore(rid,p1,hole);var s2=getScore(rid,p2,hole);
    if(!s1||!s2)return null;
    var r=T.rounds.find(function(r){return r.id===rid;});if(!r)return null;
    var smc=gameConfig||{};var smhUseNet=smc.netGross!=='gross';var smhHcpPct=(smc.hcpPercent||100)/100;
    var si=holeSI(r.course,hole);
    var n1=s1,n2=s2;
    if(smhUseNet){
      // Low-man within the 1v1 pair
      var h1=Math.round(pRoundHcp(p1,rid)*smhHcpPct);
      var h2=Math.round(pRoundHcp(p2,rid)*smhHcpPct);
      var diff=h1-h2;
      n1=diff>0?s1-strokesOnHole(diff,si):s1;
      n2=diff<0?s2-strokesOnHole(-diff,si):s2;
    }
    if(n1<n2)return p1;if(n2<n1)return p2;return null;
  }

  function subMatchScore(rid,upToHole,p1,p2,gameConfig){
    var r=T.rounds.find(function(r){return r.id===rid;});if(!r)return{diff:0,label:'AS'};
    var ssc=gameConfig||{};var ssUseNet=ssc.netGross!=='gross';var ssHcpPct=(ssc.hcpPercent||100)/100;
    // Low-man within the 1v1 pair
    var h1=Math.round(pRoundHcp(p1,rid)*ssHcpPct);
    var h2=Math.round(pRoundHcp(p2,rid)*ssHcpPct);
    var hcpDiff=h1-h2; // positive = p1 gets strokes
    var diff=0;
    var holes=upToHole||holeCount(r.course);
    for(var h=1;h<=holes;h++){
      var s1=getScore(rid,p1,h);var s2=getScore(rid,p2,h);
      if(!s1||!s2)continue;
      var si=holeSI(r.course,h);
      var n1=ssUseNet&&hcpDiff>0?s1-strokesOnHole(hcpDiff,si):s1;
      var n2=ssUseNet&&hcpDiff<0?s2-strokesOnHole(-hcpDiff,si):s2;
      if(n1<n2)diff++;else if(n2<n1)diff--;
    }
    var remaining=holeCount(r.course)-holes;
    if(diff===0)return{diff:0,label:'AS'};
    var abs=Math.abs(diff);
    var leader=diff>0?p1:p2;
    var name=getP(leader)?getP(leader).short||leader:leader;
    // Dormie check
    if(abs>remaining&&remaining>0)return{diff:diff,label:name+' dormie'};
    if(abs>remaining)return{diff:diff,label:name+' wins '+abs+'&'+remaining};
    return{diff:diff,label:name+' '+abs+'up'};
  }

  function sideMatchHtml(rid,g){
    const c=g.config||{};
    var matchList=c.subMatches||c.matches||[];if(!matchList.length)return'';
    const r=T.rounds.find(r=>r.id===rid);
    const nc=r?holeCount(r.course):18;
    return matchList.filter(function(m){return m.p1&&m.p2;}).map(function(m){
      const smGroup=[m.p1,m.p2];
      const p1n=pCompact(m.p1,smGroup),p2n=pCompact(m.p2,smGroup);
      const ppt=m.ppt||5;
      var smUseNet=c.netGross!=='gross';var smHcpPct=(c.hcpPercent||100)/100;
      // Low-man within the 1v1 pair
      var smH1=Math.round(pRoundHcp(m.p1,rid)*smHcpPct);
      var smH2=Math.round(pRoundHcp(m.p2,rid)*smHcpPct);
      var smDiff=smH1-smH2;
      const status=computeMatch(rid,m.p1,m.p2,c);
      // Compute settlement: iterate holes to get score + played count
      let score=0,played=0;
      for(let h=1;h<=nc;h++){
        const s1=getScore(rid,m.p1,h),s2=getScore(rid,m.p2,h);if(!s1||!s2)continue;
        const si=holeSI(r?.course||'',h);
        const n1=smUseNet&&smDiff>0?s1-strokesOnHole(smDiff,si):s1;
        const n2=smUseNet&&smDiff<0?s2-strokesOnHole(-smDiff,si):s2;
        if(n1<n2)score++;else if(n2<n1)score--;played++;
      }
      const rem=nc-played;
      const settled=played>0&&(Math.abs(score)>rem||rem===0);
      let dollarStr='';
      if(settled&&score!==0){
        const winner=score>0?p1n:p2n;const loser=score>0?p2n:p1n;
        dollarStr=` · <span style="color:#4ade80;font-weight:700">${loser} owe $${ppt}</span>`;
      }else if(score!==0){
        const leader=score>0?p1n:p2n;
        dollarStr=` <span style="opacity:.4;font-size:10px">(${leader} up)</span>`;
      }
      return`<div style="font-size:11px;padding:3px 0 3px 10px;border-left:2px solid rgba(255,255,255,.1);margin-top:3px">⚔️ <span style="font-weight:600">${p1n} vs ${p2n}</span> <span class="muted">· ${status}${dollarStr}</span></div>`;
    }).join('');
  }
  function gameSummaryHtml(rid,groupFilter){
    try{
    var allGames=T.gameRounds[rid]||[];
    const pids=roundPlayers(rid);
    if(!allGames.length)return'';
    // Filter to myGroup games if groupFilter is set
    var games=groupFilter!=null?allGames.filter(function(g){return isMyGroupGame(rid,g);}):allGames;
    if(!games.length)return'';
    const lines=games.map(g=>{
      const gd=GAME_DEFS[g.type];const c=g.config||{};
      const icon=gd?.icon||'🎲';const name=gd?.name||g.type;
      const t1=c.team1||[],t2=c.team2||[];
      const gpids=c.players?.length?c.players:pids;
      if(g.type==='nassau'){
        const r=T.rounds.find(r=>r.id===rid);const nc=r?holeCount(r.course):18;
        const a1=t1.length?t1:[pids[0]||''],a2=t2.length?t2:[pids[1]||''];
        const pa=c.pressAt??2,fAmt=c.front??10,bAmt=c.back??10,ovAmt=c.overall??20;
        const hm=r?.holesMode||'18';
        const fD=(hm!=='back9')?nassauMatchSeg(rid,a1,a2,1,Math.min(9,nc),pa,fAmt,c):null;
        const bD=(hm!=='front9'&&nc>9)?nassauMatchSeg(rid,a1,a2,10,nc,pa,bAmt,c):null;
        const ovD=(hm==='18'&&nc>9)?nassauMatchSeg(rid,a1,a2,1,nc,0,ovAmt,c):null;
        const allNP=[...a1,...a2];
        const t1n=a1.map(p=>pCompact(p,allNP)).join('+');
        const t2n=a2.map(p=>pCompact(p,allNP)).join('+');
        const fmtSeg=(label,d)=>{
          if(!d)return`<span style="opacity:.35">${label}: —</span>`;
          let s=`<span style="font-weight:600">${label}:</span> <span style="font-family:monospace;letter-spacing:0.5px">${d.slashStatus}</span>`;
          if(d.owedStr)s+=` · <span style="color:#4ade80;font-weight:700">${d.owedStr}</span>`;
          return s;
        };
        // Net settlement: positive = t1 won money; negative = t2 won money
        const netOwed=(fD?.owed??0)+(bD?.owed??0)+(ovD?.owed??0);
        // Gross: sum of absolute values per segment (shows total action)
        const grossTotal=Math.abs(fD?.owed??0)+Math.abs(bD?.owed??0)+Math.abs(ovD?.owed??0);
        let totLine='';
        if(netOwed!==0){
          const payer=netOwed<0?t1n:t2n;const payee=netOwed<0?t2n:t1n;
          const grossNote=grossTotal>Math.abs(netOwed)?` <span style="font-size:10px;opacity:.5">(gross: $${grossTotal})</span>`:'';
          totLine=`<div style="font-size:12px;font-weight:700;margin-top:5px;padding:5px 8px;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.2);border-radius:8px;color:#4ade80">💰 ${payer} owe ${payee} $${Math.abs(netOwed)}${grossNote}</div>`;
        }else if(grossTotal>0){
          totLine=`<div style="font-size:11px;margin-top:4px;opacity:.5">All square · $${grossTotal} action</div>`;
        }
        return`<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Nassau</span><span class="muted" style="font-size:10px;margin-left:4px">${t1n} vs ${t2n} · $${fAmt}/$${bAmt}/$${ovAmt}${pa>0?' · press@'+pa:''}</span><div style="font-size:11px;margin-top:3px;display:flex;flex-direction:column;gap:2px"><div>${fmtSeg('Front',fD)}</div><div>${fmtSeg('Back',bD)}</div><div>${fmtSeg('Overall',ovD)}</div></div>${totLine}</div>${sideMatchHtml(rid,g)}`;
      }
      if(g.type==='skins'){
        var skResult=computeSkins(rid,gpids,g);
        if(!skResult||!skResult.holes)return'<div style="margin-bottom:6px"><span style="font-weight:700">'+icon+' Skins</span> <span class="muted" style="font-size:11px">No scores yet</span></div>';
        var skWon=skResult.holes.filter(function(s){return s.winner;});
        var skPpt=skResult.ppt||5;
        var skSkinVal=skResult.skinValue||skPpt; // total $ per skin (ppt × opponents)
        // Per-hole narrative
        var holeStr=skWon.map(function(s){return'H'+s.hole+'→'+s.winnerName+'($'+(s.value||skSkinVal)+')';}).join(', ');
        if(!holeStr)holeStr='No skins won yet';
        // Carryover info
        var carryStr='';
        if(skResult.carry>0){
          if(skResult.played>=skResult.totalHoles){
            // Round over — carry died, no "next" to show
            carryStr=' · <span style="color:rgba(212,175,55,.6)">'+skResult.carry+' unclaimed skin'+(skResult.carry>1?'s':'')+' (carry died)</span>';
          }else{
            var nextVal=(skResult.carry+1)*skSkinVal;
            carryStr=' · <span style="color:#d4af37;font-weight:700">'+skResult.carry+' skin'+(skResult.carry>1?'s':'')+' in pot ($'+nextVal+' next)</span>';
          }
        }
        // Player standings (always show during round)
        var standStr='<div style="margin-top:4px;font-size:11px">';
        var sorted=skResult.pids.map(function(pid){return{pid:pid,name:pCompact(pid,skResult.pids),skins:skResult.totals[pid].skins,net:skResult.totals[pid].net};}).sort(function(a,b){return b.net-a.net;});
        sorted.forEach(function(e){
          var color=e.net>0?'#4ade80':e.net<0?'#f87171':'#d4af37';
          standStr+='<span style="color:'+color+';font-weight:700">'+e.name+': '+(e.net>0?'+ $':e.net<0?'-$':'$')+Math.abs(e.net)+' ('+e.skins+' skin'+(e.skins!==1?'s':'')+')</span> · ';
        });
        standStr=standStr.replace(/ · $/,'')+'</div>';
        // End-of-round settlement: who owes whom
        var settlStr='';
        if(skResult.played>=skResult.totalHoles&&skResult.settlements&&skResult.settlements.length){
          settlStr='<div style="margin-top:6px;padding:8px 10px;border-radius:8px;background:rgba(212,175,55,.08);border:1px solid rgba(212,175,55,.2)">';
          settlStr+='<div style="font-size:10px;font-weight:800;color:#d4af37;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">💰 Settlement</div>';
          skResult.settlements.forEach(function(s){
            settlStr+='<div style="font-size:12px;margin-bottom:2px"><span style="color:#f87171">'+pCompact(s.from,skResult.pids)+'</span> → <span style="color:#4ade80">'+pCompact(s.to,skResult.pids)+'</span>: <span style="font-weight:800;color:#f0ede0">$'+s.amount+'</span></div>';
          });
          if(skResult.deadSkins>0){
            settlStr+='<div class="muted" style="font-size:10px;margin-top:3px">'+skResult.deadSkins+' unclaimed skin'+(skResult.deadSkins>1?'s':'')+' (carry died)</div>';
          }
          settlStr+='</div>';
        }else if(skResult.played>=skResult.totalHoles&&(!skResult.settlements||!skResult.settlements.length)){
          settlStr='<div style="margin-top:4px;font-size:11px;color:#d4af37;font-weight:700">All square — no settlement needed</div>';
        }
        var payoutLabel=skResult.payoutModel==='perPlayer'?'$'+skPpt+'/skin (each opponent)':'$'+skPpt+'/skin (pot)';
        return'<div style="margin-bottom:6px"><span style="font-weight:700">'+icon+' Skins</span><span class="muted" style="font-size:10px;margin-left:4px">'+payoutLabel+'</span><div style="font-size:11px;margin-top:3px;line-height:1.6">'+holeStr+carryStr+'</div>'+standStr+settlStr+'</div>'+sideMatchHtml(rid,g);
      }
      if(g.type==='match'){
        const matchAll=[...t1,...t2];
        const t1n=t1.map(p=>pCompact(p,matchAll)).join('+')||(pCompact(pids[0],pids));
        const t2n=t2.map(p=>pCompact(p,matchAll)).join('+')||(pCompact(pids[1],pids));
        let status;
        if(t1.length>1||t2.length>1){
          status=computeMatchTeam(rid,t1.length?t1:[pids[0]],t2.length?t2:[pids[1]],c);
        }else{
          status=computeMatch(rid,t1[0]||pids[0],t2[0]||pids[1],c);
        }
        return`<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Match</span><span class="muted" style="font-size:10px;margin-left:4px">${t1n} vs ${t2n}</span><br><span class="muted" style="font-size:11px">${status}</span></div>${sideMatchHtml(rid,g)}`;
      }
      if(g.type==='vegas'){
        var variant=c.vegasVariant||'standard';
        var variantNames={'standard':'Vegas','montecarlo':'Monte Carlo','daytona':'Daytona','newtown':'Newtown'};
        var displayName=variantNames[variant]||'Vegas';
        var a1=t1.length?t1:[pids[0],pids[1]],a2=t2.length?t2:[pids[2]||pids[0],pids[3]||pids[1]];
        var vegasCalc=variant==='newtown'?computeVegasVariantFull(rid,a1,a2,'newtown',g):(t1.length&&t2.length?computeVegasVariantFull(rid,a1,a2,variant,g):null);
        var cumDiff=vegasCalc?vegasCalc.cumDiff:0;
        var ppt=c.ppt||1;
        var vegAll=[].concat(t1,t2);
        var t1n=t1.map(function(p){return pCompact(p,vegAll);}).join('+')||'TBD';
        var t2n=t2.map(function(p){return pCompact(p,vegAll);}).join('+')||'TBD';
        var dollarLine='';
        if(cumDiff!==0&&vegasCalc){
          var amt=Math.abs(cumDiff)*ppt;
          var wn=cumDiff>0?t1n:t2n;var ln=cumDiff>0?t2n:t1n;
          dollarLine=` · <span style="color:#4ade80;font-weight:700">${ln} owe $${amt}</span>`;
        }
        var vsLabel=variant==='newtown'?'(partners rotate)':t1n+' vs '+t2n;
        return`<div style="margin-bottom:6px"><span style="font-weight:700">${icon} ${displayName}</span><span class="muted" style="font-size:10px;margin-left:4px">${vsLabel}${dollarLine}</span></div>${sideMatchHtml(rid,g)}`;
      }
      if(g.type==='wolf'){
        var wolfResult=computeWolfResult(rid);
        var wolfTeeOrder=c.teeOrder||[];
        var wolfHoleNum=activeRound&&activeRound.value&&activeRound.value.id===rid?activeHole.value||0:0;
        var lpWolf=(c.wolfVariants&&c.wolfVariants.lastPlaceWolf)?wolfLastPlace(rid,g):null;
        var currentWolf=wolfHoleNum>0?wolfOnHole(wolfTeeOrder,wolfHoleNum,lpWolf):null;
        var currentWolfName=currentWolf?(getP(currentWolf)?getP(currentWolf).short||currentWolf:currentWolf):null;
        var variantLabels={'blind':'Blind Wolf','lone':'Lone Wolf','pig':'Pig','normal':''};
        var variantStr=wolfTeeOrder.length?`Tee order: ${wolfTeeOrder.map(function(p){return pCompact(p,wolfTeeOrder);}).join(' → ')}`:' No tee order set';
        var standingsStr='';
        if(wolfResult&&wolfResult.lines){
          standingsStr=wolfResult.lines.map(function(e){
            var sign=e.dollars>0?'+':'';
            return`${e.name}: <span style="color:${e.dollars>0?'#4ade80':e.dollars<0?'#f87171':'#d4af37'};font-weight:700">${sign}$${Math.abs(e.dollars)}</span>`;
          }).join(' · ');
        }
        return`<div style="margin-bottom:8px">
          <span style="font-weight:700">${icon} Wolf</span>
          <span class="muted" style="font-size:10px;margin-left:4px">$${c.ppt||1}/pt${currentWolfName?` · 🐺 <strong style="color:#d4af37">${currentWolfName}</strong> is Wolf`:''}</span>
          <div style="font-size:10px;opacity:.5;margin-top:2px">${variantStr}</div>
          ${standingsStr?`<div style="font-size:11px;margin-top:3px">${standingsStr}</div>`:''}
        </div>`;
      }
      if(g.type==='bbb'){
        var bbbRes=computeBbbResult(rid);
        var bbbStr='';
        if(bbbRes&&bbbRes.pts){
          var bbbNet={};bbbRes.pids.forEach(function(p){bbbNet[p]=0;});
          bbbRes.settlements.forEach(function(s){bbbNet[s.from]-=s.amt;bbbNet[s.to]+=s.amt;});
          var ptLines=bbbRes.pids.map(function(pid){
            var n=bbbNet[pid];var nStr=n>0?'<span style="color:#4ade80;font-weight:700">+$'+n+'</span>':n<0?'<span style="color:#f87171;font-weight:700">-$'+Math.abs(n)+'</span>':'';
            return pDisplay(pid)+': '+bbbRes.pts[pid]+' pts'+(nStr?' ('+nStr+')':'');
          });
          if(ptLines.length)bbbStr='<div style="font-size:11px;margin-top:4px">'+ptLines.join(' · ')+'</div>';
          else bbbStr='<div style="font-size:10px;margin-top:3px;opacity:.4">No awards yet</div>';
        }
        return`<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Bingo Bango Bongo</span> <span class="muted" style="font-size:11px">$${c.ppt||0}/pt</span>${bbbStr}</div>${sideMatchHtml(rid,g)}`;
      }
      // ── Hammer ──
      if(g.type==='hammer'){
        var hr=computeHammerResult(rid);
        var hc=g.config||{};
        var ht1n=(hc.team1||[]).map(function(p){return pShort(p);}).join('+')||'T1';
        var ht2n=(hc.team2||[]).map(function(p){return pShort(p);}).join('+')||'T2';
        var hppt=hc.ppt||5;
        var holeStates=hc.holes||{};
        var carryCount=Object.values(holeStates).filter(function(h){return h.t1won===null&&h.mult>1;}).length;
        var settledHoles=Object.values(holeStates).filter(function(h){return h.t1won!==null;}).length;
        var liveHole='';
        var r2=T.rounds.find(function(r){return r.id===rid;});
        if(r2){for(var hh=roundToH(rid);hh>=roundFromH(rid);hh--){var hhd=holeStates[hh];if(hhd&&hhd.mult>1&&hhd.t1won===null){liveHole=' · <span style="color:#f97316;font-weight:700">H'+hh+': '+hhd.mult+'× live!</span>';break;}}}
        var netStr='';
        if(hr&&hr.net!==0){var hpayer=hr.net<0?ht1n:ht2n;var hpayee=hr.net<0?ht2n:ht1n;netStr='<div style="margin-top:4px;font-size:12px;font-weight:700;color:#4ade80">💰 '+hpayer+' owe '+hpayee+' $'+Math.abs(hr.net)+'</div>';}
        return`<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Hammer</span><span class="muted" style="font-size:10px;margin-left:4px">${ht1n} vs ${ht2n} · $${hppt}/hole${liveHole}</span><div style="font-size:11px;margin-top:2px;opacity:.6">${settledHoles} holes settled${carryCount>0?' · '+carryCount+' carrying':''}</div>${netStr}</div>${sideMatchHtml(rid,g)}`;
      }
      // ── Snake ──
      if(g.type==='snake'){
        var sr=computeSnakeResult(rid);
        var snakeVal=(g.config.ppt||5);
        if(!sr||!sr.holder){
          return`<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Snake</span><span class="muted" style="font-size:10px;margin-left:4px">$${snakeVal}/snake — No 3-putts yet</span></div>`;
        }
        var logStr=sr.snakeLog.map(function(e){return'H'+e.hole+'→'+e.events.map(function(ev){return ev.name;}).join(',');}).join(' · ');
        var payoutStr=sr.snakeCount>1?'$'+(snakeVal*sr.snakeCount)+' total ('+sr.snakeCount+' snakes × $'+snakeVal+')':'$'+snakeVal;
        return`<div style="margin-bottom:8px">
          <span style="font-weight:700">${icon} Snake</span>
          <span class="muted" style="font-size:10px;margin-left:4px">$${snakeVal}/snake · ${sr.snakeCount} snake${sr.snakeCount!==1?'s':''} so far</span>
          <div style="font-size:11px;margin-top:3px"><span style="color:#f87171;font-weight:700">🐍 ${sr.holderName} holds it</span> · owes ${payoutStr} to each player</div>
          ${logStr?`<div style="font-size:10px;opacity:.5;margin-top:2px">${logStr}</div>`:''}
        </div>`;
      }
      // ── Dots ──
      if(g.type==='dots'){
        var dr=computeDotsResult(rid);
        var dppt=g.config.dotsPpt||g.config.ppt||1;
        if(!dr||!dr.counts.length){return`<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Dots</span><span class="muted" style="font-size:10px;margin-left:4px">$${dppt}/dot · no dots yet</span></div>`;}
        var dotCounts=dr.counts.map(function(e){return e.name+': '+e.dots;}).join(' · ');
        var dotSettle=dr.settlements.filter(function(e){return e.net!==0;}).map(function(e){return e.name+(e.net>0?'<span style="color:#4ade80"> +$'+e.net+'</span>':'<span style="color:#f87171"> -$'+Math.abs(e.net)+'</span>');}).join(' · ');
        return`<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Dots</span><span class="muted" style="font-size:10px;margin-left:4px">$${dppt}/dot</span><div style="font-size:11px;margin-top:3px;opacity:.8">${dotCounts}</div>${dotSettle?'<div style="font-size:11px;margin-top:2px">'+dotSettle+'</div>':''}</div>`;
      }
      // ── Fidget ──
      if(g.type==='fidget'){
        var fr=computeFidgetResult(rid);
        var fppp=g.config.ppp||g.config.ppt||10;
        if(!fr||!fr.pids||!fr.pids.length){return`<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Fidget</span><span class="muted" style="font-size:10px;margin-left:4px">$${fppp}/player · waiting for scores</span></div>`;}
        var fDone=fr.completedHoles>=fr.totalHoles;
        var fWinners=fr.pids.filter(function(p){return fr.hasWon[p];});
        var fLines=fr.pids.map(function(pid){
          var won=fr.hasWon[pid];
          var wIcon=won?'✅':'❌';
          var cost=!won?(fppp*(fr.pids.length-1)):0;
          var nStr=won?'<span style="color:#4ade80">safe</span>':'<span style="color:#f87171;font-weight:700">owes $'+cost+'</span>';
          return wIcon+' '+pDisplay(pid)+': '+nStr;
        });
        var fStatus='';
        if(fDone&&fr.fidgeters.length>0){
          fStatus=fr.fidgeters.map(function(p){return pDisplay(p);}).join(', ')+' fidgeted! Owe $'+fppp+' each to '+fr.fidgeters.length+' × '+(fr.pids.length-1)+' players';
        }else if(fDone){
          fStatus='Everyone won a hole — no fidgets!';
        }
        return`<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Fidget</span><span class="muted" style="font-size:10px;margin-left:4px">$${fppp}/player${!fDone?' · thru '+fr.completedHoles+'/'+fr.totalHoles:''}</span><div style="font-size:11px;margin-top:3px">${fLines.join('<br>')}</div>${fStatus?`<div style="font-size:11px;margin-top:4px;font-weight:600;color:${fr.fidgeters.length>0?'#f87171':'#4ade80'}">${fStatus}</div>`:''}</div>`;
      }
      // ── Hi-Low ──
      if(g.type==='hilow'){
        var hlr=computeHiLow(rid, g);
        if(!hlr)return`<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Hi-Low</span><span class="muted" style="font-size:11px"> · Configure teams to start</span></div>`;
        var hlNet=hlr.net;
        var hlLine=hlNet===0?'All square':(hlNet>0?hlr.t1n:hlr.t2n)+' leads '+hlr.t1pts+'-'+hlr.t2pts;
        var hlTags=(hlr.carry?' · <span style="font-size:9px;opacity:.5">carry</span>':'')+(hlr.birdieBonus?' · <span style="font-size:9px;opacity:.5">birdie 2×</span>':'');
        var hlMoney=hlNet!==0?` · <span style="color:#4ade80;font-weight:700">${hlNet<0?hlr.t1n:hlr.t2n} owe $${Math.abs(hlNet)}</span>`:'';
        return`<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Hi-Low</span><span class="muted" style="font-size:10px;margin-left:4px">${hlr.t1n} vs ${hlr.t2n}${hlTags}</span><div style="font-size:11px;margin-top:2px">${hlLine}${hlMoney}</div></div>${sideMatchHtml(rid,g)}`;
      }
      // ── Sixes ──
      if(g.type==='sixes'){
        var sr2=computeSixes(rid);
        if(!sr2)return`<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Sixes</span><span class="muted" style="font-size:11px"> · Need 4 players</span></div>`;
        // Determine current segment based on activeHole
        var curHole=activeHole.value||1;
        var curSeg=curHole<=6?0:curHole<=12?1:2;
        var segHtml=sr2.segments.map(function(s,si){
          var isCurrent=si===curSeg;
          var border=isCurrent?'border:1px solid rgba(212,175,55,.5);background:rgba(212,175,55,.08)':'border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.03)';
          var wIcon=s.winner==='t1'?'🏆':'';
          var wIcon2=s.winner==='t2'?'🏆':'';
          var tieIcon=s.winner==='tie'?'🤝':'';
          return'<div style="padding:6px 8px;border-radius:8px;font-size:10px;'+border+'">'
            +'<div style="font-weight:700;margin-bottom:3px;color:rgba(212,175,55,.8)">'+s.label+(isCurrent?' ◀':'')+tieIcon+'</div>'
            +'<div style="display:flex;justify-content:space-between;align-items:center">'
            +'<span>'+s.t1n+'</span><span style="font-weight:700">'+s.t1pts+'</span></div>'
            +'<div style="display:flex;justify-content:space-between;align-items:center">'
            +'<span>'+s.t2n+'</span><span style="font-weight:700">'+s.t2pts+'</span></div>'
            +'</div>';
        }).join('');
        var standStr=sr2.lines.map(function(e){return e.name+': <span style="color:'+(e.net>0?'#4ade80':e.net<0?'#f87171':'#d4af37')+';font-weight:700">'+(e.net>0?'+$':e.net<0?'-$':'$')+Math.abs(e.net)+'</span>';}).join(' · ');
        return`<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Sixes</span><span class="muted" style="font-size:10px;margin-left:4px">$${sr2.ppt}/segment</span><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:6px">${segHtml}</div><div style="font-size:11px;margin-top:6px">${standStr}</div></div>${sideMatchHtml(rid,g)}`;
      }
      // ── Scotch 6s ──
      if(g.type==='scotch6s'){
        var s6=computeScotch6s(rid);
        if(!s6)return`<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Scotch 6s</span><span class="muted" style="font-size:11px"> · Need 2v2 teams</span></div>`;
        var s6ScoreLine=s6.t1n+': <span style="font-weight:700">'+s6.t1total+' pts</span> vs '+s6.t2n+': <span style="font-weight:700">'+s6.t2total+' pts</span>';
        var s6StatusColor=s6.diff>0?'#4ade80':s6.diff<0?'#f87171':'#d4af37';
        // Hole-by-hole recent 3 holes summary
        var s6Recent=s6.holes.filter(function(hd){return hd.t1pts!=null;}).slice(-3).map(function(hd){
          var parts=[];
          if(hd.lowBall)parts.push((hd.lowBall==='t1'?'🔵':'🔴')+'LB');
          if(hd.lowTotal)parts.push((hd.lowTotal==='t1'?'🔵':'🔴')+'LT');
          if(hd.prox)parts.push((hd.prox==='t1'?'🔵':'🔴')+'P');
          if(hd.birdie)parts.push(hd.birdie==='both'?'🟡B':(hd.birdie==='t1'?'🔵':'🔴')+'B');
          if(hd.umbrella)parts.push('☂️');
          return'H'+hd.h+(hd.mult>1?' ×'+hd.mult:'')+': '+parts.join(' ');
        }).join(' · ');
        var s6PressInfo=s6.presses.length?' · '+s6.presses.length+' press'+(s6.presses.length>1?'es':''):'';
        var s6MoneyLine='';
        if(s6.diff!==0){
          var s6Amt=Math.abs(s6.diff)*s6.ppt;
          var s6Payer=s6.diff<0?s6.t1n:s6.t2n;
          var s6Payee=s6.diff>0?s6.t1n:s6.t2n;
          s6MoneyLine='<div style="font-size:12px;font-weight:700;margin-top:4px;color:#4ade80">💰 '+s6Payer+' owe '+s6Payee+' $'+s6Amt+'</div>';
        }
        return`<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Scotch 6s</span><span class="muted" style="font-size:10px;margin-left:4px">$${s6.ppt}/pt${s6PressInfo}${s6.played<s6.totalHoles?' · thru '+s6.played:''}</span><div style="font-size:11px;margin-top:3px">${s6ScoreLine}</div><div style="font-size:12px;margin-top:3px;font-weight:700;color:${s6StatusColor}">${s6.status}</div>${s6MoneyLine}<div style="font-size:10px;margin-top:4px;opacity:.7">${s6Recent||''}</div></div>${sideMatchHtml(rid,g)}`;
      }
      // ── 5-3-1 ──
      if(g.type==='fiveThreeOne'){
        var f31=computeFiveThreeOne(rid);
        if(!f31)return`<div style="margin-bottom:6px"><span style="font-weight:700">${icon} 5-3-1</span><span class="muted" style="font-size:11px"> · Need exactly 3 players configured</span></div>`;
        var medals=['🥇','🥈','🥉'];
        var f31standings=f31.lines.map(function(e,i){
          var col=i===0?'#4ade80':i===1?'#d4af37':'#f87171';
          return medals[i]+' <strong>'+e.name+'</strong>: <span style="color:'+col+';font-weight:700">'+e.pts+' pts</span> · $'+(e.pts*f31.ppt);
        }).join(' &nbsp;|&nbsp; ');
        var f31settle=f31.settlements.length?f31.settlements.map(function(s){return'<span style="color:#f87171">'+s.from+' → '+s.to+' $'+s.amt+'</span>';}).join(' · '):'All square';
        return`<div style="margin-bottom:8px"><span style="font-weight:700">${icon} 5-3-1</span><span class="muted" style="font-size:10px;margin-left:4px">$${f31.ppt}/pt${f31.useBlitz?' · blitz on':''}</span><div style="font-size:11px;margin-top:4px">${f31standings}</div><div style="font-size:11px;margin-top:4px;padding-top:4px;border-top:1px solid rgba(255,255,255,.06)">${f31settle}</div></div>${sideMatchHtml(rid,g)}`;
      }
      // ── Stableford ──
      if(g.type==='stableford'){
        var sc=c;
        var sa1=t1.length?t1:[pids[0],pids[1]];
        var sa2=t2.length?t2:[pids[2]||pids[0],pids[3]||pids[1]];
        var sVariant=sc.variant||'standard';
        var sResult=computeStableford(rid,sa1,sa2,sVariant,c);
        var st1n=sa1.map(function(p){return pDisplay(p);}).join('+');
        var st2n=sa2.map(function(p){return pDisplay(p);}).join('+');
        if(!sResult){return`<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Stableford</span><span class="muted" style="font-size:10px;margin-left:4px">${st1n} vs ${st2n} · ${sVariant}</span></div>`;}
        var sScoreLine=sResult.t1n+': <span style="font-weight:700">'+(sResult.t1total)+' pts</span> vs '+sResult.t2n+': <span style="font-weight:700">'+(sResult.t2total)+' pts</span>';
        var sStatusColor=sResult.diff>0?'#4ade80':sResult.diff<0?'#f87171':'#d4af37';
        return`<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Stableford</span><span class="muted" style="font-size:10px;margin-left:4px">${sVariant}${sResult.played<sResult.totalHoles?' · thru '+sResult.played:''}</span><div style="font-size:11px;margin-top:3px">${sScoreLine}</div><div style="font-size:12px;margin-top:3px;font-weight:700;color:${sStatusColor}">${sResult.status}</div></div>${sideMatchHtml(rid,g)}`;
      }
      // ── Team Day ──
      if(g.type==='teamday'){
        var td1=t1.length?t1:pids.slice(0,4);
        var td2=t2.length?t2:pids.slice(4,8);
        var tdResult=computeTeamDay(rid,td1,td2,c.bestNets||2,c.bestGross||1);
        var td1n=td1.map(function(p){return pDisplay(p);}).join('+');
        var td2n=td2.map(function(p){return pDisplay(p);}).join('+');
        var td1short=td1.map(function(p){return pShort(p);}).join('+');
        var td2short=td2.map(function(p){return pShort(p);}).join('+');
        if(!tdResult){return`<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Team Day</span><span class="muted" style="font-size:10px;margin-left:4px">Best ${c.bestNets||2} net + ${c.bestGross||1} gross</span><div style="font-size:11px;margin-top:3px"><span style="color:#60a5fa">${td1short}</span> <span style="opacity:.4">v</span> <span style="color:#f87171">${td2short}</span></div></div>`;}
        var tdScoreLine='<span style="color:#60a5fa;font-weight:700">'+td1short+': '+tdResult.t1agg+'</span> <span style="opacity:.4">v</span> <span style="color:#f87171;font-weight:700">'+td2short+': '+tdResult.t2agg+'</span>';
        var tdWinner=tdResult.diff<0?td1short:tdResult.diff>0?td2short:null;
        var tdStatusColor=tdResult.diff<0?'#4ade80':tdResult.diff>0?'#f87171':'#d4af37';
        var tdStatus=tdResult.diff===0?(tdResult.played>=tdResult.totalHoles?'Tied':'All Square'):(tdWinner+(tdResult.played>=tdResult.totalHoles?' wins by ':' leads by ')+Math.abs(tdResult.diff));
        return`<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Team Day</span><span class="muted" style="font-size:10px;margin-left:4px">Best ${tdResult.nNets} net + ${tdResult.nGross} gross/hole${tdResult.played<tdResult.totalHoles?' · thru '+tdResult.played:''}</span><div style="font-size:11px;margin-top:3px">${tdScoreLine}</div><div style="font-size:12px;margin-top:3px;font-weight:700;color:${tdStatusColor}">${tdStatus} <span class="muted" style="font-size:10px;font-weight:400">(lower wins)</span></div></div>${sideMatchHtml(rid,g)}`;
      }
      // ── Best Ball (Groups) ──
      if(g.type==='bestball'){
        var bbr=computeBestBall(rid,g);
        var bbPpp=g.config.ppp||g.config.ppt||20;
        if(!bbr){return`<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Best Ball</span><span class="muted" style="font-size:10px;margin-left:4px">${(g.config.bestNet||1)} net${(g.config.bestGross||0)>0?' + '+(g.config.bestGross||0)+' gross':''} · $${bbPpp}/pp</span><div style="font-size:11px;margin-top:3px;opacity:.5">Waiting for scores</div></div>`;}
        var bbDone=bbr.played>=bbr.totalHoles;
        var bbColor=bbr.diff<0?'#4ade80':bbr.diff>0?'#f87171':'#d4af37';
        var bbSettlement='';
        if(bbDone&&bbr.diff!==0){
          var bbLoser=bbr.diff>0?bbr.g1short:bbr.g2short;
          var bbWinner=bbr.diff<0?bbr.g1short:bbr.g2short;
          var bbGroupSize=Math.max((bbr.diff>0?bbr.g1:bbr.g2).length,1);
          var bbTotal=bbPpp*bbGroupSize;
          bbSettlement=`<div style="font-size:12px;font-weight:700;margin-top:5px;padding:5px 8px;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.2);border-radius:8px;color:#4ade80">💰 ${bbLoser} each owe $${bbPpp} to ${bbWinner} ($${bbTotal} total)</div>`;
        }
        return`<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Best Ball</span><span class="muted" style="font-size:10px;margin-left:4px">${bbr.nNets} net${bbr.nGross>0?' + '+bbr.nGross+' gross':''} · $${bbPpp}/pp${!bbDone?' · thru '+bbr.played:''}</span><div style="font-size:11px;margin-top:3px"><span style="color:#60a5fa;font-weight:700">G1: ${bbr.t1agg}</span> <span style="opacity:.4">v</span> <span style="color:#f87171;font-weight:700">G2: ${bbr.t2agg}</span></div><div style="font-size:12px;margin-top:3px;font-weight:700;color:${bbColor}">${bbr.status} <span class="muted" style="font-size:10px;font-weight:400">(lower wins)</span></div>${bbSettlement}</div>`;
      }
      return`<div style="margin-bottom:6px"><span style="font-weight:700">${icon} ${name}</span> <span class="muted" style="font-size:11px">In progress</span></div>${sideMatchHtml(rid,g)}`;
    });
    return`<div style="font-size:12px;line-height:1.7">${lines.join('')}</div>`;
    }catch(e){console.error('gameSummaryHtml crash:',e,{rid:rid});return'<div style="color:#f87171;font-size:11px">⚠️ Game display error: '+e.message+'</div>';}
  }
  function gameStakeSummary(g){
    if(g.type==='nassau')return`$${g.config.front}/$${g.config.back}/$${g.config.overall}`;
    if(g.type==='skins')return`$${g.config.ppt}/skin${g.config.skinsMode==='teams'?' (teams)':''}`;
    if(g.type==='junk'){const parts=[];if(g.config.greenie)parts.push(`Greenie $${g.config.greenie}`);if(g.config.sandie)parts.push(`Sandie $${g.config.sandie}`);if(g.config.birdie)parts.push(`Birdie $${g.config.birdie}`);if(g.config.hammer)parts.push(`Eagle $${g.config.hammer}`);return parts.join(' · ')||'$?';}
    if(g.type==='snake')return`$${g.config.ppt}/player`;
    if(g.type==='stableford'){var stMode=g.config.teamMode==='bestball'?' · Best Ball':' · Aggregate';return`${(g.config.variant||'standard')==='modified'?'Modified':(g.config.variant||'standard')==='custom'?'Custom':'Standard'}${stMode}${g.config.ppt?' · $'+g.config.ppt+'/pt':''}`;}
    if(g.type==='teamday')return`Best ${g.config.bestNets||2} net + ${g.config.bestGross||1} gross`;
    if(g.type==='match')return`$${g.config.ppt||0}/match`;
    if(g.type==='wolf'||g.type==='vegas'||g.type==='bbb')return`$${g.config.ppt||0}/pt`;
    if(g.type==='hilow'){var hlFlags=[];if(g.config.carry)hlFlags.push('carry');if(g.config.birdieBonus)hlFlags.push('birdie 2×');return`$${g.config.ppt||0}/pt`+(hlFlags.length?' · '+hlFlags.join(', '):'');}
    if(g.type==='fiveThreeOne')return`$${g.config.ppt||0}/pt`;
    if(g.type==='sixes')return`$${g.config.ppt||0}/segment`;
    if(g.type==='scotch6s')return`$${g.config.ppt||0}/pt`;
    return'—';
  }

  // ── ARCHIVE & SEASON FUNCTIONS ──
  function saveArchive(force){
    if(isDemoMode.value)return; // Never archive demo rounds
    if(!T.id)return;
    // Merge current T into archive — force=true skips the score requirement (saves on creation)
    const hasScores=force||Object.keys(T.scores||{}).some(rid=>Object.keys(T.scores[rid]||{}).length>0);
    if(!hasScores)return;
    // Update or insert current T in archive
    const idx=archivedTournaments.value.findIndex(t=>t.id===T.id);
    const snap=JSON.parse(JSON.stringify({...T,archivedAt:TODAY}));
    if(idx>=0)archivedTournaments.value[idx]=snap;
    else archivedTournaments.value.unshift(snap);
    try{localStorage.setItem('golf_archive',JSON.stringify(archivedTournaments.value));}catch(e){}
  }

  // Global players registry (persistent across rounds)
  const globalPlayers=computed(()=>{
    // Merge: playerProfiles base + unique players seen across all tournaments
    const seen=new Map();
    playerProfiles.value.forEach(p=>{seen.set(p.id,{...p,rounds:0});});
    allHistorySource.value.forEach(t=>{
      t.players.forEach(p=>{
        if(!seen.has(p.id)){seen.set(p.id,{...p,rounds:0});}
        const entry=seen.get(p.id);entry.rounds=(entry.rounds||0)+1;
        // Update ghin if more recent
        if(p.ghin!=null)entry.ghin=p.ghin;
        if(p.name&&!entry.name)entry.name=p.name;
        if(p.short&&!entry.short)entry.short=p.short;
      });
    });
    // Exclude players that were explicitly deleted
    hiddenPlayers.value.forEach(function(hid){seen.delete(hid);});
    return Array.from(seen.values());
  });

  function togglePlayerFavorite(pid){
    const idx=playerFavorites.value.indexOf(pid);
    if(idx>=0)playerFavorites.value.splice(idx,1);
    else playerFavorites.value.push(pid);
    localStorage.setItem('golf_player_favorites',JSON.stringify(playerFavorites.value));
  }
  function toggleLedgerPlayer(pid){
    var idx=ledgerPlayers.value.indexOf(pid);
    if(idx>=0){ledgerPlayers.value.splice(idx,1);}
    else if(ledgerPlayers.value.length<10){ledgerPlayers.value.push(pid);}
    else{toast.value='Max 10 players in ledger';setTimeout(function(){toast.value='';},2000);return;}
    localStorage.setItem('golf_ledger_players',JSON.stringify(ledgerPlayers.value));
  }

  function saveNewPlayer(){
    const name=newPlayerName.value.trim();
    if(!name||name.indexOf(' ')<1){
      toast.value='Enter first and last name';
      setTimeout(function(){toast.value='';},2500);
      return;
    }
    const id='p_'+Date.now();
    const short=name.trim().split(' ')[0];
    const p={id,name,short,ghin:newPlayerGhin.value||0,rounds:0};
    playerProfiles.value.push(p);
    savePlayerProfiles();
    newPlayerName.value='';newPlayerGhin.value=0;addingPlayer.value=false;
    toast.value=short+' added to roster!';setTimeout(()=>toast.value='',2000);
  }

  function updatePlayerField(pid,field,val){
    const p=playerProfiles.value.find(p=>p.id===pid);
    if(p){
      p[field]=val;
      if(field==='name'&&val){
        p.short=val.trim().split(' ')[0];
      }
      savePlayerProfiles();
    }
  }

  // Start editing a player — populate temp fields
  function startEditPlayer(p){
    editingPlayerId.value=p.id;
    editPlayerName.value=p.name||'';
    editPlayerHcp.value=p.ghin||0;
  }

  // Save edited player — validates name, syncs name everywhere, HCP only to roster + current active round
  function saveEditPlayer(pid){
    var name=(editPlayerName.value||'').trim();
    if(!name||name.indexOf(' ')<1){
      toast.value='Enter first and last name';
      setTimeout(function(){toast.value='';},2500);
      return;
    }
    var short=name.split(' ')[0];
    var hcp=editPlayerHcp.value;
    if(isNaN(hcp)||hcp<0)hcp=0;
    if(hcp>54)hcp=54;

    // Update roster (source of truth)
    var p=playerProfiles.value.find(function(x){return x.id===pid;});
    if(p){
      p.name=name;
      p.short=short;
      p.ghin=hcp;
      savePlayerProfiles();
    }

    // Sync NAME to current tournament (so scorecard shows updated name)
    var tp=T.players.find(function(x){return x.id===pid;});
    if(tp){
      tp.name=name;
      tp.short=short;
      // HCP only updates on the active tournament — does NOT rewrite roundHcp history
      tp.ghin=hcp;
      saveData();
    }

    // Sync NAME ONLY to all stored tournaments (not HCP — preserve historical handicaps)
    allTournaments.value.forEach(function(t){
      var pp=t.players.find(function(x){return x.id===pid;});
      if(pp){pp.name=name;pp.short=short;}
    });
    saveTournaments();

    // Sync NAME ONLY to archived tournaments (never touch archived HCP or roundHcp)
    archivedTournaments.value.forEach(function(t){
      var pp=t.players.find(function(x){return x.id===pid;});
      if(pp){pp.name=name;pp.short=short;}
    });
    try{localStorage.setItem('golf_archive',JSON.stringify(archivedTournaments.value));}catch(e){}

    editingPlayerId.value=null;
    toast.value=short+' updated';
    setTimeout(function(){toast.value='';},2000);
  }

  function deleteGlobalPlayer(pid){
    var inCurrent=T.players.some(function(p){return p.id===pid;});
    var inHistory=archivedTournaments.value.some(function(t){return t.players.some(function(p){return p.id===pid;});});
    var msg='Remove this player from your roster?';
    if(inCurrent)msg='This player is in the current round. Remove from roster? (They will remain in existing rounds but won\'t appear in the player picker for new rounds.)';
    else if(inHistory)msg='This player has history data. Remove from roster? (Historical records will be preserved.)';
    if(!confirm(msg))return;
    const idx=playerProfiles.value.findIndex(p=>p.id===pid);
    if(idx>=0){playerProfiles.value.splice(idx,1);savePlayerProfiles();}
    const fidx=playerFavorites.value.indexOf(pid);
    if(fidx>=0){playerFavorites.value.splice(fidx,1);localStorage.setItem('golf_player_favorites',JSON.stringify(playerFavorites.value));}
    // Also remove from active tournament roster
    var ti=T.players.findIndex(function(p){return p.id===pid;});
    if(ti>=0){T.players.splice(ti,1);saveData();}
    // Remove from ledger
    var li=ledgerPlayers.value.indexOf(pid);
    if(li>=0)ledgerPlayers.value.splice(li,1);
    // Hide from global roster (prevents phantom re-discovery from history)
    if(!hiddenPlayers.value.includes(pid)){
      hiddenPlayers.value.push(pid);
      try{localStorage.setItem('golf_hidden_players',JSON.stringify(hiddenPlayers.value));}catch(e){}
    }
    editingPlayerId.value=null;
    toast.value='Player removed';
    setTimeout(function(){toast.value='';},2000);
  }

  // Merge source player into target — rewrites all history references
  function mergePlayer(sourceId,targetId){
    if(sourceId===targetId)return;
    var target=playerProfiles.value.find(function(p){return p.id===targetId;});
    if(!target){toast.value='Target player not found';setTimeout(function(){toast.value='';},2500);return;}
    var source=playerProfiles.value.find(function(p){return p.id===sourceId;});
    var sourceName=source?source.name:sourceId;
    if(!confirm('Merge "'+sourceName+'" into "'+target.name+'"?\n\nAll scores, games, and history for "'+sourceName+'" will be reassigned to "'+target.name+'". "'+sourceName+'" will be removed from the roster.\n\nThis cannot be undone.'))return;

    // Helper: replace sourceId with targetId in an object's keys/arrays
    function replaceInTournament(t){
      // Players array
      var si=t.players.findIndex(function(p){return p.id===sourceId;});
      if(si>=0)t.players.splice(si,1);
      // Scores
      Object.keys(t.scores||{}).forEach(function(rid){
        if(t.scores[rid][sourceId]){
          if(!t.scores[rid][targetId])t.scores[rid][targetId]=t.scores[rid][sourceId];
          delete t.scores[rid][sourceId];
        }
      });
      // Game configs
      Object.keys(t.gameRounds||{}).forEach(function(rid){
        (t.gameRounds[rid]||[]).forEach(function(g){
          var c=g.config||{};
          ['team1','team2','players','wolfTeeOrder','teeOrder'].forEach(function(k){
            if(Array.isArray(c[k])){
              var idx=c[k].indexOf(sourceId);
              if(idx>=0)c[k][idx]=targetId;
            }
          });
          // Sub-matches
          (c.subMatches||[]).forEach(function(m){
            if(m.p1===sourceId)m.p1=targetId;
            if(m.p2===sourceId)m.p2=targetId;
          });
        });
      });
    }

    // Replace in current tournament
    replaceInTournament(T);
    // Replace in all stored tournaments
    allTournaments.value.forEach(replaceInTournament);
    saveTournaments();
    // Replace in archive
    archivedTournaments.value.forEach(replaceInTournament);
    try{localStorage.setItem('golf_archive',JSON.stringify(archivedTournaments.value));}catch(e){}
    // Remove source from roster
    var si2=playerProfiles.value.findIndex(function(p){return p.id===sourceId;});
    if(si2>=0)playerProfiles.value.splice(si2,1);
    savePlayerProfiles();
    // Remove from favorites
    var fi=playerFavorites.value.indexOf(sourceId);
    if(fi>=0){playerFavorites.value.splice(fi,1);localStorage.setItem('golf_player_favorites',JSON.stringify(playerFavorites.value));}
    saveData();
    editingPlayerId.value=null;
    mergeTargetId.value=null;
    toast.value=sourceName+' merged into '+target.name;
    setTimeout(function(){toast.value='';},3000);
  }

  function savePlayerProfiles(){
    try{localStorage.setItem('golf_players',JSON.stringify(playerProfiles.value));}catch(e){}
  }

  // Merge player fromId INTO keepId — rewrites all history, removes fromId from roster
  function mergePlayer(keepId,fromId){
    if(keepId===fromId)return;
    var keepP=playerProfiles.value.find(function(p){return p.id===keepId;});
    if(!keepP){toast.value='Keep player not found';setTimeout(function(){toast.value='';},2500);return;}
    var fromP=playerProfiles.value.find(function(p){return p.id===fromId;});
    if(!confirm('Merge "'+(fromP?fromP.name:fromId)+'" into "'+keepP.name+'"?\n\nAll scores, games, and history from "'+(fromP?fromP.name:fromId)+'" will be reassigned to "'+keepP.name+'".\n\nThis cannot be undone.'))return;

    // Helper: rewrite a player ID in a tournament object
    function rewriteTournament(t){
      // Players array
      var keepExists=t.players.some(function(p){return p.id===keepId;});
      t.players=t.players.filter(function(p){return p.id!==fromId||!keepExists;});
      t.players.forEach(function(p){if(p.id===fromId){p.id=keepId;p.name=keepP.name;p.short=keepP.name.trim().split(' ')[0];}});
      // Scores
      Object.keys(t.scores||{}).forEach(function(rid){
        if(t.scores[rid]&&t.scores[rid][fromId]){
          if(!t.scores[rid][keepId])t.scores[rid][keepId]=t.scores[rid][fromId];
          delete t.scores[rid][fromId];
        }
      });
      // Game rounds — rewrite team1/team2/players arrays
      Object.keys(t.gameRounds||{}).forEach(function(rid){
        (t.gameRounds[rid]||[]).forEach(function(g){
          var c=g.config||{};
          ['team1','team2','players','wolfTeeOrder','teeOrder'].forEach(function(k){
            if(c[k]&&Array.isArray(c[k])){
              c[k]=c[k].map(function(pid){return pid===fromId?keepId:pid;});
              // Deduplicate
              c[k]=c[k].filter(function(pid,i,arr){return arr.indexOf(pid)===i;});
            }
          });
          if(c.subMatches){c.subMatches.forEach(function(m){if(m.p1===fromId)m.p1=keepId;if(m.p2===fromId)m.p2=keepId;});}
        });
      });
    }

    // Rewrite active tournament
    rewriteTournament(T);
    saveData();
    // Rewrite all stored tournaments
    allTournaments.value.forEach(function(t){rewriteTournament(t);});
    saveTournaments();
    // Rewrite archives
    archivedTournaments.value.forEach(function(t){rewriteTournament(t);});
    try{localStorage.setItem('golf_archive',JSON.stringify(archivedTournaments.value));}catch(e){}
    // Remove fromId from roster
    var idx=playerProfiles.value.findIndex(function(p){return p.id===fromId;});
    if(idx>=0)playerProfiles.value.splice(idx,1);
    savePlayerProfiles();
    // Clean favorites
    var fidx=playerFavorites.value.indexOf(fromId);
    if(fidx>=0){playerFavorites.value.splice(fidx,1);localStorage.setItem('golf_player_favorites',JSON.stringify(playerFavorites.value));}
    editingPlayerId.value=null;
    toast.value='Players merged!';setTimeout(function(){toast.value='';},2500);
  }

  function nassauMatchSegForT(t,rid,team1,team2,fromH,toH,pressAt,betAmt,gameConfig){
    const r=t.rounds.find(r=>r.id===rid);if(!r)return null;
    const ntc=gameConfig||{};
    const ntUseNet=ntc.netGross!=='gross';
    const ntHcpPct=(ntc.hcpPercent||100)/100;
    const minPHt=ntc.minPressHoles||1;
    const pvPctT=(ntc.pressValuePct??100)/100;
    const pressAmtT=Math.round(betAmt*pvPctT*100)/100;
    const getScoreT=(rid,pid,h)=>t.scores?.[rid]?.[pid]?.[h]||null;
    const pRoundHcpT=(pid,rid)=>{const p=t.players.find(p=>p.id===pid);return p?.roundHcp?.[rid]??Math.round(p?.ghin||0);};
    const allPids=team1.concat(team2);
    const teamBest=(team,h)=>{
      // Compute low-man differential: first find min HCP across all players
      var minHcp=Infinity;
      allPids.forEach(function(p2){var h2=pRoundHcpT(p2,rid);if(h2<minHcp)minHcp=h2;});
      const nets=team.map(pid=>{const g=getScoreT(rid,pid,h);if(g==null)return null;var rawHcp=pRoundHcpT(pid,rid);var adjHcp=Math.max(0,rawHcp-(minHcp===Infinity?0:minHcp));return ntUseNet?g-strokesOnHole(Math.round(adjHcp*ntHcpPct),holeSI(r.course,h)):g;}).filter(x=>x!==null);
      return nets.length?Math.min(...nets):null;
    };
    const bets=[{startH:fromH,score:0,pressed:false,amt:betAmt}];
    let lastH=fromH-1;
    for(let h=fromH;h<=toH;h++){
      const b1=teamBest(team1,h),b2=teamBest(team2,h);
      if(b1===null||b2===null)continue;
      lastH=h;const rem=toH-h;
      const hRes=b1<b2?1:b2<b1?-1:0;
      const newPresses=[];
      for(const bet of bets){
        if(h>=bet.startH)bet.score+=hRes;
        // Standard: each bet fires exactly ONE press at pressAt threshold
        if(!bet.pressed&&pressAt>0&&rem>=minPHt&&Math.abs(bet.score)>=pressAt){
          bet.pressed=true;
          newPresses.push({startH:h+1,score:0,pressed:false,amt:pressAmtT});
        }
      }
      bets.push(...newPresses);
    }
    if(lastH<fromH)return null;
    const remH=toH-lastH;const allDone=remH===0;
    let owed=0;
    bets.forEach(bet=>{if(allDone||Math.abs(bet.score)>remH){if(bet.score>0)owed+=bet.amt;else if(bet.score<0)owed-=bet.amt;}});
    return{owed,score:bets[0].score};
  }

  // Look up full tournament+round data from allHistorySource by history key (tId_rId)
  function getHistRoundData(key){
    const lastR=key.lastIndexOf('_r');if(lastR<0)return null;
    const tId=key.substring(0,lastR);
    const rId=parseInt(key.substring(lastR+2));
    const t=allHistorySource.value.find(t=>t.id===tId);if(!t)return null;
    const r=t.rounds.find(r=>r.id===rId);
    return r?{t,r}:null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // ── computeRoundGameResult — HISTORY SETTLEMENT DISPLAY ──
  // IMPORTANT: When adding a new game type to the app, you MUST add
  // a corresponding block here so history displays results.
  // ── GAME TYPE CHECKLIST ──
  //   ✅ nassau     ✅ snake      ✅ dots       ✅ hammer
  //   ✅ skins      ✅ vegas      ✅ match      ✅ wolf
  //   ✅ stableford ✅ sixes      ✅ hilow      ✅ fiveThreeOne
  //   ✅ teamday    ⬜ bbb (not yet implemented)
  //   🔄 catch-all fallback for unknown types
  // ═══════════════════════════════════════════════════════════════════
  function computeRoundGameResult(t,rid){
    var games=t.gameRounds?.[rid]||[];
    if(!games.length)return null;
    var pids=t.players.map(function(p){return p.id;});
    var results=[];
    var handledTypes={nassau:1,snake:1,dots:1,hammer:1,skins:1,vegas:1,match:1,wolf:1,stableford:1,sixes:1,scotch6s:1,hilow:1,fiveThreeOne:1,teamday:1,bbb:1,fidget:1,bestball:1};
    games.forEach(function(g){
      var c=g.config||{};
      var t1=(c.team1||[]).length?c.team1:[pids[0]||''];
      var t2=(c.team2||[]).length?c.team2:[pids[1]||''];
      // Nassau
      if(g.type==='nassau'){
        var r=t.rounds.find(function(r2){return r2.id===rid;});var nc=r?holeCount(r.course):18;
        var pa=c.pressAt??2,fAmt=c.front??10,bAmt=c.back??10,ovAmt=c.overall??20;
        var hm=r?.holesMode||'18';
        var fD=hm!=='back9'?nassauMatchSegForT(t,rid,t1,t2,1,Math.min(9,nc),pa,fAmt,c):null;
        var bD=hm!=='front9'&&nc>9?nassauMatchSegForT(t,rid,t1,t2,10,nc,pa,bAmt,c):null;
        var ovD=hm==='18'&&nc>9?nassauMatchSegForT(t,rid,t1,t2,1,nc,0,ovAmt,c):null;
        var netOwed=(fD?.owed??0)+(bD?.owed??0)+(ovD?.owed??0);
        var t1n=t1.map(function(p){return t.players.find(function(pl){return pl.id===p;})?.short||p;}).join('+');
        var t2n=t2.map(function(p){return t.players.find(function(pl){return pl.id===p;})?.short||p;}).join('+');
        var nassauParts=[];
        if(fD){nassauParts.push('F: '+(fD.score===0?'AS':(fD.score>0?t1n:t2n)+' '+Math.abs(fD.score)+'up'));}
        if(bD){nassauParts.push('B: '+(bD.score===0?'AS':(bD.score>0?t1n:t2n)+' '+Math.abs(bD.score)+'up'));}
        if(ovD){nassauParts.push('O: '+(ovD.score===0?'AS':(ovD.score>0?t1n:t2n)+' '+Math.abs(ovD.score)+'up'));}
        if(netOwed!==0){
          var payer=netOwed<0?t1n:t2n;var payee=netOwed<0?t2n:t1n;
          nassauParts.push(payer+' owe '+payee+' $'+Math.abs(netOwed));
        }else if(nassauParts.length){
          nassauParts.push('Square');
        }
        if(nassauParts.length)results.push('Nassau: '+nassauParts.join(' · '));
      }
      // Snake — use events array (new) or holders (legacy)
      if(g.type==='snake'){
        var events=c.events||[];
        var snakeCount=events.length;
        if(!snakeCount){var holders=c.holders||{};snakeCount=Object.keys(holders).length;}
        // Inline snake holder from game config (avoids reading from T)
        var snakeHolder=null;
        if(events.length)snakeHolder=events[events.length-1].pid;
        else{var shKeys=Object.keys(c.holders||{}).map(Number).sort(function(a,b){return b-a;});if(shKeys.length)snakeHolder=(c.holders||{})[shKeys[0]];}
        if(snakeHolder&&snakeCount>0){
          var ppt=c.ppt||5;
          var holderName=t.players.find(function(p){return p.id===snakeHolder;})?.short||snakeHolder;
          var othersCount=(pids.length-1);
          results.push('Snake: '+holderName+' owed $'+(ppt*snakeCount)+' to each ('+snakeCount+' snakes × $'+ppt+')');
        }
      }
      // Dots (pairwise ladder settlement)
      if(g.type==='dots'){
        var entries=c.entries||{};
        var dppt=c.dotsPpt||c.ppt||1;
        var dotCounts={};
        pids.forEach(function(p){dotCounts[p]=0;});
        // Manual dots
        Object.keys(entries).forEach(function(pid){
          var pidE=entries[pid]||{};
          Object.keys(pidE).forEach(function(h){
            (pidE[h]||[]).forEach(function(dt){if(DOTS_DEFS[dt]&&!DOTS_DEFS[dt].auto)dotCounts[pid]=(dotCounts[pid]||0)+1;});
          });
        });
        // Auto dots from scores
        var r=t.rounds.find(function(r){return r.id===rid;});
        if(r){
          pids.forEach(function(pid){
            var p=t.players.find(function(pl){return pl.id===pid;});
            var hcp=p?.roundHcp?.[rid]??Math.round(p?.ghin||0);
            for(var hh=1;hh<=holeCount(r.course);hh++){
              var sc=t.scores?.[rid]?.[pid]?.[hh];
              if(!sc)continue;
              var net=sc-strokesOnHole(hcp,holeSI(r.course,hh));
              var par=holePar(r.course,hh);
              if(net-par<=-2)dotCounts[pid]=(dotCounts[pid]||0)+3;
              else if(net-par===-1)dotCounts[pid]=(dotCounts[pid]||0)+1;
            }
          });
        }
        // Pairwise settlement
        var dotSorted=pids.map(function(p){return{pid:p,dots:dotCounts[p]||0};}).sort(function(a,b){return b.dots-a.dots;});
        var dotLines=[];
        for(var di=0;di<dotSorted.length;di++){
          for(var dj=di+1;dj<dotSorted.length;dj++){
            var ddiff=dotSorted[di].dots-dotSorted[dj].dots;
            if(ddiff>0){
              var fromN=t.players.find(function(p){return p.id===dotSorted[dj].pid;})?.short||dotSorted[dj].pid;
              var toN=t.players.find(function(p){return p.id===dotSorted[di].pid;})?.short||dotSorted[di].pid;
              dotLines.push(fromN+' → '+toN+': $'+(ddiff*dppt));
            }
          }
        }
        if(dotLines.length){
          results.push('Dots ($'+dppt+'/dot): '+dotLines.join(', '));
        }else if(dotSorted.length&&dotSorted[0].dots>0){
          results.push('Dots: All square');
        }
      }
      // Hammer
      if(g.type==='hammer'){
        var holes=c.holes||{};
        var hppt=c.ppt||5;
        var ht1total=0,ht2total=0,carry=1;
        var allHoles=Object.keys(holes).map(Number).sort(function(a,b){return a-b;});
        allHoles.forEach(function(h){
          var hd=holes[h];var eff=hd.mult*carry;var amt=hppt*eff;
          if(hd.t1won===true){ht1total+=amt;carry=1;}
          else if(hd.t1won===false){ht2total+=amt;carry=1;}
          else{carry=eff;}
        });
        var hnet=ht1total-ht2total;
        if(hnet!==0){
          var ht1n=t1.map(function(p){return t.players.find(function(pl){return pl.id===p;})?.short||p;}).join('+');
          var ht2n=t2.map(function(p){return t.players.find(function(pl){return pl.id===p;})?.short||p;}).join('+');
          var hpayer=hnet<0?ht1n:ht2n;var hpayee=hnet<0?ht2n:ht1n;
          results.push('Hammer: '+hpayer+' owe '+hpayee+' $'+Math.abs(hnet));
        }
      }
      // Skins
      if(g.type==='skins'){
        var skPids=(c.players||[]).length?c.players:pids;
        var skPpt=c.ppt||5;
        var skUseNet=c.netGross!=='gross';
        var skHcpPct=(c.hcpPercent||80)/100;
        var skCarryover=c.carryover!==false;
        var skPayoutModel=c.skinsPayout||'pot';
        var skNumP=skPids.length;
        var skSkinVal=skPayoutModel==='perPlayer'?skPpt*(skNumP-1):skPpt*skNumP;
        var skGetScore=function(pid,h){return t.scores?.[rid]?.[pid]?.[h]||null;};
        var skRound=t.rounds.find(function(r2){return r2.id===rid;});
        if(skRound){
          var skFrom=(skRound.holesMode==='back9')?10:1;
          var skTo=(skRound.holesMode==='front9')?Math.min(9,holeCount(skRound.course)):holeCount(skRound.course);
          var skTotals={};var skCarry=0;var skPlayed=0;
          skPids.forEach(function(p){skTotals[p]={skins:0,won:0,paid:0};});
          for(var sh=skFrom;sh<=skTo;sh++){
            var allScored=skPids.every(function(p){return skGetScore(p,sh)!=null;});
            if(!allScored)continue;
            skPlayed++;
            var scores=skPids.map(function(p){
              var raw=skGetScore(p,sh);
              if(skUseNet){
                var pl=t.players.find(function(x){return x.id===p;});
                var hcp=pl?.roundHcp?.[rid]??Math.round(pl?.ghin||0);
                return{pid:p,score:raw-strokesOnHole(Math.round(hcp*skHcpPct),holeSI(skRound.course,sh))};
              }
              return{pid:p,score:raw};
            });
            var minSc=Math.min.apply(null,scores.map(function(x){return x.score;}));
            var winners=scores.filter(function(x){return x.score===minSc;});
            if(winners.length===1){
              var skCount=1+(skCarryover?skCarry:0);
              var skWinner=winners[0].pid;
              skTotals[skWinner].skins+=skCount;
              skTotals[skWinner].won+=skCount*skSkinVal;
              if(skPayoutModel==='pot'){
                skPids.forEach(function(p){skTotals[p].paid+=skCount*skPpt;});
              }else{
                skPids.forEach(function(p){if(p!==skWinner)skTotals[p].paid+=skCount*skPpt;});
              }
              skCarry=0;
            }else{skCarry++;}
          }
          // Build settlement lines
          skPids.forEach(function(p){skTotals[p].net=skTotals[p].won-skTotals[p].paid;});
          var skDebtors=skPids.filter(function(p){return skTotals[p].net<0;}).sort(function(a,b){return skTotals[a].net-skTotals[b].net;});
          var skCreditors=skPids.filter(function(p){return skTotals[p].net>0;}).sort(function(a,b){return skTotals[b].net-skTotals[a].net;});
          var skLines=[];
          var skDBals={};var skCBals={};
          skDebtors.forEach(function(p){skDBals[p]=-skTotals[p].net;});
          skCreditors.forEach(function(p){skCBals[p]=skTotals[p].net;});
          var sdi=0,sci=0;
          while(sdi<skDebtors.length&&sci<skCreditors.length){
            var sa=Math.min(skDBals[skDebtors[sdi]],skCBals[skCreditors[sci]]);
            if(sa>0){
              var fromN=t.players.find(function(p){return p.id===skDebtors[sdi];})?.short||skDebtors[sdi];
              var toN=t.players.find(function(p){return p.id===skCreditors[sci];})?.short||skCreditors[sci];
              skLines.push(fromN+' → '+toN+': $'+sa);
            }
            skDBals[skDebtors[sdi]]-=sa;
            skCBals[skCreditors[sci]]-=sa;
            if(skDBals[skDebtors[sdi]]<=0)sdi++;
            if(skCBals[skCreditors[sci]]<=0)sci++;
          }
          if(skLines.length){
            results.push('Skins ($'+skPpt+'/skin): '+skLines.join(', '));
          }else{
            var totalSkinsWon=skPids.reduce(function(s,p){return s+skTotals[p].skins;},0);
            if(totalSkinsWon>0)results.push('Skins: All square');
            else if(skPlayed>0)results.push('Skins: No skins won');
          }
          if(skCarry>0)results.push(skCarry+' unclaimed skin'+(skCarry>1?'s':''));
        }
      }
      // Vegas
      if(g.type==='vegas'){
        var variant=c.vegasVariant||'standard';
        var va1=t1.length?t1:[pids[0],pids[1]];
        var va2=t2.length?t2:[pids[2]||pids[0],pids[3]||pids[1]];
        var vCalc=computeVegasVariantFull(rid,va1,va2,variant,g,t);
        if(vCalc&&vCalc.cumDiff!==0){
          var vPpt=c.ppt||1;
          var vAmt=Math.abs(vCalc.cumDiff)*vPpt;
          var vt1n=va1.map(function(p){return t.players.find(function(pl){return pl.id===p;})?.short||p;}).join('+');
          var vt2n=va2.map(function(p){return t.players.find(function(pl){return pl.id===p;})?.short||p;}).join('+');
          var vPayer=vCalc.cumDiff>0?vt2n:vt1n;var vPayee=vCalc.cumDiff>0?vt1n:vt2n;
          results.push('Vegas: '+vPayer+' owe '+vPayee+' $'+vAmt);
        }
      }
      // Match play
      if(g.type==='match'){
        var mRound=t.rounds.find(function(r2){return r2.id===rid;});
        if(mRound){
          var mt1=t1.length?t1:[pids[0]];var mt2=t2.length?t2:[pids[1]];
          var mUseNet2=c.netGross!=='gross';var mHcpPct2=(c.hcpPercent||100)/100;
          var mScore=0;var mLastH=0;
          var mNc=holeCount(mRound.course);
          for(var mh=1;mh<=mNc;mh++){
            var mBest1=null,mBest2=null;
            mt1.forEach(function(pid){
              var sc=t.scores?.[rid]?.[pid]?.[mh];if(sc==null)return;
              var pl=t.players.find(function(x){return x.id===pid;});
              var hcp=pl?.roundHcp?.[rid]??Math.round(pl?.ghin||0);
              var net=mUseNet2?sc-strokesOnHole(Math.round(hcp*mHcpPct2),holeSI(mRound.course,mh)):sc;
              if(mBest1===null||net<mBest1)mBest1=net;
            });
            mt2.forEach(function(pid){
              var sc=t.scores?.[rid]?.[pid]?.[mh];if(sc==null)return;
              var pl=t.players.find(function(x){return x.id===pid;});
              var hcp=pl?.roundHcp?.[rid]??Math.round(pl?.ghin||0);
              var net=mUseNet2?sc-strokesOnHole(Math.round(hcp*mHcpPct2),holeSI(mRound.course,mh)):sc;
              if(mBest2===null||net<mBest2)mBest2=net;
            });
            if(mBest1!==null&&mBest2!==null){
              if(mBest1<mBest2)mScore++;else if(mBest2<mBest1)mScore--;
              mLastH=mh;
            }
          }
          if(mLastH>0){
            var mt1n=mt1.map(function(p){return t.players.find(function(pl){return pl.id===p;})?.short||p;}).join('+');
            var mt2n=mt2.map(function(p){return t.players.find(function(pl){return pl.id===p;})?.short||p;}).join('+');
            var rem=mNc-mLastH;
            if(mScore===0)results.push('Match: All Square');
            else{
              var leader=mScore>0?mt1n:mt2n;var trail=mScore>0?mt2n:mt1n;
              var up=Math.abs(mScore);
              if(rem===0){results.push('Match: '+leader+' wins '+up+' up');}
              else if(up>rem){results.push('Match: '+leader+' wins '+up+'&'+(up-rem));}
              else{results.push('Match: '+leader+' '+up+' UP ('+rem+' to play)');}
            }
          }
        }
      }
      // Wolf
      if(g.type==='wolf'){
        var wr=computeWolfResult(rid,t);
        if(wr&&wr.lines&&wr.lines.length){
          var wPpt=c.ppt||1;
          var wLines=wr.lines.filter(function(e){return e.dollars!==0;}).map(function(e){
            return(t.players.find(function(p){return p.id===e.pid;})?.short||e.name)+': '+(e.dollars>0?'+':'-')+'$'+Math.abs(e.dollars);
          });
          if(wLines.length)results.push('Wolf ($'+wPpt+'/pt): '+wLines.join(', '));
        }
      }
      // Stableford
      if(g.type==='stableford'){
        var stRound=t.rounds.find(function(r2){return r2.id===rid;});
        if(stRound){
          var st1=t1.length?t1:[pids[0],pids[1]];var st2=t2.length?t2:[pids[2]||pids[0],pids[3]||pids[1]];
          var stRes=computeStableford(rid,st1,st2,c.variant||'standard',c,t);
          if(stRes&&stRes.net!==0){
            var st1n=st1.map(function(p){return t.players.find(function(pl){return pl.id===p;})?.short||p;}).join('+');
            var st2n=st2.map(function(p){return t.players.find(function(pl){return pl.id===p;})?.short||p;}).join('+');
            var stPayer=stRes.net<0?st1n:st2n;var stPayee=stRes.net<0?st2n:st1n;
            results.push('Stableford: '+stPayer+' owe '+stPayee+' $'+Math.abs(stRes.net));
          }
        }
      }
      // Sixes
      if(g.type==='sixes'){
        var sxRes=computeSixes(rid,t);
        if(sxRes&&sxRes.lines){
          var sxLines=sxRes.lines.filter(function(e){return e.net!==0;}).map(function(e){
            return e.name+': '+(e.net>0?'+':'-')+'$'+Math.abs(e.net);
          });
          if(sxLines.length)results.push('Sixes ($'+sxRes.ppt+'/seg): '+sxLines.join(', '));
        }
      }
      // Scotch 6s
      if(g.type==='scotch6s'){
        var s6Res=computeScotch6s(rid,t);
        if(s6Res&&s6Res.diff!==0){
          var s6Ppt=c.ppt||1;
          var s6Amt=Math.abs(s6Res.diff)*s6Ppt;
          var s6t1n=s6Res.t1n;var s6t2n=s6Res.t2n;
          var s6Payer=s6Res.diff<0?s6t1n:s6t2n;var s6Payee=s6Res.diff>0?s6t1n:s6t2n;
          results.push('Scotch 6s ($'+s6Ppt+'/pt): '+s6Payer+' owe '+s6Payee+' $'+s6Amt+' ('+s6Res.t1total+'-'+s6Res.t2total+')');
        }else if(s6Res){
          results.push('Scotch 6s: All square ('+s6Res.t1total+'-'+s6Res.t2total+')');
        }
      }
      // Hi-Low (3 pts/hole: low ball, high ball, aggregate)
      if(g.type==='hilow'){
        var hlT1=c.team1||[],hlT2=c.team2||[];
        if(hlT1.length&&hlT2.length){
          var hlUseNet2=c.netGross!=='gross';var hlHcpPct2=(c.hcpPercent||100)/100;
          var hlRound=t.rounds.find(function(r2){return r2.id===rid;});
          if(hlRound){
            var hlPpt=c.ppt||1;var hlT1pts=0,hlT2pts=0;
            var hlCarry=!!c.carry;var hlBB=!!c.birdieBonus;
            var hlCL=0,hlCH=0,hlCA=0;
            for(var hlH=1;hlH<=holeCount(hlRound.course);hlH++){
              var hlT1nets=hlT1.map(function(pid){var sc=t.scores?.[rid]?.[pid]?.[hlH];if(sc==null)return null;var pl=t.players.find(function(x){return x.id===pid;});var hcp=pl?.roundHcp?.[rid]??Math.round(pl?.ghin||0);return hlUseNet2?sc-strokesOnHole(Math.round(hcp*hlHcpPct2),holeSI(hlRound.course,hlH)):sc;}).filter(function(x){return x!==null;});
              var hlT2nets=hlT2.map(function(pid){var sc=t.scores?.[rid]?.[pid]?.[hlH];if(sc==null)return null;var pl=t.players.find(function(x){return x.id===pid;});var hcp=pl?.roundHcp?.[rid]??Math.round(pl?.ghin||0);return hlUseNet2?sc-strokesOnHole(Math.round(hcp*hlHcpPct2),holeSI(hlRound.course,hlH)):sc;}).filter(function(x){return x!==null;});
              if(!hlT1nets.length||!hlT2nets.length)continue;
              var hlT1low=Math.min.apply(null,hlT1nets),hlT1high=Math.max.apply(null,hlT1nets);
              var hlT2low=Math.min.apply(null,hlT2nets),hlT2high=Math.max.apply(null,hlT2nets);
              var hlT1agg=hlT1nets.reduce(function(a,b){return a+b;},0);
              var hlT2agg=hlT2nets.reduce(function(a,b){return a+b;},0);
              var hlLW=hlT1low<hlT2low?1:hlT2low<hlT1low?2:0;
              var hlHW=hlT1high<hlT2high?1:hlT2high<hlT1high?2:0;
              var hlAW=hlT1agg<hlT2agg?1:hlT2agg<hlT1agg?2:0;
              var hlMult=1;
              if(hlBB){var hlPar=holePar(hlRound.course,hlH);var hlHasBird=false;hlT1.concat(hlT2).forEach(function(pid){var sc=t.scores?.[rid]?.[pid]?.[hlH];if(sc!=null&&sc<hlPar)hlHasBird=true;});if(hlHasBird)hlMult=2;}
              var hlLP=(1+hlCL)*hlPpt*hlMult;var hlHP=(1+hlCH)*hlPpt*hlMult;var hlAP=(1+hlCA)*hlPpt*hlMult;
              if(hlLW===1)hlT1pts+=hlLP;else if(hlLW===2)hlT2pts+=hlLP;
              if(hlHW===1)hlT1pts+=hlHP;else if(hlHW===2)hlT2pts+=hlHP;
              if(hlAW===1)hlT1pts+=hlAP;else if(hlAW===2)hlT2pts+=hlAP;
              if(hlCarry){hlCL=hlLW===0?hlCL+1:0;hlCH=hlHW===0?hlCH+1:0;hlCA=hlAW===0?hlCA+1:0;}
            }
            var hlNet=hlT1pts-hlT2pts;
            if(hlNet!==0){
              var hlT1n=hlT1.map(function(p){return t.players.find(function(pl){return pl.id===p;})?.short||p;}).join('+');
              var hlT2n=hlT2.map(function(p){return t.players.find(function(pl){return pl.id===p;})?.short||p;}).join('+');
              var hlPayer=hlNet<0?hlT1n:hlT2n;var hlPayee=hlNet<0?hlT2n:hlT1n;
              results.push('Hi-Low: '+hlPayer+' owe '+hlPayee+' $'+Math.abs(hlNet));
            }
          }
        }
      }
      // 5-3-1
      if(g.type==='fiveThreeOne'){
        var f31Pids=c.players||pids.slice(0,3);
        if(f31Pids.length>=3){
          var f31Round=t.rounds.find(function(r2){return r2.id===rid;});
          if(f31Round){
            var f31UseNet=c.netGross!=='gross';var f31HcpPct=(c.hcpPercent||100)/100;
            var f31Ppt=c.ppt||1;var f31UseBlitz=c.blitz!==false;
            var f31Totals={};f31Pids.forEach(function(p){f31Totals[p]=0;});
            for(var f31H=1;f31H<=holeCount(f31Round.course);f31H++){
              var f31Scores=f31Pids.map(function(pid){
                var sc=t.scores?.[rid]?.[pid]?.[f31H];if(sc==null)return null;
                var pl=t.players.find(function(x){return x.id===pid;});
                var hcp=pl?.roundHcp?.[rid]??Math.round(pl?.ghin||0);
                return{pid:pid,score:f31UseNet?sc-strokesOnHole(Math.round(hcp*f31HcpPct),holeSI(f31Round.course,f31H)):sc};
              }).filter(function(x){return x!==null;});
              if(f31Scores.length<3)continue;
              f31Scores.sort(function(a,b){return a.score-b.score;});
              if(f31UseBlitz&&f31Scores[0].score<=f31Scores[1].score-2){
                f31Totals[f31Scores[0].pid]+=9;
              }else if(f31Scores[0].score===f31Scores[1].score&&f31Scores[1].score===f31Scores[2].score){
                f31Pids.forEach(function(p){f31Totals[p]+=3;});
              }else if(f31Scores[0].score===f31Scores[1].score){
                f31Totals[f31Scores[0].pid]+=4;f31Totals[f31Scores[1].pid]+=4;f31Totals[f31Scores[2].pid]+=1;
              }else if(f31Scores[1].score===f31Scores[2].score){
                f31Totals[f31Scores[0].pid]+=5;f31Totals[f31Scores[1].pid]+=2;f31Totals[f31Scores[2].pid]+=2;
              }else{
                f31Totals[f31Scores[0].pid]+=5;f31Totals[f31Scores[1].pid]+=3;f31Totals[f31Scores[2].pid]+=1;
              }
            }
            var f31Lines=f31Pids.map(function(p){
              return(t.players.find(function(pl){return pl.id===p;})?.short||p)+': '+f31Totals[p]+' pts ($'+(f31Totals[p]*f31Ppt)+')';
            });
            results.push('5-3-1 ($'+f31Ppt+'/pt): '+f31Lines.join(', '));
          }
        }
      }
      // Team Day
      if(g.type==='teamday'){
        var tdT1=t1.length>=2?t1:pids.slice(0,4);
        var tdT2=t2.length>=2?t2:pids.slice(4,8);
        var tdRound=t.rounds.find(function(r2){return r2.id===rid;});
        if(tdRound&&tdT1.length&&tdT2.length){
          var tdBN=c.bestNets||2,tdBG=c.bestGross||1;
          var tdT1agg=0,tdT2agg=0;
          for(var tdH=1;tdH<=holeCount(tdRound.course);tdH++){
            var tdT1scores=tdT1.map(function(pid){
              var sc=t.scores?.[rid]?.[pid]?.[tdH];if(sc==null)return null;
              var pl=t.players.find(function(x){return x.id===pid;});
              var hcp=pl?.roundHcp?.[rid]??Math.round(pl?.ghin||0);
              var net=sc-strokesOnHole(hcp,holeSI(tdRound.course,tdH));
              return{gross:sc,net:net};
            }).filter(function(x){return x!==null;});
            var tdT2scores=tdT2.map(function(pid){
              var sc=t.scores?.[rid]?.[pid]?.[tdH];if(sc==null)return null;
              var pl=t.players.find(function(x){return x.id===pid;});
              var hcp=pl?.roundHcp?.[rid]??Math.round(pl?.ghin||0);
              var net=sc-strokesOnHole(hcp,holeSI(tdRound.course,tdH));
              return{gross:sc,net:net};
            }).filter(function(x){return x!==null;});
            if(!tdT1scores.length||!tdT2scores.length)continue;
            tdT1scores.sort(function(a,b){return a.net-b.net;});tdT2scores.sort(function(a,b){return a.net-b.net;});
            var tdT1nets=tdT1scores.slice(0,tdBN).reduce(function(s,e){return s+e.net;},0);
            var tdT2nets=tdT2scores.slice(0,tdBN).reduce(function(s,e){return s+e.net;},0);
            tdT1scores.sort(function(a,b){return a.gross-b.gross;});tdT2scores.sort(function(a,b){return a.gross-b.gross;});
            var tdT1gross=tdT1scores.slice(0,tdBG).reduce(function(s,e){return s+e.gross;},0);
            var tdT2gross=tdT2scores.slice(0,tdBG).reduce(function(s,e){return s+e.gross;},0);
            tdT1agg+=(tdT1nets+tdT1gross);tdT2agg+=(tdT2nets+tdT2gross);
          }
          var tdDiff=tdT1agg-tdT2agg;
          var tdT1n=tdT1.map(function(p){return t.players.find(function(pl){return pl.id===p;})?.short||p;}).join('+');
          var tdT2n=tdT2.map(function(p){return t.players.find(function(pl){return pl.id===p;})?.short||p;}).join('+');
          if(tdDiff!==0){
            results.push('Team Day: '+(tdDiff<0?tdT1n:tdT2n)+' win by '+Math.abs(tdDiff)+' strokes');
          }else{
            results.push('Team Day: All square');
          }
        }
      }
      // BBB — Bingo Bango Bongo
      if(g.type==='bbb'){
        var bbbRes=computeBbbResult(rid,t);
        if(bbbRes&&bbbRes.settlements&&bbbRes.settlements.length){
          var bbbLines=bbbRes.settlements.filter(function(e){return e.amt>0;}).map(function(e){return e.fromName+' → '+e.toName+': $'+e.amt;});
          if(bbbLines.length)results.push('BBB: '+bbbLines.join(' · '));
          else results.push('BBB: All square');
        }else{
          results.push('BBB: Game recorded');
        }
      }
      // Fidget
      if(g.type==='fidget'){
        var fRes=computeFidgetResult(rid,t);
        if(fRes&&fRes.pids){
          var fPpp3=c.ppp||c.ppt||10;
          var fDone3=fRes.completedHoles>=fRes.totalHoles;
          if(fDone3){
            if(fRes.fidgeters.length>0){
              var fNames=fRes.fidgeters.map(function(p){var pl=t.players.find(function(x){return x.id===p;});return pl?.short||p;});
              results.push('Fidget ($'+fPpp3+'/player): '+fNames.join(', ')+' fidgeted — owe $'+fPpp3+' each');
            }else{
              results.push('Fidget: All safe — everyone won a hole');
            }
          }else{
            results.push('Fidget: In progress ('+fRes.completedHoles+'/'+fRes.totalHoles+' holes)');
          }
        }else{
          results.push('Fidget: Game recorded');
        }
      }
      // Best Ball (Groups)
      if(g.type==='bestball'){
        var bbr2=computeBestBall(rid,g);
        if(bbr2){
          var bbPpp2=c.ppp||c.ppt||20;
          var bbDone2=bbr2.played>=bbr2.totalHoles;
          if(bbDone2){
            var bbLine='Best Ball: '+bbr2.g1short+' '+bbr2.t1agg+' v '+bbr2.g2short+' '+bbr2.t2agg;
            if(bbr2.diff!==0){
              var bbLoser2=bbr2.diff>0?bbr2.g1short:bbr2.g2short;
              var bbWinner2=bbr2.diff<0?bbr2.g1short:bbr2.g2short;
              bbLine+=' · '+bbLoser2+' owe '+bbWinner2+' $'+bbPpp2+'/pp';
            }else{bbLine+=' · Tied';}
            results.push(bbLine);
          }
        }
      }
      // ── Catch-all for unhandled game types ──
      if(!handledTypes[g.type]){
        results.push(g.type+': Game recorded (results pending)');
      }
    });
    return results.join(' · ')||null;
  }

  // Sub-match helpers for gc
  function gcAddSubMatch(){
    var pids=T.players.map(function(p){return p.id;});
    gc.subMatches.push({p1:pids[0]||'',p2:pids[1]||'',ppt:5});
  }
  function gcRemoveSubMatch(i){gc.subMatches.splice(i,1);}



  // ══════════════════════════════════════════════════
  // ── SNAKE GAME ──
  // ══════════════════════════════════════════════════
  function getSnakeHolder(rid){
    var g=(T.gameRounds[rid]||[]).find(function(x){return x.type==='snake';});
    if(!g)return null;
    // Use events array (new) or fall back to holders (legacy)
    var events=g.config.events||[];
    if(events.length)return events[events.length-1].pid;
    var holders=g.config.holders||{};
    var keys=Object.keys(holders).map(Number).sort(function(a,b){return b-a;});
    return keys.length?holders[keys[0]]:null;
  }

  function addSnakeEvent(rid, hole, pid){
    var g=(T.gameRounds[rid]||[]).find(function(x){return x.type==='snake';});
    if(!g)return;
    if(!g.config.events)g.config.events=[];
    g.config.events.push({hole:hole,pid:pid,ts:Date.now()});
    saveData();
  }

  function undoLastSnake(rid){
    var g=(T.gameRounds[rid]||[]).find(function(x){return x.type==='snake';});
    if(!g||!g.config.events||!g.config.events.length)return;
    g.config.events.pop();
    saveData();
    toast.value='Snake removed';
    setTimeout(function(){toast.value='';},1500);
  }

  function getSnakeCountOnHole(rid, hole){
    var g=(T.gameRounds[rid]||[]).find(function(x){return x.type==='snake';});
    if(!g)return 0;
    var events=g.config.events||[];
    return events.filter(function(e){return e.hole===hole;}).length;
  }
  function setSnakeHolder(rid,hole,pid){
    var games=T.gameRounds[rid]||[];
    var g=games.find(function(x){return x.type==='snake';});
    if(!g)return;
    if(!g.config.holders)g.config.holders={};
    if(pid===null){delete g.config.holders[hole];}
    else{g.config.holders[hole]=pid;}
    saveData();
  }
  function computeSnakeResult(rid){
    var g=(T.gameRounds[rid]||[]).find(function(x){return x.type==='snake';});
    if(!g)return null;
    var holder=getSnakeHolder(rid);
    var pids=roundPlayers(rid);
    var ppt=g.config.ppt||5;
    // Use events array for accurate count
    var events=g.config.events||[];
    var snakeCount=events.length;
    // Legacy fallback
    if(!snakeCount){
      var holders=g.config.holders||{};
      snakeCount=Object.keys(holders).length;
    }
    // Per-player snake count
    var perPlayer={};
    pids.forEach(function(p){perPlayer[p]=0;});
    events.forEach(function(e){if(perPlayer[e.pid]!==undefined)perPlayer[e.pid]++;});
    // Payout: holder owes snakeCount * ppt to EACH other player
    var totalPerPlayer=ppt*snakeCount;
    var holderName=holder?(getP(holder)?getP(holder).short||holder:holder):null;
    var others=holder?pids.filter(function(p){return p!==holder;}):pids;
    var othersNames=others.map(function(p){return pDisplay(p);}).join(', ');
    // Snake log grouped by hole
    var byHole={};
    events.forEach(function(e){
      if(!byHole[e.hole])byHole[e.hole]=[];
      byHole[e.hole].push({pid:e.pid,name:getP(e.pid)?getP(e.pid).short||e.pid:e.pid});
    });
    var snakeLog=Object.keys(byHole).map(Number).sort(function(a,b){return a-b;}).map(function(h){
      return{hole:h,events:byHole[h],count:byHole[h].length};
    });
    return{
      holder:holder,holderName:holderName,others:others,othersNames:othersNames,
      ppt:ppt,snakeCount:snakeCount,totalPerPlayer:totalPerPlayer,
      total:others.length*totalPerPlayer,snakeLog:snakeLog,perPlayer:perPlayer
    };
  }

  // ══════════════════════════════════════════════════
  // ── DOTS / TRASH GAME ──
  // ══════════════════════════════════════════════════
  function setDot(rid,pid,hole,dotType,on){
    var games=T.gameRounds[rid]||[];
    var g=games.find(function(x){return x.type==='dots';});
    if(!g)return;
    if(!g.config.entries)g.config.entries={};
    if(!g.config.entries[pid])g.config.entries[pid]={};
    var hkey=String(hole);
    if(!g.config.entries[pid][hkey])g.config.entries[pid][hkey]=[];
    var arr=g.config.entries[pid][hkey];
    var idx=arr.indexOf(dotType);
    if(on&&idx<0)arr.push(dotType);
    else if(!on&&idx>=0)arr.splice(idx,1);
    saveData();
  }
  function getDot(rid,pid,hole,dotType){
    var g=(T.gameRounds[rid]||[]).find(function(x){return x.type==='dots';});
    if(!g||!g.config.entries)return false;
    var hkey=String(hole);
    var arr=((g.config.entries[pid]||{})[hkey])||[];
    return arr.indexOf(dotType)>=0;
  }
  function playerDotCount(rid,pid){
    var g=(T.gameRounds[rid]||[]).find(function(x){return x.type==='dots';});
    if(!g)return 0;
    var r=T.rounds.find(function(r){return r.id===rid;});
    if(!r)return 0;
    var total=0;
    var entries=g.config.entries||{};
    var pidEntries=entries[pid]||{};
    Object.keys(pidEntries).forEach(function(h){
      (pidEntries[h]||[]).forEach(function(dt){
        if(DOTS_DEFS[dt]&&!DOTS_DEFS[dt].auto)total+=1;
      });
    });
    var dPids=roundPlayers(rid);
    var hcp=gameAdjHcp(pid,rid,dPids);
    roundHoles(rid).forEach(function(h){
      var sc=getScore(rid,pid,h);
      if(!sc)return;
      var net=sc-strokesOnHole(hcp,holeSI(r.course,h));
      var par=holePar(r.course,h);
      var diff=net-par;
      if(diff<=-2)total+=3;
      else if(diff===-1)total+=1;
    });
    return total;
  }
  function computeDotsResult(rid){
    var g=(T.gameRounds[rid]||[]).find(function(x){return x.type==='dots';});
    if(!g)return null;
    var pids=roundPlayers(rid);
    var ppt=g.config.dotsPpt||g.config.ppt||1;
    var counts=pids.map(function(pid){
      return{pid:pid,name:getP(pid)?getP(pid).short||pid:pid,dots:playerDotCount(rid,pid)};
    });
    counts.sort(function(a,b){return b.dots-a.dots;});
    // Pairwise ladder settlement: each pair settles the difference
    var netMap={};
    counts.forEach(function(e){netMap[e.pid]=0;});
    var settlements=[];
    for(var i=0;i<counts.length;i++){
      for(var j=i+1;j<counts.length;j++){
        var diff=counts[i].dots-counts[j].dots;
        if(diff>0){
          var amt=diff*ppt;
          netMap[counts[i].pid]+=amt;
          netMap[counts[j].pid]-=amt;
          settlements.push({from:counts[j].name,to:counts[i].name,amount:amt});
        }
      }
    }
    var lines=counts.map(function(e){return{pid:e.pid,name:e.name,dots:e.dots,net:netMap[e.pid]};});
    return{counts:counts,settlements:settlements,lines:lines,ppt:ppt};
  }

  // ══════════════════════════════════════════════════
  // ── HAMMER GAME ──
  // ══════════════════════════════════════════════════
  // Returns auto-computed hammer winner for a hole based on scores (1=t1, 2=t2, 0=tie, null=no scores)
  function hammerAutoWinner(rid,hole){
    var g=(T.gameRounds[rid]||[]).find(function(x){return x.type==='hammer';});
    if(!g)return null;
    var r=T.rounds.find(function(r){return r.id===rid;});if(!r)return null;
    var c=g.config||{};
    var hUseNet=c.netGross!=='gross';var hHcpPct=(c.hcpPercent||100)/100;
    var t1=c.team1||[],t2=c.team2||[];
    if(!t1.length||!t2.length)return null;
    var t1nets=t1.map(function(p){var sc=getScore(rid,p,hole);return sc!=null?(hUseNet?sc-strokesOnHole(Math.round(pRoundHcp(p,rid)*hHcpPct),holeSI(r.course,hole)):sc):null;}).filter(function(x){return x!==null;});
    var t2nets=t2.map(function(p){var sc=getScore(rid,p,hole);return sc!=null?(hUseNet?sc-strokesOnHole(Math.round(pRoundHcp(p,rid)*hHcpPct),holeSI(r.course,hole)):sc):null;}).filter(function(x){return x!==null;});
    if(!t1nets.length||!t2nets.length)return null;
    var b1=Math.min.apply(null,t1nets),b2=Math.min.apply(null,t2nets);
    return b1<b2?1:b2<b1?2:0;
  }

  // ══════════════════════════════════════════════════
  // ── BINGO BANGO BONGO (BBB) ──
  // ══════════════════════════════════════════════════
  // Data: g.config.awards = { "1": { bingo:"pid", bango:"pid", bongo:"pid" }, ... }
  // 3 points per hole: bingo=first on green, bango=closest to pin, bongo=first to hole out
  // ── Scotch 6s award/press helpers ──
  function s6Award(rid,hole,awardType,team){
    var g=(T.gameRounds[rid]||[]).find(function(x){return x.type==='scotch6s';});
    if(!g)return;
    if(!g.config.awards)g.config.awards={};
    var hkey=String(hole);
    if(!g.config.awards[hkey])g.config.awards[hkey]={};
    // Toggle: if same value, remove
    if(g.config.awards[hkey][awardType]===team){delete g.config.awards[hkey][awardType];}
    else{g.config.awards[hkey][awardType]=team;}
    saveData();
  }
  window.s6Award=s6Award;

  function s6Press(rid,hole,team){
    var g=(T.gameRounds[rid]||[]).find(function(x){return x.type==='scotch6s';});
    if(!g)return;
    if(!g.config.presses)g.config.presses=[];
    // Check if already pressed at this hole by this team
    var exists=g.config.presses.find(function(p){return p.hole===hole&&p.team===team;});
    if(exists){
      // Undo press
      g.config.presses=g.config.presses.filter(function(p){return !(p.hole===hole&&p.team===team);});
    }else{
      g.config.presses.push({hole:hole,team:team});
    }
    saveData();
  }
  window.s6Press=s6Press;

  function s6Roll(rid,hole,mult){
    var g=(T.gameRounds[rid]||[]).find(function(x){return x.type==='scotch6s';});
    if(!g)return;
    if(!g.config.rolls)g.config.rolls={};
    var key=String(hole);
    // Toggle: if same mult, remove; otherwise set
    if(g.config.rolls[key]===mult){delete g.config.rolls[key];}
    else{g.config.rolls[key]=mult;}
    saveData();
  }
  window.s6Roll=s6Roll;

  function getS6Award(rid,hole,awardType){
    var g=(T.gameRounds[rid]||[]).find(function(x){return x.type==='scotch6s';});
    if(!g||!g.config.awards)return null;
    var hAwards=g.config.awards[String(hole)]||{};
    return hAwards[awardType]||null;
  }

  function getS6Roll(rid,hole){
    var g=(T.gameRounds[rid]||[]).find(function(x){return x.type==='scotch6s';});
    if(!g||!g.config.rolls)return 0;
    return g.config.rolls[String(hole)]||0;
  }

  function s6HasPress(rid,hole,team){
    var g=(T.gameRounds[rid]||[]).find(function(x){return x.type==='scotch6s';});
    if(!g||!g.config.presses)return false;
    return g.config.presses.some(function(p){return p.hole===hole&&p.team===team;});
  }

  function s6TeamName(rid,teamNum){
    var g=(T.gameRounds[rid]||[]).find(function(x){return x.type==='scotch6s';});
    if(!g)return 'T'+teamNum;
    var pids=teamNum===1?(g.config.team1||[]):(g.config.team2||[]);
    return pids.map(function(p){return pShort(p);}).join('+')||('T'+teamNum);
  }

  function s6AutoResult(rid,hole,category){
    var res=computeScotch6s(rid);
    if(!res)return null;
    var hd=res.holes.find(function(h){return h.h===hole;});
    if(!hd)return null;
    return hd[category]||null;
  }

  function s6HoleStatus(rid,hole){
    var res=computeScotch6s(rid);
    if(!res)return '';
    var hd=res.holes.find(function(h){return h.h===hole;});
    if(!hd||hd.t1pts==null)return 'No scores yet';
    var parts=[];
    if(hd.t1pts>0)parts.push(s6TeamName(rid,1)+' '+hd.t1pts);
    if(hd.t2pts>0)parts.push(s6TeamName(rid,2)+' '+hd.t2pts);
    if(hd.mult>1)parts.push(hd.mult+'× press');
    return parts.join(' · ')||'Tied 0-0';
  }

  function s6BirdieAutoNote(rid,hole){
    var g=(T.gameRounds[rid]||[]).find(function(x){return x.type==='scotch6s';});
    if(!g)return '';
    var birdieMode=g.config.birdieMode||'gross';
    return birdieMode==='gross'?'(gross)':'(net)';
  }

  function s6IsUmbrella(rid,hole){
    var res=computeScotch6s(rid);
    if(!res)return false;
    var hd=res.holes.find(function(h){return h.h===hole;});
    return hd&&hd.umbrella;
  }

  function setBbbAward(rid,hole,awardType,pid){
    var g=(T.gameRounds[rid]||[]).find(function(x){return x.type==='bbb';});
    if(!g)return;
    if(!g.config.awards)g.config.awards={};
    var hkey=String(hole);
    if(!g.config.awards[hkey])g.config.awards[hkey]={};
    // Toggle: if same player already has it, remove; otherwise set
    if(g.config.awards[hkey][awardType]===pid){delete g.config.awards[hkey][awardType];}
    else{g.config.awards[hkey][awardType]=pid;}
    saveData();
  }
  function getBbbAward(rid,hole,awardType){
    var g=(T.gameRounds[rid]||[]).find(function(x){return x.type==='bbb';});
    if(!g||!g.config.awards)return null;
    return(g.config.awards[String(hole)]||{})[awardType]||null;
  }
  function bbbPlayerPoints(rid,pid,tData){
    var tSrc=tData||T;
    var g=(tSrc.gameRounds?.[rid]||[]).find(function(x){return x.type==='bbb';});
    if(!g||!g.config.awards)return 0;
    var awards=g.config.awards;var pts=0;
    Object.keys(awards).forEach(function(hkey){
      var h=awards[hkey];
      if(h.bingo===pid)pts++;
      if(h.bango===pid)pts++;
      if(h.bongo===pid)pts++;
    });
    return pts;
  }
  function computeBbbResult(rid,tData){
    var tSrc=tData||T;
    var g=(tSrc.gameRounds?.[rid]||[]).find(function(x){return x.type==='bbb';});
    if(!g)return null;
    var c=g.config||{};
    var awards=c.awards||{};
    var ppt=c.ppt||1;
    var pids=c.players?.length?c.players:(tSrc===T?roundPlayers(rid):[]);
    // Tally points per player
    var pts={};
    pids.forEach(function(p){pts[p]=0;});
    Object.keys(awards).forEach(function(hkey){
      var h=awards[hkey];
      if(h.bingo&&pts[h.bingo]!==undefined)pts[h.bingo]++;
      if(h.bango&&pts[h.bango]!==undefined)pts[h.bango]++;
      if(h.bongo&&pts[h.bongo]!==undefined)pts[h.bongo]++;
    });
    // Pairwise settlement (same model as dots)
    var settlements=[];
    for(var i=0;i<pids.length;i++){
      for(var j=i+1;j<pids.length;j++){
        var diff=pts[pids[i]]-pts[pids[j]];
        if(diff!==0){
          var winner=diff>0?pids[i]:pids[j];
          var loser=diff>0?pids[j]:pids[i];
          settlements.push({from:loser,to:winner,amt:Math.abs(diff)*ppt,
            fromName:pDisplay(loser),toName:pDisplay(winner),diff:Math.abs(diff)});
        }
      }
    }
    return{pts:pts,ppt:ppt,pids:pids,settlements:settlements,awards:awards};
  }

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
  function computeFullSettlement(rid){
    var games=T.gameRounds[rid]||[];
    var r=T.rounds.find(function(r){return r.id===rid;});
    if(!r||!games.length)return null;
    var pids=roundPlayers(rid);
    var nc=holeCount(r.course);
    var net={};
    pids.forEach(function(p){net[p]=0;});
    var gameLines=[];

    games.forEach(function(g){
      var c=g.config||{};
      var t1=c.team1||[];
      var t2=c.team2||[];
      var gname=GAME_DEFS[g.type]?GAME_DEFS[g.type].name:g.type;

      if(g.type==='nassau'){
        var a1=t1.length?t1:[pids[0]||''];
        var a2=t2.length?t2:[pids[1]||''];
        var pa=c.pressAt!=null?c.pressAt:2;
        var fAmt=c.front!=null?c.front:10;
        var bAmt=c.back!=null?c.back:10;
        var ovAmt=c.overall!=null?c.overall:20;
        var hm=r.holesMode||'18';
        var fD=hm!=='back9'?nassauMatchSeg(rid,a1,a2,1,Math.min(9,nc),pa,fAmt,c):null;
        var bD=(hm!=='front9'&&nc>9)?nassauMatchSeg(rid,a1,a2,10,nc,pa,bAmt,c):null;
        var ovD=(hm==='18'&&nc>9)?nassauMatchSeg(rid,a1,a2,1,nc,0,ovAmt,c):null;
        var total=(fD?fD.owed:0)+(bD?bD.owed:0)+(ovD?ovD.owed:0);
        if(total!==0){
          var winners=total>0?a1:a2;
          var losers=total>0?a2:a1;
          var amt=Math.abs(total);
          winners.forEach(function(p){if(net[p]!=null)net[p]+=amt;});
          losers.forEach(function(p){if(net[p]!=null)net[p]-=amt;});
          var wn=winners.map(function(p){return pDisplay(p);}).join('+');
          var ln=losers.map(function(p){return pDisplay(p);}).join('+');
          gameLines.push({game:gname,line:ln+' owe '+wn+' $'+amt,owed:amt});
        }else{
          gameLines.push({game:gname,line:'All square',owed:0});
        }
        var nassauUseNet=c.netGross!=='gross';var nassauHcpPct=(c.hcpPercent||100)/100;
        (c.subMatches||[]).forEach(function(m){
          if(!m.p1||!m.p2)return;
          var score=0,played=0;
          for(var h=1;h<=nc;h++){
            var s1=getScore(rid,m.p1,h),s2=getScore(rid,m.p2,h);
            if(!s1||!s2)continue;
            var n1=nassauUseNet?s1-strokesOnHole(Math.round(pRoundHcp(m.p1,rid)*nassauHcpPct),holeSI(r.course,h)):s1;
            var n2=nassauUseNet?s2-strokesOnHole(Math.round(pRoundHcp(m.p2,rid)*nassauHcpPct),holeSI(r.course,h)):s2;
            if(n1<n2)score++;else if(n2<n1)score--;
            played++;
          }
          var rem=nc-played;
          if(played>0&&(Math.abs(score)>rem||rem===0)&&score!==0){
            var winner=score>0?m.p1:m.p2;
            var loser=score>0?m.p2:m.p1;
            var mppt=m.ppt||5;
            if(net[winner]!=null)net[winner]+=mppt;
            if(net[loser]!=null)net[loser]-=mppt;
            var wname=getP(winner)?getP(winner).short||winner:winner;
            var lname=getP(loser)?getP(loser).short||loser:loser;
            var p1n=getP(m.p1)?getP(m.p1).short||m.p1:m.p1;
            var p2n=getP(m.p2)?getP(m.p2).short||m.p2:m.p2;
            gameLines.push({game:'1v1: '+p1n+' vs '+p2n,line:lname+' owe '+wname+' $'+mppt,owed:mppt});
          }
        });
      }

      if(g.type==='match'){
        var matchUseNet=c.netGross!=='gross';var matchHcpPct=(c.hcpPercent||100)/100;
        var a1m=t1.length?t1:[pids[0]];
        var a2m=t2.length?t2:[pids[1]];
        var mscore=0,mplayed=0;
        for(var h=1;h<=nc;h++){
          var mb1=Math.min.apply(null,a1m.map(function(p){
            var gs=getScore(rid,p,h);
            return gs!=null?(matchUseNet?gs-strokesOnHole(Math.round(pRoundHcp(p,rid)*matchHcpPct),holeSI(r.course,h)):gs):Infinity;
          }));
          var mb2=Math.min.apply(null,a2m.map(function(p){
            var gs=getScore(rid,p,h);
            return gs!=null?(matchUseNet?gs-strokesOnHole(Math.round(pRoundHcp(p,rid)*matchHcpPct),holeSI(r.course,h)):gs):Infinity;
          }));
          if(mb1===Infinity||mb2===Infinity)continue;
          if(mb1<mb2)mscore++;else if(mb2<mb1)mscore--;
          mplayed++;
        }
        var mrem=nc-mplayed;
        var mppt=c.ppt||20;
        if(mplayed>0&&(Math.abs(mscore)>mrem||mrem===0)&&mscore!==0){
          var mwins=mscore>0?a1m:a2m;
          var mloss=mscore>0?a2m:a1m;
          mwins.forEach(function(p){if(net[p]!=null)net[p]+=mppt;});
          mloss.forEach(function(p){if(net[p]!=null)net[p]-=mppt;});
          var mwn=mwins.map(function(p){return pDisplay(p);}).join('+');
          var mln=mloss.map(function(p){return pDisplay(p);}).join('+');
          gameLines.push({game:gname,line:mln+' owe '+mwn+' $'+mppt,owed:mppt});
        }else{
          var mstatus=a1m.length>1||a2m.length>1?computeMatchTeam(rid,a1m,a2m,c):computeMatch(rid,a1m[0],a2m[0],c);
          gameLines.push({game:gname,line:mstatus,owed:0});
        }
        (c.subMatches||[]).forEach(function(m){
          if(!m.p1||!m.p2)return;
          var score=0,played=0;
          for(var h=1;h<=nc;h++){
            var s1=getScore(rid,m.p1,h),s2=getScore(rid,m.p2,h);
            if(!s1||!s2)continue;
            var n1=matchUseNet?s1-strokesOnHole(Math.round(pRoundHcp(m.p1,rid)*matchHcpPct),holeSI(r.course,h)):s1;
            var n2=matchUseNet?s2-strokesOnHole(Math.round(pRoundHcp(m.p2,rid)*matchHcpPct),holeSI(r.course,h)):s2;
            if(n1<n2)score++;else if(n2<n1)score--;
            played++;
          }
          var rem=nc-played;
          if(played>0&&(Math.abs(score)>rem||rem===0)&&score!==0){
            var winner=score>0?m.p1:m.p2;
            var loser=score>0?m.p2:m.p1;
            var mppt2=m.ppt||5;
            if(net[winner]!=null)net[winner]+=mppt2;
            if(net[loser]!=null)net[loser]-=mppt2;
            var wname=getP(winner)?getP(winner).short||winner:winner;
            var lname=getP(loser)?getP(loser).short||loser:loser;
            var p1n=getP(m.p1)?getP(m.p1).short||m.p1:m.p1;
            var p2n=getP(m.p2)?getP(m.p2).short||m.p2:m.p2;
            gameLines.push({game:'1v1 side: '+p1n+' vs '+p2n,line:lname+' owe '+wname+' $'+mppt2,owed:mppt2});
          }
        });
      }

      if(g.type==='vegas'){
        var va1=t1.length?t1:[pids[0],pids[1]];
        var va2=t2.length?t2:[pids[2]||pids[0],pids[3]||pids[1]];
        if(va1.length&&va2.length){
          var vholes=computeVegasHoles(rid,va1,va2,g);
          var lastV=vholes.filter(function(h){return h.cumDiff!=null;});
          var vDiff=lastV.length?lastV[lastV.length-1].cumDiff:0;
          var vppt=c.ppt||1;
          var vAmt=Math.abs(vDiff)*vppt;
          if(vDiff!==0){
            var vwins=vDiff>0?va1:va2;
            var vloss=vDiff>0?va2:va1;
            vwins.forEach(function(p){if(net[p]!=null)net[p]+=vAmt;});
            vloss.forEach(function(p){if(net[p]!=null)net[p]-=vAmt;});
            var vwn=vwins.map(function(p){return pDisplay(p);}).join('+');
            var vln=vloss.map(function(p){return pDisplay(p);}).join('+');
            gameLines.push({game:gname,line:vln+' owe '+vwn+' $'+vAmt+' ('+Math.abs(vDiff)+'pts)',owed:vAmt});
          }else{
            gameLines.push({game:gname,line:'All square',owed:0});
          }
        }
      }

      if(g.type==='hammer'){
        var hr=computeHammerResult(rid);
        if(hr&&hr.net!==0){
          var hwins=hr.net>0?t1:t2;
          var hloss=hr.net>0?t2:t1;
          var hamt=Math.abs(hr.net);
          hwins.forEach(function(p){if(net[p]!=null)net[p]+=hamt;});
          hloss.forEach(function(p){if(net[p]!=null)net[p]-=hamt;});
          var hwn=hwins.map(function(p){return pDisplay(p);}).join('+');
          var hln=hloss.map(function(p){return pDisplay(p);}).join('+');
          gameLines.push({game:gname,line:hln+' owe '+hwn+' $'+hamt,owed:hamt});
        }else if(hr){
          gameLines.push({game:gname,line:'All square',owed:0});
        }
      }

      if(g.type==='snake'){
        var sr=computeSnakeResult(rid);
        if(sr&&sr.holder){
          sr.others.forEach(function(p){if(net[p]!=null)net[p]+=sr.totalPerPlayer;});
          if(net[sr.holder]!=null)net[sr.holder]-=(sr.totalPerPlayer*sr.others.length);
          gameLines.push({game:gname,line:sr.holderName+' owe each $'+sr.totalPerPlayer+' (total $'+sr.total+')',owed:sr.total});
        }
      }

      if(g.type==='dots'){
        var dr=computeDotsResult(rid);
        if(dr&&dr.settlements){
          dr.settlements.forEach(function(e){if(net[e.pid]!=null)net[e.pid]+=e.net;});
          var dlines=dr.settlements.filter(function(e){return e.net!==0;}).map(function(e){
            return e.name+(e.net>0?' +$'+e.net:' -$'+Math.abs(e.net));
          });
          gameLines.push({game:gname+' ('+dr.max+' dots max, $'+dr.ppt+'/dot)',line:dlines.join(' · ')||'No dots yet',owed:0});
        }
      }

      if(g.type==='bbb'){
        var bbbRes=computeBbbResult(rid);
        if(bbbRes){
          bbbRes.settlements.forEach(function(s){
            if(net[s.from]!=null)net[s.from]-=s.amt;
            if(net[s.to]!=null)net[s.to]+=s.amt;
          });
          var bbbStandingsLine=bbbRes.pids.map(function(pid){return pDisplay(pid)+': '+bbbRes.pts[pid];}).join(' · ')||'No points yet';
          var bbbSettleLines=bbbRes.settlements.filter(function(e){return e.amt>0;}).map(function(e){return e.fromName+' → '+e.toName+': $'+e.amt;});
          gameLines.push({game:gname+' ($'+(c.ppt||0)+'/pt)',line:bbbStandingsLine+(bbbSettleLines.length?' · '+bbbSettleLines.join(' · '):''),owed:0});
        }
      }

      if(g.type==='fidget'){
        var fRes2=computeFidgetResult(rid);
        if(fRes2){
          fRes2.settlements.forEach(function(s){
            if(net[s.from]!=null)net[s.from]-=s.amt;
            if(net[s.to]!=null)net[s.to]+=s.amt;
          });
          var fPpp2=c.ppp||c.ppt||10;
          var fStatusLine=fRes2.pids.map(function(pid){return pDisplay(pid)+': '+(fRes2.hasWon[pid]?'safe':'FIDGET');}).join(' · ');
          var fSettleLines=fRes2.settlements.filter(function(e){return e.amt>0;}).map(function(e){return e.fromName+' → '+e.toName+': $'+e.amt;});
          gameLines.push({game:gname+' ($'+fPpp2+'/player)',line:fStatusLine+(fSettleLines.length?' · '+fSettleLines.join(' · '):''),owed:0});
        }
      }

      if(g.type==='stableford'){
        var sa1=t1.length?t1:[pids[0],pids[1]];
        var sa2=t2.length?t2:[pids[2]||pids[0],pids[3]||pids[1]];
        var sRes=computeStableford(rid,sa1,sa2,c.variant||'standard',c);
        if(sRes){
          var sppt=c.ppt||0;
          if(sppt>0&&sRes.diff!==0){
            var swins=sRes.diff>0?sa1:sa2;
            var sloss=sRes.diff>0?sa2:sa1;
            var sAmt=Math.abs(sRes.diff)*sppt;
            swins.forEach(function(p){if(net[p]!=null)net[p]+=sAmt;});
            sloss.forEach(function(p){if(net[p]!=null)net[p]-=sAmt;});
            var swn=swins.map(function(p){return pDisplay(p);}).join('+');
            var sln=sloss.map(function(p){return pDisplay(p);}).join('+');
            gameLines.push({game:gname,line:sln+' owe '+swn+' $'+sAmt,owed:sAmt});
          }else{
            gameLines.push({game:gname,line:sRes.status,owed:0});
          }
        }
      }

      if(g.type==='scotch6s'){
        var s6r=computeScotch6s(rid);
        if(s6r){
          var s6ppt=c.ppt||1;
          if(s6r.diff!==0){
            var s6wins=s6r.diff>0?t1:t2;
            var s6loss=s6r.diff>0?t2:t1;
            var s6amt=Math.abs(s6r.diff)*s6ppt;
            s6wins.forEach(function(p){if(net[p]!=null)net[p]+=s6amt;});
            s6loss.forEach(function(p){if(net[p]!=null)net[p]-=s6amt;});
            var s6wn=s6wins.map(function(p){return pDisplay(p);}).join('+');
            var s6ln=s6loss.map(function(p){return pDisplay(p);}).join('+');
            gameLines.push({game:gname,line:s6ln+' owe '+s6wn+' $'+s6amt+' ('+s6r.t1total+'-'+s6r.t2total+')',owed:s6amt});
          }else{
            gameLines.push({game:gname,line:'All square ('+s6r.t1total+'-'+s6r.t2total+')',owed:0});
          }
        }
      }

      if(g.type==='teamday'){
        var tda1=t1.length?t1:pids.slice(0,4);
        var tda2=t2.length?t2:pids.slice(4,8);
        var tdRes=computeTeamDay(rid,tda1,tda2,c.bestNets||2,c.bestGross||1);
        if(tdRes){
          gameLines.push({game:gname,line:tdRes.status+' ('+tdRes.t1agg+' vs '+tdRes.t2agg+')',owed:0});
        }
      }
    });

    var netArr=pids.map(function(p){
      return{pid:p,name:pDisplay(p),net:net[p]||0};
    });
    return{gameLines:gameLines,netArr:netArr};
  }



  // ══════════════════════════════════════════════════
  // ── PLAYER SEARCH (wizard) ──
  // Searches globalPlayers by first name, last name, or partial match
  // ══════════════════════════════════════════════════
  function wizSearchPlayers(query){
    wizPlayerSearch.value=query;
    if(!query||query.length<1){wizPlayerSuggestions.value=[];return;}
    var q=query.trim().toLowerCase();
    // Filter globalPlayers not already in wiz.players
    var already=new Set(wiz.players.map(function(p){return p.id;}));
    var matches=globalPlayers.value.filter(function(p){
      if(already.has(p.id))return false;
      var full=(p.name||'').toLowerCase();
      var parts=full.split(' ');
      // Match: start of full name, start of last name, or anywhere
      return full.startsWith(q)||
             (parts.length>1&&parts[parts.length-1].startsWith(q))||
             full.includes(q);
    }).slice(0,6); // max 6 suggestions
    wizPlayerSuggestions.value=matches;
  }

  function getPlayerById(id){
    return globalPlayers.value&&globalPlayers.value.find(function(p){return p.id===id;});
  }

  function wizQuickAddFavorite(fid){
    var p=getPlayerById(fid);
    if(!p)return;
    var already=wiz.players.find(function(x){return x.id===fid;});
    if(already)return;
    wiz.players.push({id:p.id,name:p.name||'',short:p.short||(p.name&&p.name.trim().split(' ')[0])||p.id,ghin:p.ghin||0,team:0,roundHcp:{}});
  }

    function wizSelectSuggestion(sp){
    // Add from roster
    addWizSavedPlayer(sp);
    wizPlayerSearch.value='';
    wizPlayerSuggestions.value=[];
  }

  function wizAddSearchedPlayer(){
    var name=(wizPlayerSearch.value||'').trim();
    if(!name)return;
    var hcp=typeof wizNewPlayerHcp.value==='number'?wizNewPlayerHcp.value:parseFloat(wizNewPlayerHcp.value)||0;
    // Check existing roster match
    var existing=globalPlayers.value.find(function(p){
      return (p.name||'').toLowerCase()===name.toLowerCase();
    });
    if(existing){
      // Update HCP if provided
      if(hcp>0)existing.ghin=hcp;
      wizSelectSuggestion(existing);
      wizNewPlayerHcp.value='';
      return;
    }
    // New player — add to round AND roster automatically
    var id='p_'+Date.now();
    var short=name.trim().split(' ')[0];
    wiz.players.push({id:id,name:name,short:short,ghin:hcp,team:0,roundHcp:{}});
    // Auto-save to roster
    playerProfiles.value.push({id:id,name:name,short:short,ghin:hcp,rounds:0});
    savePlayerProfiles();
    wizPlayerSearch.value='';
    wizPlayerSuggestions.value=[];
    wizNewPlayerHcp.value='';
    toast.value=short+' added to round & roster';
    setTimeout(function(){toast.value='';},1500);
  }

  function wizConfirmSaveToRoster(){
    var p=wizSavePrompt.value;
    if(!p)return;
    // Update ghin on the wiz player
    var wp=wiz.players.find(function(x){return x.id===p.id;});
    if(wp)wp.ghin=wizSavePromptGhin.value||0;
    // Save to roster
    var short=(p.name||'').trim().split(' ')[0];
    playerProfiles.value.push({
      id:p.id,name:p.name,short:short,
      ghin:wizSavePromptGhin.value||0,rounds:0
    });
    savePlayerProfiles();
    wizSavePrompt.value=null;
    toast.value=short+' saved to roster!';
    setTimeout(function(){toast.value='';},2000);
  }

  function wizDismissSavePrompt(){
    // Keep in round but don't save to roster
    wizSavePrompt.value=null;
  }
  // ── WIZARD GAME SETUP HELPERS ──
  function wizSetTeam(gtype,pid,team){
    var g=wiz.selectedGames.find(function(x){return x.type===gtype;});
    if(!g)return;
    if(!g.config.team1)g.config.team1=[];
    if(!g.config.team2)g.config.team2=[];
    g.config.team1=g.config.team1.filter(function(p){return p!==pid;});
    g.config.team2=g.config.team2.filter(function(p){return p!==pid;});
    if(team===1)g.config.team1.push(pid);
    else if(team===2)g.config.team2.push(pid);
  }
  function wizAutoTeams(gtype){
    var g=wiz.selectedGames.find(function(x){return x.type===gtype;});
    if(!g)return;
    var pids=wiz.players.map(function(p){return p.id;}).sort(function(){return Math.random()-.5;});
    var half=Math.ceil(pids.length/2);
    g.config.team1=pids.slice(0,half);
    g.config.team2=pids.slice(half);
  }
  function wizWolfAddToOrder(g,pid){
    if(!g.config.wolfTeeOrder)g.config.wolfTeeOrder=[];
    if(g.config.wolfTeeOrder.indexOf(pid)<0)g.config.wolfTeeOrder.push(pid);
  }
  function wizWolfAutoOrder(g){
    g.config.wolfTeeOrder=wiz.players.map(function(p){return p.id;});
  }
  function wizWolfPlayerName(pid){
    var p=wiz.players.find(function(x){return x.id===pid;});
    return p?(p.short||(p.name&&p.name.trim().split(' ')[0])||pid):pid;
  }
  function wizToggleF31Player(g,pid){
    if(!g.config.players)g.config.players=[];
    var idx=g.config.players.indexOf(pid);
    if(idx>=0)g.config.players.splice(idx,1);
    else if(g.config.players.length<3)g.config.players.push(pid);
  }
  function wizAddSubMatch(gtype) {
    var g = wiz.selectedGames.find(function(x){return x.type===gtype;});
    if(!g) return;
    if(!g.config.subMatches) g.config.subMatches = [];
    var pids = wiz.players.map(function(p){return p.id;});
    g.config.subMatches.push({p1:pids[0]||'', p2:pids[1]||'', ppt:5});
  }
  function wizRemoveSubMatch(gtype, idx) {
    var g = wiz.selectedGames.find(function(x){return x.type===gtype;});
    if(!g || !g.config.subMatches) return;
    g.config.subMatches.splice(idx, 1);
  }
  function wizWolfOnHole(g,holeNum){
    var order=g.config.wolfTeeOrder||[];
    if(!order.length)return null;
    return order[(holeNum-1)%order.length];
  }
  function wizWolfMoveUp(gtype, oi) {
    var g = wiz.selectedGames.find(function(x){return x.type===gtype;});
    if(!g||!g.config.wolfTeeOrder||oi<=0)return;
    var arr = g.config.wolfTeeOrder;
    var tmp = arr[oi-1];
    arr[oi-1] = arr[oi];
    arr[oi] = tmp;
  }
  function wizWolfMoveDown(gtype, oi) {
    var g = wiz.selectedGames.find(function(x){return x.type===gtype;});
    if(!g||!g.config.wolfTeeOrder||oi>=g.config.wolfTeeOrder.length-1)return;
    var arr = g.config.wolfTeeOrder;
    var tmp = arr[oi+1];
    arr[oi+1] = arr[oi];
    arr[oi] = tmp;
  }
  function wizWolfRemove(gtype, oi) {
    var g = wiz.selectedGames.find(function(x){return x.type===gtype;});
    if(!g||!g.config.wolfTeeOrder)return;
    g.config.wolfTeeOrder.splice(oi, 1);
  }
  function gcWolfMoveUp(oi) {
    if(oi <= 0 || oi >= gc.wolfTeeOrder.length) return;
    var tmp = gc.wolfTeeOrder[oi-1];
    gc.wolfTeeOrder[oi-1] = gc.wolfTeeOrder[oi];
    gc.wolfTeeOrder[oi] = tmp;
  }
  function gcWolfMoveDown(oi) {
    if(oi < 0 || oi >= gc.wolfTeeOrder.length-1) return;
    var tmp = gc.wolfTeeOrder[oi+1];
    gc.wolfTeeOrder[oi+1] = gc.wolfTeeOrder[oi];
    gc.wolfTeeOrder[oi] = tmp;
  }
  function gcWolfRemove(oi) {
    gc.wolfTeeOrder.splice(oi, 1);
  }

  // ══════════════════════════════════════════════════
  // ── SCORECARD OCR ──
  // Uses Claude vision API to extract course data from a photo
  // ══════════════════════════════════════════════════
  function openScanModal(){
    showScanModal.value=true;
    scanState.value='idle';
    scanError.value='';
    scanResult.value=null;
    scanReviewName.value='';
    scanReviewTees.value=[];
  }
  function closeScanModal(){
    showScanModal.value=false;
    scanState.value='idle';
    scanError.value='';
  }
  function saveOcrKey(){
    localStorage.setItem('gw_ocr_key',ocrApiKey.value);
    toast.value='API key saved';setTimeout(function(){toast.value='';},2000);
  }
  function saveOcrProxy(){
    var url=(ocrProxyUrl.value||'').trim();
    // Normalize: add https:// if missing
    if(url&&url.indexOf('://')<0)url='https://'+url;
    // Strip trailing slashes
    url=url.replace(/\/+$/,'');
    ocrProxyUrl.value=url;
    localStorage.setItem('gw_proxy_url',url);
    toast.value=url?'Proxy URL saved ✓':'Proxy URL cleared';
    setTimeout(function(){toast.value='';},2000);
  }

  async function handleScorecardImage(event){
    var file=event.target.files&&event.target.files[0];
    if(!file)return;

    var proxyUrl=(ocrProxyUrl.value||'').trim();
    var apiKey=(ocrApiKey.value||'').trim();

    // Need either a proxy URL or a direct API key
    if(!proxyUrl&&!apiKey){
      scanError.value='NO_KEY';
      return;
    }

    scanState.value='scanning';
    scanError.value='';
    event.target.value='';

    try{
      // Read image as base64
      var base64=await new Promise(function(resolve,reject){
        var reader=new FileReader();
        reader.onload=function(e){resolve(e.target.result.split(',')[1]);};
        reader.onerror=reject;
        reader.readAsDataURL(file);
      });

      var mediaType=file.type||'image/jpeg';
      if(mediaType==='image/heic'||mediaType==='image/heif')mediaType='image/jpeg';
      if(!['image/jpeg','image/png','image/gif','image/webp'].includes(mediaType))mediaType='image/jpeg';

      var response;

      if(proxyUrl){
        // ── PROXY MODE (recommended — key stays on server) ──
        var endpoint=proxyUrl.replace(/\/+$/,'');
        response=await fetch(endpoint,{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({imageBase64:base64,mediaType:mediaType})
        });
      }else{
        // ── DIRECT MODE (needs API key in browser) ──
        response=await fetch('https://api.anthropic.com/v1/messages',{
          method:'POST',
          headers:{
            'Content-Type':'application/json',
            'x-api-key':apiKey,
            'anthropic-version':'2023-06-01',
            'anthropic-dangerous-direct-browser-access':'true'
          },
          body:JSON.stringify({
            model:'claude-sonnet-4-20250514',
            max_tokens:4096,
            system:'You are a golf scorecard data extractor. Output only valid JSON, no markdown.',
            messages:[{
              role:'user',
              content:[
                {type:'image',source:{type:'base64',media_type:mediaType,data:base64}},
                {type:'text',text:'Extract all data from this golf scorecard. Return ONLY a JSON object:\n{"courseName":"","holes":18,"par":[4,3,5,...],"si":[13,15,3,...],"tees":[{"name":"Blue","rating":75.9,"slope":145,"yards":7206,"yardsByHole":[539,...]}]}\nRules: par = one integer per hole in order. si = stroke index from HDCP column (1=hardest), if missing use 1-18. Extract every tee row. yardsByHole = per-hole distance if visible. courseName = empty string if not on card.'}
              ]
            }]
          })
        });
      }

      // Parse response
      var data;
      try{data=await response.json();}
      catch(je){
        var rawB='';
        try{rawB=await response.clone().text();}catch(e2){}
        throw new Error('Server returned non-JSON (status '+response.status+'): '+rawB.slice(0,100));
      }

      if(!response.ok){
        var msg=(data.error&&(data.error.message||data.error))||JSON.stringify(data);
        var isCors=(typeof msg==='string'&&(msg.indexOf('Invalid response format')>=0||msg.indexOf('CORS')>=0));
        throw new Error(isCors?'BROWSER_CORS':'API '+response.status+': '+String(msg).slice(0,120));
      }

      // Extract text blocks
      var rawText='';
      if(data.content&&Array.isArray(data.content)){
        data.content.forEach(function(block){if(block.type==='text'&&block.text)rawText+=block.text;});
      }
      rawText=rawText.trim();
      if(!rawText)throw new Error('Empty response from AI. Try a clearer photo.');

      // Find JSON object in response
      var jsonStart=rawText.indexOf('{');
      var jsonEnd=rawText.lastIndexOf('}');
      if(jsonStart<0||jsonEnd<=jsonStart)throw new Error('AI response did not contain JSON. Got: '+rawText.slice(0,80));

      var parsed;
      try{parsed=JSON.parse(rawText.slice(jsonStart,jsonEnd+1));}
      catch(pe){throw new Error('Could not parse scorecard data. Try a clearer photo.');}

      if(!parsed.par||!Array.isArray(parsed.par)||parsed.par.length<9){
        throw new Error('Could not read par values. Make sure the PAR row is visible.');
      }

      var holes=parsed.par.length;
      var si=parsed.si&&Array.isArray(parsed.si)&&parsed.si.length===holes?parsed.si:
             Array.from({length:holes},function(_,i){return i+1;});
      var teeList=parsed.tees&&Array.isArray(parsed.tees)&&parsed.tees.length?parsed.tees:
                  [{name:'Standard',rating:parsed.rating||72.0,slope:parsed.slope||113,yards:0}];

      scanReviewName.value=parsed.courseName||'';
      scanReviewTees.value=teeList.map(function(t){
        var ybh=t.yardsByHole&&Array.isArray(t.yardsByHole)&&t.yardsByHole.length===holes?
                t.yardsByHole:Array(holes).fill(0);
        return{name:t.name||'Standard',rating:t.rating||72.0,slope:t.slope||113,
               yards:t.yards||0,yardsByHole:ybh,pars:parsed.par.slice(),sis:si.slice(),include:true};
      });
      scanResult.value=parsed;
      scanState.value='review';

    }catch(e){
      console.error('OCR:',e);
      var msg=e.message||'Failed to read scorecard.';
      var isCors=msg==='BROWSER_CORS'||msg.indexOf('Invalid response format')>=0||
                 msg.indexOf('Failed to fetch')>=0||msg.indexOf('Load failed')>=0;
      scanError.value=isCors?'BROWSER_CORS':msg;
      scanState.value='idle';
    }
  }

  function scanSaveCourse(){
    var name=(scanReviewName.value||'').trim();
    if(!name){scanError.value='Course name is required';return;}
    var activeTees=scanReviewTees.value.filter(function(t){return t.include;});
    if(!activeTees.length){scanError.value='Select at least one tee set';return;}
    var firstTee=activeTees[0];
    var holes=firstTee.pars.length;
    // Validate pars
    if(holes!==9&&holes!==18){
      scanError.value='Need exactly 9 or 18 holes. Got '+holes+'.';return;
    }
    // Build course object
    var teesData={};
    activeTees.forEach(function(t){
      teesData[t.name||'Standard']={
        rating:parseFloat(t.rating)||72.0,
        slope:parseInt(t.slope)||113,
        yards:parseInt(t.yards)||0,
        yardsByHole:t.yardsByHole&&t.yardsByHole.some(function(y){return y>0;})?
          t.yardsByHole.map(function(y){return parseInt(y)||0;}):undefined
      };
    });
    var courseObj={
      par:firstTee.pars.map(function(p){return parseInt(p)||4;}),
      si:firstTee.sis.map(function(s){return parseInt(s)||1;}),
      tees:activeTees[0].name||'Standard',
      teesData:teesData
    };
    // Save using existing addCustomCourse logic
    COURSES[name]=courseObj;
    var updated=Object.assign({},customCourses.value);
    updated[name]=courseObj;
    customCourses.value=updated;
    customCourseVersion.value++;
    try{localStorage.setItem('golf_custom_courses',JSON.stringify(customCourses.value));}catch(e){}
    closeScanModal();
    toast.value='"'+name+'" added!';setTimeout(function(){toast.value='';},3000);
    // Navigate to courses tab to show result
    view.value='courses';
  }



  // ── UPCOMING / SCHEDULED TOURNAMENT FUNCTIONS ──
  function deleteActiveRound(rid){
    var r=T.rounds.find(function(r){return r.id===rid;});
    if(!r)return;
    deleteRoundConfirmId.value=rid;
    deleteRoundConfirmLabel.value=r.course?r.course+' · '+r.date:'Round '+rid;
  }
  function confirmDeleteRound(){
    var rid=deleteRoundConfirmId.value;
    if(!rid&&rid!==0){deleteRoundConfirmId.value=null;return;}
    var idx=T.rounds.findIndex(function(r){return r.id===rid;});
    if(idx>=0)T.rounds.splice(idx,1);
    if(T.scores)delete T.scores[rid];
    if(T.gameRounds)delete T.gameRounds[rid];
    if(T.roundResults)delete T.roundResults[rid];
    if(T.roundMeta)delete T.roundMeta[rid];
    if(activeRound.value&&activeRound.value.id===rid){activeRound.value=T.rounds.length?T.rounds[0]:null;}
    if(gamesRoundId.value===rid){gamesRoundId.value=T.rounds.length?T.rounds[0]?T.rounds[0].id:null:null;}
    // If no rounds remain, fully clear the tournament to prevent zombie state
    if(!T.rounds.length){
      // Remove from allTournaments list
      var tidx=allTournaments.value.findIndex(function(x){return x.id===T.id;});
      if(tidx>=0)allTournaments.value.splice(tidx,1);
      // Nuke the active-game localStorage key so it can't resurrect on reload
      localStorage.removeItem('golfTracker_v2');
      // Reset T to blank state
      Object.assign(T,{id:'',name:'',type:'single',teams:[],players:[],rounds:[],scores:{},matchResults:{},roundResults:{},gameRounds:{}});
      activeRound.value=null;
      activeId.value='';
      gamesRoundId.value=null;
      view.value='home';
    }
    saveData();saveTournaments();saveArchive();
    deleteRoundConfirmId.value=null;
    toast.value='Round deleted';setTimeout(function(){toast.value='';},2000);
  }

    function editRoundDate(tid,rid,newDate){
    // Edit a round's date in any tournament (active or upcoming)
    var t=allTournaments.value.find(function(x){return x.id===tid;});
    if(!t)return;
    var r=t.rounds.find(function(x){return x.id===rid;});
    if(!r)return;
    r.date=newDate;
    // If editing the currently active tournament, sync T
    if(T.id===tid){
      var tr=T.rounds.find(function(x){return x.id===rid;});
      if(tr)tr.date=newDate;
    }
    saveTournaments();
    saveData();
  }

  function editRoundDateActive(rid,newDate){
    // Edit date on current active T
    var r=T.rounds.find(function(x){return x.id===rid;});
    if(r){r.date=newDate;saveData();saveTournaments();}
  }

  function activateUpcoming(id){
    // Load an upcoming tournament as the active one
    var t=allTournaments.value.find(function(x){return x.id===id;});
    if(!t){toast.value='Tournament not found';setTimeout(function(){toast.value='';},2000);return;}
    loadTournamentData(t);
    view.value='rounds';
    toast.value=t.name+' is now active!';
    setTimeout(function(){toast.value='';},2500);
  }

  function deleteUpcoming(id){
    var idx=allTournaments.value.findIndex(function(t){return t.id===id;});
    if(idx>=0){allTournaments.value.splice(idx,1);saveTournaments();}
    toast.value='Tournament removed';setTimeout(function(){toast.value='';},2000);
  }

  // Load upcoming tournament for editing a specific round's games
  function editUpcomingRound(tId,rId){
    var t=allTournaments.value.find(function(x){return x.id===tId;});
    if(!t)return;
    loadTournamentData(t);
    // Don't persist upcoming tournament as the active game
    localStorage.removeItem('golfTracker_v2');
    var r=T.rounds.find(function(x){return x.id===rId;});
    if(r){
      activeRound.value=r;
      gamesRoundId.value=rId;
      view.value='games';
    }
  }

  // Load upcoming tournament for full editing (rounds view)
  function editUpcomingTournament(tId){
    var t=allTournaments.value.find(function(x){return x.id===tId;});
    if(!t)return;
    loadTournamentData(t);
    // Don't persist upcoming tournament as the active game
    localStorage.removeItem('golfTracker_v2');
    view.value='rounds';
  }

  // Seed Bandon Boys '26 as upcoming if not already in storage
  function seedBandonIfNeeded(){
    var already=allTournaments.value.some(function(t){return t.id==='bandon2026';});
    if(already)return;
    var preset=JSON.parse(JSON.stringify(BANDON_PRESET));
    allTournaments.value.push(preset);
    saveTournaments();
  }


  // ══════════════════════════════════════════════════
  // ── WEATHER FUNCTIONS (Open-Meteo — free, no key) ──
  // ══════════════════════════════════════════════════
  var _weatherTimer=null;

  function windDirLabel(deg){
    var dirs=['N','NE','E','SE','S','SW','W','NW'];
    return dirs[Math.round(deg/45)%8]||'';
  }

  async function fetchWeatherAtCoords(lat,lng){
    // Open-Meteo: free, no API key, current weather
    var url='https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lng
      +'&current=temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,weather_code'
      +'&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto';
    var resp=await fetch(url);
    if(!resp.ok)throw new Error('Weather API '+resp.status);
    var data=await resp.json();
    var c=data.current||{};
    var wc=c.weather_code||0;
    // WMO code to emoji
    var icon=wc===0?'☀️':wc<=3?'⛅':wc<=49?'🌫️':wc<=67?'🌧️':wc<=77?'🌨️':wc<=82?'🌦️':wc<=99?'⛈️':'🌡️';
    return{
      temp:Math.round(c.temperature_2m||0),
      feelsLike:Math.round(c.apparent_temperature||0),
      wind:Math.round(c.wind_speed_10m||0),
      windDeg:Math.round(c.wind_direction_10m||0),
      windDir:windDirLabel(c.wind_direction_10m||0),
      icon:icon,
      ts:new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})
    };
  }

  async function captureWeatherSnapshot(lat,lng){
    try{
      weatherLoading.value=true;
      var w=await fetchWeatherAtCoords(lat,lng);
      weatherSnapshot.value=w;
      liveWeather.value=w;
      // Save snapshot to current round
      if(activeRound.value){
        if(!T.roundMeta)T.roundMeta={};
        T.roundMeta[activeRound.value.id]=T.roundMeta[activeRound.value.id]||{};
        T.roundMeta[activeRound.value.id].weatherSnapshot=w;
        saveData();
      }
    }catch(e){console.warn('Weather fetch failed:',e);}
    finally{weatherLoading.value=false;}
  }

  function startWeatherUpdates(){
    stopWeatherUpdates();
    weatherLoading.value=true;
    // Try browser geolocation first, fall back to IP-based location
    function tryGeolocation(){
      if(!navigator.geolocation){tryIpLocation();return;}
      navigator.geolocation.getCurrentPosition(
        function(pos){
          var lat=pos.coords.latitude,lng=pos.coords.longitude;
          captureWeatherSnapshot(lat,lng);
          _weatherTimer=setInterval(async function(){
            try{var w=await fetchWeatherAtCoords(lat,lng);liveWeather.value=w;}catch(e){}
          },300000);
        },
        function(err){
          // Permission denied or unavailable — fall back to IP location
          tryIpLocation();
        },
        {enableHighAccuracy:false,timeout:8000,maximumAge:60000}
      );
    }
    async function tryIpLocation(){
      try{
        var r=await fetch('https://ipapi.co/json/');
        var d=await r.json();
        if(d.latitude&&d.longitude){
          captureWeatherSnapshot(d.latitude,d.longitude);
        }else{
          weatherLoading.value=false;
          toast.value='Location unavailable — enable location access';
          setTimeout(function(){toast.value='';},3000);
        }
      }catch(e){
        weatherLoading.value=false;
        toast.value='Could not get location for weather';
        setTimeout(function(){toast.value='';},3000);
      }
    }
    tryGeolocation();
  }
  
  function stopWeatherUpdates(){
    if(_weatherTimer){clearInterval(_weatherTimer);_weatherTimer=null;}
  }

  // ══════════════════════════════════════════════════
  // ── GPS DISTANCE TO GREEN (golfcourseapi.com) ──
  // ══════════════════════════════════════════════════
  var GOLF_API_KEY='YCTLHK65F52NIXNBEE5CIJ6WNE';
  var US_STATES=[
    {abbr:'AL',name:'Alabama'},{abbr:'AK',name:'Alaska'},{abbr:'AZ',name:'Arizona'},
    {abbr:'AR',name:'Arkansas'},{abbr:'CA',name:'California'},{abbr:'CO',name:'Colorado'},
    {abbr:'CT',name:'Connecticut'},{abbr:'DE',name:'Delaware'},{abbr:'FL',name:'Florida'},
    {abbr:'GA',name:'Georgia'},{abbr:'HI',name:'Hawaii'},{abbr:'ID',name:'Idaho'},
    {abbr:'IL',name:'Illinois'},{abbr:'IN',name:'Indiana'},{abbr:'IA',name:'Iowa'},
    {abbr:'KS',name:'Kansas'},{abbr:'KY',name:'Kentucky'},{abbr:'LA',name:'Louisiana'},
    {abbr:'ME',name:'Maine'},{abbr:'MD',name:'Maryland'},{abbr:'MA',name:'Massachusetts'},
    {abbr:'MI',name:'Michigan'},{abbr:'MN',name:'Minnesota'},{abbr:'MS',name:'Mississippi'},
    {abbr:'MO',name:'Missouri'},{abbr:'MT',name:'Montana'},{abbr:'NE',name:'Nebraska'},
    {abbr:'NV',name:'Nevada'},{abbr:'NH',name:'New Hampshire'},{abbr:'NJ',name:'New Jersey'},
    {abbr:'NM',name:'New Mexico'},{abbr:'NY',name:'New York'},{abbr:'NC',name:'North Carolina'},
    {abbr:'ND',name:'North Dakota'},{abbr:'OH',name:'Ohio'},{abbr:'OK',name:'Oklahoma'},
    {abbr:'OR',name:'Oregon'},{abbr:'PA',name:'Pennsylvania'},{abbr:'RI',name:'Rhode Island'},
    {abbr:'SC',name:'South Carolina'},{abbr:'SD',name:'South Dakota'},{abbr:'TN',name:'Tennessee'},
    {abbr:'TX',name:'Texas'},{abbr:'UT',name:'Utah'},{abbr:'VT',name:'Vermont'},
    {abbr:'VA',name:'Virginia'},{abbr:'WA',name:'Washington'},{abbr:'WV',name:'West Virginia'},
    {abbr:'WI',name:'Wisconsin'},{abbr:'WY',name:'Wyoming'}
  ];
  // BANDON_GPS_FALLBACK removed — previously contained placeholder coordinates.
  // Use "Capture Green GPS" on the scoring screen to record real coords on-site.
  var BANDON_GPS_FALLBACK={};

  function haversineYards(lat1,lng1,lat2,lng2){
    var R=6371000; // meters
    var dLat=(lat2-lat1)*Math.PI/180;
    var dLng=(lng2-lng1)*Math.PI/180;
    var a=Math.sin(dLat/2)*Math.sin(dLat/2)+
          Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*
          Math.sin(dLng/2)*Math.sin(dLng/2);
    var c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
    var meters=R*c;
    return Math.round(meters*1.09361); // yards
  }

  async function fetchCourseHoleCoords(courseName){
    // Check in-memory cache first
    if(golfCourseCache.value[courseName])return golfCourseCache.value[courseName];
    // Check hardcoded Bandon fallback
    if(BANDON_GPS_FALLBACK[courseName]){
      golfCourseCache.value=Object.assign({},golfCourseCache.value);
      golfCourseCache.value[courseName]=BANDON_GPS_FALLBACK[courseName];
      return BANDON_GPS_FALLBACK[courseName];
    }
    // Search for the course
    var searchData=await golfApiRequest('search?q='+encodeURIComponent(courseName));
    var courses=searchData.courses||[];
    if(!courses.length)throw new Error('Course "'+courseName+'" not found — use Course Search to add GPS');
    var courseId=courses[0].id;
    var detail=await golfApiRequest('course/'+courseId);
    // Extract hole center coordinates
    var holes=(detail.course&&detail.course.holes)||[];
    var coords=holes.map(function(h){
      // golfcourseapi may use various field names for hole coordinates
      return{
        lat:parseFloat(h.center_lat||h.latitude||h.lat||h.green_lat||0),
        lng:parseFloat(h.center_lng||h.longitude||h.lng||h.lon||h.green_lng||0)
      };
    });
    var result={holes:coords,courseId:courseId};
    // Cache it in memory and localStorage
    var newCache=Object.assign({},golfCourseCache.value);
    newCache[courseName]=result;
    golfCourseCache.value=newCache;
    try{localStorage.setItem('gw_gps_cache',JSON.stringify(newCache));}catch(e){}
    return result;
  }

  async function updateGpsDistance(){
    if(!showGps.value||!activeRound.value||!activeHole.value)return;
    var courseName=activeRound.value.course;
    gpsLoading.value=true;gpsError.value='';
    if(!navigator.geolocation){gpsError.value='GPS not available';gpsLoading.value=false;return;}
    // One-time fetch for immediate result
    navigator.geolocation.getCurrentPosition(function(pos){
      _applyGpsPosition(pos,courseName,activeHole.value);
    },function(e){
      gpsError.value=e.code===1?'Location permission denied':'GPS unavailable';
      gpsLoading.value=false;
    },{enableHighAccuracy:true,timeout:10000,maximumAge:5000});
  }

  function _applyGpsPosition(pos,courseName,hole){
    var asyncFn=async function(){
      try{
        var courseData=await fetchCourseHoleCoords(courseName);
        var holeCoords=courseData.holes[hole-1];
        if(!holeCoords||!holeCoords.lat||holeCoords.lat===0){
          gpsDistance.value=null;gpsFrontDist.value=null;gpsBackDist.value=null;
          gpsError.value='N/A — no GPS for hole '+hole;
          return;
        }
        var pLat=pos.coords.latitude,pLng=pos.coords.longitude;
        gpsDistance.value=haversineYards(pLat,pLng,holeCoords.lat,holeCoords.lng);
        gpsFrontDist.value=(holeCoords.front_lat&&holeCoords.front_lat!==0)?haversineYards(pLat,pLng,holeCoords.front_lat,holeCoords.front_lng):null;
        gpsBackDist.value=(holeCoords.back_lat&&holeCoords.back_lat!==0)?haversineYards(pLat,pLng,holeCoords.back_lat,holeCoords.back_lng):null;
        gpsError.value='';
      }catch(e){
        gpsError.value=e.message||'GPS error';
      }finally{
        gpsLoading.value=false;
      }
    };
    asyncFn();
  }

  function reloadCourseGps(courseName){
    if(!courseName)return;
    // Clear cache for this course to force re-fetch
    delete golfCourseCache.value[courseName];
    golfCourseCache.value=Object.assign({},golfCourseCache.value);
    // Also clear from localStorage GPS cache
    try{
      var lsCache=JSON.parse(localStorage.getItem('gw_gps_cache')||'{}');
      delete lsCache[courseName];
      localStorage.setItem('gw_gps_cache',JSON.stringify(lsCache));
    }catch(e){}
    toast.value='GPS cache cleared for '+courseName+' — reloading…';
    setTimeout(function(){toast.value='';},2500);
    // Re-fetch
    fetchCourseHoleCoords(courseName).then(function(){
      toast.value='GPS reloaded for '+courseName;
      setTimeout(function(){toast.value='';},2000);
    }).catch(function(e){
      toast.value='GPS reload failed: '+e.message;
      setTimeout(function(){toast.value='';},3000);
    });
  }

  function startGpsWatch(){
    stopGpsWatch();
    if(!navigator.geolocation)return;
    gpsWatchId.value=navigator.geolocation.watchPosition(function(pos){
      if(!showGps.value||!activeRound.value||!activeHole.value)return;
      _applyGpsPosition(pos,activeRound.value.course,activeHole.value);
    },function(e){
      // Silent fail on watch errors - don't spam error
    },{enableHighAccuracy:true,maximumAge:10000});
  }

  function stopGpsWatch(){
    if(gpsWatchId.value&&navigator.geolocation){
      navigator.geolocation.clearWatch(gpsWatchId.value);
      gpsWatchId.value=null;
    }
  }
  
  function toggleScFullscreen(){
    scFullscreen.value=!scFullscreen.value;
  }
  function showToast(msg){toast.value=msg;setTimeout(function(){toast.value='';},3000);}
  function _captureScorecard(){
    var el=document.getElementById('sc-fs-capture');
    if(!el)return Promise.reject(new Error('Nothing to capture'));
    if(typeof html2canvas==='undefined')return Promise.reject(new Error('html2canvas not loaded'));
    return html2canvas(el,{backgroundColor:'#071507',scale:2,useCORS:true,logging:false}).then(function(canvas){
      return new Promise(function(resolve,reject){
        canvas.toBlob(function(blob){
          if(!blob){reject(new Error('Capture failed'));return;}
          var rn=activeRound.value?activeRound.value.course||'scorecard':'scorecard';
          var dt=activeRound.value?activeRound.value.date||'':'';
          var fname='GolfWizard_'+rn.replace(/[^a-zA-Z0-9]/g,'_')+(dt?'_'+dt:'')+'.jpg';
          var file=new File([blob],fname,{type:'image/jpeg'});
          resolve(file);
        },'image/jpeg',0.92);
      });
    });
  }
  function saveScorecard(){
    showToast('Capturing…');
    _captureScorecard().then(function(file){
      // Use share API to open native share sheet — user taps "Save Image" for camera roll
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
        navigator.share({files:[file],title:'Scorecard'}).then(function(){
          showToast('Done!');
        }).catch(function(e){
          if(e.name!=='AbortError')showToast('Save cancelled');
        });
      }else{
        // Fallback: download link
        var url=URL.createObjectURL(file);
        var a=document.createElement('a');a.href=url;a.download=file.name;
        document.body.appendChild(a);a.click();document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Scorecard downloaded!');
      }
    }).catch(function(err){showToast('Error: '+err.message);});
  }
  function sendScorecard(){
    showToast('Capturing…');
    _captureScorecard().then(function(file){
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
        navigator.share({files:[file],title:'Scorecard',text:'Check out this scorecard!'}).then(function(){
          showToast('Sent!');
        }).catch(function(e){
          if(e.name!=='AbortError')showToast('Send cancelled');
        });
      }else{
        showToast('Share not supported on this browser');
      }
    }).catch(function(err){showToast('Error: '+err.message);});
  }
  // ══════════════════════════════════════════════════════════
  // ██  ROUND RECAP — sarcastic, witty post-round summary  ██
  // ══════════════════════════════════════════════════════════
  // ── pick helper: random item from array, optional exclusion set for no repeats ──
  function pick(arr,used){
    if(!arr||!arr.length)return'';
    if(used){
      var fresh=arr.filter(function(x){return used.indexOf(x)<0;});
      if(!fresh.length)fresh=arr; // pool exhausted, allow repeats
      var c=fresh[Math.floor(Math.random()*fresh.length)];
      used.push(c);
      return c;
    }
    return arr[Math.floor(Math.random()*arr.length)];
  }
  // template helper: replace {N} with name, {H} with hole, {S} with score, {D} with diff, {C} with course
  function tpl(s,v){return s.replace(/\{N\}/g,v.N||'').replace(/\{H\}/g,v.H||'').replace(/\{S\}/g,v.S||'').replace(/\{D\}/g,v.D||'').replace(/\{C\}/g,v.C||'').replace(/\{G\}/g,v.G||'').replace(/\{P\}/g,v.P||'').replace(/\{W\}/g,v.W||'').replace(/\{L\}/g,v.L||'');}

  function generateRecap(rid){
    var r=T.rounds.find(function(x){return x.id===rid;});
    if(!r)return'No round data.';
    var course=r.course||'Unknown Course';
    var par=cPar(course);
    var nc=holeCount(course);
    var from=roundFromH(rid),to=roundToH(rid);
    var pids=(T.players||[]).map(function(p){return p.id;});
    if(!pids.length)return'No players found.';
    // Track used quips so nothing repeats within a single recap
    var used=[];

    // ── Gather stats per player ──
    var stats=[];
    pids.forEach(function(pid){
      var p=getP(pid);
      var name=p?(p.short||(p.name||'').split(' ')[0]||pid):pid;
      var gross=grossTotal(rid,pid);
      var net=netTotal(rid,pid);
      var hcp=pRoundHcp(pid,rid)||0;
      var birdies=0,eagles=0,aces=0,bogeys=0,doubles=0,triples=0,snowmen=0,worst=0,worstH=0,bestDiff=99,bestH=0;
      var pars=0,birdieHoles=[],eagleHoles=[],blowupHoles=[],parHoles=0;
      var front9=0,back9=0,f9ct=0,b9ct=0,streakPar=0,maxStreakPar=0;
      for(var h=from;h<=to;h++){
        var sc=getScore(rid,pid,h);
        if(!sc)continue;
        var hp=holePar(course,h);
        var diff=sc-hp;
        if(h<=9){front9+=sc;f9ct++;}else{back9+=sc;b9ct++;}
        if(diff<=0){streakPar++;if(streakPar>maxStreakPar)maxStreakPar=streakPar;}else{streakPar=0;}
        if(diff<=-2){eagles++;eagleHoles.push(h);if(sc===1)aces++;}
        else if(diff===-1){birdies++;birdieHoles.push(h);}
        else if(diff===0){pars++;parHoles++;}
        else if(diff===1)bogeys++;
        else if(diff===2)doubles++;
        else if(diff>=3){triples++;blowupHoles.push({h:h,sc:sc,par:hp,diff:diff});}
        if(sc>=8)snowmen++;
        if(diff>worst){worst=diff;worstH=h;}
        if(diff<bestDiff){bestDiff=diff;bestH=h;}
      }
      // front/back split
      var f9par=0,b9par=0;
      for(var fh=1;fh<=Math.min(9,nc);fh++)f9par+=holePar(course,fh);
      for(var bh=10;bh<=nc;bh++)b9par+=holePar(course,bh);
      var frontVsPar=f9ct===Math.min(9,nc)?front9-f9par:null;
      var backVsPar=b9ct===Math.max(0,nc-9)?back9-b9par:null;
      var blowedUp=frontVsPar!==null&&backVsPar!==null&&Math.abs(frontVsPar-backVsPar)>=8;
      stats.push({pid:pid,name:name,gross:gross,net:net,hcp:hcp,team:p?p.team:0,
        birdies:birdies,eagles:eagles,aces:aces,pars:pars,parHoles:parHoles,bogeys:bogeys,
        doubles:doubles,triples:triples,snowmen:snowmen,worst:worst,worstH:worstH,
        bestDiff:bestDiff,bestH:bestH,front9:front9,back9:back9,
        frontVsPar:frontVsPar,backVsPar:backVsPar,blowedUp:blowedUp,
        maxStreakPar:maxStreakPar,
        birdieHoles:birdieHoles,eagleHoles:eagleHoles,blowupHoles:blowupHoles});
    });

    var byGross=stats.filter(function(s){return s.gross!==null;}).sort(function(a,b){return a.gross-b.gross;});
    var byNet=stats.filter(function(s){return s.net!==null;}).sort(function(a,b){return a.net-b.net;});
    if(!byGross.length)return'Scorecard is emptier than '+pick(['the fairway on a Monday','your wallet after a Nassau','the parking lot at a muni at 6am'],used)+'. Finish some holes first.';

    var lines=[];
    var date=r.date||'';
    var best=byGross[0];
    var worst2=byGross[byGross.length-1];
    var spread=worst2.gross-best.gross;
    var groupAvg=Math.round(byGross.reduce(function(a,s){return a+s.gross;},0)/byGross.length);
    var groupVsPar=groupAvg-par;
    var N=best.name,W=worst2.name;

    // ══════════════════════════
    // ██   HEADLINE            ██
    // ══════════════════════════
    var headlines=[
      'ROUND RECAP: '+course,'THE DAMAGE REPORT: '+course,'FIELD NOTES FROM '+course.toUpperCase(),
      'DISPATCHES FROM '+course.toUpperCase(),'AFTER-ACTION REPORT: '+course,
      'INCIDENT REPORT: '+course,'WHAT HAPPENED AT '+course.toUpperCase(),
      course.toUpperCase()+' — A STORY IN '+byGross.length+' PARTS',
      'TODAY AT '+course.toUpperCase()+': GOLF WAS ATTEMPTED',
    ];
    if(spread>25)headlines.push('ABSOLUTE MASSACRE AT '+course.toUpperCase(),'MERCY RULE NEEDED AT '+course.toUpperCase());
    if(spread>15)headlines.push('THE GAP IS REAL: '+course,'SURVIVAL OF THE FITTEST: '+course);
    if(groupVsPar>15)headlines.push('PAR WAS NEVER IN DANGER AT '+course.toUpperCase(),course.toUpperCase()+' REMAINS UNDEFEATED');
    if(groupVsPar<=0)headlines.push('A GOOD DAY OF GOLF — YES, REALLY','ACTUAL GOLF WAS PLAYED AT '+course.toUpperCase());
    lines.push(pick(headlines,used));
    if(date)lines.push(date);
    lines.push('Par '+par+' | '+nc+' holes | '+byGross.length+' survivors');
    lines.push('');

    // ══════════════════════════
    // ██   TEAM BATTLE         ██
    // ══════════════════════════
    var hasTeams=T.teams&&T.teams.length>=2;
    if(hasTeams){
      var t1s=stats.filter(function(s){return s.team===1;});
      var t2s=stats.filter(function(s){return s.team===2;});
      var t1G=t1s.reduce(function(a,s){return a+(s.gross||0);},0);
      var t2G=t2s.reduce(function(a,s){return a+(s.gross||0);},0);
      var t1Nm=T.teams[0]?.name||'Team 1',t2Nm=T.teams[1]?.name||'Team 2';
      var tDiff=Math.abs(t1G-t2G);
      var winNm=t1G<t2G?t1Nm:t2G<t1G?t2Nm:null;
      var loseNm=t1G<t2G?t2Nm:t2G<t1G?t1Nm:null;
      var winG=Math.min(t1G,t2G),loseG=Math.max(t1G,t2G);
      // find each team's best and worst player
      var winBest=t1G<=t2G?t1s.sort(function(a,b){return(a.gross||999)-(b.gross||999);})[0]:t2s.sort(function(a,b){return(a.gross||999)-(b.gross||999);})[0];
      var loseWorst=t1G>t2G?t1s.sort(function(a,b){return(b.gross||0)-(a.gross||0);})[0]:t2s.sort(function(a,b){return(b.gross||0)-(a.gross||0);})[0];

      if(winNm){
        lines.push(winNm+' '+winG+' — '+loseNm+' '+loseG);
        var v={W:winNm,L:loseNm};
        if(tDiff>=30)lines.push(tpl(pick([
          '{W} won by {D} strokes. That\'s not a match, that\'s a documentary.',
          'Somewhere, {L} is staring at a wall wondering what went wrong. {D} stroke deficit will do that.',
          '{L} got pantsed out there. {D} strokes. Brutal.',
          '{W} by {D}. They could\'ve played the back 9 blindfolded and still won.',
          'If {D} strokes was a person, it would file a restraining order against {L}.',
        ],used),Object.assign(v,{D:''+tDiff})));
        else if(tDiff>=15)lines.push(tpl(pick([
          '{W} cruised. {L} should consider a team meeting... or therapy.',
          '{D} stroke cushion for {W}. That\'s called a nap on the back 9.',
          '{W} put it on cruise control. {L} put it in a ditch.',
          '{L} got out-classed by {D}. Happens to the best of us. This was not the best of them.',
          '{W} handled business. {L} handled... something. Not golf.',
        ],used),Object.assign(v,{D:''+tDiff})));
        else if(tDiff>=6)lines.push(tpl(pick([
          '{W} takes it by {D}. Comfortable but not embarrassing. {L} can still make eye contact at dinner.',
          'Close enough to hurt for {L}. Far enough that {W} never sweated.',
          '{D} strokes. {W} had it wired from about the 12th hole on.',
          '{W} wins and won\'t shut up about it. {L} lost and will blame the greens.',
          '{L} hung around just long enough to make it interesting. Narrator: it was not interesting.',
        ],used),Object.assign(v,{D:''+tDiff})));
        else lines.push(tpl(pick([
          'Down to the wire. {W} by {D}. {L} will replay every missed putt tonight.',
          'A {D}-stroke margin. That\'s one bad hole. {L} knows exactly which one.',
          'Razor thin. {W} survives. {L} will say they were robbed.',
          '{D} strokes. A single lip-out changes everything. {L} doesn\'t want to hear that right now.',
          'Tighter than {L}\'s grip on the 18th tee. {W} by {D}.',
        ],used),Object.assign(v,{D:''+tDiff})));
        // MVP / anchor callouts
        if(winBest&&winBest.gross)lines.push(winBest.name+' carried '+winNm+' with a '+winBest.gross+'.');
        if(loseWorst&&loseWorst.gross)lines.push(loseWorst.name+'\'s '+loseWorst.gross+' was the anchor that sank '+loseNm+'.');
      }else{
        lines.push(t1Nm+' '+t1G+' — '+t2Nm+' '+t2G);
        lines.push(pick([
          'Dead heat. Both teams equally deserving. Or equally undeserving.',
          'Tied. Nobody won. Everybody lost. The course was the only winner.',
          'All square. The universe couldn\'t pick a winner and honestly neither can we.',
        ],used));
      }
      lines.push('');
    }

    // ══════════════════════════
    // ██   LOW GROSS / NET     ██
    // ══════════════════════════
    var vsPar=best.gross-par;
    var fmtVp=vsPar===0?'E':vsPar>0?'+'+vsPar:''+vsPar;
    lines.push(best.name+' wins the day: '+best.gross+' ('+fmtVp+')');
    var v={N:best.name,G:''+best.gross,P:fmtVp};
    if(vsPar<=-5)lines.push(tpl(pick([
      'Absolutely unconscious. Someone drug test {N}.',
      '{G} at '+course+'? {N} woke up and chose violence.',
      'The rest of you were playing golf. {N} was playing a different sport entirely.',
      '{N} went {P}. Put the trophy in the car, we\'re done here.',
      'We\'re still checking if {N}\'s ball had a motor in it.',
      '{P}. That\'s not a golf score, that\'s a flex.',
    ],used),v));
    else if(vsPar<=-2)lines.push(tpl(pick([
      '{N} came out swinging and never let up. Rest of the field? No comment.',
      'A clean {P} from {N}. Everyone else was just playing for second.',
      '{N} made it look easy. It wasn\'t easy for anyone else.',
      '{G}. {N} found something on the range and rode it all day.',
    ],used),v));
    else if(vsPar<=0)lines.push(tpl(pick([
      'Even par. {N} played like an actual golfer today. High bar, apparently.',
      '{N} shot par. In this group, that basically makes them Tiger.',
      'Solid round from {N}. Nothing flashy, just didn\'t embarrass themselves.',
      '{N} proved par is in fact achievable at '+course+'. Others took note.',
    ],used),v));
    else if(vsPar<=5)lines.push(tpl(pick([
      '{N} took medalist honors with a {G}. Damning with faint praise? Maybe.',
      'When {G} is the best card, you know it was a tough day... or a soft field.',
      '{N} was the least bad golfer today. Congrats?',
      'The winner shot +{P}. Let that sink in. {N} is our champion.',
      'Best of a rough bunch. {N} can put that on the fridge.',
    ],used),Object.assign(v,{P:''+vsPar})));
    else if(vsPar<=10)lines.push(tpl(pick([
      '{N} "won" with a {G}. And by won, we mean lost the least.',
      'Medalist {N} at +{P}. The trophy ceremony was... subdued.',
      'At +{P}, {N} was king of a very small hill.',
      '{G} takes the crown. It\'s lonely at the top when the top is +{P}.',
    ],used),Object.assign(v,{P:''+vsPar})));
    else lines.push(tpl(pick([
      '{G} won low gross. Let that marinate.',
      'When {G} is your champion, golf has officially won and the players have lost.',
      'Medalist: {N} at {G}. The bar was underground and {N} still barely cleared it.',
    ],used),v));

    if(byNet.length&&byNet[0].pid!==best.pid){
      var bn=byNet[0];
      lines.push(bn.name+' takes low net ('+bn.net+'). '+pick([
        'Handicap strokes doing the heavy lifting as intended.',
        'Thank you, GHIN, for making this possible.',
        'Proof that the handicap system works... for some.',
        'The strokes giveth what the swing taketh away.',
        'Net is where dreams stay alive.',
      ],used));
    }else if(byNet.length){
      lines.push(best.name+' swept gross and net ('+byNet[0].net+'). '+pick([
        'Didn\'t even need the strokes. Rude.',
        'Gross and net. Leave some for the rest of us.',
        'Double dipping. Typical.',
      ],used));
    }
    lines.push('');

    // ══════════════════════════
    // ██   LAST PLACE          ██
    // ══════════════════════════
    if(byGross.length>1&&worst2.pid!==best.pid){
      var wVsPar=worst2.gross-par;
      var wv={N:worst2.name,G:''+worst2.gross,P:''+wVsPar,H:''+worst2.worstH};
      lines.push(worst2.name+': '+worst2.gross+' (+'+wVsPar+')');
      if(wVsPar>=30)lines.push(tpl(pick([
        'Did {N} play with a pool noodle? Genuine question.',
        '{G} strokes. {N} visited more sand than a beach vacation.',
        'At +{P}, {N} should get frequent flyer miles for how far they were from par.',
        '{N} shot {G}. At some point it stops being golf and starts being hiking with a stick.',
        'We\'re told {N} also plays guitar. They should lean into that.',
        '+{P}. {N} didn\'t just lose to the course — they lost to the concept of golf.',
      ],used),wv));
      else if(wVsPar>=20)lines.push(tpl(pick([
        '+{P} for {N}. That\'s a lot of golf.',
        '{N}\'s {G} will not be framed and hung in the den.',
        '{N} set out to break 100. The 100 won.',
        'Somewhere, {N}\'s swing coach felt a disturbance in the force.',
        '{N} played 18 holes of adventure golf today. Not mini golf — adventure.',
      ],used),wv));
      else if(wVsPar>=15)lines.push(tpl(pick([
        '{N} treated par as more of a concept than a target.',
        '+{P} from {N}. The course sends its regards.',
        '{N} had a rough one. The kind of round you lie about at work on Monday.',
        'Tough day for {N}. The cart path saw more of their shots than the fairway.',
        '{N} gave it everything. The course gave it right back. With interest.',
      ],used),wv));
      else if(wVsPar>=10)lines.push(tpl(pick([
        '{N} at +{P}. Not catastrophic, just consistently mediocre.',
        '{N} donated {P} strokes to '+course+' today. Very generous.',
        'Last place for {N} but hey — someone\'s gotta anchor the leaderboard.',
        '{N} battled. The battle was lost, but the effort was noted.',
        '+{P} is survivable. {N} will be back out there tomorrow making the same mistakes.',
      ],used),wv));
      else lines.push(tpl(pick([
        '{N} brings up the rear but it wasn\'t ugly. Just... not pretty.',
        'Last but not least: {N} at {G}. A respectful DFL.',
        '{N} finished last in a group this tight, which is basically a coin flip with extra pain.',
      ],used),wv));
      lines.push('');
    }

    // ══════════════════════════
    // ██  FRONT/BACK SPLITS    ██
    // ══════════════════════════
    var splitStories=[];
    stats.forEach(function(s){
      if(s.frontVsPar===null||s.backVsPar===null)return;
      var diff=s.backVsPar-s.frontVsPar;
      if(diff>=8)splitStories.push({name:s.name,type:'collapse',front:s.front9,back:s.back9,diff:diff});
      else if(diff<=-8)splitStories.push({name:s.name,type:'comeback',front:s.front9,back:s.back9,diff:Math.abs(diff)});
    });
    if(splitStories.length){
      splitStories.forEach(function(ss){
        if(ss.type==='collapse')lines.push(ss.name+' went '+ss.front+'/'+ss.back+'. '+pick([
          'The front 9 was a movie. The back 9 was the sequel nobody asked for.',
          'Something broke on the turn. Mechanically, mentally, spiritually — all of it.',
          'The turn wiped out everything good about the first 9. Brutal.',
          'That back 9... who hurt you, '+ss.name+'?',
          'Front 9 '+ss.name+' and back 9 '+ss.name+' are two different people.',
        ],used));
        else lines.push(ss.name+' went '+ss.front+'/'+ss.back+'. '+pick([
          'Whatever happened on the turn, bottle it.',
          'The back 9 was a completely different human being.',
          'Front 9: lost cause. Back 9: certified baller. Math is weird.',
          ss.name+' decided to start playing golf on hole 10. Better late than never.',
          'The back 9 was revenge golf. The front 9 was just golf.',
        ],used));
      });
      if(splitStories.length)lines.push('');
    }

    // ══════════════════════════
    // ██   HIGHLIGHTS          ██
    // ══════════════════════════
    var hlLines=[];
    stats.forEach(function(s){
      s.eagleHoles.forEach(function(h){
        var sc=getScore(rid,s.pid,h);
        if(sc===1)hlLines.push(pick([
          'ACE on #'+h+'! '+s.name+' goes straight to legend status. Drinks are on them.',
          'HOLE. IN. ONE. '+s.name+', #'+h+'. Stop what you\'re doing and acknowledge greatness.',
          '#'+h+': '+s.name+' put it in the jar. From the tee. An actual ace. This is not a drill.',
        ],used));
        else hlLines.push(s.name+' made eagle on #'+h+'. '+pick([
          'Casual.',
          'Just flexing.',
          'Show-off energy and we\'re here for it.',
          'The kind of hole that makes you forget the other 17.',
          'Two under on a single hole. The math checks out. The ego inflates.',
        ],used));
      });
    });
    if(hlLines.length){
      lines.push('HIGHLIGHTS');
      hlLines.forEach(function(l){lines.push(l);});
      lines.push('');
    }

    // ══════════════════════════
    // ██   BIRDIE WATCH        ██
    // ══════════════════════════
    var birdieGuys=stats.filter(function(s){return s.birdies>0;}).sort(function(a,b){return b.birdies-a.birdies;});
    if(birdieGuys.length){
      lines.push('BIRDIE WATCH');
      birdieGuys.forEach(function(s){
        var hList=s.birdieHoles.map(function(h){return'#'+h;}).join(', ');
        if(s.birdies>=5)lines.push(s.name+': '+s.birdies+' birdies ('+hList+') '+pick(['— absolutely cooking','— on a different level','— the birdie machine','— couldn\'t miss'],used));
        else if(s.birdies>=3)lines.push(s.name+': '+s.birdies+' birdies ('+hList+') '+pick(['— heating up','— finding the bottom of the cup','— making it look routine','— somebody was feeling it'],used));
        else if(s.birdies===2)lines.push(s.name+': 2 birdies ('+hList+') '+pick(['— showing a pulse','— just enough to talk about','— a flicker of talent','— proof of concept'],used));
        else lines.push(s.name+': 1 birdie ('+hList+') '+pick([
          '— a brief flash of competence in an otherwise long day',
          '— they\'ll tell everyone about this one',
          '— lone bright spot',
          '— it counts!',
          '— clung to that one like a life raft',
          '— a single highlight in a reel that needed editing',
        ],used));
      });
      var noBirdies=stats.filter(function(s){return s.birdies===0&&s.gross!==null;});
      if(noBirdies.length){
        var nbNames=noBirdies.map(function(s){return s.name;}).join(', ');
        lines.push(nbNames+': '+pick([
          '0 birdies. The pins were safe all day.',
          'Zero birdies between them. Par 3s everywhere breathe a sigh of relief.',
          'Birdies? Never heard of her. — '+nbNames,
          'Not a single birdie. Just vibes and bogeys.',
          'The birdie-less brigade. They came, they saw, they three-putted.',
          'Combined birdies: 0. Combined excuses: infinite.',
        ],used));
      }
      lines.push('');
    }

    // ══════════════════════════
    // ██   BLOWUP REPORT      ██
    // ══════════════════════════
    var blowups=[];
    stats.forEach(function(s){
      s.blowupHoles.forEach(function(b){
        blowups.push({name:s.name,h:b.h,sc:b.sc,par:b.par,diff:b.diff});
      });
    });
    if(blowups.length){
      blowups.sort(function(a,b){return b.diff-a.diff;});
      lines.push('BLOWUP REPORT');
      blowups.slice(0,7).forEach(function(b){
        var bv={N:b.name,H:''+b.h,S:''+b.sc,D:''+b.diff};
        var q;
        if(b.sc>=10)q=pick([
          '{N} made a {S} on #{H}. At some point you just pick up and apologize to the group.',
          '#{H}: {N} carded a {S}. That\'s not a golf score, that\'s a phone number.',
          'A {S} on #{H} for {N}. We\'d like to speak to their short game coach.',
          '{N} took {S} on #{H}. The hole has filed for emotional damages.',
          '{N} put up a {S} on #{H}. The group behind them aged visibly.',
        ],used);
        else if(b.sc===9)q=pick([
          '{N} took a 9 on #{H}. You could hear the sigh from the parking lot.',
          '#{H}: {N} cards a 9. That\'s a par and a bogey crammed into one hole.',
          'A gentleman\'s 9 for {N} on #{H}. Nothing gentle about it.',
          '{N} put a big ol\' 9 on #{H}. The scorecard winced.',
        ],used);
        else if(b.sc===8)q=pick([
          '{N} built a snowman on #{H}. Frosty would be proud.',
          '#{H}: {N} with the snowman. 8 strokes of pure determination.',
          '{N} went full snowman on #{H}. We don\'t talk about #{H}.',
          'Snowman alert: {N}, #{H}. The kind of hole where you just stare at the card.',
          '{N} carded an 8 on #{H}. The ball spent more time in trouble than on the fairway.',
        ],used);
        else if(b.diff>=4)q=pick([
          '{N}: +{D} on #{H}. That hole owes {N} an apology.',
          '#{H} ate {N} alive. +{D}. Straight into the blender.',
          '{N} donated {D} over par to #{H}. Very charitable.',
          '#{H} won that battle against {N} in decisive fashion. +{D}.',
        ],used);
        else q=pick([
          '{N} stumbled on #{H} with a {S} (+{D}). Happens.',
          '{N} left a few out there on #{H}. +{D}.',
          '#{H} bit {N}. +{D} and a lot of muttering.',
          '{N} would like #{H} back please. +{D}.',
          'A +{D} on #{H} for {N}. The kind of hole you forget about... eventually.',
        ],used);
        lines.push(tpl(q,bv));
      });
      if(blowups.length>7)lines.push('...and '+(blowups.length-7)+' more explosions we don\'t have time for.');
      lines.push('');
    }

    // ══════════════════════════
    // ██  PAR STREAKS / ODDITIES ██
    // ══════════════════════════
    var tidbits=[];
    stats.forEach(function(s){
      if(s.maxStreakPar>=6)tidbits.push(s.name+' strung together '+s.maxStreakPar+' holes of par or better. That\'s called a groove.');
      if(s.pars>=12&&s.birdies===0)tidbits.push(s.name+' made '+s.pars+' pars and zero birdies. The definition of painfully steady.');
      if(s.doubles>=5)tidbits.push(s.name+' made '+s.doubles+' double bogeys. Consistency, just not the good kind.');
      if(s.snowmen>=2)tidbits.push(s.name+' had '+s.snowmen+' snowmen. That\'s a whole ski resort.');
      if(s.bogeys>=10)tidbits.push(s.name+' bogeyed '+s.bogeys+' holes. Bogey golf is still golf. Barely.');
    });
    if(spread>=20&&byGross.length>=2)tidbits.push(spread+' strokes between first and last. That\'s not a leaderboard, it\'s a zip code difference.');
    if(groupVsPar>=20)tidbits.push('Group average: '+groupAvg+' (+'+groupVsPar+'). '+course+' won today. Convincingly.');
    if(groupVsPar<=2&&byGross.length>=3)tidbits.push('Group average: '+groupAvg+'. Solid day across the board. Mark the calendar.');
    if(tidbits.length){
      lines.push('DID YOU KNOW');
      tidbits.slice(0,4).forEach(function(t){lines.push(t);});
      lines.push('');
    }

    // ══════════════════════════
    // ██  PLAYER REPORT CARDS  ██
    // ══════════════════════════
    lines.push('PLAYER REPORT CARDS');
    byGross.forEach(function(s,idx){
      var vp=s.gross-par;
      var fvp=vp===0?'E':vp>0?'+'+vp:''+vp;
      var line=s.name+' — '+s.gross+' ('+fvp+')';
      if(s.hcp)line+=' / net '+s.net;
      line+=' — ';
      var sv={N:s.name,G:''+s.gross,P:''+vp,H:''+s.worstH};
      // contextual burns/praise based on their actual stats
      if(vp<=-5)line+=tpl(pick([
        'Went full tour pro. The group will be hearing about this for years.',
        '{P} is reserved for people who are annoyingly good at golf. That\'s {N} today.',
        'Best round of the trip and it\'s not close. {N} is insufferable right now.',
        'Walking highlight reel. {N} peaked. Enjoy it.',
      ],used),sv);
      else if(vp<=-2)line+=tpl(pick([
        'Dialed in. Fairways and greens all day.',
        'Ball-striking clinic from {N}. Clean, efficient, boring in the best way.',
        'Quiet confidence, loud scorecard. {N} let the clubs do the talking.',
        'Under par. {N} didn\'t need to say a word. The card says enough.',
      ],used),sv);
      else if(vp<=0)line+=tpl(pick([
        'Even par is nothing to sneeze at. Steady Eddie performance.',
        'The boring kind of good. {N} just made pars and went home.',
        'Textbook round. Not flashy, just effective.',
        'Par golf from {N}. In this group? That\'s Rory territory.',
      ],used),sv);
      else if(vp<=3)line+=tpl(pick([
        'A bogey or two away from something special.',
        'Solid card with a couple soft spots. {N}\'ll stew on what could\'ve been.',
        'Right there. +{P} is a lip-out from even. Not bad at all.',
        'Respectable. The kind of round where you say "I\'ll take it" and mean it.',
      ],used),sv);
      else if(vp<=6)line+=tpl(pick([
        'Some good holes got buried by a few bad ones.',
        'Flashes of brilliance surrounded by flashes of... the other thing.',
        'Not a disaster, not a masterpiece. Just a regular day at the office.',
        '+{P} in this group puts you right in the mix. {N} survived.',
      ],used),sv);
      else if(vp<=10)line+=tpl(pick([
        'A round of two halves. Unfortunately both halves were over par.',
        '{N} fought the course and the course won a split decision.',
        'There were moments. None of them lasted, but they were there.',
        'Kept grinding even when the card got ugly. Respect for the effort.',
        'The kind of round where you skip the beer and go straight to whiskey.',
      ],used),sv);
      else if(vp<=15)line+=tpl(pick([
        'The course ate {N}\'s lunch, dinner, and midnight snack.',
        'A character-building experience. {N} is now tougher for it. Probably.',
        '{N}\'s scorecard read like a horror novel.',
        'Rough one. '+course+' showed no mercy.',
        'There\'s always tomorrow. Which is good, because today was ugly.',
      ],used),sv);
      else if(vp<=20)line+=tpl(pick([
        'The less said the better. +{P}. Moving on.',
        '{N} played 18 holes of something. We\'re not sure it was golf.',
        'Legend has it {N} is still looking for their ball somewhere near #{H}.',
        'The trees saw more of {N} than the fairway did. +{P} and counting.',
        '{N} gave it everything. Everything was not enough.',
        'Thoughts and prayers for {N}\'s scorecard. And their wallet.',
      ],used),sv);
      else line+=tpl(pick([
        '{G}. We\'ve alerted the proper authorities.',
        'Did {N} play with a blindfold? Because +{P} raises questions.',
        '{G} strokes of pure, uncut chaos. {N} is a menace.',
        'Should we check if {N} was holding the club the right way?',
        '{N} set a record today. Not a good one.',
        'At some point it stops being a round and starts being a safari.',
        '{G}. The cart girl felt bad. The starter felt bad. We all felt bad.',
      ],used),sv);
      lines.push(line);
    });
    lines.push('');

    // ══════════════════════════
    // ██   SETTLEMENT          ██
    // ══════════════════════════
    var settle=computeFullSettlement(rid);
    if(settle&&settle.gameLines&&settle.gameLines.length){
      lines.push('THE BILL');
      settle.gameLines.forEach(function(gl){
        lines.push(gl.game+': '+gl.line);
      });
      var sortedNet=settle.netArr.slice().sort(function(a,b){return a.net-b.net;});
      var poorest=sortedNet[0];
      var richest=sortedNet[sortedNet.length-1];
      if(richest&&richest.net>0&&poorest&&poorest.net<0){
        lines.push('');
        lines.push(pick([
          richest.name+' walks away up $'+richest.net+'. '+poorest.name+' is reaching for the Venmo.',
          poorest.name+' is down $'+Math.abs(poorest.net)+'. '+richest.name+' is buying nothing tonight.',
          richest.name+': +$'+richest.net+'. '+poorest.name+': -$'+Math.abs(poorest.net)+'. Golf giveth and golf taketh away.',
          'The money flows from '+poorest.name+'\'s wallet to '+richest.name+'\'s. As is tradition.',
          poorest.name+' owes $'+Math.abs(poorest.net)+'. This is what happens when you shoot '+((byGross.find(function(s){return s.name===poorest.name;})||{}).gross||'that')+' and bet on yourself.',
        ],used));
      }
    }

    lines.push('');
    lines.push('— sent from GolfWizard');

    return lines.join('\n');
  }

  // ── Share recap text + optional scorecard image ──
  function shareRecap(){
    if(!activeRound.value){showToast('No round selected');return;}
    var rid=activeRound.value.id;
    var text=generateRecap(rid);
    showToast('Generating recap...');

    // Try to attach scorecard image
    _captureScorecard().then(function(file){
      if(navigator.share&&navigator.canShare){
        var shareData={text:text,title:'Round Recap'};
        // Try with image first
        if(navigator.canShare({files:[file]})){
          shareData.files=[file];
        }
        navigator.share(shareData).then(function(){
          showToast('Recap sent!');
        }).catch(function(e){
          if(e.name!=='AbortError')showToast('Share cancelled');
        });
      }else{
        // Fallback: copy text to clipboard
        navigator.clipboard.writeText(text).then(function(){
          showToast('Recap copied to clipboard!');
        }).catch(function(){
          showToast('Could not copy recap');
        });
      }
    }).catch(function(){
      // No scorecard image — share text only
      if(navigator.share){
        navigator.share({text:text,title:'Round Recap'}).then(function(){
          showToast('Recap sent!');
        }).catch(function(e){
          if(e.name!=='AbortError')showToast('Share cancelled');
        });
      }else{
        navigator.clipboard.writeText(text).then(function(){
          showToast('Recap copied to clipboard!');
        }).catch(function(){showToast('Could not copy');});
      }
    });
  }

  // Copy recap text only (no image)
  function copyRecap(){
    if(!activeRound.value){showToast('No round selected');return;}
    var text=generateRecap(activeRound.value.id);
    if(navigator.clipboard){
      navigator.clipboard.writeText(text).then(function(){
        showToast('Recap copied!');
      }).catch(function(){showToast('Copy failed');});
    }else{
      showToast('Clipboard not available');
    }
  }

  function toggleGps(){
    showGps.value=!showGps.value;
    if(showGps.value){
      updateGpsDistance();
      startGpsWatch();
    }else{
      stopGpsWatch();
      gpsDistance.value=null;
    }
  }

  // part: 'center'|'front'|'back'
  function captureGreenGps(part){
    var course=activeRound.value&&activeRound.value.course;
    var hole=activeHole.value;
    if(!course||!hole)return;
    if(!navigator.geolocation){alert('GPS not available on this device');return;}
    var partLabel=part||'center';
    var labels={center:'center of green',front:'front edge of green',back:'back edge of green'};
    var confirmed=confirm('Save your current GPS position as the '+labels[partLabel]+' for '+course+' hole '+hole+'?\n\nStand at the '+labels[partLabel]+' before tapping OK.');
    if(!confirmed)return;
    navigator.geolocation.getCurrentPosition(function(pos){
      var lat=Math.round(pos.coords.latitude*1e7)/1e7;
      var lng=Math.round(pos.coords.longitude*1e7)/1e7;
      var cache=Object.assign({},golfCourseCache.value);
      if(!cache[course])cache[course]={holes:[]};
      var holes=cache[course].holes.slice();
      while(holes.length<18)holes.push({lat:0,lng:0});
      var existing=Object.assign({},holes[hole-1]||{});
      if(partLabel==='center'){existing.lat=lat;existing.lng=lng;}
      else if(partLabel==='front'){existing.front_lat=lat;existing.front_lng=lng;}
      else if(partLabel==='back'){existing.back_lat=lat;existing.back_lng=lng;}
      holes[hole-1]=existing;
      cache[course]={holes:holes,courseId:cache[course].courseId||null};
      golfCourseCache.value=cache;
      try{localStorage.setItem('gw_gps_cache',JSON.stringify(cache));}catch(e){}
      alert('Saved '+partLabel+' GPS for hole '+hole+':\n'+lat+', '+lng);
    },function(err){
      alert('Could not get GPS position: '+(err.code===1?'Permission denied':err.message));
    },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  }


  // ══════════════════════════════════════════════════
  // ── HI-LOW GAME ──
  // 2v2: per hole, 3 points available
  // 1pt Low Ball (best individual), 1pt High Ball (better worst score), 1pt Aggregate (lower combined)
  // ══════════════════════════════════════════════════
  function computeHiLow(rid, gameObj){
    var g=gameObj||(T.gameRounds[rid]||[]).find(function(x){return x.type==='hilow';});
    if(!g)return null;
    var c=g.config||{};
    var hlUseNet=c.netGross!=='gross';var hlHcpPct=(c.hcpPercent||100)/100;
    var t1=c.team1||[],t2=c.team2||[];
    if(!t1.length||!t2.length)return null;
    var r=T.rounds.find(function(r){return r.id===rid;});
    if(!r)return null;
    var nc=holeCount(r.course);
    var ppt=c.ppt||1;
    var carry=!!c.carry;          // ties push points to next hole
    var birdieBonus=!!c.birdieBonus; // natural birdie doubles hole points
    var allHlPids=t1.concat(t2);
    var t1pts=0,t2pts=0;
    var holes=[];
    var carryLow=0,carryHigh=0,carryAgg=0; // accumulated carry points
    for(var h=1;h<=nc;h++){
      var t1nets=t1.map(function(pid){var sc=getScore(rid,pid,h);var hcp=gameAdjHcp(pid,rid,allHlPids);return sc!=null?(hlUseNet?sc-strokesOnHole(Math.round(hcp*hlHcpPct),holeSI(r.course,h)):sc):null;}).filter(function(x){return x!==null;});
      var t2nets=t2.map(function(pid){var sc=getScore(rid,pid,h);var hcp=gameAdjHcp(pid,rid,allHlPids);return sc!=null?(hlUseNet?sc-strokesOnHole(Math.round(hcp*hlHcpPct),holeSI(r.course,h)):sc):null;}).filter(function(x){return x!==null;});
      if(!t1nets.length||!t2nets.length){holes.push({h:h,lowWin:null,highWin:null,aggWin:null,mult:1,carried:false});continue;}
      var t1low=Math.min.apply(null,t1nets),t1high=Math.max.apply(null,t1nets);
      var t2low=Math.min.apply(null,t2nets),t2high=Math.max.apply(null,t2nets);
      var t1agg=t1nets.reduce(function(a,b){return a+b;},0);
      var t2agg=t2nets.reduce(function(a,b){return a+b;},0);
      var lowWin=t1low<t2low?1:t2low<t1low?2:0;
      var highWin=t1high<t2high?1:t2high<t1high?2:0;
      var aggWin=t1agg<t2agg?1:t2agg<t1agg?2:0;
      // Birdie bonus: check if any player on either team made a natural (gross) birdie
      var mult=1;
      if(birdieBonus){
        var par=holePar(r.course,h);
        var hasBirdie=false;
        t1.concat(t2).forEach(function(pid){var sc=getScore(rid,pid,h);if(sc!=null&&sc<par)hasBirdie=true;});
        if(hasBirdie)mult=2;
      }
      // Carry logic: tied points carry forward
      var lowPts=(1+carryLow)*ppt*mult;
      var highPts=(1+carryHigh)*ppt*mult;
      var aggPts=(1+carryAgg)*ppt*mult;
      var holeCarried=carryLow>0||carryHigh>0||carryAgg>0;
      if(lowWin===1)t1pts+=lowPts;else if(lowWin===2)t2pts+=lowPts;
      if(highWin===1)t1pts+=highPts;else if(highWin===2)t2pts+=highPts;
      if(aggWin===1)t1pts+=aggPts;else if(aggWin===2)t2pts+=aggPts;
      // Update carries
      if(carry){
        carryLow=lowWin===0?carryLow+1:0;
        carryHigh=highWin===0?carryHigh+1:0;
        carryAgg=aggWin===0?carryAgg+1:0;
      }
      holes.push({h:h,lowWin:lowWin,highWin:highWin,aggWin:aggWin,t1low:t1low,t2low:t2low,t1high:t1high,t2high:t2high,t1agg:t1agg,t2agg:t2agg,mult:mult,carried:holeCarried,lowPts:lowPts,highPts:highPts,aggPts:aggPts});
    }
    var t1n=t1.map(function(p){return pDisplay(p);}).join('+');
    var t2n=t2.map(function(p){return pDisplay(p);}).join('+');
    return{t1pts:t1pts,t2pts:t2pts,t1n:t1n,t2n:t2n,holes:holes,ppt:ppt,net:t1pts-t2pts,carry:carry,birdieBonus:birdieBonus};
  }

  // ══════════════════════════════════════════════════
  // ── SIXES / ROUND ROBIN GAME ──
  // 4 players rotate partners every 6 holes
  // H1-6: P1+P2 vs P3+P4; H7-12: P1+P3 vs P2+P4; H13-18: P1+P4 vs P2+P3
  // Best ball 2v2 each segment; $ per segment won
  // ══════════════════════════════════════════════════
  function computeSixes(rid, tData){
    var tSrc=tData||T;
    var g=(tSrc.gameRounds[rid]||[]).find(function(x){return x.type==='sixes';});
    if(!g)return null;
    var c=g.config||{};
    var sxUseNet=c.netGross!=='gross';var sxHcpPct=(c.hcpPercent||100)/100;
    var sxRoundPlayers=tData?tData.players.map(function(p){return p.id;}):roundPlayers(rid);
    var pids=c.players||sxRoundPlayers;
    if(pids.length<4)return null;
    var p1=pids[0],p2=pids[1],p3=pids[2],p4=pids[3];
    var r=tSrc.rounds.find(function(r){return r.id===rid;});
    if(!r)return null;
    var ppt=c.ppt||5;
    var nameFunc=tData?function(p){return tData.players.find(function(pl){return pl.id===p;})?.short||p;}:pDisplay;
    // Three 6-hole segments with rotating partners
    var segments=[
      {fromH:1,toH:6,t1:[p1,p2],t2:[p3,p4],label:'H1-6'},
      {fromH:7,toH:12,t1:[p1,p3],t2:[p2,p4],label:'H7-12'},
      {fromH:13,toH:18,t1:[p1,p4],t2:[p2,p3],label:'H13-18'},
    ];
    var totals={};
    pids.forEach(function(p){totals[p]=0;});
    var segResults=segments.map(function(seg){
      var t1pts=0,t2pts=0;
      for(var h=seg.fromH;h<=seg.toH;h++){
        // Compute low-man differential across all 4 players
        var minHcp=Infinity;
        pids.forEach(function(p2){var h2=tData?tData.players.find(function(x){return x.id===p2;})?.roundHcp?.[rid]??Math.round(tData.players.find(function(x){return x.id===p2;})?.ghin||0):pRoundHcp(p2,rid);if(h2<minHcp)minHcp=h2;});
        var t1nets=seg.t1.map(function(pid){var sc=tData?(tData.scores?.[rid]?.[pid]?.[h]||null):getScore(rid,pid,h);if(sc==null)return null;var pl=tData?tData.players.find(function(x){return x.id===pid;}):null;var rawHcp=tData?(pl?.roundHcp?.[rid]??Math.round(pl?.ghin||0)):pRoundHcp(pid,rid);var adjHcp=Math.max(0,rawHcp-(minHcp===Infinity?0:minHcp));return sxUseNet?sc-strokesOnHole(Math.round(adjHcp*sxHcpPct),holeSI(r.course,h)):sc;}).filter(function(x){return x!==null;});
        var t2nets=seg.t2.map(function(pid){var sc=tData?(tData.scores?.[rid]?.[pid]?.[h]||null):getScore(rid,pid,h);if(sc==null)return null;var pl=tData?tData.players.find(function(x){return x.id===pid;}):null;var rawHcp=tData?(pl?.roundHcp?.[rid]??Math.round(pl?.ghin||0)):pRoundHcp(pid,rid);var adjHcp=Math.max(0,rawHcp-(minHcp===Infinity?0:minHcp));return sxUseNet?sc-strokesOnHole(Math.round(adjHcp*sxHcpPct),holeSI(r.course,h)):sc;}).filter(function(x){return x!==null;});
        if(!t1nets.length||!t2nets.length)continue;
        var b1=Math.min.apply(null,t1nets),b2=Math.min.apply(null,t2nets);
        if(b1<b2)t1pts++;else if(b2<b1)t2pts++;
      }
      var winner=t1pts>t2pts?'t1':t2pts>t1pts?'t2':'tie';
      if(winner==='t1'){seg.t1.forEach(function(p){if(totals[p]!=null)totals[p]+=ppt;});seg.t2.forEach(function(p){if(totals[p]!=null)totals[p]-=ppt;});}
      else if(winner==='t2'){seg.t2.forEach(function(p){if(totals[p]!=null)totals[p]+=ppt;});seg.t1.forEach(function(p){if(totals[p]!=null)totals[p]-=ppt;});}
      var t1n=seg.t1.map(function(p){return nameFunc(p);}).join('+');
      var t2n=seg.t2.map(function(p){return nameFunc(p);}).join('+');
      return{label:seg.label,t1:seg.t1,t2:seg.t2,t1n:t1n,t2n:t2n,t1pts:t1pts,t2pts:t2pts,winner:winner,ppt:ppt};
    });
    var lines=pids.map(function(p){return{pid:p,name:nameFunc(p),net:totals[p]||0};}).sort(function(a,b){return b.net-a.net;});
    return{segments:segResults,lines:lines,pids:pids,ppt:ppt};
  }

  // ══════════════════════════════════════════════════
  // ── SCOTCH 6s (SIX-POINT SCOTCH) — 2v2 ──
  // 6 points per hole:
  //   2 = low ball (best net)
  //   2 = low total (combined net)
  //   1 = prox (closest to pin, manually awarded)
  //   1 = birdie (net birdie made, manually awarded)
  // Umbrella: one team sweeps all 6 → doubled to 12
  // Presses: trailing team can press, doubling point value
  // ══════════════════════════════════════════════════
  function computeScotch6s(rid, tData){
    var tSrc=tData||T;
    var g=(tSrc.gameRounds[rid]||[]).find(function(x){return x.type==='scotch6s';});
    if(!g)return null;
    var c=g.config||{};
    var scUseNet=c.netGross!=='gross';
    var scHcpPct=(c.hcpPercent||100)/100;
    var t1=c.team1||[];var t2=c.team2||[];
    if(t1.length<2||t2.length<2)return null;
    var r=tSrc.rounds.find(function(r){return r.id===rid;});
    if(!r)return null;
    var nc=holeCount(r.course);
    var ppt=c.ppt||1;
    var nameFunc=tData?function(p){return tData.players.find(function(pl){return pl.id===p;})?.short||p;}:pDisplay;
    var t1n=t1.map(function(p){return nameFunc(p);}).join('+');
    var t2n=t2.map(function(p){return nameFunc(p);}).join('+');
    var awards=c.awards||{}; // awards[hole]={prox:'t1'|'t2'|null, birdie:'t1'|'t2'|'both'|null}
    var presses=c.presses||[]; // [{hole:N, team:'t1'|'t2'}]
    var rolls=c.rolls||{}; // rolls[hole]=2|4 (roll multiplier)

    // Build press multiplier per hole
    var pressMult=[];
    for(var ph=1;ph<=nc;ph++)pressMult[ph]=1;
    presses.forEach(function(pr){
      for(var ph=pr.hole;ph<=nc;ph++)pressMult[ph]*=2;
    });

    var t1total=0,t2total=0;
    var holes=[];
    var played=0;

    // Compute from/to
    var scFrom=r.holesMode==='back9'?10:1;
    var scTo=r.holesMode==='front9'?Math.min(9,nc):nc;

    for(var h=scFrom;h<=scTo;h++){
      var mult=pressMult[h]||1;
      var hAwards=awards[h]||{};
      var t1hPts=0,t2hPts=0;
      var detail={h:h,mult:mult,lowBall:null,lowTotal:null,prox:null,birdie:null,umbrella:false};

      // Get net scores for each player
      var getNet=function(pid){
        var sc=tData?(tData.scores?.[rid]?.[pid]?.[h]||null):getScore(rid,pid,h);
        if(sc==null)return null;
        var pl=tData?tData.players.find(function(x){return x.id===pid;}):null;
        var hcp=tData?(pl?.roundHcp?.[rid]??Math.round(pl?.ghin||0)):pRoundHcp(pid,rid);
        return scUseNet?sc-strokesOnHole(Math.round(hcp*scHcpPct),holeSI(r.course,h)):sc;
      };

      var t1nets=t1.map(function(pid){return getNet(pid);});
      var t2nets=t2.map(function(pid){return getNet(pid);});
      var t1valid=t1nets.filter(function(x){return x!==null;});
      var t2valid=t2nets.filter(function(x){return x!==null;});

      if(!t1valid.length||!t2valid.length){
        holes.push(detail);
        continue;
      }
      played++;

      // Low ball (2 pts) — best single net score
      var t1low=Math.min.apply(null,t1valid);
      var t2low=Math.min.apply(null,t2valid);
      if(t1low<t2low){t1hPts+=2;detail.lowBall='t1';}
      else if(t2low<t1low){t2hPts+=2;detail.lowBall='t2';}
      // tie = no points

      // Low total (2 pts) — combined net scores
      var t1sum=t1valid.reduce(function(a,b){return a+b;},0);
      var t2sum=t2valid.reduce(function(a,b){return a+b;},0);
      if(t1sum<t2sum){t1hPts+=2;detail.lowTotal='t1';}
      else if(t2sum<t1sum){t2hPts+=2;detail.lowTotal='t2';}

      // Prox (1 pt) — manually awarded
      if(hAwards.prox==='t1'){t1hPts+=1;detail.prox='t1';}
      else if(hAwards.prox==='t2'){t2hPts+=1;detail.prox='t2';}

      // Birdie (1 pt) — auto-detected from scores
      var birdieMode=c.birdieMode||'gross';
      var par=holePar(r.course,h);
      var t1Birdie=false,t2Birdie=false;
      if(birdieMode==='gross'){
        t1.forEach(function(pid){
          var sc=tData?(tData.scores?.[rid]?.[pid]?.[h]||null):getScore(rid,pid,h);
          if(sc!=null&&sc<par)t1Birdie=true;
        });
        t2.forEach(function(pid){
          var sc=tData?(tData.scores?.[rid]?.[pid]?.[h]||null):getScore(rid,pid,h);
          if(sc!=null&&sc<par)t2Birdie=true;
        });
      }else{
        // Net birdie
        t1valid.forEach(function(net){if(net<par)t1Birdie=true;});
        t2valid.forEach(function(net){if(net<par)t2Birdie=true;});
      }
      // Allow manual override
      if(hAwards.birdie){
        t1Birdie=hAwards.birdie==='t1'||hAwards.birdie==='both';
        t2Birdie=hAwards.birdie==='t2'||hAwards.birdie==='both';
      }
      if(t1Birdie&&t2Birdie){t1hPts+=1;t2hPts+=1;detail.birdie='both';}
      else if(t1Birdie){t1hPts+=1;detail.birdie='t1';}
      else if(t2Birdie){t2hPts+=1;detail.birdie='t2';}

      // Umbrella check: one team sweeps all awarded points (and total is 6)
      var totalPts=t1hPts+t2hPts;
      if(totalPts>=6&&(t1hPts===0||t2hPts===0)){
        // Umbrella — double all points on this hole
        if(t1hPts>0){t1hPts=12;t2hPts=0;}
        else{t2hPts=12;t1hPts=0;}
        detail.umbrella=true;
      }

      // Get roll multiplier (independent of press)
      var rollMult=rolls[String(h)]||1;

      // Apply press multiplier (main bet) + independent roll bonus (side bet)
      detail.t1pts=t1hPts*mult+(rollMult>1?t1hPts*(rollMult-1):0);
      detail.t2pts=t2hPts*mult+(rollMult>1?t2hPts*(rollMult-1):0);
      detail.rollMult=rollMult;
      t1total+=detail.t1pts;
      t2total+=detail.t2pts;
      holes.push(detail);
    }

    if(!played)return null;

    var diff=t1total-t2total;
    var leader=diff>0?t1n:diff<0?t2n:null;
    var status;
    if(played>=(scTo-scFrom+1)){
      status=diff===0?'Tied':leader+' wins '+Math.max(t1total,t2total)+'-'+Math.min(t1total,t2total);
    }else{
      status=diff===0?'All Square':leader+' leads '+Math.max(t1total,t2total)+'-'+Math.min(t1total,t2total);
    }

    return{
      t1:t1,t2:t2,t1n:t1n,t2n:t2n,
      t1total:t1total,t2total:t2total,diff:diff,
      holes:holes,status:status,played:played,
      totalHoles:scTo-scFrom+1,ppt:ppt,
      presses:presses,awards:awards,
      net:diff
    };
  }

  // ══════════════════════════════════════════════════
  // ── 5-3-1 (NINES) GAME — 3 PLAYERS ──
  // 9 points per hole: low=5, mid=3, high=1
  // Ties: two tie for low → 4/4/1; two tie for high → 5/2/2; all tie → 3/3/3
  // Win by 2+ strokes → gets all 9 points (blitz)
  // ══════════════════════════════════════════════════
  function computeFiveThreeOne(rid){
    var g=(T.gameRounds[rid]||[]).find(function(x){return x.type==='fiveThreeOne';});
    if(!g)return null;
    var c=g.config||{};
    var ftUseNet=c.netGross!=='gross';var ftHcpPct=(c.hcpPercent||100)/100;
    // Use ONLY the 3 selected players, not all round players
    var pids=(c.players&&c.players.length===3)?c.players:null;
    if(!pids)return null;
    var r=T.rounds.find(function(r){return r.id===rid;});
    if(!r)return null;
    var nc=holeCount(r.course);
    var ppt=c.ppt||1;
    var useBlitz=c.blitz!==false; // optional blitz, default on
    var totals={};pids.forEach(function(p){totals[p]=0;});
    var holeLog=[];
    for(var h=1;h<=nc;h++){
      // Net scores only
      var nets=pids.map(function(pid){
        var sc=getScore(rid,pid,h);
        if(sc==null)return null;
        return{pid:pid,net:ftUseNet?sc-strokesOnHole(Math.round(gameAdjHcp(pid,rid,pids)*ftHcpPct),holeSI(r.course,h)):sc};
      });
      if(nets.some(function(x){return x===null;})){holeLog.push({h:h,pts:null});continue;}
      var sorted=nets.slice().sort(function(a,b){return a.net-b.net;});
      var pts={};pids.forEach(function(p){pts[p]=0;});
      if(useBlitz&&sorted[0].net<=sorted[1].net-2){
        pts[sorted[0].pid]=9;
      } else {
        var low=sorted[0].net,mid=sorted[1].net,high=sorted[2].net;
        if(low===mid&&mid===high){pids.forEach(function(p){pts[p]=3;});}
        else if(low===mid){pts[sorted[0].pid]=4;pts[sorted[1].pid]=4;pts[sorted[2].pid]=1;}
        else if(mid===high){pts[sorted[0].pid]=5;pts[sorted[1].pid]=2;pts[sorted[2].pid]=2;}
        else{pts[sorted[0].pid]=5;pts[sorted[1].pid]=3;pts[sorted[2].pid]=1;}
      }
      pids.forEach(function(p){totals[p]+=pts[p]||0;});
      holeLog.push({h:h,pts:JSON.parse(JSON.stringify(pts)),nets:nets});
    }
    var lines=pids.map(function(p){
      return{pid:p,name:pDisplay(p),pts:totals[p]||0,dollars:(totals[p]||0)*ppt};
    }).sort(function(a,b){return b.pts-a.pts;});
    // Ladder payouts: 1st collects from 2nd and 3rd; 2nd collects from 3rd
    var settlements=[];
    if(lines.length===3){
      var diff12=(lines[0].pts-lines[1].pts)*ppt;
      var diff13=(lines[0].pts-lines[2].pts)*ppt;
      var diff23=(lines[1].pts-lines[2].pts)*ppt;
      if(diff12>0)settlements.push({from:lines[1].name,to:lines[0].name,amt:diff12});
      if(diff13>0)settlements.push({from:lines[2].name,to:lines[0].name,amt:diff13});
      if(diff23>0)settlements.push({from:lines[2].name,to:lines[1].name,amt:diff23});
    }
    return{lines:lines,ppt:ppt,holeLog:holeLog,settlements:settlements,useBlitz:useBlitz};
  }

  // ══════════════════════════════════════════════════
  // ── STABLEFORD GAME ──
  // Standard: Double bogey+=0, Bogey=1, Par=2, Birdie=3, Eagle=4, Albatross+=5
  // Modified (PGA): Double bogey+=-3, Bogey=-1, Par=0, Birdie=+2, Eagle=+5, Albatross+=+8
  // Team: combined (sum) stableford per team per hole
  // ══════════════════════════════════════════════════
  function stablefordPoints(netScore, par, variant, customScale) {
    var diff = netScore - par;
    if (variant === 'custom' && customScale) {
      if (diff <= -3) return customScale.albatross != null ? customScale.albatross : 5;
      if (diff === -2) return customScale.eagle != null ? customScale.eagle : 4;
      if (diff === -1) return customScale.birdie != null ? customScale.birdie : 2;
      if (diff === 0) return customScale.par != null ? customScale.par : 1;
      if (diff === 1) return customScale.bogey != null ? customScale.bogey : 0;
      return customScale.dblBogey != null ? customScale.dblBogey : -2;
    }
    if (variant === 'modified') {
      if (diff <= -3) return 8;
      if (diff === -2) return 5;
      if (diff === -1) return 2;
      if (diff === 0) return 0;
      if (diff === 1) return -1;
      return -3;
    }
    // Standard
    if (diff <= -3) return 5;
    if (diff === -2) return 4;
    if (diff === -1) return 3;
    if (diff === 0) return 2;
    if (diff === 1) return 1;
    return 0;
  }

  function computeStableford(rid, team1, team2, variant, gameConfig, tData) {
    var tSrc = tData || T;
    var r = tSrc.rounds.find(function(r) { return r.id === rid; });
    if (!r) return null;
    var stc = gameConfig || {};
    var stUseNet = stc.netGross !== 'gross';
    var stHcpPct = (stc.hcpPercent || 100) / 100;
    // Compute from/to from round data directly (avoid roundFromH which reads T)
    var stNc = holeCount(r.course);
    var stFrom = r.holesMode === 'back9' ? 10 : 1;
    var stTo = r.holesMode === 'front9' ? Math.min(9, stNc) : stNc;
    var v = variant || 'standard';
    var cScale = stc.scale || null;
    var t1total = 0, t2total = 0;
    var holes = [];
    var played = 0;

    for (var h = stFrom; h <= stTo; h++) {
      var t1pts = team1.map(function(pid) {
        var sc = tData ? (tData.scores?.[rid]?.[pid]?.[h]||null) : getScore(rid, pid, h);
        if (sc == null) return null;
        var pl = tData ? tData.players.find(function(x){return x.id===pid;}) : null;
        var hcp = tData ? (pl?.roundHcp?.[rid]??Math.round(pl?.ghin||0)) : pRoundHcp(pid, rid);
        var net = stUseNet ? sc - strokesOnHole(Math.round(hcp * stHcpPct), holeSI(r.course, h)) : sc;
        return stablefordPoints(net, holePar(r.course, h), v, cScale);
      });
      var t2pts = team2.map(function(pid) {
        var sc = tData ? (tData.scores?.[rid]?.[pid]?.[h]||null) : getScore(rid, pid, h);
        if (sc == null) return null;
        var pl = tData ? tData.players.find(function(x){return x.id===pid;}) : null;
        var hcp = tData ? (pl?.roundHcp?.[rid]??Math.round(pl?.ghin||0)) : pRoundHcp(pid, rid);
        var net = stUseNet ? sc - strokesOnHole(Math.round(hcp * stHcpPct), holeSI(r.course, h)) : sc;
        return stablefordPoints(net, holePar(r.course, h), v, cScale);
      });

      var t1valid = t1pts.filter(function(x) { return x !== null; });
      var t2valid = t2pts.filter(function(x) { return x !== null; });

      if (!t1valid.length || !t2valid.length) {
        holes.push({ h: h, t1best: null, t2best: null, diff: null });
        continue;
      }

      // Team mode: aggregate (sum) or bestball (max)
      var isBB = stc.teamMode === 'bestball';
      var t1best = isBB ? Math.max.apply(null, t1valid) : t1valid.reduce(function(a,b){return a+b;},0);
      var t2best = isBB ? Math.max.apply(null, t2valid) : t2valid.reduce(function(a,b){return a+b;},0);
      t1total += t1best;
      t2total += t2best;
      played++;
      holes.push({ h: h, t1best: t1best, t2best: t2best, diff: t1best - t2best, t1total: t1total, t2total: t2total });
    }

    if (!played) return null;

    var nameFunc = tData ? function(p){return tData.players.find(function(pl){return pl.id===p;})?.short||p;} : pDisplay;
    var t1n = team1.map(function(p) { return nameFunc(p); }).join('+');
    var t2n = team2.map(function(p) { return nameFunc(p); }).join('+');
    var diff = t1total - t2total;
    var leader = diff > 0 ? t1n : diff < 0 ? t2n : null;
    var status = diff === 0 ? 'All Square' : leader + ' leads by ' + Math.abs(diff) + ' pts';
    if (played >= (stTo - stFrom + 1)) {
      status = diff === 0 ? 'Tied' : leader + ' wins ' + Math.max(t1total, t2total) + '-' + Math.min(t1total, t2total);
    }

    return {
      t1n: t1n, t2n: t2n, t1total: t1total, t2total: t2total, diff: diff,
      holes: holes, status: status, variant: v, played: played,
      totalHoles: stTo - stFrom + 1, net: diff
    };
  }

  // Individual stableford — all players, returns sorted leaderboard
  function computeStablefordIndividual(rid, pids, variant, gameConfig) {
    var r = T.rounds.find(function(r) { return r.id === rid; });
    if (!r) return null;
    var sic = gameConfig || {};
    var siUseNet = sic.netGross !== 'gross';
    var siHcpPct = (sic.hcpPercent || 100) / 100;
    var from = roundFromH(rid), to = roundToH(rid);
    var v = variant || 'standard';
    var siScale = sic.scale || null;
    var totals = {};
    pids.forEach(function(p) { totals[p] = 0; });

    for (var h = from; h <= to; h++) {
      pids.forEach(function(pid) {
        var sc = getScore(rid, pid, h);
        if (sc == null) return;
        var net = siUseNet ? sc - strokesOnHole(Math.round(pRoundHcp(pid, rid) * siHcpPct), holeSI(r.course, h)) : sc;
        totals[pid] += stablefordPoints(net, holePar(r.course, h), v, siScale);
      });
    }

    var lines = pids.map(function(p) {
      return { pid: p, name: pDisplay(p), pts: totals[p] || 0 };
    }).sort(function(a, b) { return b.pts - a.pts; });

    return { lines: lines, variant: v };
  }

  // ══════════════════════════════════════════════════
  // ── TEAM DAY GAME ──
  // Per hole: take best N net + best M gross from each team
  // Sum aggregate across 18, lower total wins
  // Default: best 2 net + best 1 gross
  // ══════════════════════════════════════════════════
  function computeTeamDay(rid, team1, team2, bestNets, bestGross) {
    var r = T.rounds.find(function(r) { return r.id === rid; });
    if (!r) return null;
    var from = roundFromH(rid), to = roundToH(rid);
    var nNets = bestNets || 2;
    var nGross = bestGross || 1;
    var t1agg = 0, t2agg = 0;
    var holes = [];
    var played = 0;

    for (var h = from; h <= to; h++) {
      var getTeamScores = function(team) {
        var scores = [];
        team.forEach(function(pid) {
          var sc = getScore(rid, pid, h);
          if (sc == null) return;
          var net = sc - strokesOnHole(pRoundHcp(pid, rid), holeSI(r.course, h));
          scores.push({ pid: pid, gross: sc, net: net });
        });
        return scores;
      };

      var t1scores = getTeamScores(team1);
      var t2scores = getTeamScores(team2);

      var t1enough = t1scores.length >= Math.max(nNets, nGross);
      var t2enough = t2scores.length >= Math.max(nNets, nGross);

      if (!t1enough && !t2enough) {
        holes.push({ h: h, t1hole: null, t2hole: null });
        continue;
      }

      var calcHole = function(scores) {
        var byNet = scores.slice().sort(function(a, b) { return a.net - b.net; });
        var byGross = scores.slice().sort(function(a, b) { return a.gross - b.gross; });
        var netSum = 0;
        for (var i = 0; i < nNets && i < byNet.length; i++) netSum += byNet[i].net;
        var grossSum = 0;
        for (var i = 0; i < nGross && i < byGross.length; i++) grossSum += byGross[i].gross;
        return netSum + grossSum;
      };

      var t1hole = t1enough ? calcHole(t1scores) : null;
      var t2hole = t2enough ? calcHole(t2scores) : null;
      if (t1hole !== null) t1agg += t1hole;
      if (t2hole !== null) t2agg += t2hole;
      played++;
      holes.push({ h: h, t1hole: t1hole, t2hole: t2hole, t1agg: t1agg, t2agg: t2agg });
    }

    if (!played) return null;

    var t1n = team1.map(function(p) { return pDisplay(p); }).join('+');
    var t2n = team2.map(function(p) { return pDisplay(p); }).join('+');
    // Short labels for status lines (avoid 4-name strings)
    var t1short = team1.map(function(p){return pShort(p);}).join('+');
    var t2short = team2.map(function(p){return pShort(p);}).join('+');
    var diff = t1agg - t2agg; // negative = t1 winning (lower is better)
    var leader = diff < 0 ? t1short : diff > 0 ? t2short : null;
    var totalHoles = to - from + 1;
    var status = diff === 0 ? 'All Square' : leader + ' leads by ' + Math.abs(diff);
    if (played >= totalHoles) {
      status = diff === 0 ? 'Tied' : leader + ' wins by ' + Math.abs(diff);
    }

    return {
      t1n: t1n, t2n: t2n, t1agg: t1agg, t2agg: t2agg, diff: diff,
      holes: holes, status: status, played: played, totalHoles: totalHoles,
      nNets: nNets, nGross: nGross
    };
  }

  function computeBestBall(rid,game){
    var r=T.rounds.find(function(x){return x.id===rid;});if(!r)return null;
    var c=game.config||{};
    var bestNet=c.bestNet!=null?c.bestNet:(c.bestOf||1);
    var bestGross=c.bestGross!=null?c.bestGross:0;
    if(bestNet+bestGross<1)bestNet=1;
    var g1=c.team1||[];var g2=c.team2||[];
    if(!g1.length||!g2.length)return null;
    var from=roundFromH(rid),to=roundToH(rid);
    var t1agg=0,t2agg=0,played=0;
    var holes=[];
    function pickBalls(pids,h){
      var scores=[];
      pids.forEach(function(pid){
        var gv=getScore(rid,pid,h);if(gv==null)return;
        var nv=gv-strokesOnHole(pRoundHcp(pid,rid),holeSI(r.course,h));
        scores.push({pid:pid,gross:gv,net:nv});
      });
      var byNet=scores.slice().sort(function(a,b){return a.net-b.net;});
      var byGross=scores.slice().sort(function(a,b){return a.gross-b.gross;});
      var netSum=0;for(var i=0;i<bestNet&&i<byNet.length;i++)netSum+=byNet[i].net;
      var grossSum=0;for(var i=0;i<bestGross&&i<byGross.length;i++)grossSum+=byGross[i].gross;
      return{total:netSum+grossSum,complete:byNet.length>=bestNet&&byGross.length>=bestGross};
    }
    for(var h=from;h<=to;h++){
      var p1=pickBalls(g1,h);var p2=pickBalls(g2,h);
      var complete=p1.complete&&p2.complete;
      if(complete){t1agg+=p1.total;t2agg+=p2.total;played++;}
      holes.push({h:h,t1hole:complete?p1.total:null,t2hole:complete?p2.total:null,t1agg:t1agg,t2agg:t2agg,complete:complete});
    }
    if(!played)return null;
    var totalHoles=to-from+1;
    var diff=t1agg-t2agg;
    var ppp=c.ppp||c.ppt||20;
    var g1short=g1.map(function(p){return pShort(p);}).join('+');
    var g2short=g2.map(function(p){return pShort(p);}).join('+');
    var leader=diff<0?g1short:diff>0?g2short:null;
    var status=diff===0?(played>=totalHoles?'Tied':'All Square'):(leader+(played>=totalHoles?' wins by ':' leads by ')+Math.abs(diff));
    return{t1agg:t1agg,t2agg:t2agg,diff:diff,holes:holes,played:played,totalHoles:totalHoles,nNets:bestNet,nGross:bestGross,ppp:ppp,g1:g1,g2:g2,g1short:g1short,g2short:g2short,status:status,leader:leader};
  }

    // ══════════════════════════════════════════════════
  // ── WOLF GAME ──
  // Setup: tee order selected, wolf rotates each hole
  // Variations: Lone Wolf, Blind Wolf, Pig
  // ══════════════════════════════════════════════════

  // Wolf: which player is wolf on a given hole (1-indexed tee order)
  // lastPlacePid: optional override for last-place-wolf variant on holes 17 & 18
  function wolfOnHole(teeOrder, holeNum, lastPlacePid) {
    if (!teeOrder || !teeOrder.length) return null;
    // Last-place wolf override on holes 17 & 18
    if (lastPlacePid && (holeNum === 17 || holeNum === 18)) return lastPlacePid;
    var n = teeOrder.length; // usually 4
    // Wolf rotates: hole 1 = player[0], hole 2 = player[1], etc, wraps every n holes
    return teeOrder[(holeNum - 1) % n];
  }
  // Get the last-place player for wolf (lowest running total through hole 16)
  // Computed inline to avoid circular dependency with computeWolfResult
  function wolfLastPlace(rid, g) {
    var c = g ? (g.config || {}) : {};
    if (!c.wolfVariants || !c.wolfVariants.lastPlaceWolf) return null;
    var teeOrder = c.teeOrder || [];
    if (!teeOrder.length) return null;
    var totals = {};
    teeOrder.forEach(function(p) { totals[p] = 0; });
    // Sum points through hole 16 only (no lpPid passed = normal rotation)
    for (var h = 1; h <= 16; h++) {
      var hpts = wolfHolePoints(rid, h, g, null, null);
      Object.keys(hpts).forEach(function(p) { if (totals[p] != null) totals[p] += hpts[p]; });
    }
    var minPts = Infinity, lastPid = null;
    teeOrder.forEach(function(pid) {
      if (totals[pid] < minPts) { minPts = totals[pid]; lastPid = pid; }
    });
    return lastPid;
  }

  // Returns running point total for a player in wolf (through current hole)
  function wolfRunningTotal(rid, pid) {
    var g = (T.gameRounds[rid] || []).find(function(x) { return x.type === 'wolf'; });
    if (!g) return 0;
    var result = computeWolfResult(rid);
    if (!result || !result.totals) return 0;
    return result.totals[pid] || 0;
  }

  // Returns a short result string for the current hole if all scores are in

  // Returns true if player won a blitz on this hole in 5-3-1
  function isBlitzHole(rid, pid, hole) {
    var g = (T.gameRounds[rid] || []).find(function(x) { return x.type === 'fiveThreeOne'; });
    if (!g || !g.config || !g.config.blitz) return false;
    var result = computeFiveThreeOne(rid);
    if (!result || !result.holeLog) return false;
    var hdata = result.holeLog.find(function(x) { return x.h === hole; });
    if (!hdata || !hdata.pts) return false;
    // Blitz: player got 9 points (all of them)
    return hdata.pts[pid] === 9;
  }

    function wolfHoleResult(rid, hole) {
    var g = (T.gameRounds[rid] || []).find(function(x) { return x.type === 'wolf'; });
    if (!g) return null;
    var pts = wolfHolePoints(rid, hole, g);
    var keys = Object.keys(pts);
    if (!keys.length) return null;
    var ppt = g.config.ppt || 1;
    var lpPid = (g.config.wolfVariants && g.config.wolfVariants.lastPlaceWolf) ? wolfLastPlace(rid, g) : null;
    var wolfPid = wolfOnHole(g.config.teeOrder || [], hole, lpPid);
    var holeState = (g.config.holes || {})[String(hole)] || {};
    var mode = holeState.mode || 'normal';
    var partnerId = holeState.partnerId;
    var wolfPts = pts[wolfPid] || 0;
    var wolfName = pDisplay(wolfPid);
    var teamLabel = wolfName;
    if (mode === 'normal' && partnerId) teamLabel = wolfName + ' + ' + pDisplay(partnerId);
    else if (mode === 'lone') teamLabel = wolfName + ' (Lone)';
    else if (mode === 'blind') teamLabel = wolfName + ' (Blind)';
    if (wolfPts > 0) return teamLabel + ' win +$' + (wolfPts * ppt);
    if (wolfPts < 0) return teamLabel + ' lose -$' + (Math.abs(wolfPts) * ppt);
    return 'Tied — no money moves';
  }

  // Wolf: get or default the hole state
  function getWolfHole(rid, hole) {
    var g = (T.gameRounds[rid] || []).find(function (x) { return x.type === 'wolf'; });
    if (!g || !g.config.holes) return { partnerId: null, mode: 'normal' }; // normal = wolf picks partner
    return g.config.holes[String(hole)] || { partnerId: null, mode: 'normal' };
  }

  function setWolfHole(rid, hole, field, val) {
    var games = T.gameRounds[rid] || [];
    var g = games.find(function (x) { return x.type === 'wolf'; });
    if (!g) return;
    if (!g.config.holes) g.config.holes = {};
    var hk = String(hole);
    if (!g.config.holes[hk]) g.config.holes[hk] = { partnerId: null, mode: 'normal' };
    g.config.holes[hk][field] = val;
    saveData();
  }

  // Wolf points computation
  // Returns {[pid]: netPoints} for a given hole
  // lastPlacePid: optional 5th param — avoids circular call to computeWolfResult
  function wolfHolePoints(rid, hole, g, tData, lastPlacePid) {
    var c = g.config || {};
    var wUseNet = c.netGross !== 'gross';
    var wHcpPct = (c.hcpPercent || 100) / 100;
    var teeOrder = c.teeOrder || [];
    var ppt = c.ppt || 1;
    // getWolfHole reads from T, but g already has holes data
    var holeState = (g.config.holes||{})[String(hole)] || { partnerId: null, mode: 'normal' };
    var wolfPid = wolfOnHole(teeOrder, hole, lastPlacePid);
    if (!wolfPid) return {};
    var others = teeOrder.filter(function (p) { return p !== wolfPid; });
    var mode = holeState.mode || 'normal'; // 'normal'|'lone'|'blind'|'pig'
    var partnerId = holeState.partnerId;

    // Get scores for the hole (net or gross based on config)
    var tSrc = tData || T;
    var scores = {};
    teeOrder.forEach(function (pid) {
      var sc = tData ? (tData.scores?.[rid]?.[pid]?.[hole]||null) : getScore(rid, pid, hole);
      if (sc != null) {
        var r = tSrc.rounds.find(function (r) { return r.id === rid; });
        var pl = tData ? tData.players.find(function(x){return x.id===pid;}) : null;
        var hcp = tData ? (pl?.roundHcp?.[rid]??Math.round(pl?.ghin||0)) : gameAdjHcp(pid, rid, teeOrder);
        scores[pid] = wUseNet ? sc - strokesOnHole(Math.round(hcp * wHcpPct), holeSI(r ? r.course : '', hole)) : sc;
      }
    });

    // Check if all players have scores
    var allScored = teeOrder.every(function (p) { return scores[p] != null; });
    if (!allScored) return {};

    var pts = {};
    teeOrder.forEach(function (p) { pts[p] = 0; });

    if (mode === 'lone' || mode === 'blind') {
      // Wolf vs. field: wolf wins only if wolf score < ALL opponents. Ties push.
      var wolfScore = scores[wolfPid];
      var wolfWins = others.every(function (p) { return wolfScore < scores[p]; });
      var wolfLoses = others.some(function (p) { return scores[p] < wolfScore; });
      var loneMultiplier = c.wolfLoneMultiplier || 2;
      var mult = (mode === 'blind') ? 2 : loneMultiplier;
      if (wolfWins) {
        others.forEach(function (p) { pts[wolfPid] += ppt * mult; pts[p] -= ppt * mult; });
      } else if (wolfLoses) {
        others.forEach(function (p) { pts[wolfPid] -= ppt * mult; pts[p] += ppt * mult; });
      }
      // else: tie — push, no points move
    } else if (mode === 'pig') {
      // Pig: wolf and partner must EACH beat BOTH opponents individually
      var partner = partnerId;
      if (!partner) partner = others[0]; // fallback
      var opps = others.filter(function (p) { return p !== partner; });
      var wolfNet = scores[wolfPid], partnerNet = scores[partner];
      var bestTeam = Math.min(wolfNet, partnerNet);
      opps.forEach(function (opp) {
        // Team wins if BEST of team < opp
        if (bestTeam < scores[opp]) {
          pts[wolfPid] += ppt * 2; pts[partner] += ppt * 2; pts[opp] -= ppt * 2;
        } else if (bestTeam > scores[opp]) {
          pts[wolfPid] -= ppt * 2; pts[partner] -= ppt * 2; pts[opp] += ppt * 2;
        }
      });
    } else {
      // Normal: wolf has a partner (or goes lone if no partner set)
      if (!partnerId) {
        // No partner selected yet — skip
        return {};
      }
      var wolfTeam = [wolfPid, partnerId];
      var oppTeam = others.filter(function (p) { return p !== partnerId; });
      if (!oppTeam.length) return {};
      // Best ball for each team
      var wolfBest = Math.min.apply(null, wolfTeam.map(function (p) { return scores[p]; }));
      var oppBest = Math.min.apply(null, oppTeam.map(function (p) { return scores[p]; }));
      if (wolfBest < oppBest) {
        wolfTeam.forEach(function (p) { pts[p] += ppt; });
        oppTeam.forEach(function (p) { pts[p] -= ppt; });
      } else if (oppBest < wolfBest) {
        wolfTeam.forEach(function (p) { pts[p] -= ppt; });
        oppTeam.forEach(function (p) { pts[p] += ppt; });
      }
    }
    return pts;
  }

  function computeWolfResult(rid, tData) {
    var tSrc = tData || T;
    var g = (tSrc.gameRounds[rid] || []).find(function (x) { return x.type === 'wolf'; });
    if (!g) return null;
    var c = g.config || {};
    var teeOrder = c.teeOrder || [];
    if (!teeOrder.length) return null;
    var r = tSrc.rounds.find(function (r) { return r.id === rid; });
    if (!r) return null;
    var totals = {};
    teeOrder.forEach(function (p) { totals[p] = 0; });
    var nc = holeCount(r.course);
    var lpEnabled = c.wolfVariants && c.wolfVariants.lastPlaceWolf;
    var lpPid = null;
    for (var h = 1; h <= nc; h++) {
      // Compute last-place pid from totals through hole 16 for holes 17 & 18
      if (lpEnabled && h === 17) {
        var minPts = Infinity; lpPid = null;
        teeOrder.forEach(function(p){ if (totals[p] < minPts) { minPts = totals[p]; lpPid = p; }});
      }
      var hpts = wolfHolePoints(rid, h, g, tData, (h >= 17 ? lpPid : null));
      Object.keys(hpts).forEach(function (p) { if (totals[p] != null) totals[p] += hpts[p]; });
    }
    var ppt = c.ppt || 1;
    var nameFunc = tData ? function(p){return tData.players.find(function(pl){return pl.id===p;})?.short||p;} : pDisplay;
    return {
      teeOrder: teeOrder,
      totals: totals,
      ppt: ppt,
      lines: teeOrder.map(function (p) {
        var n = totals[p];
        return { pid: p, name: nameFunc(p), pts: n, dollars: n * ppt };
      })
    };
  }

  // ══════════════════════════════════════════════════
  // ── VEGAS VARIATIONS ──
  // Standard: low-low combine (lower score first)
  // Monte Carlo: best ball per team
  // Daytona / Flip the Bird: use WORST score, flip rule
  // Newtown: middle two scores are partners vs outer two
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

  function computeVegasVariantFull(rid, team1, team2, variant, gameObj, tData) {
    var tSrc = tData || T;
    var r = tSrc.rounds.find(function (r) { return r.id === rid; });
    if (!r) return null;
    var gc3 = gameObj ? (gameObj.config || gameObj) : {};
    var cumDiff = 0;
    var holes = [];
    for (var h = 1; h <= holeCount(r.course); h++) {
      var res = computeVegasHoleVariant(rid, h, team1, team2, variant, gc3, tData);
      if (res && res.diff != null) {
        cumDiff += res.diff;
        holes.push(Object.assign({ h: h, cumDiff: cumDiff }, res));
      } else {
        holes.push({ h: h, t1num: null, t2num: null, diff: null, cumDiff: cumDiff });
      }
    }
    return { holes: holes, cumDiff: cumDiff };
  }

  // ══════════════════════════════════════════════════
  // ── HAMMER MODES ──
  // Team: whole-team stake doubles
  // Individual: any player hammers any opponent 1v1
  // ══════════════════════════════════════════════════

  function getHammerHoleV2(rid, hole) {
    var g = (T.gameRounds[rid] || []).find(function (x) { return x.type === 'hammer'; });
    if (!g || !g.config.holes) return { mult: 1, t1won: null, mode: g ? (g.config.hammerMode || 'team') : 'team' };
    return g.config.holes[String(hole)] || { mult: 1, t1won: null };
  }

  function computeHammerResultV2(rid) {
    var g = (T.gameRounds[rid] || []).find(function (x) { return x.type === 'hammer'; });
    if (!g) return null;
    var r = T.rounds.find(function (r) { return r.id === rid; });
    if (!r) return null;
    var c = g.config || {};
    var h2UseNet = c.netGross !== 'gross';
    var h2HcpPct = (c.hcpPercent || 100) / 100;
    var ppt = c.ppt || 5;
    var hammerMode = c.hammerMode || 'team';
    var t1 = c.team1 || [], t2 = c.team2 || [];
    var t1n = t1.map(function (p) { return pDisplay(p); }).join('+') || (T.teams&&T.teams[0]?T.teams[0].name:'Team 1');
    var t2n = t2.map(function (p) { return pDisplay(p); }).join('+') || (T.teams&&T.teams[1]?T.teams[1].name:'Team 2');
    var holes = c.holes || {};
    var nc = holeCount(r.course);
    var carryMult = 1, t1total = 0, t2total = 0;
    var holeResults = [];

    if (hammerMode === 'individual') {
      // Individual: separate 1v1 hammer tracks per pair
      var pairs = c.individualPairs || [];
      var pairTotals = pairs.map(function () { return 0; });
      for (var h = 1; h <= nc; h++) {
        var hd = holes[String(h)] || {};
        pairs.forEach(function (pair, pi) {
          var pairHoles = hd.pairs || {};
          var ph = pairHoles[pi] || { mult: 1, winner: null };
          var sc1 = getScore(rid, pair.p1, h), sc2 = getScore(rid, pair.p2, h);
          if (sc1 == null || sc2 == null) return;
          var n1 = h2UseNet ? sc1 - strokesOnHole(Math.round(pRoundHcp(pair.p1, rid) * h2HcpPct), holeSI(r.course, h)) : sc1;
          var n2 = h2UseNet ? sc2 - strokesOnHole(Math.round(pRoundHcp(pair.p2, rid) * h2HcpPct), holeSI(r.course, h)) : sc2;
          var winner = ph.winner != null ? ph.winner : (n1 < n2 ? 'p1' : n2 < n1 ? 'p2' : null);
          if (winner === 'p1') pairTotals[pi] += ppt * (ph.mult || 1);
          else if (winner === 'p2') pairTotals[pi] -= ppt * (ph.mult || 1);
        });
      }
      return { t1n: t1n, t2n: t2n, net: 0, hammerMode: 'individual', pairTotals: pairTotals, pairs: pairs, ppt: ppt };
    }

    // Team mode
    for (var h = 1; h <= nc; h++) {
      var hd = holes[String(h)] || { mult: 1, t1won: null };
      var effMult = hd.mult * carryMult;
      var holePPT = ppt * effMult;
      if (hd.t1won === true) { t1total += holePPT; carryMult = 1; holeResults.push({ h: h, effMult: effMult, winner: 't1', amt: holePPT }); }
      else if (hd.t1won === false) { t2total += holePPT; carryMult = 1; holeResults.push({ h: h, effMult: effMult, winner: 't2', amt: holePPT }); }
      else { carryMult = effMult; holeResults.push({ h: h, effMult: effMult, winner: null, amt: holePPT }); }
    }
    var net = t1total - t2total;
    return { t1n: t1n, t2n: t2n, t1total: t1total, t2total: t2total, net: net, holeResults: holeResults, ppt: ppt, carryMult: carryMult, hammerMode: 'team' };
  }


  // ── WIZARD FUNCTIONS ──
  function startDemo(){
    // Load a fully simulated demo round — never saved to history
    isDemoMode.value=true;
    // Pre-populate T with a complete demo round at Pebble Beach
    const demoScores={
      // Mike (HCP 8) — shoots 79
      'DM':{1:4,2:5,3:4,4:4,5:3,6:5,7:4,8:3,9:4,10:4,11:4,12:3,13:5,14:4,15:4,16:4,17:3,18:6},
      // Sarah (HCP 16) — shoots 91
      'DS':{1:5,2:6,3:5,4:6,5:4,6:6,7:5,8:4,9:5,10:5,11:5,12:4,13:6,14:5,15:5,16:5,17:4,18:6},
      // Carlos (HCP 5) — shoots 76
      'DC':{1:4,2:5,3:3,4:4,5:3,6:4,7:4,8:3,9:4,10:4,11:3,12:3,13:5,14:4,15:4,16:4,17:3,18:5},
      // Priya (HCP 20) — shoots 96
      'DP':{1:5,2:6,3:6,4:6,5:4,6:7,7:5,8:4,9:6,10:6,11:5,12:4,13:6,14:5,15:6,16:5,17:5,18:5},
    };
    Object.assign(T,{
      id:'demo_round',
      name:'🎮 Demo · Pebble Beach',
      type:'single',
      teams:[{id:1,name:'Mike & Sarah'},{id:2,name:'Carlos & Priya'}],
      players:[
        {id:'DM',name:'Mike',short:'Mike',ghin:8,team:1,roundHcp:{1:8}},
        {id:'DS',name:'Sarah',short:'Sarah',ghin:16,team:2,roundHcp:{1:16}},
        {id:'DC',name:'Carlos',short:'Carlos',ghin:5,team:1,roundHcp:{1:5}},
        {id:'DP',name:'Priya',short:'Priya',ghin:20,team:2,roundHcp:{1:20}},
      ],
      rounds:[{id:1,course:'Pebble Beach',tee:'Blue',format:'social',date:TODAY,holesMode:'18',points:0,groups:[],desc:'Demo round — scores are simulated'}],
      scores:{1:demoScores},
      matchResults:{},
      roundResults:{},
      gameRounds:{1:[{type:'nassau',config:{front:10,back:10,overall:20,pressAt:2,minPressHoles:1,team1:['DM','DC'],team2:['DS','DP']}}]}
    });
    activeRound.value=T.rounds[0];
    activeHole.value=1;
    view.value='scoring';
    screen.value='app';
  }

  function exitDemo(){
    isDemoMode.value=false;
    Object.assign(T,{id:'',name:'',type:'tournament',teams:[],players:[],rounds:[],scores:{},matchResults:{},roundResults:{},gameRounds:{}});
    activeRound.value=null;
    activeHole.value=0;
    view.value='home';
    screen.value='app';
  }

  function resetSeedData(){
    if(!confirm('Reset seed data? This will reload the 4 Bandon test rounds on next page reload.'))return;
    localStorage.removeItem('golf_seed_loaded_v2');
    showAdmin.value=false;
    toast.value='Seed reset! Reload the page to see fresh data.';
    setTimeout(()=>toast.value='',4000);
  }

  // ── BUILD GAME ROUNDS FROM FORMAT (reusable for wizard + rebuild) ──
  // Formats where opponents share a foursome (mixed groups: 2 T1 + 2 T2)
  var MIXED_GROUP_FMTS={hilow:1,'high-low':1,'best-ball':1,stableford:1,'singles-match':1};
  // Formats where teammates play together (team-based groups)
  var TEAM_GROUP_FMTS={'team-day':1};

  // Emit per-group instances of wizard-selected games (intra-group) + a single
  // cross-group instance for inter-group games like bestball. Each game is tagged
  // with `groupIndex` (number = group, null = inter-group) for fast filtering.
  function emitWizSelectedGames(selectedGames,rGroups,tourT1,tourT2,allPids){
    var out=[];
    if(!selectedGames||!selectedGames.length)return out;
    var INTER_GROUP=['bestball','teamday'];
    var INDIVIDUAL=['fidget','snake','dots','bbb','skins','wolf','sixes','fiveThreeOne','stableford'];
    selectedGames.forEach(function(sel){
      var srcCfg=JSON.parse(JSON.stringify(sel.config||{}));
      // Inter-group: one game spans all groups
      if(INTER_GROUP.indexOf(sel.type)>=0){
        var cfg=Object.assign({},srcCfg);
        if(sel.type==='bestball'){
          cfg.team1=rGroups[0]?rGroups[0].slice():allPids.slice(0,4);
          cfg.team2=rGroups[1]?rGroups[1].slice():allPids.slice(4);
        }else if(sel.type==='teamday'){
          cfg.team1=tourT1.slice();cfg.team2=tourT2.slice();cfg.players=allPids.slice();
        }
        out.push({type:sel.type,groupIndex:null,config:cfg});
        return;
      }
      // Per-group: one instance per foursome
      var groups=rGroups.length?rGroups:[allPids.slice()];
      groups.forEach(function(grpPids,gi){
        var cfg=JSON.parse(JSON.stringify(srcCfg));
        cfg.players=grpPids.slice();
        if(INDIVIDUAL.indexOf(sel.type)<0){
          // Team game inside foursome — use existing team assignments if both sides present, else split in half
          var grpT1=grpPids.filter(function(pid){return tourT1.indexOf(pid)>=0;});
          var grpT2=grpPids.filter(function(pid){return tourT2.indexOf(pid)>=0;});
          if(!grpT1.length||!grpT2.length){
            var half=Math.ceil(grpPids.length/2);
            grpT1=grpPids.slice(0,half);grpT2=grpPids.slice(half);
          }
          cfg.team1=grpT1;cfg.team2=grpT2;
        }
        // Sub-game-specific cleanup
        if(sel.type==='wolf'){cfg.wolfTeeOrder=grpPids.slice();cfg.teeOrder=grpPids.slice();cfg.holes={};}
        if(sel.type==='snake')cfg.holders={};
        if(sel.type==='dots')cfg.entries={};
        if(sel.type==='hammer')cfg.holes={};
        if(sel.type==='fiveThreeOne')cfg.players=grpPids.slice(0,3);
        out.push({type:sel.type,groupIndex:gi,config:cfg});
      });
    });
    return out;
  }

  function buildGameRoundsFromFormat(rounds,tourT1,tourT2,allPids,selectedGames){
    var gameRounds={};
    rounds.forEach(function(r){
      var fmt=r.format||'social';
      var games=[];
      var rGroups=r.groups||[];

      // ── TEAM DAY: single cross-group game, teams play own foursomes ──
      if(fmt==='team-day'){
        games.push({type:'teamday',config:{
          ppt:5,team1:tourT1.slice(),team2:tourT2.slice(),
          players:allPids.slice(),netGross:'net',hcpPercent:100,subMatches:[],
          bestNets:2,bestGross:1
        }});
        gameRounds[r.id]=games;
        return; // next round
      }

      // ── OTHER FORMATS: per-group games ──
      function pushGamesForGroup(grpT1,grpT2,grpAll){
        var baseCfg={ppt:5,team1:grpT1.slice(),team2:grpT2.slice(),players:grpAll.slice(),
          netGross:'net',hcpPercent:100,subMatches:[]};
        if(fmt==='best-ball'){
          games.push({type:'match',config:Object.assign({},baseCfg,{ppt:20})});
        }else if(fmt==='stableford'){
          games.push({type:'stableford',config:Object.assign({},baseCfg,{ppt:1,variant:'standard',teamMode:'aggregate'})});
        }else if(fmt==='high-low'){
          games.push({type:'hilow',config:Object.assign({},baseCfg,{ppt:5})});
        }else if(fmt==='singles-match'){
          var minLen=Math.min(grpT1.length,grpT2.length);
          for(var si=0;si<minLen;si++){
            games.push({type:'match',config:{ppt:20,team1:[grpT1[si]],team2:[grpT2[si]],
              players:[grpT1[si],grpT2[si]],netGross:'net',hcpPercent:100,subMatches:[]}});
          }
        }
        // stroke / social = no games
      }
      if(rGroups.length>0){
        rGroups.forEach(function(grpPids,gi){
          var grpT1=grpPids.filter(function(pid){return tourT1.indexOf(pid)>=0;});
          var grpT2=grpPids.filter(function(pid){return tourT2.indexOf(pid)>=0;});
          if(!grpT1.length&&!grpT2.length&&grpPids.length>=2){
            var half=Math.ceil(grpPids.length/2);
            grpT1=grpPids.slice(0,half);grpT2=grpPids.slice(half);
          }
          var before=games.length;
          pushGamesForGroup(grpT1,grpT2,grpPids);
          // Tag any format-emitted games with their group index
          for(var bi=before;bi<games.length;bi++)games[bi].groupIndex=gi;
        });
      }else{
        pushGamesForGroup(tourT1.slice(),tourT2.slice(),allPids.slice());
      }
      // Append wizard-selected games (per-group + cross-group)
      var wizGames=emitWizSelectedGames(selectedGames||[],rGroups,tourT1,tourT2,allPids);
      games=games.concat(wizGames);
      gameRounds[r.id]=games;
    });
    return gameRounds;
  }

  // ── REBUILD GAMES for current tournament (fix broken/stale game assignments) ──
  function rebuildTournamentGames(){
    if(!T.id||T.type!=='tournament'){showToast('Only for tournaments');return;}
    var tourT1=T.players.filter(function(p){return p.team===1;}).map(function(p){return p.id;});
    var tourT2=T.players.filter(function(p){return p.team===2;}).map(function(p){return p.id;});
    var allPids=T.players.map(function(p){return p.id;});
    // Auto-assign teams if missing
    if(!tourT1.length&&!tourT2.length){
      // Split by player order
      var half=Math.ceil(T.players.length/2);
      T.players.forEach(function(p,idx){p.team=idx<half?1:2;});
      tourT1=T.players.filter(function(p){return p.team===1;}).map(function(p){return p.id;});
      tourT2=T.players.filter(function(p){return p.team===2;}).map(function(p){return p.id;});
    }
    // Ensure all rounds have format-aware groups
    T.rounds.forEach(function(r){
      var fmt=r.format||'social';
      if(TEAM_GROUP_FMTS[fmt]&&tourT1.length>=2&&tourT2.length>=2){
        // Team Day: group by team (teammates together)
        r.groups=[tourT1.slice(),tourT2.slice()];
      }else if(!r.groups||!r.groups.length||r.groups.every(function(g){return!g.length;})){
        // Mixed groups for head-to-head formats
        var donor=T.rounds.find(function(x){return x.groups&&x.groups.length&&x.groups.some(function(g){return g.length>0;})&&!TEAM_GROUP_FMTS[x.format||'social'];});
        if(donor){
          r.groups=JSON.parse(JSON.stringify(donor.groups));
        }else if(allPids.length>4){
          r.groups=[];
          var numGrp=Math.ceil(allPids.length/4);
          for(var gi=0;gi<numGrp;gi++)r.groups.push([]);
          tourT1.forEach(function(pid,i){r.groups[i%numGrp].push(pid);});
          tourT2.forEach(function(pid,i){r.groups[i%numGrp].push(pid);});
        }
      }
    });
    var newGR=buildGameRoundsFromFormat(T.rounds,tourT1,tourT2,allPids);
    Object.keys(newGR).forEach(function(rid){T.gameRounds[rid]=newGR[rid];});
    saveData();
    showToast('Games rebuilt for all rounds!');
  }

  // ── EDIT GROUPS for a specific round ──
  function editRoundGroups(rid){
    var r=T.rounds.find(function(x){return x.id===rid;});
    if(!r)return;
    var allPids=T.players.map(function(p){return p.id;});
    // Ensure groups exist
    if(!r.groups||!r.groups.length){
      r.groups=[allPids.slice(0,4),allPids.slice(4)];
    }
    showGroupEditModal.value=true;
  }
  function movePlayerToGroup(rid,pid,targetGi){
    var r=T.rounds.find(function(x){return x.id===rid;});
    if(!r||!r.groups)return;
    // Remove from current group
    r.groups.forEach(function(g){var idx=g.indexOf(pid);if(idx>=0)g.splice(idx,1);});
    // Add to target
    if(!r.groups[targetGi])r.groups[targetGi]=[];
    r.groups[targetGi].push(pid);
    // Rebuild games for this round
    var tourT1=T.players.filter(function(p){return p.team===1;}).map(function(p){return p.id;});
    var tourT2=T.players.filter(function(p){return p.team===2;}).map(function(p){return p.id;});
    var allPids2=T.players.map(function(p){return p.id;});
    var newGR=buildGameRoundsFromFormat([r],tourT1,tourT2,allPids2);
    T.gameRounds[r.id]=newGR[r.id]||[];
    saveData();
  }
  function copyGroupsToAllRounds(){
    if(!activeRound.value)return;
    var srcGroups=activeRound.value.groups;
    if(!srcGroups||!srcGroups.length)return;
    T.rounds.forEach(function(r){
      r.groups=JSON.parse(JSON.stringify(srcGroups));
    });
    // Rebuild all games
    rebuildTournamentGames();
    showToast('Groups copied to all rounds');
  }

  function resetRoundScores(rid){
    if(!rid)return;
    var r=T.rounds.find(function(x){return x.id===rid;});
    if(!r)return;
    if(!confirm('Reset scores for R'+rid+': '+r.course+'?\n\nKEPT: Games, pairings, settings\nWIPED: All hole scores for this round'))return;
    T.scores[rid]={};
    if(T.roundResults)T.roundResults[rid]=undefined;
    // Clear game state for this round
    var games=T.gameRounds[rid]||[];
    games.forEach(function(g){
      if(g.config){
        if(g.config.events)g.config.events=[];
        if(g.config.holders)g.config.holders={};
        if(g.config.holes)g.config.holes={};
        if(g.config.entries)g.config.entries={};
      }
    });
    saveData();saveTournaments();
    toast.value='R'+rid+' scores reset';setTimeout(function(){toast.value='';},2000);
  }

  function resetTournamentScores(){
    if(!T.id){toast.value='No tournament loaded';setTimeout(function(){toast.value='';},2000);return;}
    if(!confirm('Reset all scores for '+T.name+'?\n\nKEPT: Players, teams, games, pairings, dates\nWIPED: All hole scores, round results, game state'))return;
    T.rounds.forEach(function(r){
      T.scores[r.id]={};
      if(T.roundResults)T.roundResults[r.id]=undefined;
    });
    // Clear game state (snake events, hammer holes, dots, wolf holes)
    T.rounds.forEach(function(r){
      var games=T.gameRounds[r.id]||[];
      games.forEach(function(g){
        if(g.config){
          if(g.config.events)g.config.events=[];
          if(g.config.holders)g.config.holders={};
          if(g.config.holes)g.config.holes={};
          if(g.config.entries)g.config.entries={};
        }
      });
    });
    saveData();saveArchive();
    toast.value='All scores reset!';setTimeout(function(){toast.value='';},2500);
  }

  // Wipe regular (non-tournament) rounds only — keep tournaments, roster, courses
  function wipeRegularRounds(){
    if(!confirm('Wipe all regular rounds and their history?\n\nKEPT: Tournaments, player roster, courses\nWIPED: All single/casual rounds and their archived history'))return;
    // Filter out non-tournament entries from allTournaments
    allTournaments.value=allTournaments.value.filter(function(t){return t.type==='tournament';});
    saveTournaments();
    // Filter archive to keep only tournament entries
    archivedTournaments.value=archivedTournaments.value.filter(function(t){return t.type==='tournament';});
    try{localStorage.setItem('golf_archive',JSON.stringify(archivedTournaments.value));}catch(e){}
    // If active round is a regular round, clear it
    if(T.id&&T.type!=='tournament'){
      Object.assign(T,{id:'',name:'',type:'tournament',teams:[],players:[],rounds:[],scores:{},matchResults:{},roundResults:{},gameRounds:{}});
      localStorage.removeItem('golfTracker_v2');
    }
    view.value='home';
    toast.value='Regular rounds wiped. Tournaments preserved.';
    setTimeout(function(){toast.value='';},3000);
  }

  // Wipe tournaments only — keep regular rounds, roster, courses
  function wipeTournaments(){
    if(!confirm('Wipe all tournaments and their history?\n\nKEPT: Regular rounds, player roster, courses\nWIPED: All tournaments and their archived history'))return;
    allTournaments.value=allTournaments.value.filter(function(t){return t.type!=='tournament';});
    saveTournaments();
    archivedTournaments.value=archivedTournaments.value.filter(function(t){return t.type!=='tournament';});
    try{localStorage.setItem('golf_archive',JSON.stringify(archivedTournaments.value));}catch(e){}
    if(T.id&&T.type==='tournament'){
      Object.assign(T,{id:'',name:'',type:'tournament',teams:[],players:[],rounds:[],scores:{},matchResults:{},roundResults:{},gameRounds:{}});
      localStorage.removeItem('golfTracker_v2');
    }
    localStorage.removeItem('golf_seed_loaded_v2');
    localStorage.removeItem('golf_seed_v3_cleared');
    view.value='home';
    toast.value='Tournaments wiped. Regular rounds preserved.';
    setTimeout(function(){toast.value='';},3000);
  }

  // Wipe ALL rounds and history but preserve player roster, courses, GPS data, and favorites
  function wipeRoundsKeepRoster(){
    if(!confirm('Wipe ALL rounds, tournaments, and history?\n\nKEPT: Player roster, courses, GPS data, favorites\nWIPED: Everything else\n\nThis cannot be undone.'))return;
    Object.assign(T,{id:'',name:'',type:'tournament',teams:[],players:[],rounds:[],scores:{},matchResults:{},roundResults:{},gameRounds:{}});
    allTournaments.value=[];
    localStorage.removeItem('golfTracker_v2');
    localStorage.removeItem('golfTracker_all_v2');
    archivedTournaments.value=[];
    localStorage.removeItem('golf_archive');
    localStorage.removeItem('golf_seed_loaded_v2');
    localStorage.removeItem('golf_seed_v3_cleared');
    view.value='home';
    toast.value='All rounds wiped. Players & courses preserved.';
    setTimeout(function(){toast.value='';},3000);
  }

  // Reload Bandon preset fresh (after a wipe, or to reset to default structure)
  // Complete a tournament — archive it and clear from active
  function completeTournament(){
    if(!T.id){toast.value='No tournament loaded';setTimeout(function(){toast.value='';},2000);return;}
    var p1=totPts.value[1],p2=totPts.value[2];
    var winner=p1>p2?(T.teams[0]?.name||'Team 1'):p2>p1?(T.teams[1]?.name||'Team 2'):'Tied';
    if(!confirm('Complete '+T.name+'?\n\nFinal Score: '+p1+' – '+p2+'\nWinner: '+winner+'\n\nThis archives the tournament to history. You can still view it but not edit scores.'))return;
    // Add completion metadata
    T.completedAt=new Date().toISOString();
    T.finalScore={1:p1,2:p2};
    // Archive
    var snapshot=JSON.parse(JSON.stringify(T));
    snapshot.archivedAt=new Date().toISOString();
    archivedTournaments.value.push(snapshot);
    try{localStorage.setItem('golf_archive',JSON.stringify(archivedTournaments.value));}catch(e){}
    // Remove from active tournaments
    var idx=allTournaments.value.findIndex(function(t){return t.id===T.id;});
    if(idx>=0)allTournaments.value.splice(idx,1);
    saveTournaments();
    // Clear active
    Object.assign(T,{id:'',name:'',type:'tournament',teams:[],players:[],rounds:[],scores:{},matchResults:{},roundResults:{},gameRounds:{}});
    localStorage.removeItem('golfTracker_v2');
    view.value='home';
    toast.value='Tournament completed! '+winner+' wins '+p1+'-'+p2;
    setTimeout(function(){toast.value='';},4000);
  }

  function reloadBandonPreset(){
    var preset=JSON.parse(JSON.stringify(BANDON_PRESET));
    // Strip simulated scores — start clean
    preset.scores={};
    preset.roundResults={};
    // Clear game state
    Object.keys(preset.gameRounds||{}).forEach(function(rid){
      (preset.gameRounds[rid]||[]).forEach(function(g){
        if(g.config){
          if(g.config.events)g.config.events=[];
          if(g.config.holders)g.config.holders={};
          if(g.config.holes)g.config.holes={};
          if(g.config.entries)g.config.entries={};
        }
      });
    });
    // Replace existing entry or add new one in allTournaments
    var existIdx=allTournaments.value.findIndex(function(x){return x.id===preset.id;});
    if(existIdx>=0){allTournaments.value.splice(existIdx,1,preset);}
    else{allTournaments.value.push(preset);}
    saveTournaments();
    saveArchive(true);
    // Don't load into T — upcoming tournament stays in Upcoming section only
    Object.assign(T,{id:'',name:'',type:'single',teams:[],players:[],rounds:[],scores:{},matchResults:{},roundResults:{},gameRounds:{}});
    activeId.value='';
    localStorage.removeItem('golfTracker_v2');
    view.value='home';
    toast.value="Bandon Boys '26 loaded fresh!";
    setTimeout(function(){toast.value='';},2500);
  }

  function loadSimulatedScores(){
    if(!T.id){toast.value='No tournament loaded';setTimeout(function(){toast.value='';},2000);return;}
    if(!confirm('Load simulated scores for '+T.name+'? This will overwrite any existing scores.'))return;
    var preset=JSON.parse(JSON.stringify(BANDON_PRESET));
    if(preset.scores&&Object.keys(preset.scores).length>0){
      Object.keys(preset.scores).forEach(function(rid){
        T.scores[rid]=preset.scores[rid];
      });
      saveData();saveArchive();
      toast.value='Simulated scores loaded!';setTimeout(function(){toast.value='';},2500);
    }else{
      toast.value='No simulated scores in preset';setTimeout(function(){toast.value='';},2500);
    }
  }

  // Generate realistic random scores based on player HCP and course par
  function generateSimScores(rid,pids){
    var r=T.rounds.find(function(x){return x.id===rid;});if(!r)return{};
    var nc=holeCount(r.course);
    var scores={};
    pids.forEach(function(pid){
      var hcp=pRoundHcp(pid,rid)||15;
      scores[pid]={};
      for(var h=1;h<=nc;h++){
        var par=holePar(r.course,h);
        // Simulate: base=par, add HCP-based noise. Higher HCP → more bogeys
        var avg=par+(hcp/18); // expected over-par per hole
        var roll=Math.random();
        var diff;
        if(roll<0.03)diff=-2; // eagle/double-under
        else if(roll<0.12)diff=-1; // birdie
        else if(roll<0.40)diff=0; // par
        else if(roll<0.70)diff=1; // bogey
        else if(roll<0.88)diff=2; // double
        else diff=3; // triple+
        // Shift distribution based on skill: low HCP → more birdies, high → more doubles
        var skillShift=Math.round((hcp-12)/8);
        diff=Math.max(-2,diff+skillShift);
        scores[pid][h]=Math.max(1,par+diff);
      }
    });
    return scores;
  }

  function allRoundPids(r,t){
    // Collect ALL unique PIDs: from groups + roster (covers ID mismatches)
    var seen={};var pids=[];
    if(r.groups&&r.groups.length){
      r.groups.forEach(function(g){g.forEach(function(pid){if(!seen[pid]){seen[pid]=1;pids.push(pid);}});});
    }
    (t||T).players.forEach(function(p){if(!seen[p.id]){seen[p.id]=1;pids.push(p.id);}});
    return pids;
  }
  function simulateTournament(tId){
    // Load tournament, generate scores for all rounds
    var t=allTournaments.value.find(function(x){return x.id===tId;});
    if(!t)return;
    loadTournamentData(t);
    t.rounds.forEach(function(r){
      var pids=allRoundPids(r,t);
      var sim=generateSimScores(r.id,pids);
      // Force Vue reactivity: delete old then set new keys
      if(!T.scores[r.id])T.scores[r.id]={};
      // Clear existing
      Object.keys(T.scores[r.id]).forEach(function(k){delete T.scores[r.id][k];});
      // Set new scores per player
      Object.keys(sim).forEach(function(pid){T.scores[r.id][pid]=sim[pid];});
    });
    // Update allTournaments copy
    var ati=allTournaments.value.findIndex(function(x){return x.id===T.id;});
    if(ati>=0)allTournaments.value[ati]=JSON.parse(JSON.stringify(T));
    saveData();saveTournaments();saveArchive(true);
    if(T.teams&&T.teams.length>=2)autoCalcAllPoints(true);
    activeRound.value=T.rounds[0]||null;
    activeHole.value=0;
    view.value='scoring';
    toast.value='Simulated scores loaded for all '+T.rounds.length+' rounds!';
    setTimeout(function(){toast.value='';},3000);
  }

  function simulateRound(rid){
    // Generate scores for current round only — ALL players regardless of active group
    if(!rid){toast.value='No round selected';setTimeout(function(){toast.value='';},2000);return;}
    var r=T.rounds.find(function(x){return x.id===rid;});
    var pids=r?allRoundPids(r):T.players.map(function(p){return p.id;});
    if(!pids.length){pids=T.players.map(function(p){return p.id;});}
    var sim=generateSimScores(rid,pids);
    // Force Vue reactivity: delete old then set new keys
    if(!T.scores[rid])T.scores[rid]={};
    // Clear existing
    Object.keys(T.scores[rid]).forEach(function(k){delete T.scores[rid][k];});
    // Set new scores per player
    Object.keys(sim).forEach(function(pid){T.scores[rid][pid]=sim[pid];});
    saveData();saveArchive(true);
    if(T.teams&&T.teams.length>=2){
      var r=T.rounds.find(function(x){return x.id===rid;});
      if(r&&r.points>0)autoCalcRoundPoints(rid);
    }
    toast.value='Simulated scores loaded for this round!';
    setTimeout(function(){toast.value='';},2500);
  }

  function exportAllData(){
    var data={
      tournaments:allTournaments.value,
      archive:archivedTournaments.value,
      players:playerProfiles.value,
      favorites:playerFavorites.value,
      courseFavorites:courseFavorites.value,
      customCourses:customCourses.value,
      gpsCache:golfCourseCache.value,
      exportedAt:new Date().toISOString()
    };
    var json=JSON.stringify(data,null,2);
    var filename='golfwizard-backup-'+new Date().toISOString().slice(0,10)+'.json';
    // iOS Safari: use Web Share API → shows share sheet → Save to Files
    if(navigator.share&&navigator.canShare){
      var file=new File([json],filename,{type:'application/json'});
      if(navigator.canShare({files:[file]})){
        navigator.share({files:[file],title:'GolfWizard Backup'})
          .then(function(){toast.value='Backup shared!';setTimeout(function(){toast.value='';},2000);})
          .catch(function(){});
        return;
      }
    }
    // Fallback: download link
    var blob=new Blob([json],{type:'application/json'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url;a.download=filename;
    document.body.appendChild(a);a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.value='Backup downloaded!';
    setTimeout(function(){toast.value='';},2000);
  }

  function triggerImportFile(){
    importMode.value='all';
    var input=document.getElementById('gw-import-file');
    if(input)input.click();
  }
  function triggerImportRoster(){
    importMode.value='roster';
    var input=document.getElementById('gw-import-file');
    if(input)input.click();
  }

  function importAllData(event){
    var file=event.target.files&&event.target.files[0];
    if(!file)return;
    var mode=importMode.value||'all';
    var reader=new FileReader();
    reader.onload=function(e){
      try{
        var data=JSON.parse(e.target.result);
        if(mode==='all'){
          if(data.tournaments)allTournaments.value=data.tournaments;
          if(data.archive)archivedTournaments.value=data.archive;
          if(data.players)playerProfiles.value=data.players;
          if(data.favorites)playerFavorites.value=data.favorites;
          if(data.courseFavorites)courseFavorites.value=data.courseFavorites;
          if(data.customCourses)customCourses.value=data.customCourses;
          if(data.gpsCache)golfCourseCache.value=data.gpsCache;
          try{localStorage.setItem('golf_tournaments',JSON.stringify(allTournaments.value));}catch(ex){}
          try{localStorage.setItem('golf_archive',JSON.stringify(archivedTournaments.value));}catch(ex){}
          toast.value='All data imported! '+((data.tournaments||[]).length)+' tournaments loaded.';
        }else{
          // Roster + courses only — merge, don't replace
          var addedP=0,addedC=0;
          if(data.players){
            var existingIds=new Set(playerProfiles.value.map(function(p){return p.id;}));
            data.players.forEach(function(p){
              if(!existingIds.has(p.id)){playerProfiles.value.push(p);addedP++;}
              // Un-hide if re-imported
              var hi=hiddenPlayers.value.indexOf(p.id);if(hi>=0)hiddenPlayers.value.splice(hi,1);
            });
          }
          if(data.customCourses){
            Object.keys(data.customCourses).forEach(function(k){
              if(!customCourses.value[k]){customCourses.value[k]=data.customCourses[k];addedC++;}
            });
          }
          if(data.gpsCache){
            Object.keys(data.gpsCache).forEach(function(k){
              if(!golfCourseCache.value[k])golfCourseCache.value[k]=data.gpsCache[k];
            });
          }
          if(data.favorites){
            data.favorites.forEach(function(f){
              if(playerFavorites.value.indexOf(f)<0)playerFavorites.value.push(f);
            });
          }
          if(data.courseFavorites){
            data.courseFavorites.forEach(function(f){
              if(courseFavorites.value.indexOf(f)<0)courseFavorites.value.push(f);
            });
          }
          toast.value='Roster imported! '+addedP+' new players, '+addedC+' new courses.';
        }
        // Persist
        try{localStorage.setItem('golf_players',JSON.stringify(playerProfiles.value));}catch(ex){}
        try{localStorage.setItem('golf_player_favorites',JSON.stringify(playerFavorites.value));}catch(ex){}
        try{localStorage.setItem('golf_favorites',JSON.stringify(courseFavorites.value));}catch(ex){}
        try{localStorage.setItem('gw_custom_courses',JSON.stringify(customCourses.value));}catch(ex){}
        try{localStorage.setItem('gw_gps_cache',JSON.stringify(golfCourseCache.value));}catch(ex){}
        customCourseVersion.value++;
        setTimeout(function(){toast.value='';},4000);
      }catch(err){
        toast.value='Import failed: '+err.message;
        setTimeout(function(){toast.value='';},4000);
      }
    };
    reader.readAsText(file);
    event.target.value='';
  }

  function clearAllData(){
    // Step 1: open confirmation modal
    showClearConfirm.value=true;
    clearConfirmText.value='';
  }
  function clearAllDataConfirmed(){
    if(clearConfirmText.value!=='DELETE')return;
    ['golf_tournaments','golf_archive','golf_players','golf_favorites','golf_seed_loaded_v2','golfTracker_v2','golfTracker_all_v2','golf_ledger_players','golf_custom_courses','golf_player_favorites','gw_gps_cache'].forEach(function(k){localStorage.removeItem(k);});
    allTournaments.value=[];
    archivedTournaments.value=[];
    Object.assign(T,{id:'',name:'',type:'tournament',teams:[],players:[],rounds:[],scores:{},matchResults:{},roundResults:{},gameRounds:{}});
    showAdmin.value=false;
    showClearConfirm.value=false;
    clearConfirmText.value='';
    toast.value='All data cleared.';setTimeout(function(){toast.value='';},2500);
  }

  function resetToDefaults(){
    if(!confirm('Reset roster, courses, and tournament to defaults? Your scores and history will be cleared.'))return;
    // Clear everything
    ['golf_tournaments','golf_archive','golf_players','golf_favorites','golf_seed_loaded_v2','golfTracker_v2','golfTracker_all_v2','golf_ledger_players','golf_custom_courses','golf_player_favorites','gw_gps_cache'].forEach(function(k){localStorage.removeItem(k);});
    // Re-seed from embedded defaults
    try{localStorage.setItem('golf_players',JSON.stringify(SEED_PLAYERS));}catch(e){}
    try{localStorage.setItem('golf_player_favorites',JSON.stringify(SEED_PLAYER_FAVORITES));}catch(e){}
    try{localStorage.setItem('golf_custom_courses',JSON.stringify(SEED_CUSTOM_COURSES));}catch(e){}
    try{localStorage.setItem('gw_gps_cache',JSON.stringify(SEED_GPS_CACHE));}catch(e){}
    var _bp=JSON.parse(JSON.stringify(BANDON_PRESET));_bp.scores={};_bp.roundResults={};
    try{localStorage.setItem('golfTracker_all_v2',JSON.stringify([_bp]));}catch(e){}
    try{localStorage.setItem('golf_seed_loaded_v2','1');}catch(e){}
    // Reload the page to pick up fresh state
    location.reload();
  }

  function startWizard(){
    wizStep.value=1;
    wiz.mode='';
    wiz.name='';
    wiz.t1='Team 1';
    wiz.t2='Team 2';
    wiz.players=[];
    wiz.groups=[];
    wiz.selectedGames=[];
    wiz.rounds=Array.from({length:4},(_,i)=>({id:i+1,course:'',tee:'Green',format:'social',points:0,date:TODAY}));
    wiz.singleRound={course:'',tee:'Green',format:'social',date:TODAY};
    screen.value='wizard';
  }

  function setWizRounds(n){
    wiz.rounds=Array.from({length:n},(_,i)=>({id:i+1,course:'',tee:'Green',format:'social',points:0,date:TODAY}));
  }

  function wizAutoSplitGroups(){
    var pids=wiz.players.map(function(p){return p.id;});
    var groupSize=4;
    var groups=[];
    for(var i=0;i<pids.length;i+=groupSize){
      groups.push(pids.slice(i,i+groupSize));
    }
    wiz.groups=groups;
  }
  function wizShuffleGroups(){
    var pids=wiz.players.map(function(p){return p.id;});
    // Fisher–Yates
    for(var i=pids.length-1;i>0;i--){
      var j=Math.floor(Math.random()*(i+1));
      var tmp=pids[i];pids[i]=pids[j];pids[j]=tmp;
    }
    var groupSize=4;
    var groups=[];
    for(var k=0;k<pids.length;k+=groupSize){
      groups.push(pids.slice(k,k+groupSize));
    }
    wiz.groups=groups;
  }
  function wizTogglePlayerGroup(gi,pid){
    // Remove from all groups first
    wiz.groups.forEach(function(g){var idx=g.indexOf(pid);if(idx>=0)g.splice(idx,1);});
    // Add to target group if not already there
    if(!wiz.groups[gi])wiz.groups[gi]=[];
    wiz.groups[gi].push(pid);
  }
  // Calculate course HCP for a wizard player based on selected course/tee
  function wizPlayerCourseHcp(p){
    if(p.roundHcpOverride!=null)return p.roundHcpOverride;
    var sr=wiz.singleRound||{};
    var course=sr.course;var tee=sr.tee||'Green';
    if(!course)return Math.round(p.ghin||0);
    var rating=getTeeRating(course,tee);
    var slope=getTeeSlope(course,tee);
    return Math.round((p.ghin||0)*(slope/113)+(rating-cPar(course)));
  }
  // Override HCP via prompt in wizard review
  function wizOverrideHcp(p){
    var current=wizPlayerCourseHcp(p);
    var hasOverride=p.roundHcpOverride!=null;
    var msg='Course HCP for '+p.name+'\n\nCalculated from Index '+(p.ghin||0)+': '+wizPlayerCourseHcp({ghin:p.ghin,roundHcpOverride:null})+'\n\n'+(hasOverride?'Currently overridden to '+current+'. Clear to reset.':'Enter a new value to override:');
    var val=prompt(msg,hasOverride?current:'');
    if(val===null)return;
    if(val===''||val.trim()===''){delete p.roundHcpOverride;return;}
    var num=Math.round(parseFloat(val));
    if(isNaN(num)||num<0)return;
    p.roundHcpOverride=num;
  }
  function wizEnsureGroups(){
    // Auto-create 2 empty groups if players > 4 and no groups yet
    if(wiz.players.length>4&&wiz.groups.length===0){
      wiz.groups=[[],[]];
    }
  }

  function toggleWizGame(type){
    var idx=wiz.selectedGames.findIndex(function(g){return g.type===type;});
    if(idx>=0){wiz.selectedGames.splice(idx,1);return;}
    var pids=wiz.players.map(function(p){return p.id;});
    // Auto-inherit team assignments if players already have teams
    var t1=wiz.players.filter(function(p){return p.team===1;}).map(function(p){return p.id;});
    var t2=wiz.players.filter(function(p){return p.team===2;}).map(function(p){return p.id;});
    var cfg={ppt:5,team1:t1.length?t1.slice():pids.slice(0,2),team2:t2.length?t2.slice():pids.slice(2,4),players:pids.slice(),sideMatches:false,matches:[],netGross:'net',hcpPercent:100,subMatches:[]};
    if(type==='nassau'){cfg.front=10;cfg.back=10;cfg.overall=20;cfg.pressAt=2;cfg.minPressHoles=1;cfg.pressValuePct=100;}
    if(type==='match'){cfg.ppt=20;}
    if(type==='skins'){cfg.ppt=5;cfg.carryover=true;cfg.skinsMode='individual';cfg.skinsPayout='pot';cfg.hcpPercent=80;cfg.hole18Tie='split';}
    if(type==='wolf'){cfg.ppt=1;cfg.wolfTeeOrder=pids.slice();cfg.wolfLoneMultiplier=1;cfg.holes={};cfg.wolfVariants={blindWolf:true,pig:true,lastPlaceWolf:false};}
    if(type==='vegas'){cfg.ppt=1;}
    if(type==='dots'){cfg.dotsPpt=1;}
    if(type==='fidget'){cfg.ppp=10;}
    if(type==='fiveThreeOne'){cfg.ppt=1;cfg.blitz=true;cfg.players=pids.slice(0,3);}
    if(type==='snake'){cfg.holders={};}
    if(type==='hammer'){cfg.ppt=5;cfg.hammerMode='team';cfg.holes={};}
    if(type==='stableford'){cfg.ppt=1;cfg.variant='standard';cfg.teamMode='aggregate';}
    if(type==='teamday'){cfg.bestNets=2;cfg.bestGross=1;}
    if(type==='hilow'){cfg.ppt=1;cfg.carry=false;cfg.birdieBonus=false;}
    if(type==='sixes'){cfg.ppt=5;}
    if(type==='bestball'){
      cfg.bestNet=1;cfg.bestGross=0;cfg.ppp=20;
      cfg.team1=wiz.groups[0]||pids.slice(0,4);
      cfg.team2=wiz.groups[1]||pids.slice(4);
    }
    wiz.selectedGames.push({type:type,config:cfg});
  }

  function isWizGameActive(type){
    return wiz.selectedGames.some(g=>g.type===type);
  }

  // ── WIZARD GAME PLAYER ASSIGNMENT ──
  function wizPlayerSide(type,pid){
    var g=wiz.selectedGames.find(function(x){return x.type===type;});
    if(!g||!g.config)return 0;
    var teamGames=['nassau','match','vegas','hilow','hammer','stableford','teamday'];
    if(teamGames.indexOf(type)>=0){
      if((g.config.team1||[]).indexOf(pid)>=0)return 1;
      if((g.config.team2||[]).indexOf(pid)>=0)return 2;
      return 0;
    }else{
      return(g.config.players||[]).indexOf(pid)>=0?1:0;
    }
  }
  function cycleWizPlayerSide(type,pid){
    const g=wiz.selectedGames.find(g=>g.type===type);if(!g)return;
    const c=g.config;
    const isTeam=['nassau','match','vegas','hilow','hammer','stableford','teamday'].includes(type);
    if(isTeam){
      const cur=wizPlayerSide(type,pid);
      const next=(cur+1)%3;
      c.team1=(c.team1||[]).filter(p=>p!==pid);
      c.team2=(c.team2||[]).filter(p=>p!==pid);
      if(next===1)c.team1=[...(c.team1||[]),pid];
      else if(next===2)c.team2=[...(c.team2||[]),pid];
    }else{
      const pl=c.players||[];
      c.players=pl.includes(pid)?pl.filter(p=>p!==pid):[...pl,pid];
    }
  }
  function wizRandomizeGame(type){
    const g=wiz.selectedGames.find(g=>g.type===type);if(!g)return;
    const pids=[...wiz.players.map(p=>p.id)].sort(()=>Math.random()-.5);
    const half=Math.ceil(pids.length/2);
    g.config.team1=pids.slice(0,half);
    g.config.team2=pids.slice(half);
  }

  // Wizard team randomize - called from template button (no IIFE needed)
  function wizRandomizeTeams(){
    var players=wiz.players;
    var shuffled=players.slice().sort(function(){return Math.random()-0.5;});
    shuffled.forEach(function(p,i){
      p.team=i<Math.ceil(shuffled.length/2)?1:2;
    });
  }
  // Score +/- helpers - called from template tap buttons
  function decScore(rid,pid,h){
    var cur=getScore(rid,pid,h);
    if(cur==null||cur===0){
      var par=activeRound.value?holePar(activeRound.value.course,h):4;
      setScore(rid,pid,h,par-1);
    }else if(cur>1){
      setScore(rid,pid,h,cur-1);
    }
  }
  function incScore(rid,pid,h){
    var cur=getScore(rid,pid,h);
    if(cur==null||cur===0){
      var par=activeRound.value?holePar(activeRound.value.course,h):4;
      setScore(rid,pid,h,par+1);
    }else{
      setScore(rid,pid,h,cur+1);
    }
  }
  function addWizSideMatch(type){
    const g=wiz.selectedGames.find(g=>g.type===type);if(!g)return;
    if(!g.config.matches)g.config.matches=[];
    g.config.matches.push({p1:wiz.players[0]?.id||'',p2:wiz.players[1]?.id||'',ppt:5});
  }
  function removeWizSideMatch(type,idx){
    const g=wiz.selectedGames.find(g=>g.type===type);if(!g)return;
    g.config.matches.splice(idx,1);
  }

  // ── Template helper functions (moved from inline template expressions) ──
  function sortedByTeam(rid){
    return [...roundPlayers(rid)].sort((a,b)=>{
      const ta=getP(a)?.team??9,tb=getP(b)?.team??9;
      return ta-tb;
    });
  }
  function isLastTeamPlayer(pid){
    const myTeam=getP(pid)?.team;
    if(!myTeam||myTeam===0)return false;
    const s=sortedByTeam(activeRound.value?.id);
    const myIdx=s.indexOf(pid);
    const next=s[myIdx+1];
    return !next||getP(next)?.team!==myTeam;
  }
  function teamFrontWins(rid,pid){
    const team=getP(pid)?.team;
    let c=0;for(let h=1;h<=9;h++)if(holeTeamWinner(rid,h)===team)c++;
    return c||'·';
  }
  function teamBackWins(rid,pid){
    const r=T.rounds.find(r=>r.id===rid);if(!r)return'·';
    const nc=holeCount(r.course);
    const team=getP(pid)?.team;
    let c=0;for(let h=10;h<=nc;h++)if(holeTeamWinner(rid,h)===team)c++;
    return c||'·';
  }
  function match1v1Standing(rid,p1,p2){
    const holes=compute1v1Holes(rid,p1,p2);
    const last=holes.filter(x=>x.result!==null);
    if(!last.length)return'—';
    const s=last[last.length-1].runScore;
    const rem=roundHoles(rid).length-last.length;
    if(s===0)return'A/S';
    const leader=s>0?pDisplay(p1):pDisplay(p2);
    const diff=Math.abs(s);
    return diff>rem?leader+' wins':leader+' '+diff+'up';
  }
  function match1v1NetScore(rid,p1,p2,forP1){
    const h=compute1v1Holes(rid,p1,p2).filter(x=>x.result!==null);
    if(!h.length)return'—';
    const s=h[h.length-1].runScore;
    if(forP1)return s>0?'+'+s:s===0?'A/S':String(s);
    return s<0?'+'+Math.abs(s):s===0?'A/S':'-'+s;
  }
  function match1v1Color(rid,p1,p2,forP1){
    const h=compute1v1Holes(rid,p1,p2).filter(x=>x.result!==null);
    if(!h.length)return'rgba(240,237,224,.45)';
    const s=h[h.length-1].runScore;
    if(forP1)return s>0?'#4ade80':s<0?'#f87171':'#d4af37';
    return s<0?'#4ade80':s>0?'#f87171':'#d4af37';
  }
  function histScoreClass(key,pid,hn,course){
    const d=getHistRoundData(key);
    const sc=d?.t?.scores?.[d?.r?.id]?.[pid]?.[hn];
    return showNotations.value&&sc?scoreClass(sc,holePar(course,hn)):'';
  }
  function histOutScore(key,holesRange,pid){
    const d=getHistRoundData(key);if(!d)return'·';
    return holesRange.filter(n=>n<=9).reduce((s,n)=>s+(d.t.scores?.[d.r.id]?.[pid]?.[n]||0),0)||'·';
  }
  function histInScore(key,holesRange,pid){
    const d=getHistRoundData(key);if(!d)return'·';
    return holesRange.filter(n=>n>9).reduce((s,n)=>s+(d.t.scores?.[d.r.id]?.[pid]?.[n]||0),0)||'·';
  }
  function importCourseFromCode(){
    importCourseError.value='';
    var raw=(importCourseCode.value||'').trim();
    // Strip the GW: prefix if present
    if(raw.startsWith('GW:'))raw=raw.slice(3);
    if(!raw){importCourseError.value='Paste a course code first';return;}
    var parsed;
    try{
      var decoded=atob(raw);
      parsed=JSON.parse(decoded);
    }catch(e){
      importCourseError.value='Invalid code — make sure you copied the full text from Claude';
      return;
    }
    // Validate minimum structure
    if(!parsed.name||!parsed.par||!Array.isArray(parsed.par)||parsed.par.length<9){
      importCourseError.value='Code missing required fields (name, par). Ask Claude to regenerate.';
      return;
    }
    var name=parsed.name;
    var holes=parsed.par.length;
    var si=parsed.si&&parsed.si.length===holes?parsed.si:Array.from({length:holes},function(_,i){return i+1;});
    var teesData={};
    var defaultTee='Green';
    if(parsed.tees&&Array.isArray(parsed.tees)&&parsed.tees.length){
      defaultTee=parsed.tees[0].name||'Green';
      parsed.tees.forEach(function(t){
        teesData[t.name||'Standard']={
          rating:parseFloat(t.rating)||72.0,
          slope:parseInt(t.slope)||113,
          yards:parseInt(t.yards)||0,
          yardsByHole:t.yardsByHole&&t.yardsByHole.length===holes?t.yardsByHole.map(Number):undefined
        };
      });
    }else{
      teesData['Green']={rating:parsed.rating||72.0,slope:parsed.slope||113,yards:0};
    }
    var courseObj={par:parsed.par.map(Number),si:si.map(Number),tees:defaultTee,teesData:teesData};
    COURSES[name]=courseObj;
    var updated=Object.assign({},customCourses.value);
    updated[name]=courseObj;
    customCourses.value=updated;
    customCourseVersion.value++;
    try{localStorage.setItem('golf_custom_courses',JSON.stringify(customCourses.value));}catch(e){}
    importCourseCode.value='';
    showImportCourse.value=false;
    toast.value='"'+name+'" added!';setTimeout(function(){toast.value='';},3000);
    courseDetailName.value=name;
  }

    function addCustomCourse(){
    const name=newCourseName.value.trim();
    if(!name){toast.value='Course name is required';setTimeout(function(){toast.value='';},3000);return;}
    const pArr=newCoursePars.value.split(',').map(function(x){return parseInt(x.trim());}).filter(function(n){return!isNaN(n)&&n>0;});
    const sArr=newCourseSIs.value.split(',').map(function(x){return parseInt(x.trim());}).filter(function(n){return!isNaN(n)&&n>0;});
    const holes=pArr.length;
    if(holes!==18&&holes!==9){toast.value='Par needs 9 or 18 comma-separated values (e.g. 4,3,5,4,3,5,4,4,4)';setTimeout(function(){toast.value='';},4000);return;}
    if(sArr.length!==holes){toast.value='Stroke Index count must match par count ('+holes+' values)';setTimeout(function(){toast.value='';},4000);return;}
    const tName=(newCourseTee.value||'').trim()||'Green';
    const rating=parseFloat(newCourseRating.value)||72.0;
    const slope=parseInt(newCourseSlope.value)||113;
    const courseObj={
      par:pArr,
      si:sArr,
      tees:tName,
      teesData:{},
    };
    courseObj.teesData[tName]={rating:rating,slope:slope,yards:0,yardsByHole:Array(holes).fill(0)};
    COURSES[name]=courseObj;
    const updated=Object.assign({},customCourses.value);
    updated[name]=courseObj;
    customCourses.value=updated;
    customCourseVersion.value++;
    try{localStorage.setItem('golf_custom_courses',JSON.stringify(customCourses.value));}catch(e){}
    newCourseName.value='';newCoursePars.value='';newCourseSIs.value='';
    newCourseTee.value='Green';newCourseRating.value='';newCourseSlope.value='';
    addingCourse.value=false;
    toast.value='Course "'+name+'" added!';setTimeout(function(){toast.value='';},2500);
  }
  function editCustomCourse(name){
    var cc=customCourses.value&&customCourses.value[name];
    var builtIn=COURSES[name];
    // If no custom overlay exists, create one from the built-in course data
    if(!cc&&builtIn){
      cc={par:(builtIn.par||[]).slice(),si:(builtIn.si||[]).slice(),tees:[]};
      // Convert teesData to tees array
      if(builtIn.teesData){
        Object.keys(builtIn.teesData).forEach(function(tn){
          var td=builtIn.teesData[tn];
          cc.tees.push({name:tn,rating:td.rating||72,slope:td.slope||113,yards:td.yards||0,yardsByHole:td.yardsByHole||[]});
        });
      }
    }
    if(!cc)return;
    var tees=(cc.tees||[]).map(function(t){
      var holes=[];
      for(var hi=0;hi<(cc.par||[]).length;hi++){
        holes.push({par:cc.par[hi]||4,yardage:(t.yardsByHole&&t.yardsByHole[hi])||0,handicap:cc.si[hi]||hi+1});
      }
      return Object.assign({},t,{tee_name:t.name,course_rating:t.rating,slope_rating:t.slope,total_yards:t.yards,holes:holes});
    });
    if(!tees.length){
      var holes=[];
      for(var hi2=0;hi2<(cc.par||[]).length;hi2++){
        holes.push({par:cc.par[hi2]||4,yardage:0,handicap:cc.si[hi2]||hi2+1});
      }
      tees=[{tee_name:'Default',course_rating:72,slope_rating:113,total_yards:0,holes:holes}];
    }
    scorecardPreview.value={
      courseName:name,
      courseId:null,
      tees:tees,
      selectedTeeIndices:tees.map(function(_,i){return i;}),
      viewingTeeIdx:0,
      editMode:false,
      isEdit:true,
      r:{club_name:name,tees:{male:tees,female:[]}}
    };
  }

  function deleteCustomCourse(name){
    if(!customCourses.value[name])return;
    if(!confirm('Remove custom course "'+name+'"? This cannot be undone.'))return;
    delete COURSES[name];
    const updated=Object.assign({},customCourses.value);
    delete updated[name];
    customCourses.value=updated;
    customCourseVersion.value++;
    try{localStorage.setItem('golf_custom_courses',JSON.stringify(customCourses.value));}catch(e){}
    if(courseDetailName.value===name)courseDetailName.value=null;
    toast.value='Course removed';setTimeout(function(){toast.value='';},2000);
  }
  function playerLastName(p){
    const parts=(p.name||'').trim().split(' ').filter(function(w){return w.length>0;});
    return(parts[parts.length-1]||p.name||'').toLowerCase();
  }
  function holeScoreStyle(rid,h,pid){
    const winners=holeNetWinners(rid,h);
    const teamWon=holeTeamWinner(rid,h);
    const myTeam=getP(pid)?.team;
    if(teamWon!==null){
      if(teamWon===0)return{color:'rgba(212,175,55,.8)'};
      if(teamWon===myTeam)return{color:'#4ade80'};
      return{color:'rgba(240,237,224,.45)'};
    }else{
      if(winners.length>1&&winners.includes(pid))return{color:'rgba(212,175,55,.8)'};
      if(winners.length===1&&winners.includes(pid))return{color:'#4ade80'};
      return{color:'rgba(240,237,224,.45)'};
    }
  }
  function holeScoreLabel(rid,h,pid){
    const winners=holeNetWinners(rid,h);
    const teamWon=holeTeamWinner(rid,h);
    const myTeam=getP(pid)?.team;
    if(teamWon!==null){
      if(teamWon===0)return'= TIE';
      if(teamWon===myTeam)return'🏆 TEAM WIN';
      return'NET';
    }else{
      if(winners.length>1&&winners.includes(pid))return'= TIE';
      if(winners.length===1&&winners.includes(pid))return'🏆 WON';
      return'NET';
    }
  }
  // ── End template helpers ──

  function addWizSavedPlayer(sp){
    const idx=wiz.players.findIndex(p=>p.id===sp.id);
    if(idx>=0){
      wiz.players.splice(idx,1);
    }else{
      wiz.players.push({
        id:sp.id,
        name:sp.name||'',
        short:sp.short||sp.name?.trim().split(' ')[0]||'',
        ghin:sp.ghin??0,
        team:0,
        roundHcp:{}
      });
    }
  }

  function finishWizard(){
    const tourId='tour_'+Date.now();
    // Deep-copy players so reactive proxy refs don't leak into T
    const players=JSON.parse(JSON.stringify(wiz.players));
    // Set short name and use entered handicap directly as playing handicap
    players.forEach(p=>{
      p.short=p.name.trim().split(' ')[0]||p.id;
      if(!p.roundHcp)p.roundHcp={};
    });

    if(wiz.mode==='single'){
      const round={
        id:1,
        course:wiz.singleRound.course,
        tee:wiz.singleRound.tee||'Green',
        format:wiz.singleRound.format||'social',
        date:wiz.singleRound.date||TODAY,
        holesMode:wiz.singleRound.holesMode||'18',
        points:0,
        groups:wiz.groups.length?JSON.parse(JSON.stringify(wiz.groups)):[],
        desc:'',
      };
      // Apply wizard HCP overrides only; otherwise let pRoundHcp calculate from slope/rating
      players.forEach(p=>{
        if(p.roundHcpOverride!=null){p.roundHcp[1]=p.roundHcpOverride;}
        delete p.roundHcpOverride; // clean up wizard-only field
      });
      const t={
        id:tourId,
        name:(function(){
          // Auto-generate: "Course · Mon DD" — no user input needed for single rounds
          var course=wiz.singleRound.course||'Round';
          var d=wiz.singleRound.date?new Date(wiz.singleRound.date+'T12:00:00'):new Date();
          var month=d.toLocaleDateString('en-US',{month:'short'});
          var day=d.getDate();
          return course+' · '+month+' '+day;
        })(),
        type:'single',
        teams:[],
        players:players,
        rounds:[round],
        scores:{},
        matchResults:{},
        roundResults:{},
        // Deep-copy selected games to avoid reactive proxy leakage
        gameRounds:(function(){
          // Single round: if multiple groups, expand selectedGames per-group via emitter
          if(wiz.groups&&wiz.groups.length>1){
            var sgPids=players.map(function(p){return p.id;});
            var sgT1=players.filter(function(p){return p.team===1;}).map(function(p){return p.id;});
            var sgT2=players.filter(function(p){return p.team===2;}).map(function(p){return p.id;});
            return{1:emitWizSelectedGames(wiz.selectedGames,wiz.groups,sgT1,sgT2,sgPids)};
          }
          return{1:wiz.selectedGames.map(function(g){
            var cfg=JSON.parse(JSON.stringify(g.config));
            if(g.type==='wolf'){cfg.teeOrder=cfg.wolfTeeOrder||[];if(!cfg.holes)cfg.holes={};}
            if(g.type==='snake'&&!cfg.holders)cfg.holders={};
            if(g.type==='dots'&&!cfg.entries)cfg.entries={};
            if(g.type==='hammer'&&!cfg.holes)cfg.holes={};
            if(g.type==='fiveThreeOne'){cfg.players=cfg.players||[];}
            var gameObj={type:g.type,config:cfg};
            if(g.type==='bestball'){gameObj.groupIndex=null;}
            else{gameObj.groupIndex=null;}
            return gameObj;
          })};
        })(),
      };
      // Load into T, then set view state
      Object.assign(T,{roundResults:{},gameRounds:{},matchResults:{},scores:{},teams:[],players:[],rounds:[]},t);
      activeId.value=tourId;
      screen.value='app';
      view.value='scoring';
      activeRound.value=T.rounds[0];
      activeHole.value=1;
      activeGroup.value=null;
      defaultToPar.value=true;
      showGps.value=true;
      startGpsWatch();
      if(!liveWeather.value)startWeatherUpdates();
      histPlayer.value='';
      saveData();
      saveTournaments();
      saveArchive(true);
    }else{
      const rounds=JSON.parse(JSON.stringify(wiz.rounds));
      // Build team pid arrays from wizard team assignments
      var tourT1=players.filter(function(p){return p.team===1;}).map(function(p){return p.id;});
      var tourT2=players.filter(function(p){return p.team===2;}).map(function(p){return p.id;});
      var allPids=players.map(function(p){return p.id;});

      // ── GROUPS: prefer wizard picks, else auto-generate ──
      var wizGroupsFilled=wiz.groups.length>0&&wiz.groups.some(function(g){return g.length>0;});
      var effectiveGroups=[];
      if(wizGroupsFilled){
        effectiveGroups=JSON.parse(JSON.stringify(wiz.groups));
      }else if(players.length>4){
        if(tourT1.length&&tourT2.length){
          // Mix teams evenly across groups of 4
          var numGrp=Math.ceil(players.length/4);
          for(var gi=0;gi<numGrp;gi++)effectiveGroups.push([]);
          tourT1.forEach(function(pid,i){effectiveGroups[i%numGrp].push(pid);});
          tourT2.forEach(function(pid,i){effectiveGroups[i%numGrp].push(pid);});
        }else{
          // No teams — split by player order into foursomes
          for(var si=0;si<allPids.length;si+=4){
            effectiveGroups.push(allPids.slice(si,si+4));
          }
        }
      }

      // ── TEAMS: auto-assign if user skipped team picks ──
      if(!tourT1.length&&!tourT2.length){
        if(effectiveGroups.length>0){
          // Within each group, first half = T1, second half = T2
          effectiveGroups.forEach(function(grpPids){
            var half=Math.ceil(grpPids.length/2);
            grpPids.forEach(function(pid,idx){
              var p=players.find(function(x){return x.id===pid;});
              if(p)p.team=idx<half?1:2;
            });
          });
        }else{
          // No groups either — split roster in half
          var rosterHalf=Math.ceil(players.length/2);
          players.forEach(function(p,idx){p.team=idx<rosterHalf?1:2;});
        }
        tourT1=players.filter(function(p){return p.team===1;}).map(function(p){return p.id;});
        tourT2=players.filter(function(p){return p.team===2;}).map(function(p){return p.id;});
      }

      // Assign groups to ALL rounds — format-aware
      rounds.forEach(function(r){
        if(!r.holesMode)r.holesMode='18';
        var fmt=r.format||'social';
        if(TEAM_GROUP_FMTS[fmt]&&tourT1.length>=2&&tourT2.length>=2){
          // Team Day: teammates play together (group by team)
          r.groups=[tourT1.slice(),tourT2.slice()];
        }else{
          // Mixed groups for head-to-head formats (Hi-Low, Match, etc.)
          r.groups=effectiveGroups.length?JSON.parse(JSON.stringify(effectiveGroups)):[];
        }
      });
      // Apply wizard HCP overrides for tournament rounds
      players.forEach(function(p){
        if(p.roundHcpOverride!=null){
          rounds.forEach(function(r){p.roundHcp[r.id]=p.roundHcpOverride;});
        }
        delete p.roundHcpOverride;
      });
      // Auto-create gameRounds from each round's format — PER GROUP, plus wizard-selected games
      var gameRounds=buildGameRoundsFromFormat(rounds,tourT1,tourT2,allPids,wiz.selectedGames);
      const t={
        id:tourId,
        name:wiz.name,
        type:'tournament',
        teams:[{id:1,name:wiz.t1||'Team 1'},{id:2,name:wiz.t2||'Team 2'}],
        players:players,
        rounds:rounds,
        scores:{},
        matchResults:{},
        roundResults:{},
        gameRounds:gameRounds,
      };
      Object.assign(T,{roundResults:{},gameRounds:{},matchResults:{},scores:{},teams:[],players:[],rounds:[]},t);
      activeId.value=tourId;
      screen.value='app';
      view.value='scoring';
      activeRound.value=T.rounds[0];
      activeHole.value=1;
      activeGroup.value=null;
      defaultToPar.value=true;
      showGps.value=true;
      startGpsWatch();
      if(!liveWeather.value)startWeatherUpdates();
      histPlayer.value='';
      saveData();
      saveTournaments();
      saveArchive(true);
    }
  }
function scorecardPlayers(rid){
    // If a 5-3-1 game is active with configured players, show only those 3
    var g=(T.gameRounds[rid]||[]).find(function(x){return x.type==='fiveThreeOne';});
    if(g&&g.config&&g.config.players&&g.config.players.length===3)return g.config.players;
    return roundPlayers(rid);
  }
function holeNetWinners(rid,h){
    const r=T.rounds.find(r=>r.id===rid);if(!r)return[];
    const pids=roundPlayers(rid);
    const nets=pids.map(pid=>{const g=getScore(rid,pid,h);if(g==null)return null;return{pid,net:g-strokesOnHole(primaryGameHcp(pid,rid).hcp,holeSI(r.course,h))};});
    if(nets.some(x=>x===null))return[];
    const best=Math.min(...nets.map(x=>x.net));
    return nets.filter(x=>x.net===best).map(x=>x.pid);
  }
function holeTeamWinner(rid,h){
    const games=T.gameRounds[rid]||[];
    const teamGame=games.find(g=>['nassau','vegas','match'].includes(g.type)&&g.config?.team1&&g.config?.team2);
    if(!teamGame)return null;
    const pids=roundPlayers(rid);
    const t1=[...(teamGame.config?.team1||[])];
    const t2=[...(teamGame.config?.team2||[])];
    const t1Best=Math.min(...pids.filter(p=>t1.includes(p)).map(p=>{const g=getScore(rid,p,h);if(g==null)return Infinity;return g-strokesOnHole(primaryGameHcp(p,rid).hcp,holeSI(T.rounds.find(r=>r.id===rid)?.course||'',h));}));
    const t2Best=Math.min(...pids.filter(p=>t2.includes(p)).map(p=>{const g=getScore(rid,p,h);if(g==null)return Infinity;return g-strokesOnHole(primaryGameHcp(p,rid).hcp,holeSI(T.rounds.find(r=>r.id===rid)?.course||'',h));}));
    if(t1Best===Infinity||t2Best===Infinity)return null;
    if(t1Best<t2Best)return 1;
    if(t2Best<t1Best)return 2;
    return 0; // tie/halved
  }

// Export all scoring functions
export {
  strokesOnHole,
  getScore,
  setScore,
  editRoundHcp,
  netScore,
  gameNetScore,
  scoreClass,
  holeHasData,
  grossTotal,
  netTotal,
  roundGroups,
  gameGroupIndex,
  groupGames,
  roundPlayers,
  scorecardPlayers,
  holeNetWinners,
  holeTeamWinner,
};
