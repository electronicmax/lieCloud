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
    db = mongojs('liecloud', ["signups", "questionnaire"]),
	toJSON = function(o) { return JSON.stringify(o); };

var app = express();
app.use(session({secret:'keyboard cat'}));
app.use(bodyparser.json({limit: '100mb'}));  // to support JSON-encoded bodies
app.get('/', function (req, res) { res.redirect('/index.html'); });

app.post('/api/new_user_reg', 
	function (req, res) { 
		console.log('new user reg ', req.body);		
		console.log('new participant id ', pid);
		var pid = randomwords(3).join(' ');		
		// add mongo stuff here
		// db.signups.insert({});
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