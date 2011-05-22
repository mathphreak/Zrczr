var Server = {
	setup: function() {
		return {
			locX: 0,
			locY: 0,
			rotation: 0
		}
	}
};

var Person = Backbone.Model.extend({
	initialize: function() {
		var srv = Server.setup();
		var rot = amplify.store("rotation");
		if (!rot) {
			rot = (Math.random() * 2 * Math.PI);
		}
		var col = amplify.store("color");
		if (!col) {
			var colR = Math.random() * 256;
			var colG = Math.random() * 256;
			var colB = Math.random() * 256;
			col = "rgb(" + colR + "," + colG + "," + colB + ")";
		}
		var siz = amplify.store("size");
		if (!siz) {
			siz = 5;
		}
		this.set({
			locX: srv.locX,
			loxY: srv.locY,
			rotation: rot,
			color: col,
			size: siz
		});
	},
	draw: function(context) {
		context.save();
		context.translate(context.canvas.width / 2, context.canvas.height / 2);
		context.rotate(this.get("rotation"));
		context.fillStyle = this.get("color");
		var size = this.get("size");
		context.fillRect(-size, -size, size, size);
		context.restore();
	}
});

var Wall = Backbone.Model.extend({
	draw: function(context) {
		
	}
});

$(function(){
	var canvas = document.getElementById("canvas");
	if (canvas.getContext) {
		var context = canvas.getContext("2d");
		var me = new Person();
		me.draw(context);
	}
});