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
//		context.rotate(-me.get("rotation"));
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
	checkBullets: function() {
		var me = this.get("me");
		return _.any(this.get("bullets").map(function(w) {
			return collisionDetection(me, w);
		}));
	}
});

Zrczr.Models.Person = Backbone.Model.extend({
	initialize: function() {
		var srv = Zrczr.App.Server.setup();
		var loc = new Coordinate(srv.locX, srv.locY);
		var rot = amplify.store("rotation");
		if (!rot) {
			rot = (Math.random() * 2 * Math.PI);
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
		if (k.up && !hitWall) {
			var vec = new Vector(sin(rotation), -cos(rotation));
			loc = Coordinate.sum(loc, vec);
		}
		if (k.left) {
			rotation -= Math.PI / 20;
		} else if (k.right) {
			rotation += Math.PI / 20;
		} else if (k.down) {
			rotation += Math.PI;
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
		var size2 = 2*size;
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
	move: function() {}
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