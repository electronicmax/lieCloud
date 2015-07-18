/* jshint undef: true, strict:false, trailing:false, unused:false, quotmark:false */
/* global require, exports, console, process, module, L, angular, _, jQuery, FastClick, device, document, window, setTimeout, $, Keyboard, Backbone */

var tojson = function(x) { return JSON.stringify(x); };

angular.module('lie', [])
	.controller('main', function($scope, $http, $timeout) { 
		var sa = function(fn) { if (window) { window.setTimeout(function() { $scope.$apply(fn); }, 0); } };
		$scope.method = 'direct_messages';
		$scope.params = tojson({count:200});
		$scope.call = function(c) { 
			var data = _({ path : $scope.method }).extend(JSON.parse($scope.params));
			console.log('data ', data);
			$.ajax({ url:'/twitter/call', method:'GET', data: data }).then(function(results) { 
				sa(function() { 
					$scope.resultsJSON = tojson(results);
					$scope.results = results;
				});
			}).fail(function(err) { 
				console.error(err);
			});
		};
		$timeout($scope.call, 1000);
	});