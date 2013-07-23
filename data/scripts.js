exports.BattleScripts = {
	runMove: function(move, digimon, target, sourceEffect) {
		if (!sourceEffect) {
			var changedMove = this.runEvent('OverrideDecision', digimon);
			if (changedMove && changedMove !== true) {
				move = changedMove;
				target = null;
			}
		}
		move = this.getMove(move);
		if (!target) target = this.resolveTarget(digimon, move);

		this.setActiveMove(move, digimon, target);

		if (digimon.moveThisTurn) {
			// THIS IS PURELY A SANITY CHECK
			this.debug(''+digimon.id+' INCONSISTENT STATE, ALREADY MOVED: '+digimon.moveThisTurn);
			this.clearActiveMove(true);
			return;
		}
		if (!this.runEvent('BeforeMove', digimon, target, move)) {
			this.clearActiveMove(true);
			return;
		}
		if (move.beforeMoveCallback) {
			if (move.beforeMoveCallback.call(this, digimon, target, move)) {
				this.clearActiveMove(true);
				return;
			}
		}
		digimon.lastDamage = 0;
		var lockedMove = this.runEvent('LockMove', digimon);
		if (lockedMove === true) lockedMove = false;
		if (!lockedMove) {
			if (!digimon.deductDS(move, null, target)) {
				this.add('cant', digimon, 'nods', move);
				this.clearActiveMove(true);
				return;
			}
		}
		digimon.moveUsed(move);
		this.useMove(move, digimon, target, sourceEffect);
		this.singleEvent('AfterMove', move, null, digimon, target, move);
		this.runEvent('AfterMove', target, digimon, move);
		this.runEvent('AfterMoveSelf', digimon, target, move);
	},
	useMove: function(move, digimon, target, sourceEffect) {
		if (!sourceEffect && this.effect.id) sourceEffect = this.effect;
		move = this.getMove(move);
		baseMove = move;
		move = this.getMoveCopy(move);
		if (!target) target = this.resolveTarget(digimon, move);
		if (move.target === 'self' || move.target === 'allies') {
			target = digimon;
		}
		if (sourceEffect) move.sourceEffect = sourceEffect.id;

		this.setActiveMove(move, digimon, target);

		this.singleEvent('ModifyMove', move, null, digimon, target, move, move);
		if (baseMove.target !== move.target) {
			//Target changed in ModifyMove, so we must adjust it here
			target = this.resolveTarget(digimon, move);
		}
		move = this.runEvent('ModifyMove',digimon,target,move,move);
		if (baseMove.target !== move.target) {
			//check again
			target = this.resolveTarget(digimon, move);
		}
		if (!move) return false;

		var attrs = '';
		var missed = false;
		if (digimon.fainted) return false;

		if (move.isTwoTurnMove && !digimon.volatiles[move.id]) {
			attrs = '|[still]'; // suppress the default move animation
		}

		var movename = move.name;
		if (sourceEffect) attrs += '|[from]'+this.getEffect(sourceEffect);
		this.addMove('move', digimon, movename, target+attrs);

		if (!this.singleEvent('Try', move, null, digimon, target, move)) {
			return true;
		}
		if (!this.runEvent('TryMove', digimon, target, move)) {
			return true;
		}

		var damage = false;
		if (move.target === 'all' || move.target === 'foeSide' || move.target === 'allySide' || move.target === 'allyTeam') {
			if (move.target === 'all') {
				damage = this.runEvent('TryHitField', target, digimon, move);
			} else {
				damage = this.runEvent('TryHitSide', target, digimon, move);
			}
			if (!damage) {
				if (damage === false) this.add('-fail', target);
				return true;
			}
			damage = this.moveHit(target, digimon, move);
		} else if (move.target === 'allAdjacent' || move.target === 'allAdjacentFoes') {
			var targets = [];
			if (move.target === 'allAdjacent') {
				var allyActive = digimon.side.active;
				for (var i=0; i<allyActive.length; i++) {
					if (allyActive[i] && Math.abs(i-digimon.position)<=1 && i != digimon.position && !allyActive[i].fainted) {
						targets.push(allyActive[i]);
					}
				}
			}
			var foeActive = digimon.side.foe.active;
			var foePosition = foeActive.length-digimon.position-1;
			for (var i=0; i<foeActive.length; i++) {
				if (foeActive[i] && Math.abs(i-foePosition)<=1 && !foeActive[i].fainted) {
					targets.push(foeActive[i]);
				}
			}
			if (!targets.length) {
				this.attrLastMove('[notarget]');
				this.add('-notarget');
				return true;
			}
			if (targets.length > 1) move.spreadHit = true;
			damage = 0;
			for (var i=0; i<targets.length; i++) {
				damage += (this.tryMoveHit(targets[i], digimon, move, true) || 0);
			}
			if (!digimon.hp) digimon.faint();
		} else {
			if (target.fainted && target.side !== digimon.side) {
				// if a targeted foe faints, the move is retargeted
				target = this.resolveTarget(digimon, move);
			}
			if (target.fainted) {
				this.attrLastMove('[notarget]');
				this.add('-notarget');
				return true;
			}
			if (target.side.active.length > 1) {
				target = this.runEvent('RedirectTarget', digimon, digimon, move, target);
			}
			damage = this.tryMoveHit(target, digimon, move);
		}
		if (!digimon.hp) {
			this.faint(digimon, digimon, move);
		}

		if (!damage && damage !== 0 && damage !== undefined) {
			this.singleEvent('MoveFail', move, null, target, digimon, move);
			return true;
		}

		if (move.selfdestruct) {
			this.faint(digimon, digimon, move);
		}

		if (!move.negateSecondary) {
			this.singleEvent('AfterMoveSecondarySelf', move, null, digimon, target, move);
			this.runEvent('AfterMoveSecondarySelf', digimon, target, move);
		}
		return true;
	},
	tryMoveHit: function(target, digimon, move, spreadHit) {
		this.setActiveMove(move, digimon, target);
		var hitResult = true;

		if (typeof move.affectedByImmunities === 'undefined') {
			move.affectedByImmunities = (move.category !== 'Status');
		}

		hitResult = this.runEvent('TryHit', target, digimon, move);
		if (!hitResult) {
			if (hitResult === false) this.add('-fail', target);
			return false;
		}

		var boostTable = [1, 4/3, 5/3, 2, 7/3, 8/3, 3];

		// calculate true accuracy
		if (move.alwaysHit) {
			accuracy = true; // bypasses accuracy modifiers
		} else {
			accuracy = this.runEvent('Accuracy', target, digimon, move, accuracy);
		}
		if (accuracy !== true && this.random(100) >= accuracy) {
			if (!spreadHit) this.attrLastMove('[miss]');
			this.add('-miss', digimon, target);
			return false;
		}

		var damage = 0;
		digimon.lastDamage = 0;
		damage = this.moveHit(target, digimon, move);

		if (target && move.category !== 'Status') target.gotAttacked(move, damage, digimon);

		if (!damage && damage !== 0) return damage;

		if (target && !move.negateSecondary) {
			this.singleEvent('AfterMoveSecondary', move, null, target, digimon, move);
			this.runEvent('AfterMoveSecondary', target, digimon, move);
		}

		return damage;
	},
	moveHit: function(target, digimon, move, moveData, isSecondary, isSelf) {
		var damage = 0;
		move = this.getMoveCopy(move);

		if (!moveData) moveData = move;
		var hitResult = true;

		// TryHit events:
		//   STEP 1: we see if the move will succeed at all:
		//   - TryHit, TryHitSide, or TryHitField are run on the move,
		//     depending on move target (these events happen in useMove
		//     or tryMoveHit, not below)
		//   == primary hit line ==
		//   Everything after this only happens on the primary hit (not on
		//   secondary or self-hits)
		//   STEP 2: we see if anything blocks the move from hitting:
		//   - TryFieldHit is run on the target
		//   STEP 3: we see if anything blocks the move from hitting the target:
		//   - If the move's target is a digimon, TryHit is run on that digimon

		// Note:
		//   If the move target is `foeSide`:
		//     event target = digimon 0 on the target side
		//   If the move target is `allySide` or `all`:
		//     event target = the move user
		//
		//   This is because events can't accept actual sides or fields as
		//   targets. Choosing these event targets ensures that the correct
		//   side or field is hit.
		//
		//   It is the `TryHitField` event handler's responsibility to never
		//   use `target`.
		//   It is the `TryFieldHit` event handler's responsibility to read
		//   move.target and react accordingly.
		//   An exception is `TryHitSide` as a single event (but not as a normal
		//   event), which is passed the target side.

		if (move.target === 'all' && !isSelf) {
			hitResult = this.singleEvent('TryHitField', moveData, {}, target, digimon, move);
		} else if ((move.target === 'foeSide' || move.target === 'allySide') && !isSelf) {
			hitResult = this.singleEvent('TryHitSide', moveData, {}, target.side, digimon, move);
		} else if (target) {
			hitResult = this.singleEvent('TryHit', moveData, {}, target, digimon, move);
		}
		if (!hitResult) {
			if (hitResult === false) this.add('-fail', target);
			return false;
		}

		if (target && !isSecondary && !isSelf) {
			hitResult = this.runEvent('TryPrimaryHit', target, digimon, moveData);
		}
		if (target && isSecondary && !moveData.self) {
			hitResult = this.runEvent('TrySecondaryHit', target, digimon, moveData);
		}
		if (!hitResult) {
			return false;
		}

		if (target) {
			var didSomething = false;

			damage = this.getDamage(digimon, target, moveData);

			// getDamage has several possible return values:
			//
			//   a number:
			//     means that much damage is dealt (0 damage still counts as dealing
			//     damage for the purposes of things like Static)
			//   false:
			//     gives error message: "But it failed!" and move ends
			//   null:
			//     the move ends, with no message (usually, a custom fail message
			//     was already output by an event handler)
			//   undefined:
			//     means no damage is dealt and the move continues
			//
			// basically, these values have the same meanings as they do for event
			// handlers.

			if ((damage || damage === 0) && !target.fainted) {
				if (move.noFaint && damage >= target.hp) {
					damage = target.hp - 1;
				}
				damage = this.damage(damage, target, digimon, move);
				if (!(damage || damage === 0)) {
					this.debug('damage interrupted');
					return false;
				}
				didSomething = true;
			}
			if (damage === false || damage === null) {
				if (damage === false) {
					this.add('-fail', target);
				}
				this.debug('damage calculation interrupted');
				return false;
			}

			if (moveData.boosts && !target.fainted) {
				hitResult = this.boost(moveData.boosts, target, digimon, move);
				didSomething = didSomething || hitResult;
			}
			if (moveData.heal && !target.fainted) {
				var d = target.heal(Math.round(target.maxhp * moveData.heal[0] / moveData.heal[1]));
				if (!d && d !== 0) {
					this.add('-fail', target);
					this.debug('heal interrupted');
					return false;
				}
				this.add('-heal', target, target.getHealth);
				didSomething = true;
			}
			if (moveData.volatileStatus) {
				hitResult = target.addVolatile(moveData.volatileStatus, digimon, move);
				didSomething = didSomething || hitResult;
			}
			if (moveData.sideCondition) {
				hitResult = target.side.addSideCondition(moveData.sideCondition, digimon, move);
				didSomething = didSomething || hitResult;
			}
			// Hit events
			//   These are like the TryHit events, except we don't need a FieldHit event.
			//   Scroll up for the TryHit event documentation, and just ignore the "Try" part. ;)
			hitResult = null;
			if (move.target === 'all' && !isSelf) {
				if (moveData.onHitField) hitResult = this.singleEvent('HitField', moveData, {}, target, digimon, move);
			} else if ((move.target === 'foeSide' || move.target === 'allySide') && !isSelf) {
				if (moveData.onHitSide) hitResult = this.singleEvent('HitSide', moveData, {}, target.side, digimon, move);
			} else {
				if (moveData.onHit) hitResult = this.singleEvent('Hit', moveData, {}, target, digimon, move);
				if (!isSelf && !isSecondary) {
					this.runEvent('Hit', target, digimon, move);
				}
			}

			if (!hitResult && !didSomething && !moveData.self) {
				if (!isSelf && !isSecondary) {
					if (hitResult === false || didSomething === false) this.add('-fail', target);
				}
				this.debug('move failed because it did nothing');
				return false;
			}
		}
		if (moveData.self) {
			this.moveHit(digimon, digimon, move, moveData.self, isSecondary, true);
		}
		if (moveData.secondaries) {
			var secondaryRoll;
			for (var i = 0; i < moveData.secondaries.length; i++) {
				secondaryRoll = this.random(100);
				if (typeof moveData.secondaries[i].chance === 'undefined' || secondaryRoll < moveData.secondaries[i].chance) {
					this.moveHit(target, digimon, move, moveData.secondaries[i], true, isSelf);
				}
			}
		}
		return damage;
	},
	isAdjacent: function(digimon1, digimon2) {
		if (!digimon1.fainted && !digimon2.fainted && digimon2.position !== digimon1.position && Math.abs(digimon2.position-digimon1.position) <= 1) {
			return true;
		}
	},
	getTeam: function(side, team) {
		var format = side.battle.getFormat();
		if (format.team === 'random') {
			return this.randomTeam(side);
		} else if (typeof format.team === 'string' && format.team.substr(0,6) === 'random') {
			return this[format.team+'Team'](side);
		} else if (team) {
			return team;
		} else {
			return this.randomTeam(side);
		}
	},
	randomTeam: function(side) {
		var teamnum = [];
		var team = [];

		// Pick three random Digimon
		for (var i=0; i<3; i++) {
			while (true) {
				var x=Math.floor(Math.random()*1152)+1;
				if (teamnum.indexOf(x) === -1) {
					teamnum.push(x);
					break;
				}
			}
		}
		for (var i=0; i<3; i++) {
			var digi = formes.sample();
			var template = this.getTemplate(digi);

			// Level balance
			var mbstmin = 1000;
			var stats = template.baseStats;

			var mbst = (stats["as"])+10;
			mbst += (stats["ds"])+5;
			mbst += (stats["at"])+5;
			mbst += (stats["de"])+5;
			mbst += (stats["ct"])+5;
			mbst += (stats["ev"])+5;
			mbst += (stats["ht"])+5;
			mbst += (stats["bl"])+5;	
			var level = Math.floor(100*mbstmin/mbst);

			// Random item
			var item = Object.keys(this.data.Items).sample();

			//four random unique moves from movepool. don't worry about "attacking" or "viable"
			var moves;
			var pool = [];
			pool = Object.keys(template.learnset);
			if (pool.length <= 4) {
				moves = pool;
			} else {
				moves = pool.sample(4);
			}

			team.push({
				name: digi,
				moves: moves,
				item: item,
				level: level
			});
		}

		return team;
	}
};
