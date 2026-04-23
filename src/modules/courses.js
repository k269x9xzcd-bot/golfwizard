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
    // Green center coordinates (surveyed) — used for GPS distance-to-hole
    greenCoords:[
      {lat:40.9575717,lng:-73.7667778}, // H1
      {lat:40.9574444,lng:-73.7632222}, // H2
      {lat:40.9562222,lng:-73.7627000}, // H3
      {lat:40.9535556,lng:-73.7627000}, // H4
      {lat:40.9541111,lng:-73.7632500}, // H5
      {lat:40.9573056,lng:-73.7645056}, // H6
      {lat:40.9552222,lng:-73.7640833}, // H7
      {lat:40.9574167,lng:-73.7660278}, // H8
      {lat:40.9551111,lng:-73.7706167}, // H9
      {lat:40.9533611,lng:-73.7684000}, // H10
      {lat:40.9563611,lng:-73.7660833}, // H11
      {lat:40.9531111,lng:-73.7676667}, // H12
      {lat:40.9498333,lng:-73.7665833}, // H13
      {lat:40.9516667,lng:-73.7645667}, // H14
      {lat:40.9522222,lng:-73.7632222}, // H15
      {lat:40.9491667,lng:-73.7664444}, // H16
      {lat:40.9530000,lng:-73.7688611}, // H17
      {lat:40.9543889,lng:-73.7701083}, // H18
    ],
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
    example:'Team A has net 4, net 5 on a par 5. Team B has net 5, net 6. Team A\'s best ball is 4, Team B\'s is 5. Team A wins the hole.',
    sideBets:'Aloha: on hole 18, the losing team can call "Aloha" to double the overall bet for that hole only. The winning team must accept or concede the overall at current value. Only available to the team that is currently losing the overall. Tap the Aloha button on hole 18 to invoke it.'},
  match:{icon:'⚔️',name:'Match Play',role:'main',
    desc:'Head-to-head by hole. Lower net score wins the hole = 1 up. Match ends when lead exceeds remaining holes.',
    players:'1v1 or 2v2',
    rules:'Each hole: lower net score wins (+1 to their count). Equal net = halved. Status shows "X up with Y to play." Match is won when a player/team is up by more holes than remain (e.g., 3&2 = 3 up with 2 to play). If tied after 18, result is "All Square." Dormie: when a player is up by the same number of holes remaining (e.g., 3 up with 3 to play) — they cannot lose, only win or halve.',
    wagering:'Flat $ per match (closeout). Optional closeout bonus: extra $ paid by loser if match ends early. Common: $20/match.',
    hcpNote:'Low-man method: subtract the lowest handicap in the group. 1v1 uses difference between the two players.',
    example:'Player A is 3 up with 2 to play — match is over, Player A wins 3&2. With $5 closeout bonus, loser pays $25 total.'},
  vegas:{icon:'🎰',name:'Vegas',role:'main',
    desc:'Teams of 2. Both scores combine into a 2-digit number. Lower number wins, difference = points.',
    players:'2v2 teams',
    rules:'Each hole: sort scores low-high per team, combine into 2-digit number (e.g., 3+5=35). Lower number wins. Diff = pts. Birdie flip: your team birdies, opponent number flips (35→53). Eagle flip: flips + doubles diff. Double birdie: both teammates birdie, diff doubled. Penalty flip: score >= threshold (default 7) flips your own number.',
    wagering:'$ per point difference. Cumulative over 18 holes. Common: $1/pt.',
    hcpNote:'Net or Gross toggle. Net uses low-man method. Gross plays without strokes.',
    example:'Team A: 4+5=45. Team B: 3+6=36. Team B wins 9 pts. Team B birdies: A flips to 54. Now B wins 54-36=18 pts.'},
  skins:{icon:'🏆',name:'Skins',role:'main',
    desc:'Every hole is worth a "skin." Lowest net score wins the skin outright. Ties carry the skin to the next hole.',
    players:'3-4 individual',
    rules:'Each hole: player with the lowest net score wins the skin. If two or more players tie for the best score, no skin is awarded and it carries to the next hole (if carry is on). Carried skins accumulate until someone wins outright.',
    wagering:'$ per skin. If 5 skins carry, the next outright winner takes all 5. Common: $5/skin.',
    hcpNote:'Low-man method: subtract the lowest handicap in the foursome from everyone.',
    example:'Hole 7: three players tie at net 3. Skin carries. Hole 8: one player makes net 2. They win 2 skins ($10).'},
  hilow:{icon:'📊',name:'Hi-Low',role:'main',
    desc:'2v2 team game. Each hole has two or three points: low ball, high ball, and optional aggregate.',
    players:'2v2 teams',
    rules:'Each hole: compare the best net score from each team (low ball) — lower wins a point. Compare the worst net score (high ball) — lower wins a point. Optional 3rd aggregate point: combine both scores per team, lower total wins. Ties carry to next hole. Birdie double toggle: if the winning low ball is a birdie or better, the low ball point doubles.',
    wagering:'$ per point difference at the end. Common: $5/pt.',
    hcpNote:'Low-man method: subtract the lowest handicap in the foursome.',
    example:'Team A: net 3+5. Team B: net 4+4. Low: A wins. High: B wins. Agg: tie (8 vs 8). With birdie double on, if A nets birdie the low pt is worth 2.'},
  stableford:{icon:'⭐',name:'Stableford',role:'main',
    desc:'Points-based scoring against par. Rewards birdies, limits damage on blow-up holes.',
    players:'Individual (all players)',
    rules:'Standard pts: Eagle +4, Birdie +3, Par +2, Bogey +1, Double+ 0. Modified variant: fully custom pts per score type set in wizard. Pick up after double bogey — no penalty. Highest total wins. Settle $ per point difference pairwise.',
    wagering:'$ per point difference. Common: $1/pt.',
    hcpNote:'Full course handicap. Each player gets their full stroke allotment.',
    example:'Par 4, net birdie = +3 pts. Par 5, net double = 0 pts. After 18, highest total collects ppt × diff from each player.'},
  wolf:{icon:'🐺',name:'Wolf',role:'main',
    desc:'Rotating Wolf picks a partner hole-by-hole, or goes Lone/Blind Wolf for higher stakes.',
    players:'4 players',
    rules:'Set tee order before the round. Wolf can tee FIRST (watches others, picks after each shot) or LAST (must decide as each opponent hits). Rotation 1-2-3-4, 2-3-4-1, etc. Wolf picks nobody: Lone Wolf (default 4x stakes, 1 vs 3). Blind Wolf: declare before anyone tees, default 8x stakes. Best ball per side wins the hole. Lone/Blind multipliers are configurable.',
    wagering:'$ per point. Lone 4x default, Blind 8x default. Common: $5/pt.',
    hcpNote:'Low-man method: subtract the lowest handicap in the foursome.',
    example:"You're Wolf, tee first. Player B birdies, you pick them. Your best ball (net 3) vs others (net 4) — you win. Blind Wolf and win: collect 8x from each opponent."},
  hammer:{icon:'🔨',name:'Hammer',role:'main',
    desc:'2v2 where either team can throw the hammer to double the stakes. Opponent must accept or concede. Variants: Air Hammer (throw before tee shot), F-U Hammer (counter-hammer + retain), Birdie Double (auto-double if winner birdied), Carryover (tie carries value to next hole).',
    players:'2v2 teams',
    rules:'Each hole starts at the base bet. Either team can throw the hammer to double the current value. Opponent accepts (bet doubles) or concedes at current value. Multiple hammers per hole allowed. F-U Hammer: opponent can counter-hammer and retains the hammer. Birdie Double: if the winning team has a birdie, hole value auto-doubles. Carryover: tied holes carry their value to the next hole.',
    wagering:'$ per hole (starting value). Doubles with each hammer throw.',
    hcpNote:'Low-man method: subtract the lowest handicap in the foursome.',
    notation:'Per-hole: value + throw count (e.g. $4 x2🔨). Conceded holes show team that conceded.',
    example:'Hole starts at $1. Team A hammers → $2. Team B accepts and counter-hammers (F-U) → $4, Team B retains hammer. Team A concedes — Team B wins $2 (pre-last-throw value).'},
  sixes:{icon:'🎲',name:'Sixes',role:'main',
    desc:'Teams rotate every 6 holes. Two scoring models: segment match or per-hole points.',
    players:'4 players (rotating 2v2)',
    rules:'Holes 1-6: A+B vs C+D. Holes 7-12: A+C vs B+D. Holes 13-18: A+D vs B+C. Best ball per team each hole. Segment match (default): win most holes in segment = 6pts, tie = 3/3, lose = 0. Per-hole model: win=4pts, loss=2pts, tie=3/3. Settle pairwise after 18.',
    wagering:'$ per point. Common: $1/pt.',
    hcpNote:'Low-man method: subtract lowest handicap in foursome.',
    example:'Segment match: your team wins 4 of 6 holes — your pair earns 6pts for that segment. Per-hole: 4 wins=16pts + 2 losses=4pts = 20pts for your pair in the segment.'},
  nines:{icon:'9️⃣',name:'9s',role:'main',
    desc:'3-player game. Every hole: 5pts to best net, 3 to second, 1 to third. Ties split. Settle pairwise.',
    players:'3 players only',
    rules:'3 players only. Each hole: best net = 5pts, second = 3pts, third = 1pt (loser gets 0 implicitly — no 5-3-1-0 language). Ties split the combined pts for tied positions. Birdie double variant: birdie on hole doubles that player pts (5->10, 3->6, 1->2). Settle pairwise after 18.',
    wagering:'$ per point difference, pairwise. Common: $1/pt. Example: A=42pts, B=38pts, C=20pts. A collects $4 from B and $22 from C; B collects $18 from C.',
    hcpNote:'Low-man method: subtract the lowest handicap in the group from everyone. Strokes applied by stroke index.',
    example:'Hole 5: net scores 3,4,6. 3=5pts, 4=3pts, 6=1pt. Birdie double: if the 3 is a net birdie that player gets 10pts.',
    variations:'Sweep bonus: sole winner beats 2nd by >=2 net strokes, takes all 9pts. Birdie bonus: solo net birdie = +1 extra pt. Birdie double: birdie doubles pts that hole. All opt-in, agree before teeing off.',
    variationConfig: {
      sweepBonus: { type: 'boolean', default: false, label: 'Sweep bonus', desc: 'Win by 2+ net strokes -> take all 9 pts' },
      sweepMargin: { type: 'number', default: 2, label: 'Sweep margin (strokes)', min: 1, max: 5, dependsOn: 'sweepBonus' },
      birdieBonus: { type: 'boolean', default: false, label: 'Birdie bonus', desc: 'Solo net birdie = +1 extra pt' },
      birdieBonusPts: { type: 'number', default: 1, label: 'Birdie bonus pts', min: 1, max: 3, dependsOn: 'birdieBonus' },
      birdieDouble: { type: 'boolean', default: false, label: 'Birdie double', desc: 'Net birdie doubles pts that hole (5->10, 3->6, 1->2)' },
    }},
  bestball:{icon:'🏅',name:'Best Ball (Team)',role:'main',
    desc:'2v2 team game. Each hole: best ball from each team compared. Lower wins the hole.',
    players:'2v2 teams',
    rules:'Each hole: each team takes the best (lowest) net score among their two players. Compare the two team best-balls. Lower score wins the hole. Ties are halved. Track cumulative holes won.',
    wagering:'$ per hole won or $ per match. Common: $5/hole.',
    hcpNote:'Low-man method: subtract the lowest handicap in the foursome.',
    example:'Team A: net 3, net 5 → best ball 3. Team B: net 4, net 4 → best ball 4. Team A wins the hole.'},

  // ── SIDE GAMES ──
  dots:{icon:'🎯',name:'Dots / Junk',role:'side',
    desc:'Bonus bets for special achievements: birdies, greenies, sandies, and optional junk (Barkie, Arnie, Ferret, negative). Big Three on by default: Birdie (auto), Greenie (manual, par 3), Sandy (manual).',
    players:'All players',
    rules:'Each event earns a dot. Big Three: Birdie (net or gross, auto), Greenie (closest on par 3 + make par, manual), Sandy (up-and-down from bunker, manual). Eagle = 2 dots. Optional: Barkie (hit tree + make par), Arnie (miss fairway + make par), Ferret (hole out from off green), Negative (water/OB costs a dot). Net vs gross birdie is configurable. A Junk Sheet slides up after each hole to mark manual dots. At end, each player pays dot differential to every other player.',
    wagering:'$ per dot. Pairwise settlement at end of round. Common: $2/dot.',
    hcpNote:'Net birdie toggle: on = handicap strokes applied (default). Off = gross score used for birdies/eagles.',
    notation:'Per-hole dots shown in corner of score cell for each player.',
    example:'You get a net birdie (1 dot) + sandy (1 dot) = 2 dots. Buddy gets a greenie (1 dot). You win 1 dot net × $2 = $2 from him.'},
  snake:{icon:'🐍',name:'Snake',role:'side',
    desc:'Three-putt tracker. Whoever 3-putts last is "holding the snake" and pays everyone at the end.',
    players:'All players',
    rules:'Anytime a player 3-putts (or worse), they take the snake. Snake passes to whoever 3-putts next. At end of round, holder pays every other player. Cumulative model: each 3-putt event costs money. Scorecard notation: snake icon on hole cell when player 3-putts. Live standings show current holder.',
    wagering:'Cumulative: $ per 3-putt event paid to every other player. Or flat: holder at end pays everyone. Common: $5 per snake.',
    hcpNote:'No handicap adjustment — 3-putts are gross putting events.',
    example:'4 players. You 3-putt twice = 2 snakes. You owe 2 × $5 × 3 opponents = $30 out.'},
  fidget:{icon:'😬',name:'Fidget',role:'side',
    desc:'If you never win a single hole outright during the round, you "fidget" and pay everyone.',
    players:'All players in foursome',
    rules:'Track whether each player wins at least one hole outright (lowest net score, no ties). Any player who finishes 18 holes without an outright hole win is a fidget and pays every other player. Live warning shows when a player is at risk. Scorecard notation: star on holes where a player wins outright.',
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
  bbb:{icon:'🏌️',name:'BBB (Bingo Bango Bongo)',role:'side',
    desc:'Three points per hole: BINGO (first on green), BANGO (closest to pin once all on green), BONGO (first in hole). Gross game — handicap does not apply.',
    players:'All players',
    rules:'Each hole offers 3 pts. BINGO: first player to reach the green. BANGO: player closest to the pin once all players are on the green. BONGO: first player to hole out. A player can win all 3 (sweep). Double Bongo variant: if BONGO winner birdied, they earn 2 pts instead of 1. Pairwise settlement at end of round.',
    wagering:'$ per point. Pairwise settlement. Common: $1-2/pt.',
    hcpNote:'Inherently gross — no strokes applied. Levels the field through the unique scoring structure.',
    notation:'B1=Bingo, B2=Bango, B3=Bongo icons shown in hole cells on scorecard.',
    example:'Hole 5: Player A reaches green first (BINGO). Player C closest to pin (BANGO). Player B holes out first (BONGO). A:1pt, B:1pt, C:1pt.'},
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
