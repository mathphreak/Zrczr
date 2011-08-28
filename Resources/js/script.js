var Coordinate = goog.math.Coordinate;
var Vector = goog.math.Vec2;
var cos = Math.cos;
var sin = Math.sin;

var Zrczr = {};

Zrczr.App = {};

Zrczr.App.Backgrounds = {};

Zrczr.Models = {};

var conv = function(corv) {
	// corv is a Coordinate or a Vector.
	if (corv.constructor === Coordinate) {
		// we want a Vector
		return new Vector(corv.x, corv.y);
	} else if (corv.constructor === Vector) {
		// we want a Coordinate
		return new Coordinate(corv.x, corv.y);
	}
}

function makeVector(angle) {
	return new Vector(sin(angle), -cos(angle));
}

Zrczr.App.Server = {
	setup: function() {
		return {
			locX: 0,
			locY: 0
		}
	}
};

Zrczr.Models.Background = Backbone.Model.extend({
	draw: function(context) {
		this.get("draw").call(this, context);
	},
	move: function(context) {}
});

Zrczr.Models.World = Backbone.Model.extend({
	initialize: function() {
		if (!this.get("walls")) { // assume that everything else is missing, too
			function makeCollection(model) {
				var a = Backbone.Collection.extend({
					model: model
				});
				return new a();
			}
			this.set({
				walls: makeCollection(Zrczr.Models.Wall),
				bullets: makeCollection(Zrczr.Models.Bullet)
			});
		}
		this.iterator = function(functor) {
			var funcargs = _.toArray(arguments).slice(1);
			return function(i) {
				i[functor].apply(i, funcargs);
			};
		}
	},
	draw: function(context) {
		var drawIt = this.iterator('draw', context);
		var me = this.get("me");
		context.save();
		context.translate(context.canvas.width / 2, context.canvas.height / 2);
		context.rotate(-me.get("rotation"));
		context.translate(-me.get("location").x, -me.get("location").y);
		Zrczr.App.Background.draw(context);
		this.get("walls").each(drawIt);
		this.get("bullets").each(drawIt);
		me.draw(context);
		context.restore();
	},
	move: function() {
		var moveIt = this.iterator('move');
		this.get("walls").each(moveIt);
		this.get("bullets").each(moveIt);
		if (!!this.get("me")) this.get("me").move();
	},
	die: function() {
		$("#canvas").explode();
	},
	checkWalls: function() {
		var me = this.get("me");
		return _.any(this.get("walls").map(function(w) {
			return collisionDetection(me, w);
		}));
	},
	checkBullets: function(recipient) {
		if (!recipient) {
			recipient = this.get("me");
		}
		return this.get("bullets").detect(function(w) {
			return collisionDetection(w, recipient);
		});
	}
});

Zrczr.Models.Person = Backbone.Model.extend({
	initialize: function() {
		var srv = Zrczr.App.Server.setup();
		var loc = new Coordinate(srv.locX, srv.locY);
		var rot = amplify.store("rotation");
		if (!rot) {
			rot = (Math.random() * 2 * Math.PI);
			rot = Math.floor(rot / (Math.PI / 20)) * (Math.PI / 20);
		}
		var siz = amplify.store("size");
		if (!siz) {
			siz = 5;
			amplify.store("size", siz);
		}
		this.set({
			location: loc,
			rotation: rot,
			size: siz
		});
	},
	draw: function(context) {
		context.save();
		var loc = this.get("location");
		context.translate(loc.x, loc.y);
		context.rotate(this.get("rotation"));
		context.fillStyle = "black";
		var size = this.get("size");
		context.beginPath();
		context.moveTo(-size, size);
		context.lineTo(size, size);
		context.lineTo(size, -size);
		context.lineTo(-size, -size);
		context.closePath();
		context.fill();
		context.fillStyle = "white";
		context.beginPath();
		context.moveTo(size - 1, 0);
		context.lineTo(size - 1, -size + 1);
		context.lineTo(0, -size + 1);
		context.closePath();
		context.fill();
		context.beginPath();
		context.moveTo(-size + 1, 0);
		context.lineTo(-size + 1, -size + 1);
		context.lineTo(0, -size + 1);
		context.closePath();
		context.fill();
		context.restore();
	},
	move: function() {
		var k = Backbone.Keyboard.status;
		var loc = this.get("location");
		var rotation = this.get("rotation");
		hitWall = Zrczr.App.World.checkWalls();
		if (this.targetRot && Math.abs(this.targetRot-rotation) < Math.PI / 20) {
			this.targetRot = undefined;
		}
		if (k.up && !hitWall) {
			var vec = new Vector(sin(rotation), -cos(rotation));
			loc = Coordinate.sum(loc, vec);
		}
		if (k.left || this.targetRot && this.targetRot < rotation) {
			rotation -= Math.PI / 20;
		} else if (k.right || this.targetRot && this.targetRot > rotation) {
			rotation += Math.PI / 20;
		} else if (k.down) {
			this.targetRot = this.lastLeft ? rotation + Math.PI : rotation - Math.PI;
			this.lastLeft = !this.lastLeft;
			k.down = false;
		}
		this.set({
			location: loc,
			rotation: rotation
		});
		if (k.drop && !this.justDropped) {
			Zrczr.App.World.get("walls").add({
				parent: this
			});
			this.justDropped = true;
		} else if (!k.drop) {
			this.justDropped = false;
		}
		if (k.fire && !this.justFired) {
			Zrczr.App.World.get("bullets").add({
				parent: this
			});
			this.justFired = true;
		} else if (!k.fire) {
			this.justFired = false;
		}
		amplify.store("rotation", rotation);
	}
});

Zrczr.Models.Wall = Backbone.Model.extend({
	initialize: function() {
		var parent = this.get("parent");
		var loc = parent.get("location");
		var rotation = parent.get("rotation");
		var parentMovement = new Vector(sin(rotation), -cos(rotation));
		var size = parent.get("size");
		this.set({
			location: Coordinate.difference(loc, parentMovement.scale(size*2 + 2)),
			rotation: rotation,
			size: size
		});
	},
	draw: function(context) {
		var loc = this.get("location");
		var rot = this.get("rotation");
		var size = this.get("size");
		context.save();
		context.translate(loc.x, loc.y);
		context.rotate(rot);
		context.fillStyle = "black";
		context.beginPath();
		context.moveTo(-size, -size);
		context.lineTo(-size, size);
		context.lineTo(size, size);
		context.lineTo(size, -size);
		context.closePath();
		context.fill();
		context.restore();
	},
	move: function() {
		// seems to me this function should be a no-op...
		// but really, it does all the collision detection checking
		var pwned = Zrczr.App.World.checkBullets(this);
		if (!!pwned && !this.death) {
			this.die();
			pwned.die();
		}
		var size = this.get("size");
		if (!!this.death) {
			if ($.now() - this.death > 100) {
				if (size > 0) {
					size--;
					this.set({
						size: size
					});
					this.death = $.now();
				} else {
					this.collection.remove(this);
				}
			}
		}
	},
	die: function() {
		this.death = $.now();
	}
});

Zrczr.Models.Bullet = Backbone.Model.extend({
	initialize: function() {
		var parent = this.get("parent");
		var loc = parent.get("location");
		var rotation = parent.get("rotation");
		var parentMovement = new Vector(sin(rotation), -cos(rotation));
		var parentSize = parent.get("size");
		var size = parentSize;
		if (!!this.get("size")) {
			size = this.get("size");
		}
		this.set({
			location: Coordinate.sum(loc, parentMovement.scale(parentSize*2 + 2)),
			rotation: rotation,
			size: size,
			birth: Date.now()
		});
	},
	draw: function(context) {
		var loc = this.get("location");
		var rot = this.get("rotation");
		var size = this.get("size");
		var anotherFrame = makeVector(rot).scale(2);
		context.save();
		context.translate(loc.x + anotherFrame.x, loc.y + anotherFrame.y);
		context.rotate(rot);
		context.strokeStyle = "black";
		context.beginPath();
		context.moveTo(0, 0);
		context.lineTo(0, -size);
		context.stroke();
		context.restore();
	},
	move: function() {
		var loc = this.get("location");
		var rot = this.get("rotation");
		var anotherFrame = makeVector(rot).scale(2);
		loc = Coordinate.sum(loc, anotherFrame);
		this.set({
			location: loc
		});
	},
	die: function() {
		this.collection.remove(this);
	}
});

Zrczr.App.Backgrounds.Empty = new Zrczr.Models.Background({
	draw: function() {}
});

Zrczr.App.Backgrounds.Axes = new Zrczr.Models.Background({
	draw: function(context) {
		context.strokeStyle = "red"; // x
		context.beginPath();
		context.moveTo(-context.canvas.width, 0);
		context.lineTo(context.canvas.width, 0);
		context.stroke();
		context.strokeStyle = "green"; // y
		context.beginPath();
		context.moveTo(0, -context.canvas.height);
		context.lineTo(0, context.canvas.height);
		context.stroke();
	}
});

Zrczr.App.Backgrounds.Grid = new Zrczr.Models.Background({
	draw: function(context) {
		var limit = 20;
		// draw axes
		Zrczr.App.Backgrounds.Axes.draw(context);
		context.strokeStyle = "silver";
		var width = context.canvas.width;
		var height = context.canvas.height;
		for (var i = -limit; i < limit; i++) {
			// draw horizontal axis
			context.beginPath();
			context.moveTo(-width, i*(height/limit));
			context.lineTo(width, i*(height/limit));
			context.stroke();
			// draw vertical axis
			context.beginPath();
			context.moveTo(i*(width/limit), -height);
			context.lineTo(i*(width/limit), height);
			context.stroke();
		}
	}
});

function collisionDetection(objA, objB) {
	var aLoc = (_.isFunction(objA.get) && objA.get("location") !== undefined) ? objA.get("location") : objA.location;
	var bLoc = (_.isFunction(objB.get) && objB.get("location") !== undefined) ? objB.get("location") : objB.location;
	var aRot = (_.isFunction(objA.get) && objA.get("rotation") !== undefined) ? objA.get("rotation") : objA.rotation;
	var bRot = (_.isFunction(objB.get) && objB.get("rotation") !== undefined) ? objB.get("rotation") : objB.rotation;
	var aSize = (_.isFunction(objA.get) && objA.get("size") !== undefined) ? objA.get("size") : objA.size;
	var bSize = (_.isFunction(objB.get) && objB.get("size") !== undefined) ? objB.get("size") : objB.size;
	var difference = Coordinate.difference(aLoc, bLoc);
	var distSquared = Coordinate.squaredDistance(aLoc, bLoc);
	var distX = Math.abs(difference.x);
	var distY = Math.abs(difference.y);
	var totalSize = aSize + bSize;
	if (distX < totalSize && distY < totalSize) {
		// we're awfully close...but we don't know for sure yet.
		var aVec = new Vector(sin(aRot), -cos(aRot));
		var nextALoc = Coordinate.sum(aLoc, aVec);
		return Coordinate.squaredDistance(nextALoc, bLoc) < distSquared;
	} else if (distX == distY == totalSize) {
		// we have the non-collision:
		/* +---+
		 * | A |
		 * +---+
		 *      +---+
		 *      | B |
		 *      +---+
		 */
		return false;
	} else if (distX == totalSize || distY == totalSize) {
		// we have the not-quite-collision:
		/* +---+
		 * | A | ->
		 * +---+
		 * +---+
		 * | B |
		 * +---+
		 */
		// or we could have the just-barely-collision:
		/*   +---++---+
		 * ->| A || B |
		 *   +---++---+
		 */
		// either way, we can just wait for the next step and see if there's a collision then.
		// but actually, this doesn't work, so we have to do things the hard way.
		var aVec = new Vector(sin(aRot), -cos(aRot));
		var nextALoc = Coordinate.sum(aLoc, aVec);
		return Coordinate.squaredDistance(nextALoc, bLoc) < distSquared;
	} else if (distX > totalSize || distY > totalSize) {
		// we've got plenty of space between A and B...
		return false;
	} else {
		// there's no way in heck this is possible...
		throw new Error("Logical contradiction in collisionDetection()");
	}
}

function canvasWorks(canvas) {
	var context = canvas.getContext("2d");
	function update() {
		Zrczr.App.World.move();
		context.clearRect(0, 0, context.canvas.width, context.canvas.height);
		Zrczr.App.World.draw(context);
		Zrczr.App.FPSStats.update();
		Zrczr.App.MSStats.update();
		requestAnimFrame(update, $("#canvas")[0]);
	}
	update();
}

$(function(){
	Backbone.Keyboard.bindArrowWASD();
	Backbone.Keyboard.keyMeans(' '.charCodeAt(0), 'drop');
	Backbone.Keyboard.keyMeans('Q'.charCodeAt(0), 'fire');
	Backbone.Keyboard.keyMeans('E'.charCodeAt(0), 'fire');
	Zrczr.App.Background = Zrczr.App.Backgrounds.Grid;
	Zrczr.App.World = new Zrczr.Models.World();
	Zrczr.App.World.set({
		me: new Zrczr.Models.Person()
	});
	Zrczr.App.FPSStats = new Stats();
	Zrczr.App.FPSStats.domElement.style.position = 'relative';
	Zrczr.App.MSStats = new Stats();
	Zrczr.App.MSStats.domElement.style.position = 'relative';
	Zrczr.App.MSStats.show('ms');
	$("header").append(Zrczr.App.FPSStats.domElement);
	$("header").append(Zrczr.App.MSStats.domElement);
	var canvas = document.getElementById("canvas");
	if (canvas.getContext) {
		canvasWorks(canvas);
	}
});