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
	babyclaw: {
		name: "Baby Claw",
		basePower: 120,
		desc: "Agumon attacks with its claws.",
		shortDesc: "Claws the enemy.",
		ds: 14,
		cd: 2,
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
		cd: 2,
		priority: 0,
		secondary: false,
		target: "ranged",
		type: "Fire"
	},
	hakasebo: {

	},
	hakasebou: {

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
		cd: 4,
		priority: 0,
		secondary: false,
		target: "ranged",
		type: "Fire"
	},
};
