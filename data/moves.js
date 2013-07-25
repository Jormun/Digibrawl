exports.BattleMoves = {
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
	atomicblaster: {
		name: "Atomic Blaster",
		basePower: 1234,
		desc: "Fires a powerful charge from its chest.",
		shortDesc: "Fires a powerful charge.",
		ds: 152,
		cd: 3,
		priority: 0,
		secondary: false,
		target: "ranged",
		type: "Fire"
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
	crimsonlight: {
		name: "Crimson Light",
		basePower: 3306,
		desc: "Blinds enemy opponent with a holy light also inflicting damage.",
		shortDesc: "Blinds enemy opponent with a holy light.",
		ds: 3340,
		cd: 3,
		priority: 0,
		secondary: false,
		target: "ranged",
		type: "Light"
	},
	dashdoubleclaw: {
		name: "Dash Double Claw",
		basePower: 236,
		desc: "Pushes out ribbons to hit the opponent.",
		shortDesc: "Uses ribbons to hit the opponent.",
		ds: 25,
		cd: 1,
		priority: 0,
		secondary: false,
		target: "melee",
		type: "Wind"
	},
	doublebackhand: {
		name: "Double Back Hand",
		basePower: 128,
		desc: "Rolls body to attack.",
		shortDesc: "Rolls body to attack.",
		ds: 8,
		cd: 2,
		priority: 0,
		secondary: false,
		target: "melee",
		type: "Wind"
	},
	doublecrescentmirage: {
		name: "Double Crescent Mirage",
		basePower: 1057,
		desc: "Conjures two wind blades to attack the opponent.",
		shortDesc: "Makes two wind blades to strike opponent.",
		ds: 99,
		cd: 2,
		priority: 0,
		secondary: false,
		target: "ranged",
		type: "Wind"
	},
	doubleedge: {
		name: "Double Edge",
		basePower: 647,
		desc: "Strikes the opponent with both bladed arms causing tons of damage.",
		shortDesc: "Strikes opponent with bladed arms.",
		ds: 52,
		cd: 1,
		priority: 0,
		secondary: false,
		target: "melee",
		type: "Fire"
	},
	exhaustflame: {
		name: "Exhaust Flame",
		basePower: 795,
		desc: "Shoots a powerful fireball from the mouth.",
		shortDesc: "Fires a strong fireball.",
		ds: 126,
		cd: 2,
		priority: 0,
		secondary: false,
		target: "melee",
		type: "Fire"
	},
	finalelysian: {
		name: "Final Elysian",
		basePower: 2110,
		desc: "Eliminates evil with power waves of light from Aegis, the Holy Shield.",
		shortDesc: "Uses Aegis to eliminate evil.",
		ds: 187,
		cd: 3,
		priority: 0,
		secondary: false,
		target: "ranged",
		type: "Light"
	},
	fullmoonblaster: {
		name: "Full Moon Blaster",
		basePower: 1454,
		desc: "Concentrates moonlight energy and blasts the opponent with a strong force.",
		shortDesc: "Blasts opponent with moonlight energy.",
		ds: 260,
		cd: 3,
		priority: 0,
		secondary: false,
		target: "ranged",
		type: "Wind"
	},
	fullmoonmeteorimpact: {
		name: "Full Moon Meteor Impact",
		basePower: 1630,
		desc: "Slams opponent with a meteor rivaling the size of the moon.",
		shortDesc: "Slams opponent with giant meteor.",
		ds: 205,
		cd: 2,
		priority: 0,
		secondary: false,
		target: "melee",
		type: "Wind"
	},
	galeclaw: {
		name: "Gale Claw",
		basePower: 465,
		desc: "Strikes the opponent with the force of wind.",
		shortDesc: "Stikes with the wind.",
		ds: 61,
		cd: 1,
		priority: 0,
		secondary: false,
		target: "melee",
		type: "Wind"
	},
	gaorush: {
		name: "Gao Rush",
		basePower: 71,
		desc: "Repeatedly punches the opponent.",
		shortDesk: "Punches opponent repeatedly.",
		ds: 6,
		cd: 1,
		priority: 0,
		secondary: false,
		target: "melee",
		type: "Wind"
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
	howlingcannon: {
		name: "Howling Cannon",
		basePower: 754,
		desc: "Opens mouth and shoots beam at opponent.",
		shortDesc: "Shoots powerful beam at opponent.",
		ds: 114,
		cd: 2,
		priority: 0,
		secondary: false,
		target: "ranged",
		type: "Wind",
	},
	invinciblesword: {
		name: "Invincible Sword",
		basePower: 1745,
		desc: "Slashes enemy opponent with a sword blessed by the gods.",
		shortDesc: "Slashes enemy with holy sword.",
		ds: 245,
		cd: 1,
		priority: 0,
		secondary: false,
		target: "melee",
		type: "Light"
	},
	lunahookslasher: {
		name: "Luna Hook Slasher",
		basePower: 3298,
		desc: "Slashes opponent with a blade crafted from the moon itself.",
		shortDesc: "Slashes opponent with a moon blade.",
		ds: 450,
		cd: 3,
		priority: 0,
		secondary: false,
		target: "melee",
		type: "Wind"
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
	plasmablade: {
		name: "Plasma Blade",
		basePower: 290,
		desc: "Gathers energy in both arms to create lightning and strikes the enemy.",
		shortDesc: "Strikes the enemy with lightning created blades.",
		ds: 24,
		cd: 1,
		priority: 0,
		secondary: false,
		target: "melee",
		type: "Thunder"
	},
	pyrosphere: {
		name: "Pyro Sphere",
		basePower: 290,
		desc: "Shoots flame balls out of mouth.",
		shortDesc: "Shoots flame balls.",
		ds: 38,
		cd: 3,
		priority: 0,
		secondary: false,
		target: "ranged",
		type: "Fire"
	},
	rockbreaker: {
		name: "Rock Breaker",
		basePower: 200,
		desc: "Rushes into opponent to cause damage.",
		shortDesc: "Charges into opponent.",
		ds: 11,
		cd: 1,
		priority: 0,
		secondary: false,
		target: "melee",
		type: "Fire"
	},
	rollingupper: {
		name: "Rolling Upper",
		basePower: 238,
		desc: "Jumps, then rolls body to attack.",
		shortDesc: "Jumps and rolls body to attack.",
		ds: 23,
		cd: 3,
		priority: 0,
		secondary: false,
		target: "melee",
		type: "Wind"
	},
	royalsaber: {
		name: "Royal Saber",
		basePower: 932,
		desc: "Slashes opponent with the holy weapon Graam.",
		shortDesc: "Slashes opponent with a holy weapon.",
		ds: 83,
		cd: 2,
		priority: 0,
		secondary: false,
		target: "melee",
		type: "Light"
	},
	sharpclaw: {

	},
	sharperclaw: {

	},
	spiralblow: {
		name: "Spiral Blow",
		basePower: 397,
		desc: "Shoots tornado out of mouth.",
		shortDesc: "Shoots tornado out of mouth.",
		ds: 43,
		cd: 2,
		priority: 0,
		secondary: false,
		target: "ranged",
		type: "Wind"
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
	},
	winningknuckle: {
		name: "Winning Knuckle",
		basePower: 258,
		desc: "Quickly gets close to the opponent and lands powerful punches.",
		shortDesc: "Closes distance and lands strong punches.",
		ds: 28,
		cd: 1,
		priority: 0,
		secondary: false,
		target: "melee",
		type: "Wind"
	}
};
