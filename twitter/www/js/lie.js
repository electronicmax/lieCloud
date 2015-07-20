/* jshint undef: true, strict:false, trailing:false, unused:false, quotmark:false */
/* global require, exports, console, process, module, L, angular, _, jQuery, FastClick, device, document, window, setTimeout, $, Keyboard, Backbone */



var tojson = function(x) { return JSON.stringify(x); },
	getUrlParameter = function(sParam)	{
	    var sPageURL = window.location.search.substring(1);
	    var sURLVariables = sPageURL.split('&');
	    for (var i = 0; i < sURLVariables.length; i++) 
	    {
	        var sParameterName = sURLVariables[i].split('=');
	        if (sParameterName[0] == sParam) 
	        {
	            return sParameterName[1];
	        }
	    }
	};

angular.module('lie', ['lifecourse'])
	.controller('main', function($scope, utils, $http, $timeout) { 
		var sa = function(fn) { if (window) { window.setTimeout(function() { $scope.$apply(fn); }, 0); } },
			tokenkey = getUrlParameter('tokenkey');

		var callTwitter = function(path, params) { 
			var data = _({path:path, tokenkey:tokenkey}).extend(params);
			return new Promise(function(acc,rej) { 
				$.ajax({ url:'/twitter/call', method:'GET', data: data }).then(acc).fail(rej);
			});
		},
			set = function(key, data) { 
				var payload = { id : key, data: data },
					jsonpayload = JSON.stringify(payload);
				return $.ajax({url:'/set', method:'POST', processData:false, contentType:'application/json', data:jsonpayload });
			},
			get = function(key) { 
				return new Promise(function(acc,rej) { 
					$.ajax({url:'/get', method:'GET', data:{id:key} }).then(function(results) { 
						console.info('results ', results.length);
						acc(JSON.parse(results));
					}).fail(rej);
				});
			};

		$scope.method = 'direct_messages';
		$scope.params = tojson({count:200});

		$scope.call = function(c) { 
			callTwitter($scope.method, JSON.parse($scope.params)).then(function(results) { 
				sa(function() { 
					$scope.resultsJSON = tojson(results);
					$scope.results = results;
					console.log(results);
				});
			}).fail(function(err) { 
				console.error(err);
			});
		};

		var incr = function(person, id, amount) { 
			person[id] = (person[id] || 0) + (amount || 1);
		};


		var follows = {};
		var process = function(screen_name, results, incr_val) { 
			console.log('processing results ', screen_name, results.length);
			follows[screen_name] = {};
			results.map(function(x) {
				if (x.retweeted && x.retweeted_status) { 
					incr(follows[screen_name], x.retweeted_status.user.screen_name, incr_val);
				} else if (!x.retweeted) {
					// when person x mentions y, take those into account
					x.entities.user_mentions.map(function(mention) {
						incr(follows[screen_name], mention.screen_name, incr_val);
					});
				}
			}); 
			sa(function() { 
				$scope.byfriend = follows[screen_name];
			});	
		};

		var recurseTwitter = function(fn, screen_name, maxid) {
			console.log('recurseTwitter ', fn, screen_name, maxid);
			var params = _({count:200, screen_name:screen_name, max_id: maxid}).omit(function(v) { return v === undefined; });
			console.log('params ', params);
			return callTwitter(fn, params).then(function(results) { 
				if (results.length > 1) { 
					var newmaxid = results[results.length - 1].id_str;
					console.info('newmaxid ', newmaxid);
					return recurseTwitter(fn,screen_name,newmaxid).then(function(new_results) { 
						return results.concat(new_results);
					});
				}
				return results;
			});
		};

		var grab_user_timeline = function(screen_name) { 
			console.log('grab_user_timeline ', screen_name);
			return get('timeline-'+screen_name).then(function(results) { 
				console.info('get results for ', screen_name, results); 
				if (!results.length) { 
					console.info('no results lets go');
					return recurseTwitter('statuses/user_timeline', screen_name)
						.then(function(timeline) {
							set('timeline-'+screen_name, timeline);
							return timeline;
						});
				}
				console.info('skipping grabbing user timeline ', screen_name);
				return results;
			});
		};

		callTwitter('account/verify_credentials', {}).then(function(results) { 
			var my_screen_name = results.screen_name;
			console.info('im ', my_screen_name);
			var processes = [
				grab_user_timeline(my_screen_name).then(function(results) { 
					console.log('total results ', results.length);
					return process(my_screen_name, results);
				})
			];
			Promise.all(processes).then(function() { 
				var scores = follows[my_screen_name],
					pairs = _(scores).pairs();
				pairs.sort(function(x,y) { return y[1] - x[1]; });
				console.log('top scorers ', pairs);
				pairs.slice(0,3).map(function(x) { return x[0]; }).
					map(function(friend_id) {
						console.info('grabbing ', friend_id); 
						grab_user_timeline(friend_id).then(function(results) {
							return process(friend_id, results);
						});
					});
			});			
		});

		window.s = $scope;

	});