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
    par:[4,4,3,4,3,4,4,4,5,3,4,4,4,4,3,5,5,4],
    si:[6,12,16,10,18,2,14,4,8,13,3,11,1,9,17,7,5,15],
    tees:'White',
    teesData:{
      'Black':{rating:72.5,slope:133,yards:6650,yardsByHole:[380,405,170,400,160,435,365,390,530,195,415,375,435,410,175,525,500,390]},
      'White':{rating:70.0,slope:128,yards:6250,yardsByHole:[355,380,155,375,145,410,340,365,505,175,390,350,410,385,155,500,475,365]},
      'Red':{rating:66.5,slope:120,yards:5600,yardsByHole:[310,335,130,330,120,360,295,320,455,150,345,305,360,340,130,450,425,320]},
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
  nassau:{icon:'💰',name:'Nassau',role:'main',desc:'Three separate bets: Front 9, Back 9, and Overall 18. Best ball per team each hole (lower net wins). Auto-press when a team is down a set number of holes — each press creates a new bet for the remaining holes in that side. Settlement: each segment (front/back/overall) pays independently, presses stack.',players:'2v2 teams',rules:'Each hole: compare best net score from each team. Lower net wins the hole (+1). Equal = halved. Track running score per side (front/back) and overall. When one team is down by the press threshold, a new bet automatically starts from the next hole.',wagering:'Set $ for front, back, and overall separately. Press doubles the action on that side. Common: $10/$10/$20 with auto-press at 2 down.',hcpNote:'USGA recommends 90% handicap for best-ball formats.'},
  match:{icon:'⚔️',name:'Match Play',role:'main',desc:'Head-to-head by hole. Lower net score wins the hole = 1 up. Tied hole = halved. Match ends when lead exceeds remaining holes. Works 1v1 or 2v2 (best ball).',players:'1v1 or 2v2',rules:'Each hole: lower net score wins (+1 to their count). Equal net = halved. The match status shows "X up with Y to play." Match is won when a player/team is up by more holes than remain (e.g., 3&2 = 3 up with 2 to play). If tied after 18, result is "All Square."',wagering:'Flat $ per match. Common: $20/match.',hcpNote:'1v1: strokes given based on difference between handicaps. 2v2: each player gets full course handicap.'},
  vegas:{icon:'🎰',name:'Vegas',role:'main',desc:'Teams of 2. Both net scores combine into a 2-digit number (lower score first). Lower team number wins, difference = points. Birdie flip: if a team makes net birdie, opponent number reverses. Score 7+ on a hole moves that score to the back digit.',players:'2v2 teams',rules:'Each hole: sort each team\'s two net scores low-high, combine into 2-digit number (e.g., 3 and 5 = 35). Lower number wins. Difference = points that hole. Birdie flip: if your team makes a net birdie, opponent\'s number gets reversed (e.g., 35 becomes 53). Any individual net score of 7+ automatically goes to the back position.',wagering:'$ per point difference. Cumulative over 18 holes. Common: $1/pt.',hcpNote:'Full handicap recommended.'}
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
