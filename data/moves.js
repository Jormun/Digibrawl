exports.BattleMovedex = {
	/**
	 * First we list the DS-free cost moves that are static for all stages.
	 */
	// Fresh, In-Training
	bubbles: {
		name: "Bubbles",
		basePower: 1,
		desc: "The Digimon throws Bubbles to the enemy which deal puny damage.",
		shortDesc: "Deals damage.",
		ds: 0,
		cd: 0,
		priority: 0,
		secondary: false,
		target: "ranged",
		type: "Neutral"
	},
	// Rookie
	attackrookie: {
		name: "Attack (Rookie)",
		basePower: 10,
		desc: "The Digimon attacks the enemy with its melee power.",
		shortDesc: "Deals damage.",
		ds: 0,
		cd: 0,
		priority: 0,
		secondary: false,
		target: "melee",
		type: "Neutral"
	},
	// Champion
	attackchampion: {
		name: "Attack (Champion)",
		basePower: 10,
		desc: "The Digimon attacks the enemy with its melee power.",
		shortDesc: "Deals damage.",
		ds: 0,
		cd: 0,
		priority: 0,
		secondary: false,
		target: "melee",
		type: "Neutral"
	},
	// Ultimate
	attackultimate: {
		name: "Attack (Ultimate)",
		basePower: 10,
		desc: "The Digimon attacks the enemy with its melee power.",
		shortDesc: "Deals damage.",
		ds: 0,
		cd: 0,
		priority: 0,
		secondary: false,
		target: "melee",
		type: "Neutral"
	},
	// Mega
	attackmega: {
		name: "Attack (Mega)",
		basePower: 10,
		desc: "The Digimon attacks the enemy with its melee power.",
		shortDesc: "Deals damage.",
		ds: 0,
		cd: 0,
		priority: 0,
		secondary: false,
		target: "melee",
		type: "Neutral"
	},
	// Burst
	burstattack: {
		name: "Burst Attack",
		basePower: 10,
		desc: "The Digimon attacks the enemy with its burst melee power.",
		shortDesc: "Deals damage.",
		ds: 0,
		cd: 0,
		priority: 0,
		secondary: false,
		target: "melee",
		type: "Neutral"
	},
	// Jogress
	doubleattack: {
		name: "Double Attack",
		basePower: 10,
		desc: "The Digimon attacks the enemy with its melee power.",
		shortDesc: "Deals damage.",
		ds: 0,
		cd: 0,
		priority: 0,
		secondary: false,
		target: "melee",
		type: "Neutral"
	},
	/**
	 * Regular moves. Let's have fun putting them all!
	 */
	 angelrod: {
		name: "Angel Rod",
		basePower: 140,
		desc: "The Digimon uses the holy rod to attack the enemy.",
		shortDesc: "Deals damage.",
		ds: 19,
		cd: 1,
		priority: 0,
		secondary: false,
		target: "melee",
		type: "Light"
	},
	babyclaw: {
		name: "Baby Claw",
		basePower: 120,
		desc: "Agumon attacks with its claws.",
		shortDesc: "Claws the enemy.",
		ds: 14,
		cd: 1,
		priority: 0,
		secondary: false,
		target: "melee",
		type: "Neutral"
	},
	babyflame: {
		name: "Baby Flame",
		basePower: 100,
		desc: "Agumon shoots fireballs to the enemy.",
		shortDesc: "Shoots fireballs.",
		ds: 12,
		cd: 1,
		priority: 0,
		secondary: false,
		target: "ranged",
		type: "Fire"
	},
	hakasebo: {
		desc: "Tries to persuade the opponent with its rod."
	},
	hakasebou: {
		desc: "Agumon tries to enchant itself into cleverness with its hat."
	},
	handoffate: {
		name: "Hand Of Fate",
		basePower: 494,
		desc: "The Digimon attacks the enemy with a shiny gold fist.",
		shortDesc: "Deals damage.",
		ds: 81,
		cd: 2,
		priority: 0,
		secondary: false,
		target: "melee",
		type: "Light"
	},
	heavenscharm: {
		name: "Heaven's Charm",
		basePower: 780,
		desc: "The Digimon fires a concentrated bolt of light to attack the enemy",
		shortDesc: "Deals damage.",
		ds: 90,
		cd: 2,
		priority: 0,
		secondary: false,
		target: "ranged",
		type: "Light"
	},
	holyarrow: {
		name: "Holy Arrow",
		basePower: 1150,
		desc: "The Digimon shoots an arrow of light to attack the enemy",
		shortDesc: "Deals damage.",
		ds: 117,
		cd: 3,
		priority: 0,
		secondary: false,
		target: "ranged",
		type: "Light"
	},
	omnityphoon: {
		name: "Omni Typhoon",
		basePower: 910,
		desc: "The Digimon creates a whirlpool by turning and attacks",
		shortDesc: "Deals damage.",
		ds: 187,
		cd: 3,
		priority: 0,
		secondary: false,
		target: "melee",
		type: "Wind"
	},
	sharpclaw: {

	},
	sharperclaw: {

	},
	spitfireblast: {
	 	name: "Spitfire Blast",
		basePower: 275,
		desc: "Agumon shoots flames to his enemies, burning and hurting them.",
		shortDesc: "Shoots flame from Agumon's mouth.",
		ds: 19,
		cd: 3,
		priority: 0,
		secondary: false,
		target: "ranged",
		type: "Fire"
	}
};
