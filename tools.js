/**
 * Tools
 * Digibrawl - http://www.digibrawl.com/
 *
 * Handles getting data about digimon, cards, etc.
 *
 * This file is used by the main process (to validate teams)
 * as well as the individual simulator processes (to get
 * information about digimon, cards, etc to simulate).
 *
 * @license MIT license
 */

module.exports = (function () {
	var dataTypes = ['FormatsData', 'Learnsets', 'Digivice', 'Digimoves', 'TypeChart', 'Scripts', 'Items', 'Formats'];
	var dataFiles = {
		'Digivice': 'digivice.js',
		'Digimoves': 'moves.js',
		'TypeChart': 'typechart.js',
		'Scripts': 'scripts.js',
		'Items': 'items.js',
		'Formats': 'formats.js',
		'FormatsData': 'formats-data.js',
		'Learnsets': 'learnsets.js'
	};
	function Tools() {
		this.data = {};

		dataTypes.forEach(function(dataType) {
			try {
				var path = './data/' + dataFiles[dataType];
				if (fs.existsSync(path)) this.data[dataType] = require(path)['Battle' + dataType];
			} catch (e) {
				console.log(e.stack);
			}
			if (!this.data[dataType]) this.data[dataType] = {};
		}, this);
		try {
			var path = './config/formats.js';
			if (fs.existsSync(path)) {
				var configFormats = require(path).Formats;
				for (var i=0; i<configFormats.length; i++) {
					var id = toId(configFormats[i].name);
					configFormats[i].effectType = 'Format';
					this.data.Formats[id] = configFormats[i];
				}
			}
		} catch (e) {
			console.log(e.stack);
		}
	}

	var moddedTools = {};
	Tools.prototype.mod = function(mod) {
		if (!moddedTools[mod]) {
			mod = this.getFormat(mod).mod;
		}
		if (!mod) mod = 'base';
		return moddedTools[mod];
	};
	Tools.prototype.modData = function(dataType, id) {
		return this.data[dataType][id];
	};
	Tools.prototype.effectToString = function() {
		return this.name;
	};
	Tools.prototype.getElementalEffectiveness = function(type, target) {
		var totalTypeMod = 0;
		if (!this.data.TypeChart.elements[target.element]) continue;
		var totalTypeMod = this.data.TypeChart.elements[target.element].damageTaken[type];
		return totalTypeMod;
	};
	Tools.prototype.getAttributeEffectiveness = function(type, target) {
		var totalAttrMod = 0;
		if (!this.data.TypeChart.attributes[target.attribute]) continue;
		var totalAttrMod = this.data.TypeChart.attributes[target.attribute].damageTaken[type];
		return totalAttrMod;
	};
	Tools.prototype.getTemplate = function(template) {
		if (!template || typeof template === 'string') {
			var name = (template||'').trim();
			var id = toId(name);
			if (this.data.Aliases[id]) {
				name = this.data.Aliases[id];
				id = toId(name);
			}
			template = {};
			if (id && this.data.Digivice[id]) {
				template = this.data.Digivice[id];
				if (template.cached) return template;
				template.cached = true;
				template.exists = true;
			}
			name = template.name || template.name || name;
			if (this.data.FormatsData[id]) {
				Object.merge(template, this.data.FormatsData[id]);
			}
			if (this.data.Learnsets[id]) {
				Object.merge(template, this.data.Learnsets[id]);
			}
			if (!template.id) template.id = id;
			if (!template.name) template.name = name;
			if (!template.forme) template.forme = '';
			if (!template.spriteid) template.spriteid = toId(template.baseSpecies)+(template.baseSpecies!==name?'-'+toId(template.forme):'');
			if (!template.prevos) template.prevos = [];
			if (!template.evos) template.evos = [];
			if (!template.nfe) template.nfe = !!template.evos.length;
			if (!template.tier) template.tier = 'Illegal';
		}
		return template;
	};
	Tools.prototype.getMove = function(move) {
		if (!move || typeof move === 'string') {
			var name = (move||'').trim();
			var id = toId(name);
			move = {};
			if (id && this.data.Moves[id]) {
				move = this.data.Moves[id];
				if (move.cached) return move;
				move.cached = true;
				move.exists = true;
			}
			if (!move.id) move.id = id;
			if (!move.name) move.name = name;
			if (!move.fullname) move.fullname = 'move: '+move.name;
			move.toString = this.effectToString;
			if (!move.baseType) move.baseType = move.type;
			if (!move.effectType) move.effectType = 'Move';
			if (!move.secondaries && move.secondary) move.secondaries = [move.secondary];
			if (!move.priority) move.priority = 0;
		}
		return move;
	};
	/**
	 * Ensure we're working on a copy of a move (and make a copy if we aren't)
	 *
	 * Remember: "ensure" - by default, it won't make a copy of a copy:
	 *     moveCopy === Tools.getMoveCopy(moveCopy)
	 *
	 * If you really want to, use:
	 *     moveCopyCopy = Tools.getMoveCopy(moveCopy.id)
	 *
	 * @param  move    Move ID, move object, or movecopy object describing move to copy
	 * @return         movecopy object
	 */
	Tools.prototype.getMoveCopy = function(move) {
		if (move && move.isCopy) return move;
		move = this.getMove(move);
		var moveCopy = Object.clone(move, true);
		moveCopy.isCopy = true;
		return moveCopy;
	};
	Tools.prototype.getEffect = function(effect) {
		if (!effect || typeof effect === 'string') {
			var name = (effect||'').trim();
			var id = toId(name);
			effect = {};
			if (id && this.data.Moves[id] && this.data.Moves[id].effect) {
				effect = this.data.Moves[id].effect;
				effect.name = effect.name || this.data.Moves[id].name;
			} else if (id && this.data.Items[id] && this.data.Items[id].effect) {
				effect = this.data.Items[id].effect;
				effect.name = effect.name || this.data.Items[id].name;
			} else if (id && this.data.Formats[id]) {
				effect = this.data.Formats[id];
				effect.name = effect.name || this.data.Formats[id].name;
				if (!effect.mod) effect.mod = 'base';
				if (!effect.effectType) effect.effectType = 'Format';
			} else if (id === 'recoil') {
				effect = {
					effectType: 'Recoil'
				};
			} else if (id === 'drain') {
				effect = {
					effectType: 'Drain'
				};
			}
			if (!effect.id) effect.id = id;
			if (!effect.name) effect.name = name;
			if (!effect.fullname) effect.fullname = effect.name;
			effect.toString = this.effectToString;
			if (!effect.category) effect.category = 'Effect';
			if (!effect.effectType) effect.effectType = 'Effect';
		}
		return effect;
	};
	Tools.prototype.getFormat = function(effect) {
		if (!effect || typeof effect === 'string') {
			var name = (effect||'').trim();
			var id = toId(name);
			effect = {};
			if (id && this.data.Formats[id]) {
				effect = this.data.Formats[id];
				if (effect.cached) return effect;
				effect.cached = true;
				effect.name = effect.name || this.data.Formats[id].name;
				if (!effect.mod) effect.mod = 'base';
				if (!effect.effectType) effect.effectType = 'Format';
			}
			if (!effect.id) effect.id = id;
			if (!effect.name) effect.name = name;
			if (!effect.fullname) effect.fullname = effect.name;
			effect.toString = this.effectToString;
			if (!effect.category) effect.category = 'Effect';
			if (!effect.effectType) effect.effectType = 'Effect';
			this.getBanlistTable(effect);
		}
		return effect;
	};
	Tools.prototype.getItem = function(item) {
		if (!item || typeof item === 'string') {
			var name = (item||'').trim();
			var id = toId(name);
			if (this.data.Aliases[id]) {
				name = this.data.Aliases[id];
				id = toId(name);
			}
			item = {};
			if (id && this.data.Items[id]) {
				item = this.data.Items[id];
				if (item.cached) return item;
				item.cached = true;
				item.exists = true;
			}
			if (!item.id) item.id = id;
			if (!item.name) item.name = name;
			if (!item.fullname) item.fullname = 'item: '+item.name;
			item.toString = this.effectToString;
			if (!item.category) item.category = 'Effect';
			if (!item.effectType) item.effectType = 'Item';
		}
		return item;
	};
	Tools.prototype.getElement = function(type) {
		if (!type || typeof type === 'string') {
			var id = toId(type);
			id = id.substr(0,1).toUpperCase() + id.substr(1);
			type = {};
			if (id && this.data.TypeChart.elements[id]) {
				type = this.data.TypeChart.elements[id];
				if (type.cached) return type;
				type.cached = true;
				type.exists = true;
				type.isType = true;
				type.effectType = 'Type';
			}
			if (!type.id) type.id = id;
			if (!type.effectType) type.effectType = 'EffectElement';
		}
		return type;
	};
	Tools.prototype.getAttribute = function(type) {
		if (!type || typeof type === 'string') {
			var id = toId(type);
			id = id.substr(0,1).toUpperCase() + id.substr(1);
			type = {};
			if (id && this.data.TypeChart.attributes[id]) {
				type = this.data.TypeChart.attributes[id];
				if (type.cached) return type;
				type.cached = true;
				type.exists = true;
				type.isType = true;
				type.effectType = 'Type';
			}
			if (!type.id) type.id = id;
			if (!type.effectType) type.effectType = 'EffectAttribute';
		}
		return type;
	};
	var BattleCrests = {
		Valor: {plus:'AT', minus:'DE'}
		// @TODO: This.
	};
	Tools.prototype.getCrest = function(crest) {
		if (typeof crest === 'string') crest = BattleCrests[crest];
		if (!crest) crest = {};
		return crest;
	};
	Tools.prototype.crestModify = function(stats, crest) {
		if (typeof crest === 'string') crest = BattleCrests[crest];
		if (!crest) return stats;
		if (crest.plus) stats[crest.plus] *= 1.1;
		if (crest.minus) stats[crest.minus] *= 0.9;
		return stats;
	};

	Tools.prototype.checkLearnset = function(move, template, lsetData) {
		move = toId(move);
		template = this.getTemplate(template);
		return !(template.learnset[move]);
	};
	Tools.prototype.getBanlistTable = function(format, subformat, depth) {
		var banlistTable;
		if (!depth) depth = 0;
		if (depth>8) return; // avoid infinite recursion
		if (format.banlistTable && !subformat) {
			banlistTable = format.banlistTable;
		} else {
			if (!format.banlistTable) format.banlistTable = {};
			if (!format.setBanTable) format.setBanTable = [];
			if (!format.teamBanTable) format.teamBanTable = [];

			banlistTable = format.banlistTable;
			if (!subformat) subformat = format;
			if (subformat.banlist) {
				for (var i=0; i<subformat.banlist.length; i++) {
					// don't revalidate what we already validate
					if (banlistTable[toId(subformat.banlist[i])]) continue;

					banlistTable[subformat.banlist[i]] = subformat.name || true;
					banlistTable[toId(subformat.banlist[i])] = subformat.name || true;

					var plusPos = subformat.banlist[i].indexOf('+');
					if (plusPos && plusPos > 0) {
						var plusPlusPos = subformat.banlist[i].indexOf('++');
						if (plusPlusPos && plusPlusPos > 0) {
							var complexList = subformat.banlist[i].split('++');
							for (var j=0; j<complexList.length; j++) {
								complexList[j] = toId(complexList[j]);
							}
							format.teamBanTable.push(complexList);
						} else {
							var complexList = subformat.banlist[i].split('+');
							for (var j=0; j<complexList.length; j++) {
								complexList[j] = toId(complexList[j]);
							}
							format.setBanTable.push(complexList);
						}
					}
				}
			}
			if (subformat.ruleset) {
				for (var i=0; i<subformat.ruleset.length; i++) {
					// don't revalidate what we already validate
					if (banlistTable['Rule:'+toId(subformat.ruleset[i])]) continue;

					banlistTable['Rule:'+toId(subformat.ruleset[i])] = subformat.ruleset[i];
					if (format.ruleset.indexOf(subformat.ruleset[i]) === -1) format.ruleset.push(subformat.ruleset[i]);

					var subsubformat = this.getFormat(subformat.ruleset[i]);
					if (subsubformat.ruleset || subsubformat.banlist) {
						this.getBanlistTable(format, subsubformat, depth+1);
					}
				}
			}
		}
		return banlistTable;
	};
	Tools.prototype.validateTeam = function(team, format, forceThisMod) {
		format = this.getFormat(format);
		var problems = [];
		this.getBanlistTable(format);
		if (format.team === 'random' || format.team === 'cc') {
			return false;
		}
		if (!team || !Array.isArray(team)) {
			if (format.canUseRandomTeam) {
				return false;
			}
			return ["You sent invalid team data. If you're not using a custom client, please report this as a bug."];
		}
		if (!team.length) {
			return ["Your team has no digimon."];
		}
		if (team.length>3) {
			return ["Your team has more than 3 digimon."];
		}
		var teamHas = {};
		for (var i=0; i<team.length; i++) {
			var setProblems = this.validateSet(team[i], format, teamHas);
			if (setProblems) {
				problems = problems.concat(setProblems);
			}
		}

		for (var i=0; i<format.teamBanTable.length; i++) {
			var bannedCombo = '';
			for (var j=0; j<format.teamBanTable[i].length; j++) {
				if (!teamHas[format.teamBanTable[i][j]]) {
					bannedCombo = false;
					break;
				}

				if (j == 0) {
					bannedCombo += format.teamBanTable[i][j];
				} else {
					bannedCombo += ' and '+format.teamBanTable[i][j];
				}
			}
			if (bannedCombo) {
				var clause = format.name ? " by "+format.name : '';
				problems.push("Your team has the combination of "+bannedCombo+", which is banned"+clause+".");
			}
		}

		if (format.ruleset) {
			for (var i=0; i<format.ruleset.length; i++) {
				var subformat = this.getFormat(format.ruleset[i]);
				if (subformat.validateTeam) {
					problems = problems.concat(subformat.validateTeam.call(this, team, format)||[]);
				}
			}
		}
		if (format.validateTeam) {
			problems = problems.concat(format.validateTeam.call(this, team, format)||[]);
		}

		if (!problems.length) return false;
		return problems;
	};
	Tools.stageEvoLevels = {
		'Fresh': 1,
		'In-Training': 1,
		'Rookie': 1,
		'Champion': 11,
		'Ultimate': 31,
		'Mega': 41,
		'Burst': 71,
		'Jogress': 1
	};
	Tools.prototype.validateSet = function(set, format, teamHas, forceThisMod) {
		format = this.getFormat(format);
		var problems = [];
		if (!set) {
			return ["This is not a Digimon."];
		}

		var template = this.getTemplate(string(set.name));
		if (!template.exists) {
			return ["The Digimon '"+set.name+"' does not exist."];
		}
		set.name = template.name;

		set.name = toName(set.name);
		var item = this.getItem(string(set.item));
		set.item = item.name;
		if (!Array.isArray(set.moves)) set.moves = [];

		var maxLevel = format.maxLevel || 90;
		var maxForcedLevel = format.maxForcedLevel || maxLevel;
		if (!set.level) set.level = (format.defaultLevel || maxLevel);
		if (format.forcedLevel) {
			set.forcedLevel = format.forcedLevel;
		} else if (set.level >= maxForcedLevel) {
			set.forcedLevel = maxForcedLevel;
		}
		if (set.level > maxLevel || set.level == set.forcedLevel || set.level == set.maxForcedLevel) {
			set.level = maxLevel;
		}

		set.name = set.name || 'Agumon';
		var name = set.name;
		if (set.name !== set.name) name = set.name + " ("+set.name+")";
		var lsetData = {set:set, format:format};
		var setHas = {};

		if (!template) {
			set.name = 'Agumon';
			template = this.getTemplate('Agumon');
		}

		var banlistTable = this.getBanlistTable(format);

		var check = toId(set.name);
		var clause = '';
		setHas[check] = true;
		if (banlistTable[check]) {
			clause = typeof banlistTable[check] === 'string' ? " by "+ banlistTable[check] : '';
			problems.push(set.name+' is banned'+clause+'.');
		}
		check = toId(set.item);
		setHas[check] = true;
		if (banlistTable[check]) {
			clause = typeof banlistTable[check] === 'string' ? " by "+ banlistTable[check] : '';
			problems.push(name+"'s item "+set.item+" is banned"+clause+".");
		}
		if (banlistTable['Unreleased'] && item.isUnreleased) {
			problems.push(name+"'s item "+set.item+" is unreleased.");
		}
		if (set.moves && Array.isArray(set.moves)) {
			set.moves = set.moves.filter(function(val){ return val; });
		}
		if (!set.moves || !set.moves.length) {
			problems.push(name+" has no moves.");
		} else {
			// A limit is imposed here to prevent too much engine strain or
			// too much layout deformation - to be exact, this is the Debug
			// Mode limitation.
			set.moves = set.moves.slice(0,24);
			for (var i=0; i<set.moves.length; i++) {
				if (!set.moves[i]) continue;
				var move = this.getMove(string(set.moves[i]));
				set.moves[i] = move.name;
				check = move.id;
				setHas[check] = true;
				if (banlistTable[check]) {
					clause = typeof banlistTable[check] === 'string' ? " by "+ banlistTable[check] : '';
					problems.push(name+"'s move "+set.moves[i]+" is banned"+clause+".");
				}

				if (banlistTable['illegal']) {
					var problem = this.checkLearnset(move, template, lsetData);
					if (problem) {
						var problemString = name+" can't learn "+move.name;
						problemString = problemString.concat(".");
						problems.push(problemString);
					}
				}
			}

			if (set.level < Tools.stageEvoLevels[template.stage]) {
				problems.push(name+" must be at least level "+template.evoLevel+".");
			}
		}
		setHas[toId(template.stage)] = true;
		if (banlistTable[template.stage]) {
			problems.push(name+" is in Stage "+template.stage+", which is banned.");
		}

		if (teamHas) {
			for (var i in setHas) {
				teamHas[i] = true;
			}
		}
		for (var i=0; i<format.setBanTable.length; i++) {
			var bannedCombo = '';
			for (var j=0; j<format.setBanTable[i].length; j++) {
				if (!setHas[format.setBanTable[i][j]]) {
					bannedCombo = false;
					break;
				}

				if (j == 0) {
					bannedCombo += format.setBanTable[i][j];
				} else {
					bannedCombo += ' and '+format.setBanTable[i][j];
				}
			}
			if (bannedCombo) {
				clause = format.name ? " by "+format.name : '';
				problems.push(name+" has the combination of "+bannedCombo+", which is banned"+clause+".");
			}
		}

		if (format.ruleset) {
			for (var i=0; i<format.ruleset.length; i++) {
				var subformat = this.getFormat(format.ruleset[i]);
				if (subformat.validateSet) {
					problems = problems.concat(subformat.validateSet.call(this, set, format)||[]);
				}
			}
		}
		if (format.validateSet) {
			problems = problems.concat(format.validateSet.call(this, set, format)||[]);
		}

		if (!problems.length) return false;
		return problems;
	};
	Tools.construct = function(mod) {
		var tools = new Tools(mod);
		// Scripts override Tools.
		var ret = Object.create(tools);
		tools.install(ret);
		if (ret.init) ret.init();
		return ret;
	};

	moddedTools.base = Tools.construct();
	moddedTools.base.__proto__.moddedTools = moddedTools;

	return moddedTools.base;
})();
