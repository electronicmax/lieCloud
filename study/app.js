/* jshint undef: true, strict:false, trailing:false, unused:false, quotmark:false */
/* global require, exports, console, process, module, L, angular, jQuery, FastClick, device, document, window, setTimeout, $, Keyboard, Backbone */

var express = require('express'),
	url = require('url'),
	guid = require('guid'),
	Flutter = require('flutter'),
	session = require('express-session'),
	_ = require('underscore'),
	bodyparser = require('body-parser'),
	bluebird = require('bluebird'),
	collection = 'participants',
	mongojs = require("mongojs"),	
	dburi = "mongodb://localhost:27769/liecloud",
    db = mongojs.connect(dburi, ["participants"]);

var app = express();
app.use(session({secret:'keyboard cat'}));
app.use(bodyparser.json({limit: '100mb'}));       // to support JSON-encoded bodies
app.post('/twitter/genparticipant', function(req,res) { res.send('ok'); });
app.get('/', function (req, res) { res.redirect('/index.html'); });
app.use(express.static('www'));

var server = app.listen(8000, function () {
	var host = server.address().address;
	var port = server.address().port;
	console.log('Example app listening at http://%s:%s', host, port);
});