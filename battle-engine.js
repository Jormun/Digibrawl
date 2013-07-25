/**
 * Battle process
 * Digibrawl - http://www.digibrawl.com/
 *
 * This file is where the battle itself happens.
 *
 * The most important part of the battle happens in runEvent -
 * see that function's definition for details.
 *
 * @license MIT license
 */
require('sugar');

global.fs = require('fs');
if (!('existsSync' in fs)) {
	// For compatibility with ancient versions of node
	fs.existsSync = require('path').existsSync;
}
global.config = require('./config/config.js');

if (config.crashguard) {
	// graceful crash - allow current battles to finish before restarting
	process.on('uncaughtException', function (err) {
		require('./crashlogger.js')(err, 'A simulator process');
	});
}

/**
 * Converts anything to an ID. An ID must have only lowercase alphanumeric
 * characters.
 * If a string is passed, it will be converted to lowercase and
 * non-alphanumeric characters will be stripped.
 * If an object with an ID is passed, its ID will be returned.
 * Otherwise, an empty string will be returned.
 */
global.toId = function(text) {
	if (text && text.id) text = text.id;
	else if (text && text.userid) text = text.userid;

	return string(text).toLowerCase().replace(/[^a-z0-9]+/g, '');
};
global.toUserid = toId;

/**
 * Validates a username or Digimon nickname
 */
var bannedNameStartChars = {'~':1, '&':1, '@':1, '%':1, '+':1, '-':1, '!':1, '?':1, '#':1, ' ':1};
global.toName = function(name) {
	name = string(name);
	name = name.replace(/[\|\s\[\]\,]+/g, ' ').trim();
	while (bannedNameStartChars[name.charAt(0)]) {
		name = name.substr(1);
	}
	if (name.length > 18) name = name.substr(0,18);
	if (config.namefilter) {
		name = config.namefilter(name);
	}
	return name;
};

/**
 * Escapes a string for HTML
 * If strEscape is true, escapes it for JavaScript, too
 */
global.sanitize = function(str, strEscape) {
	str = (''+(str||''));
	str = str.escapeHTML();
	if (strEscape) str = str.replace(/'/g, '\\\'');
	return str;
};

/**
 * Safely ensures the passed variable is a string
 * Simply doing ''+str can crash if str.toString crashes or isn't a function
 * If we're expecting a string and being given anything that isn't a string
 * or a number, it's safe to assume it's an error, and return ''
 */
global.string = function(str) {
	if (typeof str === 'string' || typeof str === 'number') return ''+str;
	return '';
}

/**
 * Converts any variable to an integer (numbers get floored, non-numbers
 * become 0). Then clamps it between min and (optionally) max.
 */
clampIntRange = function(num, min, max) {
	if (typeof num !== 'number') num = 0;
	num = Math.floor(num);
	if (num < min) num = min;
	if (typeof max !== 'undefined' && num > max) num = max;
	return num;
};

global.Data = {};
global.Tools = require('./tools.js');

var Battles = {};

// Receive and process a message sent using App.prototype.send in
// another process.
process.on('message', function(message) {
	var nlIndex = message.indexOf("\n");
	var more = '';
	if (nlIndex > 0) {
		more = message.substr(nlIndex+1);
		message = message.substr(0, nlIndex);
	}
	var data = message.split('|');
	if (data[1] === 'init') {
		if (!Battles[data[0]]) {
			try {
				Battles[data[0]] = Battle.construct(data[0], data[2], data[3]);
			} catch (err) {
				var stack = err.stack + '\n\n' +
						'Additional information:\n' +
						'message = ' + message;
				var fakeErr = {stack: stack};

				if (!require('./crashlogger.js')(fakeErr, 'A battle')) {
					var ministack = (""+err.stack).split("\n").slice(0,2).join("<br />");
					process.send(data[0]+'\nupdate\n|html|<div class="broadcast-red"><b>A BATTLE PROCESS HAS CRASHED:</b> '+ministack+'</div>');
				} else {
					process.send(data[0]+'\nupdate\n|html|<div class="broadcast-red"><b>The battle crashed!</b><br />Don\'t worry, we\'re working on fixing it.</div>');
				}
			}
		}
	} else if (data[1] === 'dealloc') {
		if (Battles[data[0]]) Battles[data[0]].destroy();
		delete Battles[data[0]];
	} else {
		var battle = Battles[data[0]];
		if (battle) {
			var prevRequest = battle.currentRequest;
			try {
				battle.receive(data, more);
			} catch (err) {
				var stack = err.stack + '\n\n' +
						'Additional information:\n' +
						'message = ' + message + '\n' +
						'currentRequest = ' + prevRequest + '\n\n' +
						'Log:\n' + battle.log.join('\n');
				var fakeErr = {stack: stack};
				require('./crashlogger.js')(fakeErr, 'A battle');

				var logPos = battle.log.length;
				battle.add('html', '<div class="broadcast-red"><b>The battle crashed</b><br />You can keep playing but it might crash again.</div>');
				var nestedError;
				try {
					battle.makeRequest(prevRequest);
				} catch (e) {
					nestedError = e;
				}
				battle.sendUpdates(logPos);
				if (nestedError) {
					throw nestedError;
				}
			}
		} else if (data[1] === 'eval') {
			try {
				eval(data[2]);
			} catch (e) {}
		}
	}
});

var BattleDigimon = (function() {
	function BattleDigimon(set, side) {
		this.side = side;
		this.battle = side.battle;
		if (typeof set === 'string') set = {name: set};

		// "pre-bound" functions for nicer syntax (avoids repeated use of `bind`)
		this.getHealth = BattleDigimon.getHealth.bind(this);
		this.getDetails = BattleDigimon.getDetails.bind(this);

		this.set = set;

		this.baseTemplate = this.battle.getTemplate(set.species || set.name);
		if (!this.baseTemplate.exists) {
			this.battle.debug('Unidentified species: ' + this.species);
			this.baseTemplate = this.battle.getTemplate('Agumon');
		}
		this.species = this.baseTemplate.species;
		if (set.name === set.species || !set.name || !set.species) {
			set.name = this.species;
		}
		this.name = (set.name || set.species || 'Agumon').substr(0,20);
		this.speciesid = toId(this.species);
		this.template = this.baseTemplate;
		this.attribute = this.baseTemplate.attribute;
		this.element = this.baseTemplate.element;
		this.types = this.baseTemplate.types;
		this.families = this.baseTemplate.families;
		this.moves = [];
		this.baseMoves = this.moves;
		this.moveset = [];
		this.baseMoveset = [];
		this.level = clampIntRange(set.forcedLevel || set.level || 90, 1, 90);
		this.fullname = this.side.id + ': ' + this.name;
		this.details = this.species + (this.level===90?'':', L'+this.level);
		this.volatiles = {};
		this.size = this.template.size;
		this.ignore = {};
		this.items = [toId(set.items[0]), toId(set.items[1])];
		this.itemsData = {0:{id: this.items[0]}, 1:{id: this.items[1]}};
		this.speciesData = {id: this.speciesid};

		if (this.set.moves) {
			for (var i=0; i<this.set.moves.length; i++) {
				var move = this.battle.getMove(this.set.moves[i]);
				if (!move.id) continue;
				this.baseMoveset.push({
					move: move.name,
					id: move.id,
					ds: move.ds,
					target: move.target,
					disabled: false,
					used: false
				});
				this.moves.push(move.id);
			}
		}
		this.boosts = {hp:0, ds:0, at:0, de:0,ct:0, ev:0, ht:0, bl:0, as:0};
		this.stats = {hp:0, ds:0, at:0, de:0,ct:0, ev:0, ht:0, bl:0, as:0};
		this.maxhp = this.template.baseStats['hp'];
		this.hp = this.hp || this.maxhp;
		this.clearVolatile(true);
	}

	BattleDigimon.prototype.hp = 0;
	BattleDigimon.prototype.maxhp = 100;
	BattleDigimon.prototype.fainted = false;
	BattleDigimon.prototype.lastItem = '';
	BattleDigimon.prototype.position = 0;
	BattleDigimon.prototype.lastMove = '';
	BattleDigimon.prototype.moveThisTurn = '';
	BattleDigimon.prototype.lastDamage = 0;
	BattleDigimon.prototype.lastAttackedBy = null;
	BattleDigimon.prototype.usedItemThisTurn = false;
	BattleDigimon.prototype.isActive = false;
	BattleDigimon.prototype.isStarted = false; // has this digimon's Start events run yet?
	BattleDigimon.prototype.duringMove = false;
	BattleDigimon.prototype.speed = 0;
	BattleDigimon.prototype.stage = 'Rookie';

	BattleDigimon.prototype.toString = function() {
		var fullname = this.fullname;
		var positionList = ['a','b','c','d','e','f'];
		if (this.isActive) return fullname.substr(0,2) + positionList[this.position] + fullname.substr(2);
		return fullname;
	};
	// "static" function
	BattleDigimon.getDetails = function(side) {
		return this.details + '|' + this.getHealth(side);
	};
	BattleDigimon.prototype.update = function(init) {
		// Reset for disabled moves
		this.disabledMoves = {};
		// reset for ignore settings
		this.ignore = {};
		for (var i in this.moveset) {
			if (this.moveset[i]) this.moveset[i].disabled = false;
		}
		if (init) return;

		for (var i = 0; i < this.battle.sides.length; ++i) {
			var side = this.battle.sides[i];
			if (side === this.side) continue;
			for (var j = 0; j < side.active.length; ++j) {
				var digimon = side.active[j];
				if (!digimon || digimon.fainted) continue;
			}
		}
		this.battle.runEvent('ModifyDigimon', this);

		this.speed = this.getStat('as');
	};
	BattleDigimon.prototype.getStat = function(statName, unboosted, unmodified) {
		statName = toId(statName);
		var boost = this.boosts[statName];
		if (statName === 'hp') return this.maxhp;

		// base stat
		var stat = this.stats[statName];
		if (unmodified) return stat;

		// stat modifier effects
		var statTable = {hp:'HP',ds:'DS',at:'AT',de:'DE',ct:'CT',ev:'EV',ht:'HT',bl:'BL',as:'AS'};
		stat = this.battle.runEvent('Modify'+statTable[statName], this, null, null, stat);
		stat = Math.floor(stat);

		if (unboosted) return stat;

		// stat boosts
		boost = this.battle.runEvent('ModifyBoost', this, null, null, boost);
		if (boost >= 0) {
			stat = Math.floor(stat + (stat * boost / 100));
		} else {
			stat = Math.floor(stat - (stat * boost / 100));
		}

		return stat;
	};
	BattleDigimon.prototype.getMoveData = function(move) {
		move = this.battle.getMove(move);
		for (var i=0; i<this.moveset.length; i++) {
			var moveData = this.moveset[i];
			if (moveData.id === move.id) {
				return moveData;
			}
		}
		return null;
	};
	BattleDigimon.prototype.moveUsed = function(move) {
		this.lastMove = this.battle.getMove(move).id;
		this.moveThisTurn = this.lastMove;
	};
	BattleDigimon.prototype.gotAttacked = function(move, damage, source) {
		if (!damage) damage = 0;
		move = this.battle.getMove(move);
		this.lastAttackedBy = {
			digimon: source,
			damage: damage,
			move: move.id,
			thisTurn: true
		};
	};
	BattleDigimon.prototype.getLockedMove = function() {
		var lockedMove = this.battle.runEvent('LockMove', this);
		if (lockedMove === true) lockedMove = false;
		return lockedMove;
	};
	BattleDigimon.prototype.getStageMove = function(stage) {
		var move = 'bubbles';
		var movesPerStage = {
			'Rookie':'attackrookie',
			'Champion': 'attackchampion',
			'Ultimate': 'attackultimate',
			'Mega': 'attackmega',
			'Burst': 'burstattack',
			'Jogress': 'doubleattack'
		};
		if (movesPerStage[stage]) move = movesPerStage[stage];

		return this.getMove(move);
	};
	BattleDigimon.prototype.getMoves = function(lockedMove) {
		if (lockedMove) {
			lockedMove = toId(lockedMove);
			this.trapped = true;
		}
		var moves = [];
		moves.push(this.getStageMove(this.stage));
		var hasValidMove = false;
		for (var i=0; i<this.moveset.length; i++) {
			var move = this.moveset[i];
			if (lockedMove) {
				if (lockedMove === move.id) return [move];
				continue;
			}
			if (this.disabledMoves[move.id] || this.side.ds < move.ds) {
				move.disabled = true;
			} else if (!move.disabled) {
				hasValidMove = true;
			}
			var moveName = move.move;
			moves.push({
				move: moveName,
				id: move.id,
				ds: move.ds,
				target: move.target,
				disabled: move.disabled
			});
		}
		if (lockedMove) {
			return [{
				move: this.battle.getMove(lockedMove).name,
				id: lockedMove
			}];
		}

		return moves;
	};
	BattleDigimon.prototype.getRequestData = function() {
		var lockedMove = this.getLockedMove();
		var data = {moves: this.getMoves(lockedMove)};
		if (lockedMove && this.trapped) {
			data.trapped = true;
		} else if (this.maybeTrapped) {
			data.maybeTrapped = true;
		}
		return data;
	};
	BattleDigimon.prototype.positiveBoosts = function() {
		var boosts = 0;
		for (var i in this.boosts) {
			if (this.boosts[i] > 0) boosts += this.boosts[i];
		}
		return boosts;
	};
	BattleDigimon.prototype.boostBy = function(boost, source, effect) {
		var changed = false;
		for (var i in boost) {
			var delta = boost[i];
			this.boosts[i] += delta;
			if (this.boosts[i] > 100) {
				delta -= this.boosts[i] - 10;
				this.boosts[i] = 100;
			}
			if (this.boosts[i] < -100) {
				delta -= this.boosts[i] - (-100);
				this.boosts[i] = -100;
			}
			if (delta) changed = true;
		}
		this.update();
		return changed;
	};
	BattleDigimon.prototype.clearBoosts = function() {
		for (var i in this.boosts) {
			this.boosts[i] = 0;
		}
		this.update();
	};
	BattleDigimon.prototype.setBoost = function(boost) {
		for (var i in boost) {
			this.boosts[i] = boost[i];
		}
		this.update();
	};
	BattleDigimon.prototype.copyVolatileFrom = function(digimon) {
		this.clearVolatile();
		this.boosts = digimon.boosts;
		this.volatiles = digimon.volatiles;
		this.update();
		digimon.clearVolatile();
		for (var i in this.volatiles) {
			var status = this.getVolatile(i);
			if (status.noCopy) {
				delete this.volatiles[i];
			}
			this.battle.singleEvent('Copy', status, this.volatiles[i], this);
		}
	};
	BattleDigimon.prototype.clearVolatile = function(init) {
		this.boosts = {hp:0, ds:0, at:0, de:0,ct:0, ev:0, ht:0, bl:0, as:0};
		this.moveset = [];
		this.moves = [];

		// We're copying array contents
		// DO NOT "optimize" it to copy just the pointer
		// if you don't know what a pointer is, please don't
		// touch this code
		for (var i=0; i<this.baseMoveset.length; i++) {
			this.moveset.push(this.baseMoveset[i]);
			this.moves.push(toId(this.baseMoveset[i].move));
		}
		for (var i in this.volatiles) {
			if (this.volatiles[i].linkedStatus) {
				this.volatiles[i].linkeddigimon.removeVolatile(this.volatiles[i].linkedStatus);
			}
		}
		this.volatiles = {};
		this.switchFlag = false;

		this.lastMove = '';
		this.moveThisTurn = '';

		this.lastDamage = 0;
		this.lastAttackedBy = null;
		this.newlySwitched = true;

		this.formeChange(this.baseTemplate);

		this.update(init);
	};
	BattleDigimon.prototype.hasType = function (type) {
		// TODO: This
		if (!type) return false;
		if (Array.isArray(type)) {
			for (var i=0; i<type.length; i++) {
				if (this.hasType(type[i])) return true;
			}
		} else {
			if (this.types[0] === type) return true;
			if (this.types[1] === type) return true;
		}
		return false;
	};
	BattleDigimon.prototype.faint = function(source, effect) {
		if (this.fainted) return 0;
		var d = this.hp;
		this.hp = 0;
		this.switchFlag = false;
		this.status = 'fnt';
		this.fainted = true;
		this.battle.faintQueue.push({
			target: this,
			source: source,
			effect: effect
		});
		return d;
	};
	BattleDigimon.prototype.damage = function(d, source, effect) {
		if (!this.hp) return 0;
		if (d < 1 && d > 0) d = 1;
		d = Math.floor(d);
		if (isNaN(d)) return 0;
		if (d <= 0) return 0;
		this.hp -= d;
		if (this.hp <= 0) {
			d += this.hp;
			this.faint(source, effect);
		}
		return d;
	};
	BattleDigimon.prototype.hasMove = function(moveid) {
		moveid = toId(moveid);
		for (var i=0; i<this.moveset.length; i++) {
			if (moveid === this.battle.getMove(this.moveset[i].move).id) {
				return moveid;
			}
		}
		return false;
	};
	BattleDigimon.prototype.getValidMoves = function() {
		var pMoves = this.getMoves(this.getLockedMove());
		var moves = [];
		for (var i=0; i<pMoves.length; i++) {
			if (!pMoves[i].disabled) {
				moves.push(pMoves[i].id);
			}
		}
		if (!moves.length) return [this.getStageMove(this.stage)];
		return moves;
	};
	// returns the amount of damage actually healed
	BattleDigimon.prototype.heal = function(d) {
		if (!this.hp) return 0;
		d = Math.floor(d);
		if (isNaN(d)) return 0;
		if (d <= 0) return 0;
		if (this.hp >= this.maxhp) return 0;
		this.hp += d;
		if (this.hp > this.maxhp) {
			d -= this.hp - this.maxhp;
			this.hp = this.maxhp;
		}
		return d;
	};
	// sets HP, returns delta
	BattleDigimon.prototype.sethp = function(d) {
		if (!this.hp) return 0;
		d = Math.floor(d);
		if (isNaN(d)) return;
		if (d < 1) d = 1;
		d = d-this.hp;
		this.hp += d;
		if (this.hp > this.maxhp) {
			d -= this.hp - this.maxhp;
			this.hp = this.maxhp;
		}
		return d;
	};
	BattleDigimon.prototype.eatItem = function(item, source, sourceEffect) {
		if (!this.hp || !this.isActive) return false;
		if (!this.item) return false;

		var id = toId(item);
		if (id && this.item !== id) return false;

		if (!sourceEffect && this.battle.effect) sourceEffect = this.battle.effect;
		if (!source && this.battle.event && this.battle.event.target) source = this.battle.event.target;
		item = this.getItem();
		if (this.battle.runEvent('UseItem', this, null, null, item) && this.battle.runEvent('EatItem', this, null, null, item)) {
			this.battle.add('-enditem', this, item, '[eat]');

			this.battle.singleEvent('Eat', item, this.itemData, this, source, sourceEffect);

			this.lastItem = this.item;
			this.item = '';
			this.itemData = {id: '', target: this};
			this.usedItemThisTurn = true;
			return true;
		}
		return false;
	};
	BattleDigimon.prototype.useItem = function(item, source, sourceEffect) {
		if (!this.isActive) return false;
		if (!this.item) return false;

		var id = toId(item);
		if (id && this.item !== id) return false;

		if (!sourceEffect && this.battle.effect) sourceEffect = this.battle.effect;
		if (!source && this.battle.event && this.battle.event.target) source = this.battle.event.target;
		item = this.getItem();
		if (this.battle.runEvent('UseItem', this, null, null, item)) {
			switch (item.id) {
			case 'redcard':
				this.battle.add('-enditem', this, item, '[of] '+source);
				break;
			default:
				if (!item.isGem) {
					this.battle.add('-enditem', this, item);
				}
				break;
			}

			this.battle.singleEvent('Use', item, this.itemData, this, source, sourceEffect);

			this.lastItem = this.item;
			this.item = '';
			this.itemData = {id: '', target: this};
			this.usedItemThisTurn = true;
			return true;
		}
		return false;
	};
	BattleDigimon.prototype.takeItem = function(source) {
		if (!this.hp || !this.isActive) return false;
		if (!this.item) return false;
		if (!source) source = this;
		var item = this.getItem();
		if (this.battle.runEvent('TakeItem', this, source, null, item)) {
			this.lastItem = '';
			this.item = '';
			this.itemData = {id: '', target: this};
			return item;
		}
		return false;
	};
	BattleDigimon.prototype.setItem = function(item, source, effect) {
		if (!this.hp || !this.isActive) return false;
		item = this.battle.getItem(item);
		this.lastItem = this.item;
		this.item = item.id;
		this.itemData = {id: item.id, target: this};
		if (item.id) {
			this.battle.singleEvent('Start', item, this.itemData, this, source, effect);
		}
		if (this.lastItem) this.usedItemThisTurn = true;
		return true;
	};
	BattleDigimon.prototype.getItem = function() {
		return this.battle.getItem(this.item);
	};
	BattleDigimon.prototype.clearItem = function() {
		return this.setItem('');
	};
	BattleDigimon.prototype.addVolatile = function(status, source, sourceEffect) {
		if (!this.hp) return false;
		status = this.battle.getEffect(status);
		if (this.battle.event) {
			if (!source) source = this.battle.event.source;
			if (!sourceEffect) sourceEffect = this.battle.effect;
		}

		if (this.volatiles[status.id]) {
			if (!status.onRestart) return false;
			return this.battle.singleEvent('Restart', status, this.volatiles[status.id], this, source, sourceEffect);
		}
		if (!this.runImmunity(status.id)) return false;
		var result = this.battle.runEvent('TryAddVolatile', this, source, sourceEffect, status);
		if (!result) {
			this.battle.debug('add volatile ['+status.id+'] interrupted');
			return result;
		}
		this.volatiles[status.id] = {id: status.id};
		this.volatiles[status.id].target = this;
		if (source) {
			this.volatiles[status.id].source = source;
			this.volatiles[status.id].sourcePosition = source.position;
		}
		if (sourceEffect) {
			this.volatiles[status.id].sourceEffect = sourceEffect;
		}
		if (status.duration) {
			this.volatiles[status.id].duration = status.duration;
		}
		if (status.durationCallback) {
			this.volatiles[status.id].duration = status.durationCallback.call(this.battle, this, source, sourceEffect);
		}
		var result = this.battle.singleEvent('Start', status, this.volatiles[status.id], this, source, sourceEffect);
		if (!result) {
			// cancel
			delete this.volatiles[status.id];
			return result;
		}
		this.update();
		return true;
	};
	BattleDigimon.prototype.getVolatile = function(status) {
		status = this.battle.getEffect(status);
		if (!this.volatiles[status.id]) return null;
		return status;
	};
	BattleDigimon.prototype.removeVolatile = function(status) {
		if (!this.hp) return false;
		status = this.battle.getEffect(status);
		if (!this.volatiles[status.id]) return false;
		this.battle.singleEvent('End', status, this.volatiles[status.id], this);
		delete this.volatiles[status.id];
		this.update();
		return true;
	};
	// "static" function
	BattleDigimon.getHealth = function(side) {
		if (!this.hp) return '0 fnt';
		var hpstring;
		if ((side === true) || (this.side === side) || this.battle.getFormat().debug) {
			hpstring = ''+this.hp+'/'+this.maxhp;
		} else {
			var ratio = this.hp / this.maxhp;
			if (this.battle.reportPercentages) {
				// HP Percentage Mod mechanics
				var percentage = Math.ceil(ratio * 100);
				if ((percentage === 100) && (ratio < 1.0)) {
					percentage = 99;
				}
				hpstring = '' + percentage + '/100';
			} else {
				// In-game accurate pixel health mechanics
				var pixels = Math.floor(ratio * 48) || 1;
				hpstring = '' + pixels + '/48';
				if ((pixels === 9) && (ratio > 0.2)) {
					hpstring += 'y'; // force yellow HP bar
				} else if ((pixels === 24) && (ratio > 0.5)) {
					hpstring += 'g'; // force green HP bar
				}
			}
		}
		if (this.status) hpstring += ' ' + this.status;
		return hpstring;
	};
	BattleDigimon.prototype.runImmunity = function(type, message) {
		if (this.fainted) {
			return false;
		}
		if (!type || type === '???') {
			return true;
		}
		if (this.negateImmunity[type]) return true;
		if (!this.negateImmunity['Type'] && !this.battle.getImmunity(type, this)) {
			this.battle.debug('natural immunity');
			if (message) {
				this.battle.add('-immune', this, '[msg]');
			}
			return false;
		}
		var immunity = this.battle.runEvent('Immunity', this, null, null, type);
		if (!immunity) {
			this.battle.debug('artificial immunity');
			if (message && immunity !== null) {
				this.battle.add('-immune', this, '[msg]');
			}
			return false;
		}
		return true;
	};
	BattleDigimon.prototype.destroy = function() {
		// deallocate ourself
		// get rid of some possibly-circular references
		this.battle = null;
		this.side = null;
	};
	return BattleDigimon;
})();

var BattleSide = (function() {
	function BattleSide(name, battle, n, team) {
		this.battle = battle;
		this.n = n;
		this.name = name;
		this.digimon = [];
		this.sideConditions = {};
		this.maxds = 400;
		this.id = (n?'p2':'p1');
		this.active = [null, null, null];
		this.team = this.battle.getTeam(this, team);
		for (var i=0; i<this.team.length && i<3; i++) {
			this.digimon.push(new BattleDigimon(this.team[i], this));
		}
		this.digimonLeft = this.digimon.length;
		for (var i=0; i<this.digimon.length; i++) {
			this.digimon[i].position = i;
			this.maxds += this.digimon[i].ds;
		}
		this.ds = Math.floor(this.maxds / 2);
	}

	BattleSide.prototype.isActive = false;
	BattleSide.prototype.digimonLeft = 0;
	BattleSide.prototype.faintedLastTurn = false;
	BattleSide.prototype.faintedThisTurn = false;
	BattleSide.prototype.decision = null;
	BattleSide.prototype.foe = null;

	BattleSide.prototype.toString = function() {
		return this.id+': '+this.name;
	};
	BattleSide.prototype.getData = function() {
		var data = {
			name: this.name,
			id: this.id,
			digimon: []
		};
		for (var i=0; i<this.digimon.length; i++) {
			var digimon = this.digimon[i];
			data.digimon.push({
				ident: digimon.fullname,
				details: digimon.details,
				condition: digimon.getHealth(digimon.side),
				active: (digimon.position < digimon.side.active.length),
				moves: digimon.moves.map(function(move) {
					return move;
				}),
				item: digimon.item
			});
		}
		return data;
	};
	BattleSide.prototype.randomActive = function() {
		var actives = this.active.filter(function(active) {
			return active && !active.fainted;
		});
		if (!actives.length) return null;
		var i = Math.floor(Math.random() * actives.length);
		return actives[i];
	};
	BattleSide.prototype.addSideCondition = function(status, source, sourceEffect) {
		status = this.battle.getEffect(status);
		if (this.sideConditions[status.id]) {
			if (!status.onRestart) return false;
			return this.battle.singleEvent('Restart', status, this.sideConditions[status.id], this, source, sourceEffect);
		}
		this.sideConditions[status.id] = {id: status.id};
		this.sideConditions[status.id].target = this;
		if (source) {
			this.sideConditions[status.id].source = source;
			this.sideConditions[status.id].sourcePosition = source.position;
		}
		if (status.duration) {
			this.sideConditions[status.id].duration = status.duration;
		}
		if (status.durationCallback) {
			this.sideConditions[status.id].duration = status.durationCallback.call(this.battle, this, source, sourceEffect);
		}
		if (!this.battle.singleEvent('Start', status, this.sideConditions[status.id], this, source, sourceEffect)) {
			delete this.sideConditions[status.id];
			return false;
		}
		this.battle.update();
		return true;
	};
	BattleSide.prototype.getSideCondition = function(status) {
		status = this.battle.getEffect(status);
		if (!this.sideConditions[status.id]) return null;
		return status;
	};
	BattleSide.prototype.removeSideCondition = function(status) {
		status = this.battle.getEffect(status);
		if (!this.sideConditions[status.id]) return false;
		this.battle.singleEvent('End', status, this.sideConditions[status.id], this);
		delete this.sideConditions[status.id];
		this.battle.update();
		return true;
	};
	BattleSide.prototype.emitCallback = function() {
		this.battle.send('callback', this.id + "\n" +
			Array.prototype.slice.call(arguments).join('|'));
	};
	BattleSide.prototype.emitRequest = function(update) {
		this.battle.send('request', this.id+"\n"+this.battle.rqid+"\n"+JSON.stringify(update));
	};
	BattleSide.prototype.destroy = function() {
		// deallocate ourself

		// deallocate children and get rid of references to them
		for (var i=0; i<this.digimon.length; i++) {
			if (this.digimon[i]) this.digimon[i].destroy();
			this.digimon[i] = null;
		}
		this.digimon = null;
		for (var i=0; i<this.active.length; i++) {
			this.active[i] = null;
		}
		this.active = null;

		if (this.decision) {
			delete this.decision.side;
			delete this.decision.digimon;
		}
		this.decision = null;

		// get rid of some possibly-circular references
		this.battle = null;
		this.foe = null;
	};
	return BattleSide;
})();

var Battle = (function() {
	var Battle = {};

	Battle.construct = (function() {
		var battleProtoCache = {};
		return function(roomid, formatarg, rated) {
			var battle = Object.create((function() {
				if (battleProtoCache[formatarg] !== undefined) {
					return battleProtoCache[formatarg];
				}

				// Scripts overrides Battle overrides Scripts overrides Tools
				var tools = Tools.mod(formatarg);
				var proto = Object.create(tools);
				for (var i in Battle.prototype) {
					proto[i] = Battle.prototype[i];
				};
				var battle = Object.create(proto);
				var ret = Object.create(battle);
				tools.install(ret);
				return battleProtoCache[formatarg] = ret;
			})());
			Battle.prototype.init.call(battle, roomid, formatarg, rated);
			return battle;
		};
	})();

	Battle.prototype = {};

	Battle.prototype.init = function(roomid, formatarg, rated) {
		var format = Tools.getFormat(formatarg);

		this.log = [];
		this.sides = [null, null];
		this.roomid = roomid;
		this.id = roomid;
		this.rated = rated;
		this.weatherData = {id:''};
		this.pseudoWeather = {};

		this.format = toId(format);
		this.formatData = {id:this.format};

		this.effect = {id:''};
		this.effectData = {id:''};
		this.event = {id:''};

		this.gameType = (format.gameType || 'singles');

		this.queue = [];
		this.faintQueue = [];
		this.messageLog = [];

		// use a random initial seed (64-bit, [high -> low])
		this.seed = [Math.floor(Math.random() * 0xffff),
			Math.floor(Math.random() * 0xffff),
			Math.floor(Math.random() * 0xffff),
			Math.floor(Math.random() * 0xffff)];
	}

	Battle.prototype.turn = 0;
	Battle.prototype.p1 = null;
	Battle.prototype.p2 = null;
	Battle.prototype.lastUpdate = 0;
	Battle.prototype.currentRequest = '';
	Battle.prototype.ended = false;
	Battle.prototype.started = false;
	Battle.prototype.active = false;
	Battle.prototype.eventDepth = 0;
	Battle.prototype.lastMove = '';
	Battle.prototype.activeMove = null;
	Battle.prototype.activedigimon = null;
	Battle.prototype.activeTarget = null;
	Battle.prototype.midTurn = false;
	Battle.prototype.currentRequest = '';
	Battle.prototype.rqid = 0;
	Battle.prototype.lastMoveLine = 0;
	Battle.prototype.reportPercentages = false;

	Battle.prototype.toString = function() {
		return 'Battle: '+this.format;
	};

	Battle.prototype.random = function(m, n) {
		this.seed = this.nextFrame(); // Advance the RNG
		var result = (this.seed[0] << 16 >>> 0) + this.seed[1]; // Use the upper 32 bits
		m = Math.floor(m);
		n = Math.floor(n);
		result = (m ? (n ? Math.floor(result*(n-m) / 0x100000000)+m : Math.floor(result*m / 0x100000000)) : result/0x100000000);
		this.debug('randBW(' + (m ? (n ? m + ',' + n : m) : '') + ') = ' + result);
		return result;
	};

	Battle.prototype.nextFrame = function(n) {
		var seed = this.seed;
		n = n || 1;
		for (var frame = 0; frame < n; ++frame) {
			var a = [0x5D58, 0x8B65, 0x6C07, 0x8965];
			var c = [0, 0, 0x26, 0x9EC3];

			var nextSeed = [0, 0, 0, 0];
			var carry = 0;

			for (var cN = seed.length - 1; cN >= 0; --cN) {
				nextSeed[cN] = carry;
				carry = 0;

				var aN = seed.length - 1;
				var seedN = cN;
				for (; seedN < seed.length; --aN, ++seedN) {
					var nextWord = a[aN] * seed[seedN];
					carry += nextWord >>> 16;
					nextSeed[cN] += nextWord & 0xFFFF;
				}
				nextSeed[cN] += c[cN];
				carry += nextSeed[cN] >>> 16;
				nextSeed[cN] &= 0xFFFF;
			}

			seed = nextSeed;
		}
		return seed;
	}
	Battle.prototype.getFormat = function() {
		return this.getEffect(this.format);
	};
	Battle.prototype.addPseudoWeather = function(status, source, sourceEffect) {
		status = this.getEffect(status);
		if (this.pseudoWeather[status.id]) {
			if (!status.onRestart) return false;
			return this.singleEvent('Restart', status, this.pseudoWeather[status.id], this, source, sourceEffect);
		}
		this.pseudoWeather[status.id] = {id: status.id};
		if (source) {
			this.pseudoWeather[status.id].source = source;
			this.pseudoWeather[status.id].sourcePosition = source.position;
		}
		if (status.duration) {
			this.pseudoWeather[status.id].duration = status.duration;
		}
		if (status.durationCallback) {
			this.pseudoWeather[status.id].duration = status.durationCallback.call(this, source, sourceEffect);
		}
		if (!this.singleEvent('Start', status, this.pseudoWeather[status.id], this, source, sourceEffect)) {
			delete this.pseudoWeather[status.id];
			return false;
		}
		this.update();
		return true;
	};
	Battle.prototype.getPseudoWeather = function(status) {
		status = this.getEffect(status);
		if (!this.pseudoWeather[status.id]) return null;
		return status;
	};
	Battle.prototype.removePseudoWeather = function(status) {
		status = this.getEffect(status);
		if (!this.pseudoWeather[status.id]) return false;
		this.singleEvent('End', status, this.pseudoWeather[status.id], this);
		delete this.pseudoWeather[status.id];
		this.update();
		return true;
	};
	Battle.prototype.setActiveMove = function(move, digimon, target) {
		if (!move) move = null;
		if (!digimon) digimon = null;
		if (!target) target = digimon;
		this.activeMove = move;
		this.activedigimon = digimon;
		this.activeTarget = target;

		this.update();
	};
	Battle.prototype.clearActiveMove = function(failed) {
		if (this.activeMove) {
			if (!failed) {
				this.lastMove = this.activeMove.id;
			}
			this.activeMove = null;
			this.activedigimon = null;
			this.activeTarget = null;

			this.update();
		}
	};

	Battle.prototype.update = function() {
		var actives = this.p1.active;
		for (var i=0; i<actives.length; i++) {
			if (actives[i]) actives[i].update();
		}
		actives = this.p2.active;
		for (var i=0; i<actives.length; i++) {
			if (actives[i]) actives[i].update();
		}
	};

	// bubbles up
	Battle.comparePriority = function(a, b) { // intentionally not in Battle.prototype
		a.priority = a.priority || 0;
		a.subPriority = a.subPriority || 0;
		a.speed = a.baseStats.as || 0;
		b.priority = b.priority || 0;
		b.subPriority = b.subPriority || 0;
		b.speed = b.baseStats.as || 0;
		if ((typeof a.order === 'number' || typeof b.order === 'number') && a.order !== b.order) {
			if (typeof a.order !== 'number') {
				return -(1);
			}
			if (typeof b.order !== 'number') {
				return -(-1);
			}
			if (b.order - a.order) {
				return -(b.order - a.order);
			}
		}
		if (b.priority - a.priority) {
			return b.priority - a.priority;
		}
		if (b.speed - a.speed) {
			return a.speed - b.speed;
		}
		if (b.subOrder - a.subOrder) {
			return -(b.subOrder - a.subOrder);
		}
		return Math.random()-0.5;
	};
	Battle.prototype.eachEvent = function(eventid, effect, relayVar) {
		var actives = [];
		if (!effect && this.effect) effect = this.effect;
		for (var i=0; i<this.sides.length;i++) {
			var side = this.sides[i];
			for (var j=0; j<side.active.length; j++) {
				if (side.active[j]) actives.push(side.active[j]);
			}
		}
		actives.sort(function(a, b) {
			if (b.speed - a.speed) {
				return b.speed - a.speed;
			}
			return Math.random()-0.5;
		});
		for (var i=0; i<actives.length; i++) {
			if (actives[i].isStarted) {
				this.runEvent(eventid, actives[i], null, effect, relayVar);
			}
		}
	};
	// The entire event system revolves around this function
	// (and its helper functions, getRelevant*)
	Battle.prototype.singleEvent = function(eventid, effect, effectData, target, source, sourceEffect, relayVar) {
		if (this.eventDepth >= 8) {
			// oh fuck
			this.add('message', 'STACK LIMIT EXCEEDED');
			this.add('message', 'PLEASE REPORT IN BUG THREAD');
			this.add('message', 'Event: '+eventid);
			this.add('message', 'Parent event: '+this.event.id);
			throw new Error("Stack overflow");
			return false;
		}
		//this.add('Event: '+eventid+' (depth '+this.eventDepth+')');
		effect = this.getEffect(effect);
		var hasRelayVar = true;
		if (relayVar === undefined) {
			relayVar = true;
			hasRelayVar = false;
		}

		if (target.fainted) {
			return false;
		}
		if (effect.effectType === 'Status' && target.status !== effect.id) {
			// it's changed; call it off
			return relayVar;
		}

		if (effect['on'+eventid] === undefined) return relayVar;
		var parentEffect = this.effect;
		var parentEffectData = this.effectData;
		var parentEvent = this.event;
		this.effect = effect;
		this.effectData = effectData;
		this.event = {id: eventid, target: target, source: source, effect: sourceEffect};
		this.eventDepth++;
		var args = [target, source, sourceEffect];
		if (hasRelayVar) args.unshift(relayVar);
		var returnVal;
		if (typeof effect['on'+eventid] === 'function') {
			returnVal = effect['on'+eventid].apply(this, args);
		} else {
			returnVal = effect['on'+eventid];
		}
		this.eventDepth--;
		this.effect = parentEffect;
		this.effectData = parentEffectData;
		this.event = parentEvent;
		if (returnVal === undefined) return relayVar;
		return returnVal;
	};
	/**
	 * runEvent is the core of digimon Showdown's event system.
	 *
	 * Basic usage
	 * ===========
	 *
	 *   this.runEvent('Blah')
	 * will trigger any onBlah global event handlers.
	 *
	 *   this.runEvent('Blah', target)
	 * will additionally trigger any onBlah handlers on the target, onAllyBlah
	 * handlers on any active digimon on the target's team, and onFoeBlah
	 * handlers on any active digimon on the target's foe's team
	 *
	 *   this.runEvent('Blah', target, source)
	 * will additionally trigger any onSourceBlah handlers on the source
	 *
	 *   this.runEvent('Blah', target, source, effect)
	 * will additionally pass the effect onto all event handlers triggered
	 *
	 *   this.runEvent('Blah', target, source, effect, relayVar)
	 * will additionally pass the relayVar as the first argument along all event
	 * handlers
	 *
	 * You may leave any of these null. For instance, if you have a relayVar but
	 * no source or effect:
	 *   this.runEvent('Damage', target, null, null, 50)
	 *
	 * Event handlers
	 * ==============
	 *
	 * Items, abilities, statuses, and other effects like SR, confusion, weather,
	 * or Trick Room can have event handlers. Event handlers are functions that
	 * can modify what happens during an event.
	 *
	 * event handlers are passed:
	 *   function(target, source, effect)
	 * although some of these can be blank.
	 *
	 * certain events have a relay variable, in which case they're passed:
	 *   function(relayVar, target, source, effect)
	 *
	 * Relay variables are variables that give additional information about the
	 * event. For instance, the damage event has a relayVar which is the amount
	 * of damage dealt.
	 *
	 * If a relay variable isn't passed to runEvent, there will still be a secret
	 * relayVar defaulting to `true`, but it won't get passed to any event
	 * handlers.
	 *
	 * After an event handler is run, its return value helps determine what
	 * happens next:
	 * 1. If the return value isn't `undefined`, relayVar is set to the return
	 *	value
	 * 2. If relayVar is falsy, no more event handlers are run
	 * 3. Otherwise, if there are more event handlers, the next one is run and
	 *	we go back to step 1.
	 * 4. Once all event handlers are run (or one of them results in a falsy
	 *	relayVar), relayVar is returned by runEvent
	 *
	 * As a shortcut, an event handler that isn't a function will be interpreted
	 * as a function that returns that value.
	 *
	 * You can have return values mean whatever you like, but in general, we
	 * follow the convention that returning `false` or `null` means
	 * stopping or interrupting the event.
	 *
	 * For instance, returning `false` from a TrySetStatus handler means that
	 * the digimon doesn't get statused.
	 *
	 * If a failed event usually results in a message like "But it failed!"
	 * or "It had no effect!", returning `null` will suppress that message and
	 * returning `false` will display it. Returning `null` is useful if your
	 * event handler already gave its own custom failure message.
	 *
	 * Returning `undefined` means "don't change anything" or "keep going".
	 * A function that does nothing but return `undefined` is the equivalent
	 * of not having an event handler at all.
	 *
	 * Returning a value means that that value is the new `relayVar`. For
	 * instance, if a Damage event handler returns 50, the damage event
	 * will deal 50 damage instead of whatever it was going to deal before.
	 *
	 * Useful values
	 * =============
	 *
	 * In addition to all the methods and attributes of Tools, Battle, and
	 * Scripts, event handlers have some additional values they can access:
	 *
	 * this.effect:
	 *   the Effect having the event handler
	 * this.effectData:
	 *   the data store associated with the above Effect. This is a plain Object
	 *   and you can use it to store data for later event handlers.
	 * this.effectData.target:
	 *   the digimon, Side, or Battle that the event handler's effect was
	 *   attached to.
	 * this.event.id:
	 *   the event ID
	 * this.event.target, this.event.source, this.event.effect:
	 *   the target, source, and effect of the event. These are the same
	 *   variables that are passed as arguments to the event handler, but
	 *   they're useful for functions called by the event handler.
	 */
	Battle.prototype.runEvent = function(eventid, target, source, effect, relayVar) {
		if (this.eventDepth >= 8) {
			// oh fuck
			this.add('message', 'STACK LIMIT EXCEEDED');
			this.add('message', 'PLEASE REPORT IN BUG THREAD');
			this.add('message', 'Event: '+eventid);
			this.add('message', 'Parent event: '+this.event.id);
			throw new Error("Stack overflow");
			return false;
		}
		if (!target) target = this;
		var statuses = this.getRelevantEffects(target, 'on'+eventid, 'onSource'+eventid, source);
		var hasRelayVar = true;
		effect = this.getEffect(effect);
		var args = [target, source, effect];
		//console.log('Event: '+eventid+' (depth '+this.eventDepth+') t:'+target.id+' s:'+(!source||source.id)+' e:'+effect.id);
		if (typeof relayVar === 'undefined' || relayVar === null) {
			relayVar = true;
			hasRelayVar = false;
		} else {
			args.unshift(relayVar);
		}
		for (var i=0; i<statuses.length; i++) {
			var status = statuses[i].status;
			var thing = statuses[i].thing;
			if (thing.fainted) continue;
			//this.debug('match '+eventid+': '+status.id+' '+status.effectType);
			if (status.effectType === 'Status' && thing.status !== status.id) {
				// it's changed; call it off
				continue;
			}
			var returnVal;
			if (typeof statuses[i].callback === 'function') {
				var parentEffect = this.effect;
				var parentEffectData = this.effectData;
				var parentEvent = this.event;
				this.effect = statuses[i].status;
				this.effectData = statuses[i].statusData;
				this.effectData.target = thing;
				this.event = {id: eventid, target: target, source: source, effect: effect};
				this.eventDepth++;
				returnVal = statuses[i].callback.apply(this, args);
				this.eventDepth--;
				this.effect = parentEffect;
				this.effectData = parentEffectData;
				this.event = parentEvent;
			} else {
				returnVal = statuses[i].callback;
			}

			if (typeof returnVal !== 'undefined') {
				relayVar = returnVal;
				if (!relayVar) return relayVar;
				if (hasRelayVar) {
					args[0] = relayVar;
				}
			}
		}
		return relayVar;
	};
	Battle.prototype.resolveLastPriority = function(statuses, callbackType) {
		var order = false;
		var priority = 0;
		var subOrder = 0;
		var status = statuses[statuses.length-1];
		if (status.status[callbackType+'Order']) {
			order = status.status[callbackType+'Order'];
		}
		if (status.status[callbackType+'Priority']) {
			priority = status.status[callbackType+'Priority'];
		} else if (status.status[callbackType+'SubOrder']) {
			subOrder = status.status[callbackType+'SubOrder'];
		}

		status.order = order;
		status.priority = priority;
		status.subOrder = subOrder;
		if (status.thing && status.thing.getStat) status.speed = status.thing.speed;
	};
	// bubbles up to parents
	Battle.prototype.getRelevantEffects = function(thing, callbackType, foeCallbackType, foeThing, checkChildren) {
		var statuses = this.getRelevantEffectsInner(thing, callbackType, foeCallbackType, foeThing, true, false);
		statuses.sort(Battle.comparePriority);
		//if (statuses[0]) this.debug('match '+callbackType+': '+statuses[0].status.id);
		return statuses;
	};
	Battle.prototype.getRelevantEffectsInner = function(thing, callbackType, foeCallbackType, foeThing, bubbleUp, bubbleDown, getAll) {
		if (!callbackType || !thing) return [];
		var statuses = [];
		var status;

		if (thing.sides) {
			for (var i in this.pseudoWeather) {
				status = this.getPseudoWeather(i);
				if (typeof status[callbackType] !== 'undefined' || (getAll && thing.pseudoWeather[i][getAll])) {
					statuses.push({status: status, callback: status[callbackType], statusData: this.pseudoWeather[i], end: this.removePseudoWeather, thing: thing});
					this.resolveLastPriority(statuses,callbackType);
				}
			}
			status = this.getWeather();
			if (typeof status[callbackType] !== 'undefined' || (getAll && thing.weatherData[getAll])) {
				statuses.push({status: status, callback: status[callbackType], statusData: this.weatherData, end: this.clearWeather, thing: thing, priority: status[callbackType+'Priority']||0});
				this.resolveLastPriority(statuses,callbackType);
			}
			status = this.getFormat();
			if (typeof status[callbackType] !== 'undefined' || (getAll && thing.formatData[getAll])) {
				statuses.push({status: status, callback: status[callbackType], statusData: this.formatData, end: function(){}, thing: thing, priority: status[callbackType+'Priority']||0});
				this.resolveLastPriority(statuses,callbackType);
			}
			if (bubbleDown) {
				statuses = statuses.concat(this.getRelevantEffectsInner(this.p1, callbackType,null,null,false,true, getAll));
				statuses = statuses.concat(this.getRelevantEffectsInner(this.p2, callbackType,null,null,false,true, getAll));
			}
			return statuses;
		}

		if (thing.digimon) {
			for (var i in thing.sideConditions) {
				status = thing.getSideCondition(i);
				if (typeof status[callbackType] !== 'undefined' || (getAll && thing.sideConditions[i][getAll])) {
					statuses.push({status: status, callback: status[callbackType], statusData: thing.sideConditions[i], end: thing.removeSideCondition, thing: thing});
					this.resolveLastPriority(statuses,callbackType);
				}
			}
			if (foeCallbackType) {
				statuses = statuses.concat(this.getRelevantEffectsInner(thing.foe, foeCallbackType,null,null,false,false, getAll));
			}
			if (bubbleUp) {
				statuses = statuses.concat(this.getRelevantEffectsInner(this, callbackType,null,null,true,false, getAll));
			}
			if (bubbleDown) {
				for (var i=0;i<thing.active.length;i++) {
					statuses = statuses.concat(this.getRelevantEffectsInner(thing.active[i], callbackType,null,null,false,true, getAll));
				}
			}
			return statuses;
		}

		if (thing.fainted) return statuses;
		if (!thing.getStatus) {
			this.debug(JSON.stringify(thing));
			return statuses;
		}
		var status = thing.getStatus();
		if (typeof status[callbackType] !== 'undefined' || (getAll && thing.statusData[getAll])) {
			statuses.push({status: status, callback: status[callbackType], statusData: thing.statusData, end: thing.clearStatus, thing: thing});
			this.resolveLastPriority(statuses,callbackType);
		}
		for (var i in thing.volatiles) {
			status = thing.getVolatile(i);
			if (typeof status[callbackType] !== 'undefined' || (getAll && thing.volatiles[i][getAll])) {
				statuses.push({status: status, callback: status[callbackType], statusData: thing.volatiles[i], end: thing.removeVolatile, thing: thing});
				this.resolveLastPriority(statuses,callbackType);
			}
		}
		status = thing.getAbility();
		if (typeof status[callbackType] !== 'undefined' || (getAll && thing.abilityData[getAll])) {
			statuses.push({status: status, callback: status[callbackType], statusData: thing.abilityData, end: thing.clearAbility, thing: thing});
			this.resolveLastPriority(statuses,callbackType);
		}
		status = thing.getItem();
		if (typeof status[callbackType] !== 'undefined' || (getAll && thing.itemData[getAll])) {
			statuses.push({status: status, callback: status[callbackType], statusData: thing.itemData, end: thing.clearItem, thing: thing});
			this.resolveLastPriority(statuses,callbackType);
		}
		status = this.getEffect(thing.template.baseSpecies);
		if (typeof status[callbackType] !== 'undefined') {
			statuses.push({status: status, callback: status[callbackType], statusData: thing.speciesData, end: function(){}, thing: thing});
			this.resolveLastPriority(statuses,callbackType);
		}

		if (foeThing && foeCallbackType && foeCallbackType.substr(0,8) !== 'onSource') {
			statuses = statuses.concat(this.getRelevantEffectsInner(foeThing, foeCallbackType,null,null,false,false, getAll));
		} else if (foeCallbackType) {
			var foeActive = thing.side.foe.active;
			var allyActive = thing.side.active;
			var eventName = '';
			if (foeCallbackType.substr(0,8) === 'onSource') {
				eventName = foeCallbackType.substr(8);
				if (foeThing) {
					statuses = statuses.concat(this.getRelevantEffectsInner(foeThing, foeCallbackType,null,null,false,false, getAll));
				}
				foeCallbackType = 'onFoe'+eventName;
				foeThing = null;
			}
			if (foeCallbackType.substr(0,5) === 'onFoe') {
				eventName = foeCallbackType.substr(5);
				for (var i=0; i<allyActive.length; i++) {
					statuses = statuses.concat(this.getRelevantEffectsInner(allyActive[i], 'onAlly'+eventName,null,null,false,false, getAll));
					statuses = statuses.concat(this.getRelevantEffectsInner(allyActive[i], 'onAny'+eventName,null,null,false,false, getAll));
				}
				for (var i=0; i<foeActive.length; i++) {
					statuses = statuses.concat(this.getRelevantEffectsInner(foeActive[i], 'onAny'+eventName,null,null,false,false, getAll));
				}
			}
			for (var i=0; i<foeActive.length; i++) {
				statuses = statuses.concat(this.getRelevantEffectsInner(foeActive[i], foeCallbackType,null,null,false,false, getAll));
			}
		}
		if (bubbleUp) {
			statuses = statuses.concat(this.getRelevantEffectsInner(thing.side, callbackType, foeCallbackType, null, true, false, getAll));
		}
		return statuses;
	};
	Battle.prototype.getDigimon = function(id) {
		if (typeof id !== 'string') id = id.id;
		for (var i=0; i<this.p1.digimon.length; i++) {
			var digimon = this.p1.digimon[i];
			if (digimon.id === id) return digimon;
		}
		for (var i=0; i<this.p2.digimon.length; i++) {
			var digimon = this.p2.digimon[i];
			if (digimon.id === id) return digimon;
		}
		return null;
	};
	Battle.prototype.makeRequest = function(type, requestDetails) {
		if (!this.p1.isActive || !this.p2.isActive) {
			return;
		}
		if (type) {
			this.currentRequest = type;
			this.rqid++;
			this.p1.decision = null;
			this.p2.decision = null;
		} else {
			type = this.currentRequest;
		}
		this.update();

		// default to no request
		var p1request = null;
		var p2request = null;
		this.p1.currentRequest = '';
		this.p2.currentRequest = '';

		switch (type) {
		case 'switch':
			var switchablesLeft = 0;
			var switchTable = null;
			function canSwitch(a) {
				return !a.fainted;
			}
			function shouldSwitch(a) {
				if (!a) return false;
				if (!switchablesLeft) {
					a.switchFlag = false;
					return false;
				}
				if (a.switchFlag) switchablesLeft--;
				return !!a.switchFlag;
			}

			switchablesLeft = this.p1.digimon.slice(this.p1.active.length).count(canSwitch);
			switchTable = this.p1.active.map(shouldSwitch);
			if (switchTable.any(true)) {
				this.p1.currentRequest = 'switch';
				p1request = {forceSwitch: switchTable, side: this.p1.getData(), rqid: this.rqid};
			}
			switchablesLeft = this.p2.digimon.slice(this.p2.active.length).count(canSwitch);
			switchTable = this.p2.active.map(shouldSwitch);
			if (switchTable.any(true)) {
				this.p2.currentRequest = 'switch';
				p2request = {forceSwitch: switchTable, side: this.p2.getData(), rqid: this.rqid};
			}
			break;

		case 'teampreview':
			this.add('teampreview'+(requestDetails?'|'+requestDetails:''));
			this.p1.currentRequest = 'teampreview';
			p1request = {teamPreview: true, side: this.p1.getData(), rqid: this.rqid};
			this.p2.currentRequest = 'teampreview';
			p2request = {teamPreview: true, side: this.p2.getData(), rqid: this.rqid};
			break;

		default:
			var activeData;
			this.p1.currentRequest = 'move';
			activeData = this.p1.active.map(function(digimon) {
				if (digimon) return digimon.getRequestData();
			});
			p1request = {active: activeData, side: this.p1.getData(), rqid: this.rqid};

			this.p2.currentRequest = 'move';
			activeData = this.p2.active.map(function(digimon) {
				if (digimon) return digimon.getRequestData();
			});
			p2request = {active: activeData, side: this.p2.getData(), rqid: this.rqid};
			break;
		}

		if (this.p1 && this.p2) {
			var inactiveSide = -1;
			if (p1request && !p2request) {
				inactiveSide = 0;
			} else if (!p1request && p2request) {
				inactiveSide = 1;
			}
			if (inactiveSide !== this.inactiveSide) {
				this.send('inactiveside', inactiveSide);
				this.inactiveSide = inactiveSide;
			}
		}

		if (p1request) {
			this.p1.emitRequest(p1request);
		} else {
			this.p1.decision = true;
			this.p1.emitRequest({wait: true, side: this.p1.getData()});
		}

		if (p2request) {
			this.p2.emitRequest(p2request);
		} else {
			this.p2.decision = true;
			this.p2.emitRequest({wait: true, side: this.p2.getData()});
		}

		if (this.p2.decision && this.p1.decision) {
			if (this.p2.decision === true && this.p1.decision === true) {
				if (type !== 'move') {
					// TODO: investigate this race condition; should be fixed
					// properly later
					return this.makeRequest('move');
				}
				this.add('html', '<div class="broadcast-red"><b>The battle crashed</b></div>');
				this.win();
			} else {
				// some kind of weird race condition?
				this.commitDecisions();
			}
			return;
		}

		this.add('callback', 'decision');
	};
	Battle.prototype.tie = function() {
		this.win();
	};
	Battle.prototype.win = function(side) {
		if (this.ended) {
			return false;
		}
		if (side === 'p1' || side === 'p2') {
			side = this[side];
		} else if (side !== this.p1 && side !== this.p2) {
			side = null;
		}
		this.winner = side?side.name:'';

		this.add('');
		if (side) {
			this.add('win', side.name);
		} else {
			this.add('tie');
		}
		this.ended = true;
		this.active = false;
		this.currentRequest = '';
		return true;
	};
	Battle.prototype.switchIn = function(digimon, pos) {
		if (!digimon || digimon.isActive) return false;
		if (!pos) pos = 0;
		var side = digimon.side;
		if (side.active[pos]) {
			var oldActive = side.active[pos];
			var lastMove = null;
			lastMove = this.getMove(oldActive.lastMove);
		}
		this.runEvent('BeforeSwitchIn', digimon);
		if (side.active[pos]) {
			var oldActive = side.active[pos];
			oldActive.isActive = false;
			oldActive.isStarted = false;
			oldActive.position = digimon.position;
			digimon.position = pos;
			side.digimon[digimon.position] = digimon;
			side.digimon[oldActive.position] = oldActive;
			oldActive.clearVolatile();
		}
		side.active[pos] = digimon;
		digimon.isActive = true;
		digimon.activeTurns = 0;
		for (var m in digimon.moveset) {
			digimon.moveset[m].used = false;
		}
		this.add('switch', side.active[pos], side.active[pos].getDetails);
		digimon.update();
		this.runEvent('SwitchIn', digimon);
		this.addQueue({digimon: digimon, choice: 'runSwitch'});
	};
	Battle.prototype.canSwitch = function(side) {
		var canSwitchIn = [];
		for (var i=side.active.length; i<side.digimon.length; i++) {
			var digimon = side.digimon[i];
			if (!digimon.fainted) {
				canSwitchIn.push(digimon);
			}
		}
		return canSwitchIn.length;
	};
	Battle.prototype.faint = function(digimon, source, effect) {
		digimon.faint(source, effect);
	};
	Battle.prototype.nextTurn = function() {
		this.turn++;
		for (var i=0; i<this.sides.length; i++) {
			for (var j=0; j<this.sides[i].active.length; j++) {
				var digimon = this.sides[i].active[j];
				if (!digimon) continue;
				digimon.moveThisTurn = '';
				digimon.usedItemThisTurn = false;
				digimon.newlySwitched = false;
				if (digimon.lastAttackedBy) {
					digimon.lastAttackedBy.thisTurn = false;
				}
				digimon.activeTurns++;
			}
			this.sides[i].faintedLastTurn = this.sides[i].faintedThisTurn;
			this.sides[i].faintedThisTurn = false;
			this.sides[i].ds += Math.floor(this.sides[i].ds * 10 / 100);
		}
		this.add('turn', this.turn);
		this.makeRequest('move');
	};
	Battle.prototype.start = function() {
		if (this.active) return;

		if (!this.p1 || !this.p1.isActive || !this.p2 || !this.p2.isActive) {
			// need two players to start
			return;
		}

		this.p2.emitRequest({side: this.p2.getData()});
		this.p1.emitRequest({side: this.p1.getData()});

		if (this.started) {
			this.makeRequest();
			this.isActive = true;
			this.activeTurns = 0;
			return;
		}
		this.isActive = true;
		this.activeTurns = 0;
		this.started = true;
		this.p2.foe = this.p1;
		this.p1.foe = this.p2;

		this.add('gametype', this.gameType);

		var format = this.getFormat();
		Tools.mod(format.mod).getBanlistTable(format); // fill in format ruleset

		this.add('tier', format.name);
		if (this.rated) {
			this.add('rated');
		}
		if (format && format.ruleset) {
			for (var i=0; i<format.ruleset.length; i++) {
				this.addPseudoWeather(format.ruleset[i]);
			}
		}

		if (!this.p1.digimon[0] || !this.p2.digimon[0]) {
			this.add('message', 'Battle not started: One of you has an empty team.');
			return;
		}

		this.residualEvent('TeamPreview');

		this.addQueue({choice:'start'});
		this.midTurn = true;
		if (!this.currentRequest) this.go();
	};
	Battle.prototype.boost = function(boost, target, source, effect) {
		if (this.event) {
			if (!target) target = this.event.target;
			if (!source) source = this.event.source;
			if (!effect) effect = this.effect;
		}
		if (!target || !target.hp) return 0;
		effect = this.getEffect(effect);
		boost = this.runEvent('Boost', target, source, effect, Object.clone(boost));
		var success = false;
		for (var i in boost) {
			var currentBoost = {};
			currentBoost[i] = boost[i];
			if (boost[i] !== 0 && target.boostBy(currentBoost)) {
				success = true;
				var msg = '-boost';
				if (boost[i] < 0) {
					msg = '-unboost';
					boost[i] = -boost[i];
				}
				switch (effect.id) {
				case 'intimidate':
					this.add(msg, target, i, boost[i]);
					break;
				default:
					if (effect.effectType === 'Move') {
						this.add(msg, target, i, boost[i]);
					} else {
						this.add(msg, target, i, boost[i], '[from] '+effect.fullname);
					}
					break;
				}
				this.runEvent('AfterEachBoost', target, source, effect, currentBoost);
			}
		}
		this.runEvent('AfterBoost', target, source, effect, boost);
		return success;
	};
	Battle.prototype.damage = function(damage, target, source, effect) {
		if (this.event) {
			if (!target) target = this.event.target;
			if (!source) source = this.event.source;
			if (!effect) effect = this.effect;
		}
		if (!target || !target.hp) return 0;
		effect = this.getEffect(effect);
		if (!(damage || damage === 0)) return damage;
		if (damage !== 0) damage = clampIntRange(damage, 1);

		if (effect.id !== 'struggle-recoil') { // Struggle recoil is not affected by effects
			damage = this.runEvent('Damage', target, source, effect, damage);
			if (!(damage || damage === 0)) {
				this.debug('damage event failed');
				return damage;
			}
		}
		if (damage !== 0) damage = clampIntRange(damage, 1);
		damage = target.damage(damage, source, effect);
		if (source) source.lastDamage = damage;
		var name = effect.fullname;
		if (effect.effectType === 'Move') {
			this.add('-damage', target, target.getHealth);
		} else if (source && source !== target) {
			this.add('-damage', target, target.getHealth, '[from] '+effect.fullname, '[of] '+source);
		} else {
			this.add('-damage', target, target.getHealth, '[from] '+name);
		}

		if (effect.recoil && source) {
			this.damage(clampIntRange(Math.round(damage * effect.recoil[0] / effect.recoil[1]), 1), source, target, 'recoil');
		}
		if (effect.drain && source) {
			this.heal(Math.ceil(damage * effect.drain[0] / effect.drain[1]), source, target, 'drain');
		}

		if (target.fainted) this.faint(target);
		else {
			damage = this.runEvent('AfterDamage', target, source, effect, damage);
			if (effect && !effect.negateSecondary) {
				this.runEvent('Secondary', target, source, effect);
			}
		}
		return damage;
	};
	Battle.prototype.directDamage = function(damage, target, source, effect) {
		if (this.event) {
			if (!target) target = this.event.target;
			if (!source) source = this.event.source;
			if (!effect) effect = this.effect;
		}
		if (!target || !target.hp) return 0;
		if (!damage) return 0;
		damage = clampIntRange(damage, 1);

		damage = target.damage(damage, source, effect);
		switch (effect.id) {
		case 'strugglerecoil':
			this.add('-damage', target, target.getHealth, '[from] recoil');
			break;
		default:
			this.add('-damage', target, target.getHealth);
			break;
		}
		if (target.fainted) this.faint(target);
		return damage;
	};
	Battle.prototype.heal = function(damage, target, source, effect) {
		if (this.event) {
			if (!target) target = this.event.target;
			if (!source) source = this.event.source;
			if (!effect) effect = this.effect;
		}
		effect = this.getEffect(effect);
		if (damage && damage <= 1) damage = 1;
		damage = Math.floor(damage);
		// for things like Liquid Ooze, the Heal event still happens when nothing is healed.
		damage = this.runEvent('TryHeal', target, source, effect, damage);
		if (!damage) return 0;
		if (!target || !target.hp) return 0;
		if (target.hp >= target.maxhp) return 0;
		damage = target.heal(damage, source, effect);
		switch (effect.id) {
		case 'leechseed':
		case 'rest':
			this.add('-heal', target, target.getHealth, '[silent]');
			break;
		case 'drain':
			this.add('-heal', target, target.getHealth, '[from] drain', '[of] '+source);
			break;
		case 'wish':
			break;
		default:
			if (effect.effectType === 'Move') {
				this.add('-heal', target, target.getHealth);
			} else if (source && source !== target) {
				this.add('-heal', target, target.getHealth, '[from] '+effect.fullname, '[of] '+source);
			} else {
				this.add('-heal', target, target.getHealth, '[from] '+effect.fullname);
			}
			break;
		}
		this.runEvent('Heal', target, source, effect, damage);
		return damage;
	};
	Battle.prototype.modify = function(value, numerator, denominator) {
		// You can also use:
		// modify(value, [numerator, denominator])
		// modify(value, fraction) - assuming you trust JavaScript's floating-point handler
		if (!denominator) denominator = 1;
		if (numerator && numerator.length) {
			denominator = numerator[1];
			numerator = numerator[0];
		}
		var modifier = Math.floor(numerator*4096/denominator);
		return Math.floor((value * modifier + 2048 - 1) / 4096);
	};
	Battle.prototype.getCategory = function(move) {
		move = this.getMove(move);
		return move.category || 'Physical';
	};
	Battle.prototype.getDamage = function(digimon, target, move, suppressMessages) {
		if (typeof move === 'string') move = this.getMove(move);
		if (typeof move === 'number') move = {
			basePower: move,
			type: '???',
			category: 'Physical'
		};

		if (move.affectedByImmunities) {
			if (!target.runImmunity(move.type, true)) {
				return false;
			}
		}


		if (!move.basePowerMultiplier && move.category !== 'Status') {
			move.basePowerMultiplier = this.runEvent('BasePowerMultiplier', digimon, target, move, 1);
			if (move.basePowerMultiplier != 1) this.debug('multiplier: '+move.basePowerMultiplier);
		}

		if (move.damageCallback) {
			return move.damageCallback.call(this, digimon, target);
		}
		if (move.damage === 'level') {
			return digimon.level;
		}
		if (move.damage) {
			return move.damage;
		}

		if (!move) move = {};
		if (!move.type) move.type = 'Neutral';
		var type = move.type;
		var basePower = move.basePower;
		if (move.basePowerCallback) {
			basePower = move.basePowerCallback.call(this, digimon, target, move);
		}
		if (!basePower) {
			if (basePower === 0) return; // returning undefined means not dealing damage
			return basePower;
		}
		basePower = clampIntRange(basePower, 1);

		move.crit = move.willCrit || false;
		if (typeof move.willCrit === 'undefined') {
			move.crit = ((Math.floor(Math.random() * 100)) <= parseInt(digimon.getStat('ct')));
		}
		if (move.crit) move.crit = this.runEvent('CriticalHit', target, null, move);

		// happens after crit calculation
		if (basePower) {
			basePower = this.singleEvent('BasePower', move, null, digimon, target, move, basePower);
			basePower = this.runEvent('BasePower', digimon, target, move, basePower);

			if (move.basePowerMultiplier && move.basePowerMultiplier != 1) {
				basePower = this.modify(basePower, move.basePowerMultiplier);
			}
			if (move.basePowerModifier) {
				basePower = this.modify(basePower, move.basePowerModifier);
			}
		}
		if (!basePower) return 0;
		basePower = clampIntRange(basePower, 1);

		var level = digimon.level;

		var attacker = digimon;
		var defender = target;
		var rankTable = {'Baby':1,'In-Training':2,'Rookie':3,'Champion':4,'Ultimate':5,'Mega':6,'Burst':7,'Jogress':8};
		var rankNum = rankTable[digimon.stage] || 1;
		var baseDamage = Math.ceil(attacker.getStat('AT') * basePower / (35 * Math.log(90 * attacker.getStat('DE')) * 0.065 * Math.pow(2, (rankNum * 1.05))));

		// Crit
		if (move.crit) {
			if (!suppressMessages) this.add('-crit', target);
			baseDamage = Math.floor(baseDamage * 1.5);
		}

		// Randomizer
		baseDamage = Math.floor(baseDamage * (100 - this.random(16)) / 100);

		// Elemental power
		var totalTypeMod = this.getElementalEffectiveness(move.type, target);
		if (totalTypeMod > 0) {
			if (!suppressMessages) this.add('-supereffective', target);
			baseDamage = Math.floor(baseDamage + (baseDamage * totalTypeMod / 100));
		}
		if (totalTypeMod < 0) {
			if (!suppressMessages) this.add('-resisted', target);
			baseDamage = Math.floor(baseDamage + (baseDamage * totalTypeMod / 100));
		}

		// Attribute power
		var totalAttrMod = this.getAttributeEffectiveness(digimon.attribute, target);
		if (totalAttrMod > 0) {
			if (!suppressMessages) this.add('-supereffective', target);
			baseDamage = Math.floor(baseDamage + (baseDamage * totalAttrMod / 100));
		}

		if (basePower && !Math.floor(baseDamage)) {
			return 1;
		}

		// Final modifier. Modifiers that modify damage after min damage check.
		baseDamage = this.runEvent('ModifyDamage', digimon, target, move, baseDamage);

		return Math.floor(baseDamage);
	};
	/**
	 * Returns whether a proposed target for a move is valid.
	 */
	Battle.prototype.validTargetLoc = function(targetLoc, source, targetType) {
		var numSlots = source.side.active.length;
		if (!Math.abs(targetLoc) && Math.abs(targetLoc) > numSlots) return false;

		var sourceLoc = -(source.position+1);
		var isFoe = (targetLoc > 0);
		var isAdjacent = (isFoe ? Math.abs(-(numSlots+1-targetLoc)-sourceLoc)<=1 : Math.abs(targetLoc-sourceLoc)<=1);
		var isSelf = (sourceLoc === targetLoc);

		switch (targetType) {
		case 'melee':
		case 'normal':
			return isAdjacent && !isSelf;
		case 'any':
		case 'ranged':
			return !isSelf;
		}
		return false;
	};
	Battle.prototype.validTarget = function(target, source, targetType) {
		var targetLoc;
		if (target.side == source.side) {
			targetLoc = -(target.position+1);
		} else {
			targetLoc = target.position+1;
		}
		return this.validTargetLoc(targetLoc, source, targetType);
	};
	Battle.prototype.getTarget = function(decision) {
		var move = this.getMove(decision.move);
		var target;
		if ((move.target !== 'randomNormal') &&
				this.validTargetLoc(decision.targetLoc, decision.digimon, move.target)) {
			if (decision.targetLoc > 0) {
				target = decision.digimon.side.foe.active[decision.targetLoc-1];
			} else {
				target = decision.digimon.side.active[(-decision.targetLoc)-1];
			}
			if (target && !target.fainted) return target;
		}
		if (!decision.targetPosition || !decision.targetSide) {
			target = this.resolveTarget(decision.digimon, decision.move);
			decision.targetSide = target.side;
			decision.targetPosition = target.position;
		}
		return decision.targetSide.active[decision.targetPosition];
	};
	Battle.prototype.resolveTarget = function(digimon, move) {
		move = this.getMove(move);
		if (move.target === 'adjacentAlly' && digimon.side.active.length > 1) {
			if (digimon.side.active[digimon.position-1]) {
				return digimon.side.active[digimon.position-1];
			}
			else if (digimon.side.active[digimon.position+1]) {
				return digimon.side.active[digimon.position+1];
			}
		}
		if (move.target === 'self' || move.target === 'all' || move.target === 'allySide' || move.target === 'allyTeam' || move.target === 'adjacentAlly' || move.target === 'adjacentAllyOrSelf') {
			return digimon;
		}
		return digimon.side.foe.randomActive() || digimon.side.foe.active[0];
	};
	Battle.prototype.checkFainted = function() {
		function isFainted(a) {
			if (!a) return false;
			if (a.fainted) {
				a.switchFlag = true;
				return true;
			}
			return false;
		}
		// make sure these don't get short-circuited out; all switch flags need to be set
		var p1fainted = this.p1.active.map(isFainted);
		var p2fainted = this.p2.active.map(isFainted);
	};
	Battle.prototype.faintMessages = function() {
		while (this.faintQueue.length) {
			var faintData = this.faintQueue.shift();
			if (!faintData.target.fainted) {
				this.add('faint', faintData.target);
				this.runEvent('Faint', faintData.target, faintData.source, faintData.effect);
				faintData.target.fainted = true;
				faintData.target.isActive = false;
				faintData.target.isStarted = false;
				faintData.target.side.digimonLeft--;
				faintData.target.side.faintedThisTurn = true;
			}
		}
		if (!this.p1.digimonLeft && !this.p2.digimonLeft) {
			this.win();
			return true;
		}
		if (!this.p1.digimonLeft) {
			this.win(this.p2);
			return true;
		}
		if (!this.p2.digimonLeft) {
			this.win(this.p1);
			return true;
		}
		return false;
	};
	Battle.prototype.addQueue = function(decision, noSort, side) {
		if (decision) {
			if (Array.isArray(decision)) {
				for (var i=0; i<decision.length; i++) {
					this.addQueue(decision[i], noSort);
				}
				return;
			}
			if (decision.choice === 'pass') return;
			if (!decision.side && side) decision.side = side;
			if (!decision.side && decision.digimon) decision.side = decision.digimon.side;
			if (!decision.choice && decision.move) decision.choice = 'move';
			if (!decision.priority) {
				var priorities = {
					'beforeTurn': 100,
					'beforeTurnMove': 99,
					'switch': 6,
					'runSwitch': 6.1,
					'residual': -100,
					'team': 102,
					'start': 101
				};
				if (priorities[decision.choice]) {
					decision.priority = priorities[decision.choice];
				}
			}
			if (decision.choice === 'move') {
				if (this.getMove(decision.move).beforeTurnCallback) {
					this.addQueue({choice: 'beforeTurnMove', digimon: decision.digimon, move: decision.move}, true);
				}
			} else if (decision.choice === 'switch') {
				if (decision.digimon.switchFlag && decision.digimon.switchFlag !== true) {
					decision.digimon.switchCopyFlag = decision.digimon.switchFlag;
				}
				decision.digimon.switchFlag = false;
				if (!decision.speed && decision.digimon && decision.digimon.isActive) decision.speed = decision.digimon.speed;
			}
			if (decision.move) {
				var target;

				if (!decision.targetPosition) {
					target = this.resolveTarget(decision.digimon, decision.move);
					decision.targetSide = target.side;
					decision.targetPosition = target.position;
				}

				decision.move = this.getMove(decision.move);
				if (!decision.priority) {
					var priority = decision.move.priority;
					priority = this.runEvent('ModifyPriority', decision.digimon, target, decision.move, priority);
					decision.priority = priority;
				}
			}
			if (!decision.digimon && !decision.speed) decision.speed = 1;
			if (!decision.speed && decision.choice === 'switch' && decision.target) decision.speed = decision.target.speed;
			if (!decision.speed) decision.speed = decision.digimon.speed;

			if (decision.choice === 'switch' && !decision.side.digimon[0].isActive) {
				// if there's no actives, switches happen before activations
				decision.priority = 6.2;
			}

			this.queue.push(decision);
		}
		if (!noSort) {
			this.queue.sort(Battle.comparePriority);
		}
	};
	Battle.prototype.prioritizeQueue = function(decision, source, sourceEffect) {
		if (this.event) {
			if (!source) source = this.event.source;
			if (!sourceEffect) sourceEffect = this.effect;
		}
		for (var i=0; i<this.queue.length; i++) {
			if (this.queue[i] === decision) {
				this.queue.splice(i,1);
				break;
			}
		}
		decision.sourceEffect = sourceEffect;
		this.queue.unshift(decision);
	};
	Battle.prototype.willAct = function() {
		for (var i=0; i<this.queue.length; i++) {
			if (this.queue[i].choice === 'move' || this.queue[i].choice === 'switch') {
				return this.queue[i];
			}
		}
		return null;
	};
	Battle.prototype.willMove = function(digimon) {
		for (var i=0; i<this.queue.length; i++) {
			if (this.queue[i].choice === 'move' && this.queue[i].digimon === digimon) {
				return this.queue[i];
			}
		}
		return null;
	};
	Battle.prototype.cancelDecision = function(digimon) {
		var success = false;
		for (var i=0; i<this.queue.length; i++) {
			if (this.queue[i].digimon === digimon) {
				this.queue.splice(i,1);
				i--;
				success = true;
			}
		}
		return success;
	};
	Battle.prototype.cancelMove = function(digimon) {
		for (var i=0; i<this.queue.length; i++) {
			if (this.queue[i].choice === 'move' && this.queue[i].digimon === digimon) {
				this.queue.splice(i,1);
				return true;
			}
		}
		return false;
	};
	Battle.prototype.willSwitch = function(digimon) {
		for (var i=0; i<this.queue.length; i++) {
			if (this.queue[i].choice === 'switch' && this.queue[i].digimon === digimon) {
				return true;
			}
		}
		return false;
	};
	Battle.prototype.runDecision = function(decision) {
		// returns whether or not we ended in a callback
		switch (decision.choice) {
		case 'start':
			var beginCallback = this.getFormat().onBegin;
			if (beginCallback) beginCallback.call(this);

			this.add('start');
			for (var pos=0; pos<this.p1.active.length; pos++) {
				this.switchIn(this.p1.digimon[pos], pos);
			}
			for (var pos=0; pos<this.p2.active.length; pos++) {
				this.switchIn(this.p2.digimon[pos], pos);
			}
			for (var pos=0; pos<this.p1.digimon.length; pos++) {
				var digimon = this.p1.digimon[pos];
				this.singleEvent('Start', this.getEffect(digimon.species), digimon.speciesData, digimon);
			}
			for (var pos=0; pos<this.p2.digimon.length; pos++) {
				var digimon = this.p2.digimon[pos];
				this.singleEvent('Start', this.getEffect(digimon.species), digimon.speciesData, digimon);
			}
			this.midTurn = true;
			break;
		case 'move':
			if (!decision.digimon.isActive) return false;
			if (decision.digimon.fainted) return false;
			this.runMove(decision.move, decision.digimon, this.getTarget(decision), decision.sourceEffect);
			break;
		case 'beforeTurnMove':
			if (!decision.digimon.isActive) return false;
			if (decision.digimon.fainted) return false;
			this.debug('before turn callback: '+decision.move.id);
			decision.move.beforeTurnCallback.call(this, decision.digimon, this.getTarget(decision));
			break;
		case 'event':
			this.runEvent(decision.event, decision.digimon);
			break;
		case 'team':
			var i = parseInt(decision.team[0], 10)-1;
			if (i >= 6 || i < 0) return;

			if (decision.team[1]) {
				// validate the choice
				var len = decision.side.digimon.length;
				var newdigimon = [null,null,null,null,null,null].slice(0, len);
				for (var j=0; j<len; j++) {
					var i = parseInt(decision.team[j], 10)-1;
					newdigimon[j] = decision.side.digimon[i];
				}
				var reject = false;
				for (var j=0; j<len; j++) {
					if (!newdigimon[j]) reject = true;
				}
				if (!reject) {
					for (var j=0; j<len; j++) {
						newdigimon[j].position = j;
					}
					decision.side.digimon = newdigimon;
					return;
				}
			}

			if (i == 0) return;
			var digimon = decision.side.digimon[i];
			if (!digimon) return;
			decision.side.digimon[i] = decision.side.digimon[0];
			decision.side.digimon[0] = digimon;
			decision.side.digimon[i].position = i;
			decision.side.digimon[0].position = 0;
			return;
			// we return here because the update event would crash since there are no active digimon yet
			break;
		case 'switch':
			if (decision.digimon) {
				decision.digimon.beingCalledBack = true;
				var lastMove = this.getMove(decision.digimon.lastMove);
				if (lastMove.selfSwitch !== 'copyvolatile') {
					this.runEvent('BeforeSwitchOut', decision.digimon);
				}
			}
			if (decision.digimon && !decision.digimon.hp && !decision.digimon.fainted) {
				this.debug('A Digimon can\'t switch between when it runs out of HP and when it faints');
				break;
			}
			if (decision.target.isActive) {
				this.debug('Switch target is already active');
				break;
			}
			this.switchIn(decision.target, decision.digimon.position);
			//decision.target.runSwitchIn();
			break;
		case 'runSwitch':
			decision.digimon.isStarted = true;
			this.singleEvent('Start', decision.digimon.getAbility(), decision.digimon.abilityData, decision.digimon);
			this.singleEvent('Start', decision.digimon.getItem(), decision.digimon.itemData, decision.digimon);
			break;
		case 'beforeTurn':
			this.eachEvent('BeforeTurn');
			break;
		case 'residual':
			this.add('');
			this.clearActiveMove(true);
			this.residualEvent('Residual');
			break;
		}
		this.clearActiveMove();

		// phazing (Roar, etc)

		var self = this;
		function checkForceSwitchFlag(a) {
			if (!a) return false;
			if (a.hp && a.forceSwitchFlag) {
				self.dragIn(a.side, a.position);
			}
			delete a.forceSwitchFlag;
		}
		this.p1.active.forEach(checkForceSwitchFlag);
		this.p2.active.forEach(checkForceSwitchFlag);

		// fainting

		this.faintMessages();
		if (this.ended) return true;

		// switching (fainted digimon, U-turn, Baton Pass, etc)

		if (!this.queue.length) this.checkFainted();

		function hasSwitchFlag(a) { return a?a.switchFlag:false; }
		function removeSwitchFlag(a) { if (a) a.switchFlag = false; }
		var p1switch = this.p1.active.any(hasSwitchFlag);
		var p2switch = this.p2.active.any(hasSwitchFlag);

		if (p1switch && !this.canSwitch(this.p1)) {
			this.p1.active.forEach(removeSwitchFlag);
			p1switch = false;
		}
		if (p2switch && !this.canSwitch(this.p2)) {
			this.p2.active.forEach(removeSwitchFlag);
			p2switch = false;
		}

		if (p1switch || p2switch) {
			this.makeRequest('switch');
			return true;
		}

		this.eachEvent('Update');

		return false;
	};
	Battle.prototype.go = function() {
		this.add('');
		if (this.currentRequest) {
			this.currentRequest = '';
		}

		if (!this.midTurn) {
			this.queue.push({choice:'residual', priority: -100});
			this.queue.push({choice:'beforeTurn', priority: 100});
			this.midTurn = true;
		}
		this.addQueue(null);

		var currentPriority = 6;

		while (this.queue.length) {
			var decision = this.queue.shift();

			/* while (decision.priority < currentPriority && currentPriority > -6) {
				this.eachEvent('Priority', null, currentPriority);
				currentPriority--;
			} */

			this.runDecision(decision);

			if (this.currentRequest) {
				return;
			}

			// if (!this.queue.length || this.queue[0].choice === 'runSwitch') {
			// 	if (this.faintMessages()) return;
			// }

			if (this.ended) return;
		}

		this.nextTurn();
		this.midTurn = false;
		this.queue = [];
	};
	/**
	 * Changes a digimon's decision.
	 *
	 * The un-modded game should not use this function for anything,
	 * since it rerolls speed ties (which messes up RNG state).
	 *
	 * You probably want the OverrideDecision event (which doesn't
	 * change priority order).
	 */
	Battle.prototype.changeDecision = function(digimon, decision) {
		this.cancelDecision(digimon);
		if (!decision.digimon) decision.digimon = digimon;
		this.addQueue(decision);
	};
	/**
	 * Takes a choice string passed from the client. Starts the next
	 * turn if all required choices have been made.
	 */
	Battle.prototype.choose = function(sideid, choice, rqid) {
		var side = null;
		if (sideid === 'p1' || sideid === 'p2') side = this[sideid];
		// This condition should be impossible because the sideid comes
		// from our forked process and if the player id were invalid, we would
		// not have even got to this function.
		if (!side) return; // wtf

		// This condition can occur if the client sends a decision at the
		// wrong time.
		if (!side.currentRequest) return;

		// Make sure the decision is for the right request.
		if ((rqid !== undefined) && (parseInt(rqid, 10) !== this.rqid)) {
			return;
		}

		// It should be impossible for choice not to be a string. Choice comes
		// from splitting the string sent by our forked process, not from the
		// client. However, just in case, we maintain this check for now.
		if (typeof choice === 'string') choice = choice.split(',');

		side.decision = this.parseChoice(choice, side);

		if (this.p1.decision && this.p2.decision) {
			this.commitDecisions();
		}
	};
	Battle.prototype.commitDecisions = function() {
		if (this.p1.decision !== true) {
			this.addQueue(this.p1.decision, true, this.p1);
		}
		if (this.p2.decision !== true) {
			this.addQueue(this.p2.decision, true, this.p2);
		}

		this.currentRequest = '';
		this.p1.currentRequest = '';
		this.p2.currentRequest = '';

		this.p1.decision = true;
		this.p2.decision = true;

		this.go();
	};
	Battle.prototype.undoChoice = function(sideid) {
		var side = null;
		if (sideid === 'p1' || sideid === 'p2') side = this[sideid];
		// The following condition can never occur for the reasons given in
		// the choose() function above.
		if (!side) return; // wtf
		// This condition can occur.
		if (!side.currentRequest) return;

		if (side.decision && side.decision.finalDecision) {
			this.debug("Can't cancel decision: the last digimon could have been trapped");
			return;
		}

		side.decision = false;
	};
	/**
	 * Parses a choice string passed from a client into a decision object
	 * usable by PS's engine.
	 *
	 * Choice validation is also done here.
	 */
	Battle.prototype.parseChoice = function(choices, side) {
		var prevSwitches = {};
		if (!side.currentRequest) return true;

		if (typeof choices === 'string') choices = choices.split(',');

		var decisions = [];
		var len = choices.length;
		if (side.currentRequest === 'move') len = side.active.length;
		for (var i=0; i<len; i++) {
			var choice = (choices[i]||'').trim();

			var data = '';
			var firstSpaceIndex = choice.indexOf(' ');
			if (firstSpaceIndex >= 0) {
				data = choice.substr(firstSpaceIndex+1).trim();
				choice = choice.substr(0, firstSpaceIndex).trim();
			}

			switch (side.currentRequest) {
			case 'teampreview':
				if (choice !== 'team' || i > 0) return false;
				break;
			case 'move':
				if (i >= side.active.length) return false;
				if (!side.digimon[i] || side.digimon[i].fainted) {
					decisions.push({
						choice: 'pass'
					});
					continue;
				}
				if (choice !== 'move' && choice !== 'switch') {
					if (i === 0) return false;
					choice = 'move';
					data = '1';
				}
				break;
			case 'switch':
				if (i >= side.active.length) return false;
				if (!side.active[i] || !side.active[i].switchFlag) {
					if (choice !== 'pass') choices.splice(i, 0, 'pass');
					decisions.push({
						choice: 'pass'
					});
					continue;
				}
				if (choice !== 'switch') return false;
				break;
			default:
				return false;
			}

			var decision = null;
			switch (choice) {
			case 'team':
				decisions.push({
					choice: 'team',
					side: side,
					team: data
				});
				break;

			case 'switch':
				if (i > side.active.length || i > side.digimon.length) continue;
				if (side.currentRequest === 'move') {
					if (side.digimon[i].trapped) {
						//this.debug("Can't switch: The active digimon is trapped");
						side.emitCallback('trapped', i);
						return false;
					} else if (side.digimon[i].maybeTrapped) {
						var finalDecision = true;
						for (var j = i + 1; j < side.active.length; ++j) {
							if (side.active[j] && !side.active[j].fainted) {
								finalDecision = false;
							}
						}
						decisions.finalDecision = decisions.finalDecision || finalDecision;
					}
				}

				data = parseInt(data, 10)-1;
				if (data < 0) data = 0;
				if (data > side.digimon.length-1) data = side.digimon.length-1;

				if (!side.digimon[data]) {
					this.debug("Can't switch: You can't switch to a digimon that doesn't exist");
					return false;
				}
				if (data == i) {
					this.debug("Can't switch: You can't switch to yourself");
					return false;
				}
				if (this.battleType !== 'triples' && data < side.active.length) {
					this.debug("Can't switch: You can't switch to an active digimon except in triples");
					return false;
				}
				if (side.digimon[data].fainted) {
					this.debug("Can't switch: You can't switch to a fainted digimon");
					return false;
				}
				if (prevSwitches[data]) {
					this.debug("Can't switch: You can't switch to digimon already queued to be switched");
					return false;
				}
				prevSwitches[data] = true;

				decisions.push({
					choice: 'switch',
					digimon: side.digimon[i],
					target: side.digimon[data]
				});
				break;

			case 'move':
				var targetLoc = 0;

				if (data.substr(data.length-2) === ' 1') targetLoc = 1;
				if (data.substr(data.length-2) === ' 2') targetLoc = 2;
				if (data.substr(data.length-2) === ' 3') targetLoc = 3;
				if (data.substr(data.length-3) === ' -1') targetLoc = -1;
				if (data.substr(data.length-3) === ' -2') targetLoc = -2;
				if (data.substr(data.length-3) === ' -3') targetLoc = -3;

				if (targetLoc) data = data.substr(0, data.lastIndexOf(' '));

				var digimon = side.digimon[i];
				var validMoves = digimon.getValidMoves();
				var moveid = '';
				if (data.search(/^[0-9]+$/) >= 0) {
					moveid = validMoves[parseInt(data, 10) - 1];
				} else {
					moveid = toId(data);
					if (moveid.substr(0, 11) === 'hiddenpower') {
						moveid = 'hiddenpower';
					}
					if (validMoves.indexOf(moveid) < 0) {
						moveid = '';
					}
				}
				if (!moveid) {
					moveid = validMoves[0];
				}

				decisions.push({
					choice: 'move',
					digimon: digimon,
					targetLoc: targetLoc,
					move: moveid
				});
				break;
			}
		}
		return decisions;
	};
	Battle.prototype.add = function() {
		var parts = Array.prototype.slice.call(arguments);
		var functions = parts.map(function(part) {
			return typeof part === 'function';
		});
		if (functions.indexOf(true) < 0) {
			this.log.push('|'+parts.join('|'));
		} else {
			this.log.push('|split');
			var sides = this.sides.concat(null, true);
			for (var i = 0; i < sides.length; ++i) {
				var line = '';
				for (var j = 0; j < parts.length; ++j) {
					line += '|';
					if (functions[j]) {
						line += parts[j](sides[i]);
					} else {
						line += parts[j];
					}
				}
				this.log.push(line);
			}
		}
	};
	Battle.prototype.addMove = function() {
		this.lastMoveLine = this.log.length;
		this.log.push('|'+Array.prototype.slice.call(arguments).join('|'));
	};
	Battle.prototype.attrLastMove = function() {
		this.log[this.lastMoveLine] += '|'+Array.prototype.slice.call(arguments).join('|');
	};
	Battle.prototype.debug = function(activity) {
		if (this.getFormat().debug) {
			this.add('debug', activity);
		}
	};
	Battle.prototype.debugError = function(activity) {
		this.add('debug', activity);
	};

	// players
	Battle.prototype.join = function(slot, name, avatar, team) {
		if (this.p1 && this.p1.isActive && this.p2 && this.p2.isActive) return false;
		if ((this.p1 && this.p1.isActive && this.p1.name === name) || (this.p2 && this.p2.isActive && this.p2.name === name)) return false;
		if (this.p1 && this.p1.isActive || slot === 'p2') {
			if (this.started) {
				this.p2.name = name;
			} else {
				//console.log("NEW SIDE: "+name);
				this.p2 = new BattleSide(name, this, 1, team);
				this.sides[1] = this.p2;
			}
			if (avatar) this.p2.avatar = avatar;
			this.p2.isActive = true;
			this.add('player', 'p2', this.p2.name, avatar);
		} else {
			if (this.started) {
				this.p1.name = name;
			} else {
				//console.log("NEW SIDE: "+name);
				this.p1 = new BattleSide(name, this, 0, team);
				this.sides[0] = this.p1;
			}
			if (avatar) this.p1.avatar = avatar;
			this.p1.isActive = true;
			this.add('player', 'p1', this.p1.name, avatar);
		}
		this.start();
		return true;
	};
	Battle.prototype.rename = function(slot, name, avatar) {
		if (slot === 'p1' || slot === 'p2') {
			var side = this[slot];
			side.name = name;
			if (avatar) side.avatar = avatar;
			this.add('player', slot, name, side.avatar);
		}
	};
	Battle.prototype.leave = function(slot) {
		if (slot === 'p1' || slot === 'p2') {
			var side = this[slot];
			if (!side) {
				console.log('**** '+slot+' tried to leave before it was possible in '+this.id);
				require('./crashlogger.js')({stack: '**** '+slot+' tried to leave before it was possible in '+this.id}, 'A simulator process');
				return;
			}

			side.emitRequest(null);
			side.isActive = false;
			this.add('player', slot);
			this.active = false;
		}
		return true;
	};

	// IPC

	// Messages sent by this function are received and handled in
	// App.prototype.receive in simulator.js (in another process).
	Battle.prototype.send = function(type, data) {
		if (Array.isArray(data)) data = data.join("\n");
		process.send(this.id+"\n"+type+"\n"+data);
	};
	// This function is called by this process's 'message' event.
	Battle.prototype.receive = function(data, more) {
		this.messageLog.push(data.join(' '));
		var logPos = this.log.length;
		var alreadyEnded = this.ended;
		switch (data[1]) {
		case 'join':
			var team = null;
			try {
				if (more) team = JSON.parse(more);
			} catch (e) {
				console.log('TEAM PARSE ERROR: '+more);
				team = null;
			}
			this.join(data[2], data[3], data[4], team);
			break;

		case 'rename':
			this.rename(data[2], data[3], data[4]);
			break;

		case 'leave':
			this.leave(data[2]);
			break;

		case 'chat':
			this.add('chat', data[2], more);
			break;

		case 'win':
		case 'tie':
			this.win(data[2]);
			break;

		case 'choose':
			this.choose(data[2], data[3], data[4]);
			break;

		case 'undo':
			this.undoChoice(data[2]);
			break;

		case 'eval':
			var battle = this;
			var p1 = this.p1;
			var p2 = this.p2;
			var p1active = p1?p1.active[0]:null;
			var p2active = p2?p2.active[0]:null;
			data[2] = data[2].replace(/\f/g, '\n');
			this.add('', '>>> '+data[2]);
			try {
				this.add('', '<<< '+eval(data[2]));
			} catch (e) {
				this.add('', '<<< error: '+e.message);
			}
			break;
		}

		this.sendUpdates(logPos, alreadyEnded);
	};
	Battle.prototype.sendUpdates = function(logPos, alreadyEnded) {
		if (this.p1 && this.p2) {
			var inactiveSide = -1;
			if (!this.p1.isActive && this.p2.isActive) {
				inactiveSide = 0;
			} else if (this.p1.isActive && !this.p2.isActive) {
				inactiveSide = 1;
			} else if (!this.p1.decision && this.p2.decision) {
				inactiveSide = 0;
			} else if (this.p1.decision && !this.p2.decision) {
				inactiveSide = 1;
			}
			if (inactiveSide !== this.inactiveSide) {
				this.send('inactiveside', inactiveSide);
				this.inactiveSide = inactiveSide;
			}
		}

		if (this.log.length > logPos) {
			if (alreadyEnded !== undefined && this.ended && !alreadyEnded) {
				if (this.rated) {
					var log = {
						turns: this.turn,
						p1: this.p1.name,
						p2: this.p2.name,
						p1team: this.p1.team,
						p2team: this.p2.team,
						log: this.log
					}
					this.send('log', JSON.stringify(log));
				}
				this.send('winupdate', [this.winner].concat(this.log.slice(logPos)));
			} else {
				this.send('update', this.log.slice(logPos));
			}
		}
	};

	Battle.prototype.destroy = function() {
		// deallocate ourself

		// deallocate children and get rid of references to them
		for (var i=0; i<this.sides.length; i++) {
			if (this.sides[i]) this.sides[i].destroy();
			this.sides[i] = null;
		}
		this.p1 = null;
		this.p2 = null;
		for (var i=0; i<this.queue.length; i++) {
			delete this.queue[i].digimon;
			delete this.queue[i].side;
			this.queue[i] = null;
		}
		this.queue = null;

		// in case the garbage collector really sucks, at least deallocate the log
		this.log = null;

		// remove from battle list
		Battles[this.id] = null;
	};
	return Battle;
})();

exports.BattleDigimon = BattleDigimon;
exports.BattleSide = BattleSide;
exports.Battle = Battle;
