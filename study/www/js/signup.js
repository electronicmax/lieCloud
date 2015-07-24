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

angular.module('liecloud', ['lifecourse'])
	.config(function($stateProvider, $urlRouterProvider) {
		$urlRouterProvider.otherwise('/intro');
		$stateProvider.state('intro', {
			url: '/intro',
			templateUrl: 'tmpl/intro.html',
			controller: function ($scope, $state, utils) {
				var sa = function(fn) { if (window) { window.setTimeout(function() { $scope.$apply(fn); }, 0); } };
				$scope.qualify = {};		
				$scope.signup = {};
				$scope.months = [
					{ 
						name:'july'
						dates: [new Date('2015-07-28'),new Date('2015-07-29'),new Date('2015-07-30'),new Date('2015-07-21')]
					},
					{ 
						name:'august'
						dates: genDates(8)
					},
					{ 
						name:'september'
						dates: [u.range(1,11).map(function(x) { return new Date('2015-09-'+x);});
					}
				];
				$scope.dow = function(x) { return u.DOW_FULL[x.getDay()]; };
				$scope.d2str = function(x) { return $scope.dow(x) + x.getDate() + u.MON_SHORT[x.getMonth()]; )}
				$scope.assess = function() {
					$scope.assessed = true;
					return $scope.qualify.consent=='yes' && $scope.qualify.vuln=='no' && $scope.qualify.over18=='yes';
				};
				$scope.submit = function() {
					$scope.submitted = true;
					$.ajax({method:'POST', url:'/api/new_user_reg', data:JSON.stringify($scope.signup), processData:false}).then(function(x) {
						console.log('participant id ', x, x.id);
						sa(function() { $state.go('questionnaire', { pid: x.id });
					}).fail(function(err) {
						sa(function() { 
							$scope.submitted = false;
							$scope.submitError = err; 
						});
					});
				};		
				$scope.$watchCollection('qualify', function() { 
					$scope.done = $scope.qualify.consent && $scope.qualify.vuln && $scope.qualify.over18; 
					console.log('done is ', $scope.done);
				});
			}
		}).state('questionnaire', {
			url:'/questions?pid',
			templateUrl:'tmpl/questions.html',
			controller:function($scope, utils) {
				$scope.responses = {};
				$scope.submit = function() {
					$scope.submitted = true;
					$.ajax({method:'POST', url:'/api/new_user_reg', data:JSON.stringify($scope.responses), processData:false}).then(function(x) {
						$scope.submitted = true;
					}).fail(function(err) {
						$scope.submitted = false;
					});
				}
			}
		});
	}).controller('main', function($scope, utils, $http, $timeout, server) { 

	})
