/* jshint undef: true, strict:false, trailing:false, unused:false, quotmark:false */
/* global require, exports, console, process, module, L, angular, _, jQuery, FastClick, device, document, window, setTimeout, $, Keyboard, Backbone */

var express = require('express');
var Flutter = require('flutter');
var session = require('express-session'),
    redis = require("redis"),
    client = redis.createClient(),
    bluebird = require('bluebird'),
    rget = function(key) { 
      return new Promise(function(accept, reject) {
        client.get(key, function(err, res) {
          if (res !== null) { return accept(res); }
          reject(err);
        });
      });
    },
    consumerKey = 'VV6ZRqrHqezOxl0xbOuo2ytZE',
    consumerSecret = 'hc6nbiaotdnvK3isC04EQLAeAAKLtelSn0uz03RqhzaLRBl2SJ',
    twitter = require('twitter');


var flutter = new Flutter({
  consumerKey: consumerKey,
  consumerSecret: consumerSecret,
  loginCallback: 'http://localhost:3000/twitter/callback',
  authCallback: function(req, res, next) {
    if (req.error) {
      // Authentication failed, req.error contains details
      return;
    }
    var accessToken = req.session.oauthAccessToken;
    var secret = req.session.oauthAccessTokenSecret;
    // Redirect user back to your app
    console.log('saving oaRT::' + req.session.oauthRequestToken + 
        ' oaRS::' + req.session.oauthRequestTokenSecret + 
        ' oaAT::' + req.session.oauthAccessToken + 
        ' oaATs::' +  req.session.oauthAccessTokenSecret
    );

    client.set('oauthRequestToken', req.session.oauthRequestToken, console.log);
    client.set('oauthRequestTokenSecret', req.session.oauthRequestTokenSecret, console.log);
    client.set('oauthAccessToken', req.session.oauthAccessToken, console.log);
    client.set('oauthAccessTokenSecret', req.session.oauthAccessTokenSecret, console.log);
    res.redirect('/done');
  }
});

var app = express();
app.use(session({secret:'keyboard cat'}));
app.get('/twitter/connect', flutter.connect);
app.get('/twitter/callback', flutter.auth);
app.get('/done', function(req, res) { 
  res.send('by jove! oaRT::' + req.session.oauthRequestToken + 
      ' oaRS::' + req.session.oauthRequestTokenSecret + 
      ' oaAT::' + req.session.oauthAccessToken + 
      ' oaATs::' +  req.session.oauthAccessTokenSecret
  );
});


var getClient = function() { 
  return Promise.all([rget('oauthAccessToken'), rget('oauthAccessTokenSecret')]).then(function(values) { 
    var accessToken = values[0], secret = values[1];
    if (accessToken && secret) { 
      return new twitter({ 
        consumer_key: consumerKey, consumer_secret: consumerSecret, 
        access_token_key: accessToken, access_token_secret: secret 
      });
    }
    throw new Error("oops");
  });
};

app.get('/twitter/dms', function(req,res) {
  getClient().then(function(t)  {
    // t.get('favorites/list', function(error, tweets, response){
     // t.get('statuses/user_timeline', function(error, tweets, response){
     t.get('direct_messages', {count:200}, function(error, tweets, response){      
      if(error) { 
        console.log('error!', error); 
        return res.send('error ' + error[0].message);
        // throw error;
      }
      console.log(tweets);  // The favorites.
      res.send(tweets);
      console.log(response);  // Raw response object.
    });  
  });
});

app.get('/', function (req, res) {
  res.send('Hello World!');
});

app.use(express.static('www'));

var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);
});