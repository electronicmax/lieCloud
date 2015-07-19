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

angular.module('lie', [])
	.controller('main', function($scope, $http, $timeout) { 
		var sa = function(fn) { if (window) { window.setTimeout(function() { $scope.$apply(fn); }, 0); } },
			tokenkey = getUrlParameter('tokenkey');

		var callTwitter = function(path, params) { 
			var data = _({path:path, tokenkey:tokenkey}).extend(params);
			console.log('data ', data);
			return new Promise(function(acc,rej) { 
				$.ajax({ url:'/twitter/call', method:'GET', data: data }).then(acc).fail(rej);
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

		$scope.byfriend = {};
		var incr = function(id) { 
			$scope.byfriend[id] = ($scope.byfriend[id] || 0) + 1;
		};

		var alls = [
			// callTwitter('direct_messages', {count:200}).then(function(results) {
			// 	sa(function() { results.map(function(x) { 
			// 		console.log(x);
			// 		incr(x.sender.screen_name); 
			// 	}); });
			// }),
			callTwitter('statuses/user_timeline', {count:500}).then(function(results) {
				console.info('user_timeline ', results);
				sa(function() { 
					results.map(function(x) { 
						// once for the author:
						incr(x.user.screen_name); 
						// once for each @ mention
						x.entities.user_mentions.map(function(mention) {
							incr(mention.screen_name);
						});
					}); 
				});				
			})
		];


		window.s = $scope;

	});