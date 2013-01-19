/**
 * primal | me: CS 247 P2
 * team members: 
 * 		Sarah Nader, Kevin Ho
 *		Lilith Wu, Victora Flores
 * -------------------------------
 * 
 *
 *
 *
 */

function ripple(){
	var canvas = document.getElementById('scream-ripples');
	var width = $('#container').width();
	var height = $('#container').height();
	console.log(width);
	console.log(height);
	if(!isCanvasSupported()){
		console.log("canvas is not supported");
	}
    if (canvas.getContext){
    	var ctx = canvas.getContext('2d');
    	 ctx.canvas.width  = width;
 		 ctx.canvas.height = height;
   	} else {
   		console.log("canvas not working");
   	}
}

function isCanvasSupported(){
  var elem = document.createElement('canvas');
  return !!(elem.getContext && elem.getContext('2d'));
}

$(document).ready(function() {
	ripple();
});
