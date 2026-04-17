/**
 * courses.js - Golf course data and definitions
 * Extracted from GolfWizard main application
 */

// All ~100 built-in golf courses with tee data
export const COURSES={
  'Bandon Trails':{
    par:[4,3,5,4,3,4,4,4,5,4,4,3,4,4,4,5,3,4],
    si:[13,17,3,5,15,9,7,11,1,10,4,18,12,14,8,2,16,6],
    tees:'Green',
    teesData:{
      'Black':{rating:74.9,slope:136,yards:6788,yardsByHole:[392,214,549,408,133,395,440,321,567,418,445,242,401,325,406,530,182,420]},
      'Green':{rating:72.0,slope:137,yards:6249,yardsByHole:[356,166,532,365,124,359,406,299,522,393,429,235,374,306,367,494,159,363]},
      'Gold':{rating:69.6,slope:132,yards:5751,yardsByHole:[288,142,513,334,114,315,373,283,497,369,398,220,354,292,323,466,138,332]},
      'Royal Blue':{rating:63.0,slope:113,yards:3937,yardsByHole:[212,84,356,200,104,204,264,243,353,255,279,153,243,174,239,260,92,222]},
      'Orange':{rating:66.6,slope:125,yards:5097,yardsByHole:[212,84,455,315,104,293,351,243,456,326,382,192,308,251,296,437,128,264]},
    },
  },
  'Old Macdonald':{
    par:[4,3,4,4,3,5,4,3,4,4,4,3,4,4,5,4,5,4],
    si:[11,15,9,1,17,3,5,13,7,6,4,16,18,14,12,2,10,8],
    tees:'Green',
    teesData:{
      'Black':{rating:74.4,slope:134,yards:6944,yardsByHole:[341,181,375,504,160,555,363,181,416,465,445,237,346,370,535,455,546,469]},
      'Green':{rating:71.4,slope:127,yards:6320,yardsByHole:[304,162,345,472,134,520,345,170,352,440,399,205,319,297,482,433,515,426]},
      'Gold':{rating:67.8,slope:117,yards:5658,yardsByHole:[275,139,312,441,121,467,322,152,343,383,390,164,253,254,424,408,397,413]},
      'Royal Blue':{rating:62.6,slope:104,yards:4040,yardsByHole:[213,102,217,283,100,354,195,121,231,278,250,91,220,184,313,270,343,275]},
      'Orange':{rating:65.1,slope:112,yards:4985,yardsByHole:[242,106,244,391,100,401,311,130,284,369,344,149,247,238,340,326,391,372]},
    },
  },
  'Bandon Dunes':{
    par:[4,3,5,4,4,3,4,4,5,4,4,3,5,4,3,4,4,5],
    si:[13,15,3,5,1,17,7,11,9,8,2,18,6,16,14,10,12,4],
    tees:'Green',
    teesData:{
      'Black':{rating:73.5,slope:143,yards:6732,yardsByHole:[386,189,543,410,428,161,383,359,558,362,384,199,553,359,163,363,389,543]},
      'Green':{rating:71.1,slope:133,yards:6221,yardsByHole:[352,155,489,362,400,153,372,342,520,339,351,153,537,332,131,345,375,513]},
      'Gold':{rating:69.1,slope:124,yards:5716,yardsByHole:[332,136,467,340,374,126,332,321,510,302,315,129,498,320,113,301,329,471]},
      'Royal Blue':{rating:61.6,slope:105,yards:3986,yardsByHole:[223,117,318,228,260,111,232,220,335,200,228,98,344,205,80,210,244,333]},
      'Orange':{rating:65.5,slope:114,yards:5040,yardsByHole:[293,117,351,308,321,111,317,290,464,251,284,98,447,288,102,250,324,424]},
    },
  },
  'Pacific Dunes':{
    par:[4,4,5,4,3,4,4,4,4,3,3,5,4,3,5,4,3,5],
    si:[9,11,7,3,17,13,1,5,15,14,18,6,2,16,10,12,8,4],
    tees:'Green',
    teesData:{
      'Black':{rating:73.2,slope:143,yards:6633,yardsByHole:[370,368,499,463,199,316,464,400,406,206,148,529,444,145,539,338,208,591]},
      'Green':{rating:70.8,slope:135,yards:6142,yardsByHole:[304,335,476,449,181,288,436,369,379,163,131,507,390,128,504,338,189,575]},
      'Gold':{rating:68.9,slope:131,yards:5775,yardsByHole:[287,335,476,410,163,288,377,349,356,149,114,476,371,119,492,301,164,548]},
      'Royal Blue':{rating:61.5,slope:113,yards:3920,yardsByHole:[200,180,309,320,115,167,239,240,262,128,96,330,250,100,320,200,118,346]},
      'Orange':{rating:65.8,slope:126,yards:5088,yardsByHole:[253,275,452,369,133,267,314,296,268,129,96,449,336,100,452,292,128,479]},
    },
  },
  'Sheep Ranch':{
    par:[5,4,3,4,3,4,3,4,4,4,5,4,5,4,4,3,4,5],
    si:[5,13,17,3,11,1,15,7,9,6,4,2,10,8,14,16,12,18],
    tees:'Black',
    teesData:{
      'Black':{rating:71.9,slope:121,yards:6636,yardsByHole:[549,318,120,474,198,460,155,429,399,390,529,440,510,403,321,151,326,464]},
      'Green':{rating:70.0,slope:116,yards:6245,yardsByHole:[517,303,113,443,166,431,138,407,386,375,506,414,485,377,303,131,314,436]},
      'Gold':{rating:67.9,slope:109,yards:5810,yardsByHole:[491,282,101,415,139,401,110,382,361,356,463,390,464,354,279,120,297,405]},
      'Royal Blue':{rating:61.0,slope:97,yards:3943,yardsByHole:[307,231,75,259,91,246,88,264,239,229,296,231,319,237,210,90,228,303]},
      'Orange':{rating:65.0,slope:102,yards:5144,yardsByHole:[422,263,94,379,130,318,99,337,339,316,411,318,377,325,260,102,266,388]},
    },
  },
  "Shorty's":{
    par:[3,3,3,3,3,3,3,3,3,3,3,3,3],
    si:[1,2,3,4,5,6,7,8,9,10,11,12,13],
    tees:'Red',
    teesData:{'Red':{rating:50,slope:80,yards:2200}},
  },
  'Bandon Preserve':{
    par:[3,3,3,3,3,3,3,3,3,3,3,3,3],
    si:[1,2,3,4,5,6,7,8,9,10,11,12,13],
    tees:'Back',
    teesData:{
      'Back':{rating:48.0,slope:75,yards:1609,yardsByHole:[134,150,87,118,142,131,147,63,134,120,142,132,109]},
      'Front':{rating:45.0,slope:72,yards:1121,yardsByHole:[90,93,65,83,95,77,119,40,88,93,95,108,75]},
    },
  },
  // ── Courses from backup ───────────────────────────────────────
  'Bonnie Briar Country Club':{
    // Sources: Blue tee card (OUT=3139/IN=3246/TOT=6385 verified),
    //          combo scorecard (BW OUT=3049/IN=3157/TOT=6206, White OUT=2948/IN=3029/TOT=5977 verified),
    //          ratings from back-of-card (Blue 71.7/140, BW 71.2/137, White 69.9/134)
    // Par: H1-9=35, H10-18=36, Total=71
    par:[4,4,3,4,3,4,4,4,5,3,4,4,4,4,3,5,5,4],
    si:[4,12,18,10,14,2,16,6,8,13,3,9,1,11,17,7,5,15],
    tees:'Blue',
    teesData:{
      'Blue':{rating:71.7,slope:140,yards:6385,
        siByHole:[4,12,18,10,14,2,16,6,8,13,3,9,1,11,17,7,5,15],
        yardsByHole:[468,341,168,366,185,403,309,408,491,202,453,333,458,320,133,525,518,304]},
      'Blue/White':{rating:71.2,slope:137,yards:6206,
        siByHole:[4,12,16,10,18,2,14,6,8,13,3,9,1,11,17,7,5,15],
        yardsByHole:[451,341,168,366,151,403,309,380,480,202,428,333,426,320,133,525,486,304]},
      'White':{rating:69.9,slope:134,yards:5977,
        siByHole:[4,12,16,10,18,2,14,6,8,13,3,9,1,11,17,7,5,15],
        yardsByHole:[451,326,161,351,151,388,298,360,462,188,428,320,426,298,125,508,442,294]},
    },
  },
  'Manhattan Woods Golf Club':{
    par:[4,4,5,3,4,4,3,5,4,4,4,3,5,4,5,4,3,4],
    si:[9,11,5,15,1,13,17,7,3,10,12,18,4,2,14,8,16,6],
    tees:'White',
    teesData:{
      'Black':{rating:74.0,slope:138,yards:7010,yardsByHole:[415,415,545,210,460,435,215,555,410,410,440,215,540,415,555,415,215,440]},
      'White':{rating:70.5,slope:130,yards:6400,yardsByHole:[380,380,510,180,425,400,185,520,375,375,405,185,505,380,520,380,185,405]},
      'Red':{rating:67.0,slope:122,yards:5650,yardsByHole:[335,335,455,150,375,350,155,465,330,330,355,155,450,335,465,335,155,355]},
    },
  },
  'Kiawah Island Club':{
    par:[4,5,3,4,4,3,4,5,4,4,4,3,5,4,4,5,3,4],
    si:[5,9,11,13,15,17,1,7,3,4,10,16,12,8,6,14,18,2],
    tees:'White',
    teesData:{
      'Black':{rating:76.0,slope:144,yards:7376,yardsByHole:[445,576,205,449,463,240,431,600,437,462,452,215,575,466,464,618,222,456]},
      'White':{rating:72.0,slope:135,yards:6700,yardsByHole:[405,530,175,410,420,210,390,555,395,420,410,185,530,425,420,570,195,415]},
      'Red':{rating:68.5,slope:127,yards:5900,yardsByHole:[360,465,145,360,370,175,345,490,350,370,360,155,470,375,370,505,165,365]},
    },
  },
  'Bulls Bay Golf Club':{
    par:[4,5,3,5,4,5,3,4,4,5,4,3,5,3,4,4,3,4],
    si:[9,1,17,3,15,5,13,11,7,8,10,16,2,14,4,12,18,6],
    tees:'White',
    teesData:{
      'Black':{rating:74.5,slope:140,yards:7131,yardsByHole:[424,562,209,575,418,566,206,440,430,524,424,209,556,196,416,410,196,370]},
      'White':{rating:71.0,slope:133,yards:6500,yardsByHole:[388,520,180,535,383,526,175,403,393,488,388,175,518,163,380,373,163,337]},
      'Red':{rating:67.0,slope:125,yards:5700,yardsByHole:[340,455,150,470,335,460,145,352,343,427,340,145,453,135,332,326,135,293]},
    },
  },
};

export const FORMATS=[
  {id:'social',name:'Social / Casual'},
  {id:'stroke',name:'Stroke Play (Net)'},
  {id:'best-ball',name:'2v2 Best Ball Match Play'},
  {id:'stableford',name:'2v2 Stableford'},
  {id:'high-low',name:'2v2 High-Low Aggregate'},
  {id:'singles-match',name:'Singles Net Match Play'},
  {id:'team-day',name:'Team Day (Best 2 Net + Gross)'},
];
export const WOLF_HOLE_MODES=[{k:'normal',l:'🤝 Partner'},{k:'lone',l:'🐺 Lone'},{k:'blind',l:'🙈 Blind'}];
  export const HOLES_MODE_OPTS=[{v:'18',l:'Full 18'},{v:'front9',l:'Front 9'},{v:'back9',l:'Back 9'}];
  export const VEGAS_VARIANT_OPTS=[
    {k:'standard',l:'Standard Vegas',d:'Low score leads the 2-digit number. Score 7+ flips to back.'},
    {k:'montecarlo',l:'Monte Carlo',d:'Best ball per team — lower ball wins.'},
    {k:'daytona',l:'Daytona / Flip the Bird',d:'Worst score leads the number. Still flips on 7+.'},
    {k:'newtown',l:'Newtown (Rock Ridge CC)',d:'Sort all 4 scores. Middle two partner vs outer two. No fixed teams.'}
  ];
  export const WOLF_VARIANT_OPTS=[
    {k:'blindWolf',icon:'🙈',label:'Blind Wolf',desc:'Wolf declares before seeing anyone tee off. Points doubled.'},
    {k:'lastPlaceWolf',icon:'🔻',label:'Last Place Wolf (17 & 18)',desc:'On holes 17 & 18, player in last place becomes wolf instead of normal rotation.'}
  ];
  export const WOLF_MULTIPLIER_OPTS=[{v:1,l:'1× (same as team)'},{v:2,l:'2× (double)'},{v:3,l:'3× (triple)'}];

  export const GAME_DEFS={
  // ── MAIN GAMES ──
  nassau:{icon:'💰',name:'Nassau',role:'main',
    desc:'Three separate bets: Front 9, Back 9, and Overall 18. Best ball per team each hole (lower net wins). Auto-press when down.',
    players:'2v2 teams',
    rules:'Each hole: compare best net score from each team. Lower net wins the hole (+1). Equal = halved. Track running score per side (front/back) and overall. When one team is down by the press threshold, a new bet automatically starts from the next hole for the remaining holes on that side.',
    wagering:'Set $ for front, back, and overall separately. Press doubles the action on that side. Common: $10/$10/$20 with auto-press at 2 down.',
    hcpNote:'Low-man method: subtract the lowest handicap in the foursome from everyone. Strokes given on holes by stroke index.',
    example:'Team A has net 4, net 5 on a par 5. Team B has net 5, net 6. Team A\'s best ball is 4, Team B\'s is 5. Team A wins the hole.'},
  match:{icon:'⚔️',name:'Match Play',role:'main',
    desc:'Head-to-head by hole. Lower net score wins the hole = 1 up. Match ends when lead exceeds remaining holes.',
    players:'1v1 or 2v2',
    rules:'Each hole: lower net score wins (+1 to their count). Equal net = halved. Status shows "X up with Y to play." Match is won when a player/team is up by more holes than remain (e.g., 3&2 = 3 up with 2 to play). If tied after 18, result is "All Square."',
    wagering:'Flat $ per match (closeout). Common: $20/match.',
    hcpNote:'Low-man method: subtract the lowest handicap in the group. 1v1 uses difference between the two players.',
    example:'Player A is 3 up with 2 to play — match is over, Player A wins 3&2.'},
  vegas:{icon:'🎰',name:'Vegas',role:'main',
    desc:'Teams of 2. Both scores combine into a 2-digit number (lower score first). Lower team number wins, difference = points.',
    players:'2v2 teams',
    rules:'Each hole: sort each team\'s two scores low-high, combine into 2-digit number (e.g., 3 and 5 = 35). Lower number wins. Difference = points that hole. Birdie flip: if your team makes a birdie, opponent\'s number gets reversed (e.g., 35 → 53). Any individual score of 7+ automatically goes to the back position.',
    wagering:'$ per point difference. Cumulative over 18 holes. Common: $1/pt.',
    hcpNote:'Net or Gross toggle available. Net uses low-man method. Gross plays without strokes.',
    example:'Team A: scores 4,5 = 45. Team B: scores 3,6 = 36. Team B wins, difference is 45-36 = 9 points.'},
  skins:{icon:'🏆',name:'Skins',role:'main',
    desc:'Every hole is worth a "skin." Lowest net score wins the skin outright. Ties carry the skin to the next hole.',
    players:'3-4 individual',
    rules:'Each hole: player with the lowest net score wins the skin. If two or more players tie for the best score, no skin is awarded and it carries to the next hole (if carry is on). Carried skins accumulate until someone wins outright.',
    wagering:'$ per skin. If 5 skins carry, the next outright winner takes all 5. Common: $5/skin.',
    hcpNote:'Low-man method: subtract the lowest handicap in the foursome from everyone.',
    example:'Hole 7: three players tie at net 3. Skin carries. Hole 8: one player makes net 2. They win 2 skins ($10).'},
  hilow:{icon:'📊',name:'Hi-Low',role:'main',
    desc:'2v2 team game. Each hole has two points: one for low ball (best score), one for high ball (worst score).',
    players:'2v2 teams',
    rules:'Each hole: compare the best net score from each team (low ball) — lower wins a point. Then compare the worst net score from each team (high ball) — lower wins a point. Ties = halved (½ point each). Total points after 18 determines winner.',
    wagering:'$ per point difference at the end. Common: $5/pt.',
    hcpNote:'Low-man method: subtract the lowest handicap in the foursome.',
    example:'Team A: net 3 & 5. Team B: net 4 & 4. Low ball: A wins (3<4). High ball: B wins (4<5). Split hole.'},
  stableford:{icon:'⭐',name:'Stableford',role:'main',
    desc:'Points-based scoring against par. Rewards birdies and eagles, limits damage from blow-up holes.',
    players:'Individual (all players)',
    rules:'Points per hole based on net score vs par: Double Eagle +5, Eagle +3, Birdie +2, Par +1, Bogey 0, Double Bogey or worse −1. Pick up and move on after double — no need to finish. Highest total points wins.',
    wagering:'$ per point difference. Or set a pot and split by placement. Common: $1/pt.',
    hcpNote:'Full course handicap (GHIN → slope/rating adjusted). Each player gets their full allotment of strokes.',
    example:'Par 4, you make net birdie = +2 pts. Par 5, you make net double = −1 pt. After 18, highest total wins.'},
  wolf:{icon:'🐺',name:'Wolf',role:'main',
    desc:'Rotating "Wolf" picks a partner after watching each player tee off, or goes Lone Wolf for double stakes.',
    players:'4 players',
    rules:'Tee order rotates (1-2-3-4, 2-3-4-1, etc.). The Wolf tees off first and watches each player hit. After any tee shot, Wolf can pick that player as partner — but must decide before the next player hits. If Wolf picks nobody, they go Lone (1 vs 3) for double stakes. Best ball per side wins the hole.',
    wagering:'$ per point. Lone Wolf multiplier (2× or 3×). Common: $5/pt with 2× lone.',
    hcpNote:'Low-man method: subtract the lowest handicap in the foursome.',
    example:'You\'re Wolf. Player B stripes it, you pick them. Your team\'s best ball (net 3) vs the other two\'s best ball (net 4). You win.'},
  hammer:{icon:'🔨',name:'Hammer',role:'main',
    desc:'2v2 where either team can "throw the hammer" to double the stakes. Opponent must accept or concede the hole.',
    players:'2v2 teams',
    rules:'Each hole starts at the base bet. At any point, a team can throw the hammer to double the current value. The other team must either accept (bet doubles) or concede the hole at current value. Only the team that is currently losing the hole can hammer. Multiple hammers per hole allowed.',
    wagering:'$ per hole (starting value). Doubles with each hammer. Common: $1 base.',
    hcpNote:'Low-man method: subtract the lowest handicap in the foursome.',
    example:'Hole starts at $1. Team A hammers → $2. Team B accepts and re-hammers → $4. Team A accepts. Hole is now worth $4.'},
  sixes:{icon:'🎲',name:'Sixes',role:'main',
    desc:'Teams rotate every 6 holes so everyone partners with everyone. 6 points available per hole.',
    players:'4 players (rotating 2v2)',
    rules:'Holes 1-6: Player A+B vs C+D. Holes 7-12: A+C vs B+D. Holes 13-18: A+D vs B+C. Each hole: best ball wins = 4 pts to winners, 2 to losers. Tie = 3 each. After 18, tally each player\'s total points.',
    wagering:'$ per point difference from average (24 pts). Common: $1/pt.',
    hcpNote:'Low-man method: subtract the lowest handicap in the foursome.',
    example:'Your team wins 4 of 6 holes and ties 2. That\'s 4×4 + 2×3 = 22 pts for your pair in that 6-hole set.'},
  fiveThreeOne:{icon:'5️⃣',name:'5-3-1',role:'main',
    desc:'Every hole awards 5 points to best net, 3 to second, 1 to third, 0 to worst. No ties — playoff rules apply.',
    players:'4 players',
    rules:'Each hole: rank all 4 players by net score. Best = 5 pts, second = 3, third = 1, worst = 0. If players tie, combine their point values and split equally (e.g., two players tie for best: (5+3)/2 = 4 each). Total points after 18 determines winner.',
    wagering:'$ per point difference. Common: $1/pt.',
    hcpNote:'Low-man method: subtract the lowest handicap in the foursome.',
    example:'Hole 5: net scores are 3, 4, 4, 5. Player with 3 gets 5 pts. Two tied at 4 split 3+1 = 2 pts each. Player with 5 gets 0.'},
  bestball:{icon:'🏅',name:'Best Ball (Team)',role:'main',
    desc:'2v2 team game. Each hole: best ball from each team compared. Lower wins the hole.',
    players:'2v2 teams',
    rules:'Each hole: each team takes the best (lowest) net score among their two players. Compare the two team best-balls. Lower score wins the hole. Ties are halved. Track cumulative holes won.',
    wagering:'$ per hole won or $ per match. Common: $5/hole.',
    hcpNote:'Low-man method: subtract the lowest handicap in the foursome.',
    example:'Team A: net 3, net 5 → best ball 3. Team B: net 4, net 4 → best ball 4. Team A wins the hole.'},

  // ── SIDE GAMES ──
  dots:{icon:'🎯',name:'Dots / Junk',role:'side',
    desc:'Bonus bets for special achievements: birdies, greenies (closest on par 3), sandies (up-and-down from bunker), and more.',
    players:'All players',
    rules:'Track specific events during the round. Each event earns a "dot." Common dots: Birdie (net birdie), Greenie (closest to pin on par 3 and make par or better), Sandy (up-and-down from bunker), Eagle (net eagle, worth 2 dots). At the end, each player pays the difference in dots to each other player.',
    wagering:'$ per dot. Each player settles with every other player based on dot differential. Common: $2/dot.',
    hcpNote:'Birdies/eagles are based on net score. Greenies/sandies are gross achievements.',
    example:'You finish with 5 dots, your buddy has 2. He pays you (5-2) × $2 = $6.'},
  snake:{icon:'🐍',name:'Snake',role:'side',
    desc:'Three-putt tracker. Whoever 3-putts last is "holding the snake" and pays everyone at the end.',
    players:'All players',
    rules:'Anytime a player 3-putts (or worse), they take the snake. The snake passes to whoever 3-putts next. At the end of the round, the player holding the snake pays a set amount to every other player. Some groups play cumulative — each 3-putt costs money.',
    wagering:'Cumulative: $ per 3-putt event paid to every other player. Or flat: holder at end pays everyone. Common: $5 per snake.',
    hcpNote:'No handicap adjustment — 3-putts are gross putting events.',
    example:'4 players. You 3-putt twice = 2 snakes. You owe 2 × $5 × 3 opponents = $30 out.'},
  fidget:{icon:'😬',name:'Fidget',role:'side',
    desc:'If you never win a single hole outright during the round, you "fidget" and pay everyone.',
    players:'All players in foursome',
    rules:'Track whether each player wins at least one hole outright (lowest net score, no ties). Any player who finishes 18 holes without winning a single hole outright is a "fidget" and pays a penalty to every other player.',
    wagering:'Flat $ paid to each player if you fidget. Common: $10 per person.',
    hcpNote:'Low-man method: subtract the lowest handicap in the foursome.',
    example:'4 players. You never have the outright lowest net on any hole. You fidget: pay $10 × 3 = $30.'},
  match1v1:{icon:'⚔️',name:'1v1 Side Match',role:'side',
    desc:'Head-to-head closeout match between any two players, running alongside the main game.',
    players:'Any 2 players',
    rules:'Same as match play — lower net score wins each hole. Match ends when one player is up by more holes than remain (closeout). Runs independently of the main game.',
    wagering:'Flat $ to the winner (closeout format). Common: $10-$20.',
    hcpNote:'Low-man method between the two players (difference in handicaps).',
    example:'You\'re 2 up with 1 to play — you win 2&1, collect $20.'},
  bbn:{icon:'🏅',name:'Best Ball Net (Foursome)',role:'side',
    desc:'Track best ball(s) across the entire foursome — not teams. Count 1 or 2 best net/gross scores per hole.',
    players:'All players in foursome',
    rules:'Each hole: take the best 1 (or 2) net or gross scores from all 4 players. Track the foursome total. Compare against par or use for bragging rights. Multiple trackers can run simultaneously (e.g., 1 BB net + 1 BB gross).',
    wagering:'Usually bragging rights or comparison across foursomes. Can set $ per under/over par.',
    hcpNote:'Net uses full course handicap (GHIN → slope/rating). Gross uses raw scores.',
    example:'1 BB Net: four players make net 3, 4, 4, 5 on a par 4. Best ball = 3 (1 under). Track running total vs par.'},
};

/**
 * Get course by name
 * @param {string} courseName - Name of the course
 * @returns {object} Course object or null
 */
export function getCourse(courseName) {
  return COURSES[courseName] || null;
}

/**
 * Get list of all course names
 * @returns {string[]} Array of course names
 */
export function getCourseNames() {
  return Object.keys(COURSES);
}

/**
 * Get tee options for a course
 * @param {string} courseName - Course name
 * @returns {string[]} Array of available tees
 */
export function getTeesForCourse(courseName) {
  const course = COURSES[courseName];
  if (!course || !course.teesData) return [];
  return Object.keys(course.teesData);
}
