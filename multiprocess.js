/**
 * Multiprocess abstraction layer
 * Digibrawl - http://www.digibrawl.com/
 *
 * This file abstracts away Digibrawl's multi-process model.
 * You can basically include this file, use its API, and pretend
 * Digibrawl is just one big happy process.
 *
 * For the actual battle, see battle-engine.js
 * 
 * @license MIT license
 */

var processes = {};

var AppProcess = (function() {
	function AppProcess() {
		this.process = require('child_process').fork('battle-engine.js');
		this.process.on('message', function(message) {
			var lines = message.split('\n');
			var sim = processes[lines[0]];
			if (sim) {
				sim.receive(lines);
			}
		});
		this.send = this.process.send.bind(this.process);
	}
	AppProcess.prototype.load = 0;
	AppProcess.prototype.active = true;
	AppProcess.processes = [];
	AppProcess.spawn = function() {
		var num = config.simulatorprocesses || 1;
		for (var i = 0; i < num; ++i) {
			this.processes.push(new AppProcess());
		}
	};
	AppProcess.respawn = function() {
		this.processes.splice(0).forEach(function(process) {
			process.active = false;
			if (!process.load) process.process.disconnect();
		});
		this.spawn();
	};
	AppProcess.acquire = function() {
		var process = this.processes[0];
		for (var i = 1; i < this.processes.length; ++i) {
			if (this.processes[i].load < process.load) {
				process = this.processes[i];
			}
		}
		++process.load;
		return process;
	};
	AppProcess.release = function(process) {
		--process.load;
		if (!process.load && !process.active) {
			process.process.disconnect();
		}
	};
	AppProcess.eval = function(code) {
		this.processes.forEach(function(process) {
			process.send('|eval|' + code);
		});
	};
	return AppProcess;
})();

// Create the initial set of simulator processes.
AppProcess.spawn();

var slice = Array.prototype.slice;

var App = (function(){
	function App(id, format, rated, room) {
		if (processes[id]) {
			// ???
			return;
		}

		this.id = id;
		this.room = room;
		this.format = toId(format);
		this.players = [null, null];
		this.playerids = [null, null];
		this.playerTable = {};
		this.requests = {};

		this.process = AppProcess.acquire();

		processes[id] = this;

		this.send('init', this.format, rated?'1':'');
	}

	App.prototype.id = '';

	App.prototype.started = false;
	App.prototype.ended = false;
	App.prototype.active = true;
	App.prototype.players = null;
	App.prototype.playerids = null;
	App.prototype.playerTable = null;
	App.prototype.format = null;
	App.prototype.room = null;

	App.prototype.requests = null;

	// log information
	App.prototype.logData = null;
	App.prototype.endType = 'normal';

	App.prototype.getFormat = function() {
		return Tools.getFormat(this.format);
	};
	App.prototype.send = function() {
		this.process.send(''+this.id+'|'+slice.call(arguments).join('|'));
	};
	App.prototype.sendFor = function(user, action) {
		var player = this.playerTable[toUserid(user)];
		if (!player) {
			console.log('SENDFOR FAILED: Player doesn\'t exist: '+user.name)
			return;
		}

		this.send.apply(this, [action, player].concat(slice.call(arguments, 2)));
	};
	App.prototype.sendForOther = function(user, action) {
		var opposite = {'p1':'p2', 'p2':'p1'}
		var player = this.playerTable[toUserid(user)];
		if (!player) return;

		this.send.apply(this, [action, opposite[player]].concat(slice.call(arguments, 2)));
	};

	App.prototype.rqid = '';
	App.prototype.inactiveQueued = false;
	App.prototype.receive = function(lines) {
		switch (lines[1]) {
		case 'update':
			this.active = !this.ended && this.p1 && this.p2;
			this.room.push(lines.slice(2));
			this.room.update();
			if (this.inactiveQueued) {
				this.room.nextInactive();
				this.inactiveQueued = false;
			}
			break;

		case 'winupdate':
			this.started = true;
			this.ended = true;
			this.active = false;
			this.room.push(lines.slice(3));
			this.room.win(lines[2]);
			this.inactiveSide = -1;
			break;

		case 'callback':
			var player = this.getPlayer(lines[2]);
			if (player) {
				player.sendTo(this.id, '|callback|' + lines[3]);
			}
			break;

		case 'request':
			var player = this.getPlayer(lines[2]);
			var rqid = lines[3];
			if (player) {
				this.requests[player.userid] = lines[4];
				player.sendTo(this.id, '|request|'+lines[4]);
			}
			if (rqid !== this.rqid) {
				this.rqid = rqid;
				this.inactiveQueued = true;
			}
			break;

		case 'log':
			this.logData = JSON.parse(lines[2]);
			break;

		case 'inactiveside':
			this.inactiveSide = parseInt(lines[2], 10);
			break;
		}
	};

	App.prototype.resendRequest = function(user) {
		if (this.requests[user.userid]) {
			user.sendTo(this.id, '|request|'+this.requests[user.userid]);
		}
	};
	App.prototype.win = function(user) {
		if (!user) {
			this.tie();
			return;
		}
		this.sendFor(user, 'win');
	};
	App.prototype.lose = function(user) {
		this.sendForOther(user, 'win');
	};
	App.prototype.tie = function() {
		this.send('tie');
	};
	App.prototype.chat = function(user, message) {
		this.send('chat', user.name+"\n"+message);
	};

	App.prototype.isEmpty = function() {
		if (this.p1) return false;
		if (this.p2) return false;
		return true;
	};

	App.prototype.isFull = function() {
		if (this.p1 && this.p2) return true;
		return false;
	};

	App.prototype.setPlayer = function(user, slot) {
		if (this.players[slot]) {
			delete this.players[slot].battles[this.id];
		}
		if (user) {
			user.battles[this.id] = true;
		}
		this.players[slot] = (user || null);
		var oldplayerid = this.playerids[slot];
		if (oldplayerid) {
			if (user) {
				this.requests[user.userid] = this.requests[oldplayerid];
			}
			delete this.requests[oldplayerid];
		}
		this.playerids[slot] = (user ? user.userid : null);
		this.playerTable = {};
		this.active = !this.ended;
		for (var i=0, len=this.players.length; i<len; i++) {
			var player = this.players[i];
			this['p'+(i+1)] = player?player.name:'';
			if (!player) {
				this.active = false;
				continue;
			}
			this.playerTable[player.userid] = 'p'+(i+1);
		}
	};
	App.prototype.getPlayer = function(slot) {
		if (typeof slot === 'string') {
			if (slot.substr(0,1) === 'p') {
				slot = parseInt(slot.substr(1),10)-1;
			} else {
				slot = parseInt(slot, 10);
			}
		}
		return this.players[slot];
	};
	App.prototype.getSlot = function(player) {
		return this.players.indexOf(player);
	};

	App.prototype.join = function(user, slot, team) {
		if (slot === undefined) {
			slot = 0;
			while (this.players[slot]) slot++;
		}
		// console.log('joining: '+user.name+' '+slot);
		if (this.players[slot] || slot >= this.players.length) return false;

		this.setPlayer(user, slot);

		var teamMessage = '';
		if (!this.started) {
			teamMessage = "\n"+JSON.stringify(team);
		}
		if (this.p1 && this.p2) this.started = true;
		this.sendFor(user, 'join', user.name, user.avatar+teamMessage);
		return true;
	};

	App.prototype.rename = function() {
		for (var i=0, len=this.players.length; i<len; i++) {
			var player = this.players[i];
			var playerid = this.playerids[i];
			if (!player) continue;
			if (player.userid !== playerid) {
				this.setPlayer(player, i);
				this.sendFor(player, 'rename', player.name, player.avatar);
			}
		}
	};

	App.prototype.leave = function(user) {
		for (var i=0, len=this.players.length; i<len; i++) {
			var player = this.players[i];
			if (player === user) {
				this.sendFor(user, 'leave');
				this.setPlayer(null, i);
				return true;
			}
		}
		return false;
	};

	App.prototype.destroy = function() {
		this.send('dealloc');

		this.players = null;
		this.room = null;
		AppProcess.release(this.process);
		this.process = null;
		delete processes[this.id];
	};

	return App;
})();

exports.App = App;
exports.processes = processes;
exports.AppProcess = AppProcess;

exports.create = function(id, format, rated, room) {
	if (processes[id]) return processes[id];
	return new App(id, format, rated, room);
};
