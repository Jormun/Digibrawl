exports.BattleFormats = {
	randombattle: {
		name: "Random Battle",
		effectType: 'Format',
		team: 'random',
		canUseRandomTeam: true,
		searchDefault: true,
		rated: true,
		challengeShow: true,
		searchShow: true,
		ruleset: ['Digimon', 'Species Clause'],
		banlist: ['Illegal']
	},
	mega: {
		name: "Mega",
		effectType: 'Format',
		searchDefault: true,
		rated: true,
		challengeShow: true,
		searchShow: true,
		ruleset: ['Digimon', 'Species Clause'],
		banlist: ['Illegal', 'Jogress', 'Burst']
	},
	jogress: {
		name: "Jogress",
		effectType: 'Format',
		searchDefault: true,
		rated: true,
		challengeShow: true,
		searchShow: true,
		ruleset: ['Digimon', 'Species Clause'],
		banlist: ['Illegal']
	},
	burst: {
		name: "Burst",
		effectType: 'Format',
		searchDefault: true,
		rated: true,
		challengeShow: true,
		searchShow: true,
		ruleset: ['Digimon', 'Species Clause'],
		banlist: ['Illegal', 'Jogress']
	},
	ultimate: {
		name: "Ultimate",
		effectType: 'Format',
		searchDefault: true,
		rated: true,
		challengeShow: true,
		searchShow: true,
		ruleset: ['Digimon', 'Species Clause'],
		banlist: ['Illegal', 'Jogress', 'Burst', 'Mega']
	},
	champion: {
		name: "Champion",
		effectType: 'Format',
		searchDefault: true,
		rated: true,
		challengeShow: true,
		searchShow: true,
		ruleset: ['Digimon', 'Species Clause'],
		banlist: ['Illegal', 'Jogress', 'Burst', 'Mega', 'Ultimate']
	},
	rookie: {
		name: "Rookie",
		effectType: 'Format',
		searchDefault: true,
		rated: true,
		challengeShow: true,
		searchShow: true,
		ruleset: ['Digimon', 'Species Clause'],
		banlist: ['Illegal', 'Jogress', 'Burst', 'Mega', 'Ultimate', 'Champion']
	},
	intraining: {
		name: "In-Training",
		effectType: 'Format',
		searchDefault: true,
		rated: true,
		challengeShow: true,
		searchShow: true,
		ruleset: ['Digimon', 'Species Clause'],
		banlist: ['Illegal', 'Jogress', 'Burst', 'Mega', 'Ultimate', 'Champion', 'Rookie']
	},
	fresh: {
		name: "Fresh",
		effectType: 'Format',
		searchDefault: true,
		rated: true,
		challengeShow: true,
		searchShow: true,
		ruleset: ['Digimon', 'Species Clause'],
		banlist: ['Illegal', 'Jogress', 'Burst', 'Mega', 'Ultimate', 'Champion', 'Rookie', 'In-Training']
	},
	banless: {
		name: "Banless",
		effectType: 'Format',
		searchDefault: true,
		rated: true,
		challengeShow: true,
		searchShow: true,
		ruleset: ['Digimon'],
		banlist: ['Illegal']
	},

	//////////////
	// Rulesets //
	//////////////
	digimon: {
		effectType: 'Banlist',
		validateSet: function(set, format) {
			var item = this.getItem(set.item);
			var template = this.getTemplate(set.species);
			var problems = [];

			if (set.species === set.name) delete set.name;
			if (template.isNonstandard) {
				problems.push(set.species+' is not a real Digimon.');
			}
			if (set.moves) for (var i=0; i<set.moves.length; i++) {
				var move = this.getMove(set.moves[i]);
				if (move.isNonstandard) {
					problems.push(move.name+' is not a real move.');
				}
			}
			if (item) {
				if (item.isNonstandard) {
					problems.push(item.name + ' is not a real item.');
				}
			}
			if (set.level && set.level > 100) {
				problems.push((set.name||set.species) + ' is higher than level 100.');
			}

			// Limit one of each move
			var moves = [];
			if (set.moves) {
				var hasMove = {};
				for (var i=0; i<set.moves.length; i++) {
					var move = this.getMove(set.moves[i]);
					var moveid = move.id;
					if (hasMove[moveid]) continue;
					hasMove[moveid] = true;
					moves.push(set.moves[i]);
				}
			}
			set.moves = moves;

			return problems;
		}
	},
	teampreview: {
		onStartPriority: -10,
		onStart: function() {
			this.add('clearpoke');
			for (var i=0; i<this.sides[0].pokemon.length; i++) {
				this.add('poke', this.sides[0].pokemon[i].side.id, this.sides[0].pokemon[i].details.replace(/Arceus(\-[a-zA-Z\?]+)?/, 'Arceus-*'));
			}
			for (var i=0; i<this.sides[1].pokemon.length; i++) {
				this.add('poke', this.sides[1].pokemon[i].side.id, this.sides[1].pokemon[i].details.replace(/Arceus(\-[a-zA-Z\?]+)?/, 'Arceus-*'));
			}
		},
		onTeamPreview: function() {
			this.makeRequest('teampreview');
		}
	},
	speciesclause: {
		effectType: 'Rule',
		onStart: function() {
			this.add('rule', 'Species Clause: Limit one of each Digimon');
		},
		validateTeam: function(team, format) {
			var speciesTable = {};
			for (var i=0; i<team.length; i++) {
				var template = this.getTemplate(team[i].species);
				if (speciesTable[template.num]) {
					return ["You are limited to one of each digimon by Species Clause.","(You have more than one "+template.name+")"];
				}
				speciesTable[template.num] = true;
			}
		}
	}
};
