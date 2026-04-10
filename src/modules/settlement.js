/**
 * settlement.js - Game settlement and ledger calculations
 * Extracted from GolfWizard main application
 * Handles debt clearing, minimum transfers, and round settlements
 */

// ══════════════════════════════════════════════════════════════════
// SETTLEMENT & LEDGER FUNCTIONS
// ══════════════════════════════════════════════════════════════════

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

// Export all settlement functions
export {
  computeFullSettlement,
  computeRoundGameResult,
};
