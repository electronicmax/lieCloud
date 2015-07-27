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

angular.module('liecloud', ['lifecourse', 'ui.router'])
	.config(function($stateProvider, $urlRouterProvider) {
		$urlRouterProvider.otherwise('/intro');
		$stateProvider.state('intro', {
			url: '/intro',
			templateUrl: 'tmpl/intro.html',
			controller: function ($scope, $state, utils) {
				var sa = function(fn) { if (window) { window.setTimeout(function() { $scope.$apply(fn); }, 0); } },
					u = utils,
					DATES_REQUIRED = 4,
					genDates = function(year, mm) {
						var d = new Date([year,mm,1].join('-')),
							dates = [];
						while (d.getMonth() + 1 == mm) { 
							if (d.getDay() > 0 && d.getDay() < 6) { 
								dates.push(d);
							}
							d = u.daysOffset(d,1);
						}
						return dates;
					};

				$scope.qualify = {};		
				$scope.signup = {
					email:'',
					signup_date : new Date(),
					signup_guid : utils.guid()
				};
				$scope.months = [
					{ name:'july', dates: [new Date('2015-07-29'),new Date('2015-07-30'),new Date('2015-07-21')]},
					{ name:'august', dates: genDates(2015, 8)},
					{ name:'september', dates: u.range(1,11).map(function(x) { return new Date('2015-09-'+x);}) }
				];
				$scope.dow = function(x) { return u.DOW_FULL[x.getDay()]; };
				$scope.d2str = function(x) { return [$scope.dow(x), x.getDate(), u.MON_SHORT[x.getMonth()]].join(' '); };
				$scope.d2val = function(x) { return x.toDateString(); };
				$scope.assess = function() {
					console.info('assess', $scope.qualify);
					$scope.assessed = $scope.qualify.consent !== undefined && $scope.qualify.over18 !== undefined;
					$scope.qualify_result =  $scope.qualify.consent=='yes' && $scope.qualify.over18=='yes';
				};
				$scope.$watchCollection('qualify', $scope.assess);

				$scope.submit = function() {
					$scope.submitted = true;
					console.log('submitting ', $scope.signup);
					$.ajax({method:'POST', url:'/api/new_user_reg', data:JSON.stringify($scope.signup), contentType:'application/json', processData:false}).then(function(x) {
						console.log('got results ', x);
						var results = JSON.parse(x);
						console.log(results);
						sa(function() { $state.go('questionnaire', { pid: results.pId }); });
					}).fail(function(err) {
						console.error(err);
						sa(function() { 
							$scope.submitted = false;
							$scope.submitError = err; 
						});
					});
				};
				$scope.$watchCollection('qualify', function() { 
					$scope.done = $scope.qualify.consent && $scope.qualify.over18; 
					console.log('done is ', $scope.done);
				});


				// set up email checking 
				var validateEmail = function() {
					var se = $scope.signup.email || '';
					se = se.trim();
					console.info($scope.signup.email, se.length > 3, se.indexOf('@') > 0, se.indexOf('.') > 0, se.slice(se.lastIndexOf('.')+1).length >= 2);
					return $scope.emailValid = se.length > 3 && se.indexOf('@') > 0 && se.indexOf('.') > 0 && se.slice(se.lastIndexOf('.')+1).length >= 2;
				}, validate = function() { 
					var v = validateEmail() && $scope.signup.interviewpref !== undefined && $scope.signup.dates !== undefined;
					var n_trues = _($scope.signup.dates).pairs().filter(function(x) { console.log(' fair ', x); return x; }).length;
					$scope.remainingDates = DATES_REQUIRED - n_trues;
					$scope.valid = v && n_trues >= DATES_REQUIRED;

					console.info('validating ', 'email - ', validateEmail(), $scope.signup.interviewpref !== undefined, $scope.signup.dates !== undefined, n_trues);

					return $scope.valid;
				};

				$('#email').on('blur', validateEmail);
				$scope.$watchCollection('signup', validate);
				$scope.$watchCollection('signup.dates', validate);
				
				window.ss = $scope;
			}
		}).state('questionnaire', {
			url:'/questions?pid',
			templateUrl:'tmpl/questions.html',
			controller:function($scope, $state, $stateParams, utils) {
				var sa = function(fn) { if (window) { window.setTimeout(function() { $scope.$apply(fn); }, 0); } },
					u = utils,
					pId = $scope.pId = $stateParams.pid;

				console.info('state entering questionnaire - ', pId);
				$scope.responses = {};
				$scope.meta = {
					pId:pId,
					survey_start:new Date(),
				};
				$scope.submit = function() {
					$scope.submitted = true;
					$scope.meta.survey_end = new Date();
					var payload = _({}).chain().extend($scope.meta).extend({responses:$scope.responses}).value();
					$.ajax({method:'POST', url:'/api/questionnaire', data:JSON.stringify(payload), contentType:'application/json', processData:false}).then(function(x) {
						sa(function() { 
							$scope.submitted = true;
							$state.go('thankyou');
						});
					}).fail(function(err) {
						sa(function() { 
							$scope.submitted = false;
							$scope.error = err.message || err.statusText; 
						});
					});
				}
			}
		}).state('thankyou', {
			url:'/thankyou?pid&email',
			templateUrl:'tmpl/thanks.html',
			controller:function($scope, $state, utils) {
			}			
		});
	}).controller('main', function() { 

	})
