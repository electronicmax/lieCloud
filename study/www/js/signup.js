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
				var sa = function(fn) { if (window) { window.setTimeout(function() { $scope.$apply(fn); }, 0); } },
					u = utils,
					genDates = function(year, mm) {
						var d = new Date([year,mm,1].join('-')),
							dates = [];
						while (d.getMonth() == mm) { 
							dates.push(d);
							d = u.daysOffset(d,1);
						}
						return dates;
					};

				$scope.qualify = {};		
				$scope.signup = {
					signup_date : new Date(),
					signup_guid : utils.guid()
				};
				$scope.months = [
					{ 
						name:'july',
						dates: [new Date('2015-07-28'),new Date('2015-07-29'),new Date('2015-07-30'),new Date('2015-07-21')]
					},
					{ 	name:'august', dates: genDates(2015, 8)},
					{   name:'september', dates: [u.range(1,11).map(function(x) { return new Date('2015-09-'+x);})] }
				];
				$scope.dow = function(x) { return u.DOW_FULL[x.getDay()]; };
				$scope.d2str = function(x) { return $scope.dow(x) + x.getDate() + u.MON_SHORT[x.getMonth()]; };
				$scope.assess = function() {
					$scope.assessed = true;
					return $scope.qualify.consent=='yes' && $scope.qualify.vuln=='no' && $scope.qualify.over18=='yes';
				};
				$scope.submit = function() {
					$scope.submitted = true;
					$.ajax({method:'POST', url:'/api/new_user_reg', data:JSON.stringify($scope.signup), processData:false}).then(function(x) {
						console.log('participant id ', x, x.id);
						sa(function() { $state.go('questionnaire', { pid: x.id }); });
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
			controller:function($scope, $state, $stateParams, utils) {
				var pId = $scope.pId = $stateParams.pid;
				console.info('state entering questionnaire - ', pId);
				$scope.responses = {};
				$scope.submit = function() {
					$scope.submitted = true;
					var payload = _({pId:pId}).extend($scope.responses);
					$.ajax({method:'POST', url:'/api/questionnaire', data:JSON.stringify(payload), processData:false}).then(function(x) {
						$scope.submitted = true;
						$state.go('thankyou');
					}).fail(function(err) {
						$scope.submitted = false;
						$state.error = err;
					});
				}
			}
		}).state('thankyou', {
			url:'/thankyou?pid',
			templateUrl:'tmpl/thanks.html',
			controller:function($scope, $state, utils) {

			}			
		});
	}).controller('main', function($scope, utils, $http, $timeout, server) { 

	})
