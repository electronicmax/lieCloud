/* jshint undef: true, strict:false, trailing:false, unused:false, quotmark:false */
/* global require, exports, console, process, module, L, angular, jQuery, FastClick, device, document, window, setTimeout, $, Keyboard, Backbone */

var express = require('express'),
	url = require('url'),
	guid = require('guid'),
	Flutter = require('flutter'),
	session = require('express-session'),
	_ = require('underscore'),
	redis = require("redis"),
	client = redis.createClient(),
	bluebird = require('bluebird'),
	rget = function(tokenkey, key) { 

		return new Promise(function(accept, reject) {
			client.get(tokenkey, function(err, res) {
				if (res !== null) { 
					try { 
						var tokenbundle = JSON.parse(res);
						return accept(tokenbundle[key]);
					} catch(e) { 
						console.error('error decoding');
						return reject(e);
					}
				}
				reject(err);
			});
		});
	},
	consumerKey = 'VV6ZRqrHqezOxl0xbOuo2ytZE',
	consumerSecret = 'hc6nbiaotdnvK3isC04EQLAeAAKLtelSn0uz03RqhzaLRBl2SJ',
	twitter = require('twitter'),
	flutter = new Flutter({
		consumerKey: consumerKey,
		consumerSecret: consumerSecret,
		loginCallback: 'http://localhost:3000/twitter/callback',
		authCallback: function(req, res, next) {
			if (req.error) {
				// Authentication failed, req.error contains details
				return;
			}
			var redis_key = 'token-' + guid.create(),
				accessToken = req.session.oauthAccessToken,
				secret = req.session.oauthAccessTokenSecret;
			console.log('req.session ', req.session);
			client.set(redis_key, 
				JSON.stringify({
					oauthRequestToken: req.session.oauthRequestToken,
					oauthRequestTokenSecret: req.session.oauthRequestTokenSecret,
					oauthAccessToken: req.session.oauthAccessToken,
					oauthAccessTokenSecret: req.session.oauthAccessTokenSecret
				}),
				console.log);
			res.redirect('/model.html?tokenkey='+redis_key);
		}
	});

var app = express();
app.use(session({secret:'keyboard cat'}));
app.get('/twitter/connect', flutter.connect);
app.get('/twitter/callback', flutter.auth);

var getClient = function(tokenkey) { 
	return Promise.all([rget(tokenkey, 'oauthAccessToken'), rget(tokenkey, 'oauthAccessTokenSecret')]).then(function(values) { 
		var accessToken = values[0], secret = values[1];
		console.log('aT ', accessToken, ' secret ', secret);
		if (accessToken && secret) { 
			return new twitter({ 
				consumer_key: consumerKey, consumer_secret: consumerSecret, 
				access_token_key: accessToken, access_token_secret: secret 
			});
		}
		throw new Error("oops");
	});
};

app.get('/twitter/call', function(req,res) {
	var path = req.query.path,
		tokenkey = req.query.tokenkey,
		params = _(req.query).omit('path', 'tokenkey');

	getClient(tokenkey).then(function(t)  {
		 t.get(path, params, function(error, tweets, response){      
				if(error) { 
					console.log('error!', error); 
					res.send(JSON.stringify({error:true, message:error && error.message || error && error[0] && error[0].message}));
					return;
				}
				res.send(tweets);
		});  
	});
});
app.get('/', function (req, res) { res.send('Hello World!'); });
app.use(express.static('www'));

var server = app.listen(3000, function () {
	var host = server.address().address;
	var port = server.address().port;

	console.log('Example app listening at http://%s:%s', host, port);
});