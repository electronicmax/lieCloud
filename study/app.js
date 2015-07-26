/* jshint undef: true, strict:false, trailing:false, unused:false, quotmark:false */
/* global require, exports, console, process, module, L, angular, jQuery, FastClick, device, document, window, setTimeout, $, Keyboard, Backbone */

var express = require('express'),
	url = require('url'),
	session = require('express-session'),
	_ = require('underscore'),
	bodyparser = require('body-parser'),
	Promise = require('bluebird'),
	mongojs = require("mongojs"),
	randomwords = require('random-words'),
	stringify = function(o) { return JSON.stringify(o); };

Promise.promisifyAll([
   require("mongojs/lib/collection"),
   require("mongojs/lib/database"),
   require("mongojs/lib/cursor")
]);

var db = mongojs('liecloud', ["signups", "questionnaire"]),
	app = express();

app.use(session({secret:'keyboard cat'}));
app.use(bodyparser.json({limit: '100mb'}));  // to support JSON-encoded bodies

app.get('/', function (req, res) { res.redirect('/index.html'); });
app.post('/api/new_user_reg', 
	function (req, res) { 
		var pId = randomwords(3).join(' '),
			params = _({pid:pId}).extend(req.body);

		console.log('new user reg ', req.body);		
		console.log('new participant id ', pId);

		db.signups.insertAsync(params).then(function(foo) {
			console.log('foo ', foo);
			res.send(stringify({pId:pId}));
		}).catch(function(err) {
			res.status(500).send(stringify({error:err.message}));
		});
	});

app.post('/api/questionnaire', 
	function (req, res) { 
		var pId = req.body.pId,
			responses = req.body.responses;			
		console.info('pId ', pId, responses);
		if (!pId || !responses) { 
			res.status(401).send(stringify({error:'wrong params - no pId or responses'}));
			return;
		} 
		console.info('questionnaire. saving ', req.body);		
		db.questionnaire.insertAsync(req.body).then(function() { 
			res.send(JSON.stringify({pId:pId}));
		}).catch(function(err) {
			res.status(500).send(stringify({error:err.message}));
		});
	});

app.use(express.static('www'));

var server = app.listen(8000, function () {
	var host = server.address().address;
	var port = server.address().port;
	console.log('Example app listening at http://%s:%s', host, port);
});