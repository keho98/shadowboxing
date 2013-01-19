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

var INPUT = "kinectdepth"; 

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
	setUpKinect();
});


/*
 * Starts the connection to the Kinect
 */
function setUpKinect() {
	kinect.sessionPersist()
		  .modal.make('css/knctModal.css')
		  .notif.make();
		  
	kinect.addEventListener('openedSocket', function() {
		startKinect();
	});
}

/*
 * Starts the socket for depth or RGB messages from KinectSocketServer
 */
function startKinect() {
	if (INPUT != "kinectdepth" && INPUT != "kinectrgb") {
		console.log("Asking for incorrect socket from Kinect.");
		return;
	}
	
	if(kinectSocket)
	{
		kinectSocket.send( "KILL" );
		setTimeout(function() {
			kinectSocket.close();
			kinectSocket.onopen = kinectSocket.onmessage = kinectSocket = null;
		}, 300 );
		return false;
	}
	
	// Web sockets
	if (INPUT == "kinectdepth") {
		kinectSocket = kinect.makeDepth(null, true, null);
	} else if (INPUT == "kinectrgb") {
		kinectSocket = kinect.makeRGB(null, true, null);
	}

	kinectSocket.onopen = function() {
	};
	
	kinectSocket.onclose = kinectSocket.onerror = function() {
		kinectSocket.onclose = kinectSocket.onerror = null;
		return false;
	};

	kinectSocket.onmessage = function( e ) {
		if (e.data.indexOf("data:image/jpeg") == 0) {
			var image = new Image();
			image.src = e.data;
			image.onload = function() {
				rawContext.drawImage(image, 0, 0, 640, 480);
			}
			return false;
		}
	};
}

