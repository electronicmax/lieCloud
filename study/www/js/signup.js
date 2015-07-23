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
	.factory('server', function() { 
		var tokenkey = getUrlParameter('tokenkey');
		return { 
			callTwitter : function(path, params) { 
				var data = _({path:path, tokenkey:tokenkey}).extend(params);
				return new Promise(function(acc,rej) { 
					$.ajax({ url:'/twitter/call', method:'GET', data: data }).then(acc).fail(rej);
				});
			},
			set : function(key, data) { 
				var payload = { id : key, data: data },
					jsonpayload = JSON.stringify(payload);
				return $.ajax({url:'/set', method:'POST', processData:false, contentType:'application/json', data:jsonpayload });
			},
			get : function(key) { 
				return new Promise(function(acc,rej) { 
					$.ajax({url:'/get', method:'GET', data:{id:key} }).then(function(results) { 
						console.info('results ', results.length);
						acc(JSON.parse(results));
					}).fail(rej);
				});
			}
		};
	}).controller('main', function($scope, utils, $http, $timeout, server) { 
		var sa = function(fn) { if (window) { window.setTimeout(function() { $scope.$apply(fn); }, 0); } };

	
		$scope.method = 'direct_messages';
		$scope.params = tojson({count:200});

		$scope.call = function(c) { 
			server.callTwitter($scope.method, JSON.parse($scope.params)).then(function(results) { 
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


		var respects = $scope.respects = {},
			// tbyday = {},
			tminmax = {},
			tpds = $scope.tpds = {};

		// var update_tpds = function(scr_id, tweet) { 
		// 	tbyday[scr_id] = (tbyday[scr_id] || {});
		// 	var datestr = new Date(tweet.created_at).toDateString();
		// 	tbyday[scr_id][datestr] = (tbyday[scr_id][datestr] || []);
		// 	tbyday[scr_id][datestr].push(tweet);
		// };
		var update_tpds = function(scr_id, tweet) { 
			var tweet_date = new Date(tweet.created_at).valueOf(),
				minmax = { 
					min: Math.min(tminmax[scr_id] && tminmax[scr_id].min || tweet_date, tweet_date),
					max : Math.max(tminmax[scr_id] && tminmax[scr_id].max || tweet_date, tweet_date)
				};
			tminmax[scr_id] = minmax;
		};

		var process = function(screen_name, results, incr_val) { 
			console.log('processing results ', screen_name, results.length);
			respects[screen_name] = {};
			results.map(function(x) {
				if (x.retweeted && x.user && x.user.screen_name) { 
					incr(respects[screen_name], x.user.screen_name, incr_val);					
				}
				if (x.retweeted && !x.user && !x.retweeted_status) { 
					console.log('no retweeted or user but retweeted_status ?', x); 
					return;
				}
				if (x.retweeted && x.retweeted_status) { 
					incr(respects[screen_name], x.retweeted_status.user.screen_name, incr_val);
				} else if (!x.retweeted) {
					// when person x mentions y, take those into account
					if (x.entities === undefined) { console.error('no entities ', x); }
					else if (x.entities) { 
						x.entities.user_mentions.map(function(mention) {
							incr(respects[screen_name], mention.screen_name, incr_val);
						});
					}
				}
				update_tpds(screen_name, x);
			}); 
			sa(function() { $scope.byfriend = respects[screen_name];	});
			server.set('respects-'+screen_name, JSON.stringify(respects[screen_name]));
			console.log(' ', screen_name, '  -> msec', (tminmax[screen_name].max - tminmax[screen_name].min), 'days: ', (tminmax[screen_name].max - tminmax[screen_name].min)/(24.0*60*60*1000));
			$scope.tpds[screen_name] = results.length / Math.max( (tminmax[screen_name].max - tminmax[screen_name].min)/(24.0*60*60*1000), 1 );
			// $scope.tpds[screen_name] = _(tbyday[screen_name]).values().map(function(x) { 
			// 	return x.length; 
			// }).reduce(function(x,y) { return x+y; },0)/(1.0*_(tbyday[screen_name]).keys().length);
			server.set('tpds-'+screen_name, $scope.tpds[screen_name]);
			return results;	
		};

		var recurseTwitter = function(fn, screen_name, maxid) {
			console.log('recurseTwitter', fn, screen_name, maxid);
			var params = _({count:200, screen_name:screen_name, max_id: maxid}).omit(function(v) { return v === undefined; });
			return server.callTwitter(fn, params).then(function(results) { 
				console.log('results ', results, results && results.error);
				if (results && results.error) { return undefined; }
				if (results.length > 1) { 
					var ids = results.map(function(x) { return x.id_str; }).filter(function(x) { return x !== undefined; });
					if (ids.length >= 0) { 
						var newmaxid = ids[ids.length-1];
						return recurseTwitter(fn,screen_name,newmaxid).then(function(new_results) { 
							return results.concat(new_results);
						});
					}
					// out of ids.
					return results;
				}
				return results;
			});
		};

		var grab_user_timeline = function(screen_name) { 
			console.log('grab_user_timeline ', screen_name);
			return server.get('timeline-'+screen_name).then(function(results) { 
				console.info('get results for ', screen_name, results); 
				if (results.length === 0) { 
					console.info('no results for ', screen_name, ' lets recurse!');
					return recurseTwitter('statuses/user_timeline', screen_name).then(function(timeline) {
						if (timeline !== undefined) {
							server.set('timeline-'+screen_name, timeline);
							return timeline;
						}
					});
				}
				console.info('skipping grabbing user timeline for ', screen_name);
				return results;
			});
		};

		server.callTwitter('account/verify_credentials', {}).then(function(results) { 
			var my_screen_name = results.screen_name;
			var processes = [
				grab_user_timeline(my_screen_name).then(function(results) { 
					// console.log('total results ', results.length);
					return process(my_screen_name, results);
				})
			];
			Promise.all(processes).then(function() { 
				var scores = respects[my_screen_name],
					pairs = _(scores).pairs();
				pairs.sort(function(x,y) { return y[1] - x[1]; });
				console.log('top scorers ', pairs);
				var fns = pairs.slice(0,50).map(function(x) { return x[0]; })
					.map(function(friend_id) { 
						return function() { 
							return grab_user_timeline(friend_id).then(function(results) {
								return process(friend_id, results);
							});
						};
					});
				// console.log('fns ', fns);
				fns.reduce(function(fn, next) {	return fn.then(next); }, Promise.resolve()); 
			});			
		});

		window.s = $scope;

	});