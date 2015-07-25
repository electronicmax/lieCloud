/* jshint undef: true, strict:false, trailing:false, unused:false, quotmark:false */
/* global require, exports, console, process, module, L, angular, jQuery, FastClick, device, document, window, setTimeout, $, Keyboard, Backbone */

var express = require('express'),
	url = require('url'),
	session = require('express-session'),
	_ = require('underscore'),
	bodyparser = require('body-parser'),
	bluebird = require('bluebird'),
	mongojs = require("mongojs"),	
	randomwords = require('random-words'),
    db = mongojs('liecloud', ["signup", "questionnaire"]),
	toJSON = function(o) { return JSON.stringify(o); };

// dbs.on('ready',function() { console.log('signup database connected'); });
// dbq.on('ready',function() { console.log('q response database connected'); });

var app = express();
app.use(session({secret:'keyboard cat'}));
app.use(bodyparser.json({limit: '100mb'}));  // to support JSON-encoded bodies
app.get('/', function (req, res) { res.redirect('/index.html'); });

app.post('/api/new_user_reg', 
	function (req, res) { 
		var pid = randomwords(5);
		console.log('new user reg ', req.body);		
		console.log('new participant id ', pid);
		// add mongo stuff here
		res.send(JSON.stringify({pId:pid}));
	});

app.post('/api/questionnaire', 
	function (req, res) { 
		var pId = req.body.pId,
			responses = req.body.responses;
		console.info('pId ', pId, responses);
		if (!pId || !responses) { 
			res.status(401).send(toJSON({error:'wrong params - no pId or responses'}));
			return;
		} 
		res.send(JSON.stringify({pId:pId}));
	});

app.use(express.static('www'));

var server = app.listen(8000, function () {
	var host = server.address().address;
	var port = server.address().port;
	console.log('Example app listening at http://%s:%s', host, port);
});