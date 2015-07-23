/* jshint undef: true, strict:false, trailing:false, unused:false, quotmark: true */
/* global require, exports, console, process, module, L, angular, _, jQuery, window */

(function() {

	angular.module('lifecourse')
		.service('onboarding', function (onboardingStates) {
			var currentIndex = function ($state) {
				var current = $state.current.name.split('.').slice(0, 2).join('.');
				return onboardingStates.indexOf(_.find(onboardingStates, function (state) {
					return current === state.name.split('.').slice(0, 2).join('.');
				}));
			};
			return {
				next: function ($state, utils, profile) {
					// TODO: check skipIfOnboarded
					var current = currentIndex($state),
						obModel = utils.getModel(profile,'onboarded'),
						onboarded = obModel.get('status');
					return _.find(onboardingStates, function (state, i) {
						return i > current && !(onboarded && state.skipIfOnboarded);
					}).name;
				}
			};
		})
		.run(function ($rootScope, $location, utils, $state) {
			// detect if back button (or history.back()) is used, stop any
			// illegal back navigations, and set appropriate onboarding
			// animation
			var sa = function (f) { utils.safeApply($rootScope, f); },
				history = [],
				navigatingBack = false;

			var canBackInto = function (to, from) { // check if user is allowed to back to one state from another
				var stateRoute = to.name.split('.'),
					disallowState, _s;
				while (!disallowState && stateRoute.length > 0) {
					_s = $state.get(stateRoute.join('.'));
					stateRoute.pop(); // get parent
					if (_s.disallowBackInto) { disallowState = _s; }
				}
				return !disallowState || disallowState && from.name.indexOf(disallowState.name) === 0; // allow navigation within parent stages - e.g. from onboarding.name to onboarding.info
			};

			$rootScope.navBack = false;
			
			$rootScope.$on('$stateChangeStart', function (event, state, params) {
				if (navigatingBack) { return; }

				var url = $location.url(),
					prev = history[history.length - 2],
					lastLegalState,
					backCount = 0;

				if (prev && prev.url === url) {
					console.log('%chistory: user went back', 'color: magenta');
					navigatingBack = true;
					var current = history.pop();

					while (!lastLegalState && history.length > 0) { // find the last state that can be backed into
						lastLegalState = history.pop();
						backCount++;
						console.log('%chistory: checking state', 'color: magenta', lastLegalState);
						if (!canBackInto(lastLegalState.state, current.state)) {
							console.log('%chistory: illegal state', 'color: magenta');
							lastLegalState = null;
						}
					}
					if (!lastLegalState) {
						event.preventDefault();
						console.log('%shistory: out of states -- exit app', 'color: magenta');
						navigator.app.exitApp();
					} else {
						console.log('%chistory: going back ' + backCount + ' times to legal state ' + lastLegalState.url, 'color: magenta');
						$rootScope.navBack = true;
						if (backCount > 1) {
							event.preventDefault();
							window.history.go(-backCount+1);
						}
					}
				} else {
					$rootScope.navBack = false;
				}
			});
			$rootScope.$on('$stateChangeSuccess', function (event, state, params) {
				var url = $location.url();
				console.log('%chistory: adding state ' + url, 'color: magenta');
				if (!(history[history.length - 1] && url === history[history.length - 1].url)) { // don't allow duplicates
					history.push({ url: url, state: state, params: params });
				}
				navigatingBack = false;
				console.log('%chistory: summary\n • ' + _.pluck(history, 'url').join('\n • '), 'color: green');
			});
		})
		.config(function ($stateProvider, $urlRouterProvider) {
			$stateProvider.state('onboarding', {
				abstract: true,
				url: '/onboarding',
				template: '<ui-view ng-class="{ \'transition-panright\': !navBack, \'transition-panleft\': navBack }" />',
				disallowBackInto: true
			}).state('onboarding.tos', {
				url: '/tos',
				templateUrl: 'tmpl/onboarding-tos.html',
				resolve: {
					profile: function (storage)  { return storage.getProfile(); },
				},
				disallowBackInto: true,
				controller: function ($scope, $state, onboarding, utils, profile) {
					_.extend($scope, {
						resp: {},
						next: function() {
							var tos = utils.getModel(profile, 'tos');
							tos.set({ tosagree: true, tosagree_date: new Date() });
							tos.save();
							$state.go(onboarding.next($state, utils, profile));
						}
					});
					$scope.$watch('resp.tosagree', function(x) {
						if (x) { $scope.next(); }
					});
				}
			}).state('onboarding.auth', {
				abstract: true,
				url: '/auth',
				template: '<ui-view/>',
				disallowBackInto: true
			}).state('onboarding.auth.signup', {
				url: '/signup',
				templateUrl: 'tmpl/onboarding-auth-signup.html',
				resolve: {
					profile: function (storage) { return storage.getProfile(); },
					credentials: function (remote) { return remote.getCredentials(); }
				},
				controller: function ($scope, $state, onboarding, credentials, utils, storage, profile) {
					var sa = function (f) { utils.safeApply($scope, f); };

					_.extend($scope, {
						input: {
							email: credentials.email || '',
							password: '',
							confirmpass: ''
						},
						error: {},
						othererror: undefined,
						validateEmail: utils.validateEmail,
						previous: function () {
							$state.go(onboarding.previous($state));
						},
						next: function () {
							var email = $scope.input.email,
								password = $scope.input.password;

							console.log('attempting sign up with', email);
							
							if (!($scope.error.email = $scope.validateEmail(email) === true)) { return; } // FIXME cryptic
							delete $scope.othererror;
							$scope.submitting = true;

							storage.register(email, password).then(function (res) {
								// this gets called if the registration is actually successful
								// not need to set credentials because they're already set
								console.log('register success >>> ', res);
								$state.go(onboarding.next($state, utils, profile));
							}).catch(function (err) {
								console.error('registration error', err);
								if (err === null)  {
									$state.go('onboarding.auth.network-error'); 
								} else if (err && err.name == 'UserEmailConflict') {
									console.info('UserEmailConflict - trying authLogin');
									return storage.authLogin(email, password).then(function() {
										console.info(' authLogin success, going to start done ');
										$state.go(onboarding.next($state, utils, profile));
									}).catch(function(err) {
										console.error('registration/authLogin both failed, sending to returning screen.', err);
										if (err && (err.status === 0 || err.status === 500))  {
											$state.go('onboarding.auth.network-error');
										} else {
											$state.go('onboarding.auth.signin', { signup: true });
										}
									});
								} else {
									sa(function() { 
										$scope.submitting = false;
										$scope.errorother = err.message; 
									});
								}
							});
						}

					});
				}
			}).state('onboarding.auth.signin', {
				url: '/signin',
				templateUrl: 'tmpl/onboarding-auth-signin.html',
				resolve: {
					profile: function (storage) { return storage.getProfile(); },
					credentials: function (remote) { return remote.getCredentials(); }
				},
				controller:function($scope, $state, $stateParams, profile, storage, utils, credentials, onboarding) {

					var sa = function (f) { utils.safeApply($scope, f); };

					_.extend($scope, {
						input: {
							email: credentials.email || '',
							password: ''
						},
						error: {},
						validateEmail: utils.validateEmail,
						next: function () {
							var email = $scope.input.email,
								password = $scope.input.password;

							console.log('attempting sign in with', email);
							
							delete $scope.error.login;

							if (!($scope.error.email = $scope.validateEmail(email) === true)) { return; } // FIXME cryptic
							$scope.submitting = true;

							storage.authLogin(email, password).then(function (res) {
								console.log('authLogin success >>> ', res);
								$state.go(onboarding.next($state, utils, profile));
							}).catch(function (err) {
								if (err === null) {
									$state.go('onboarding.auth.network-error');
								} else {
									// incorrect login
									sa(function () {
										$scope.submitting = false;
										$scope.error.login = err.message || 'Incorrect username or password. Please check them and try again.';
									});
								}
							});
						}
					});
				}
			}).state('onboarding.auth.reset', {
				url: '/reset',
				templateUrl: 'tmpl/onboarding-auth-reset.html',
				resolve: {
					profile: function (storage)  { return storage.getProfile(); },
					credentials: function (remote)  { return remote.getCredentials(); }
				},
				controller:function ($scope, $state, storage, utils, profile, credentials) {

					var sa = function (f) { utils.safeApply($scope, f); };

					_.extend($scope, {
						input: {
							email: credentials.email || '',
							password: ''
						},
						error: {},
						feedback: {
							btnMessage: 'Send me a Password Reset'
						},
						validateEmail: utils.validateEmail,
						ferr: function(status) {
							sa(function() {
								delete $scope.feedback.lock;
								$scope.feedback.btnMessage = 'Try again';
								$scope.feedback.error = status;
							});
						},
						doReset: function () {
							$scope.feedback.lock = true; // debounce the button
							// TODO REPLACE WITH CALL >>>
							storage.resetPassword($scope.input.email).then(function () {
								delete $scope.feedback.error;
								sa(function () { $scope.feedback.status = true; });
							}).catch(function (err) {
								$scope.ferr(err.status);
							});
						},
						fst: function (x) { sa(function () { $scope.feedback.status = x; }); }
					});
				}
			}).state('onboarding.auth.network-error', {
				url: '/network-error',
				templateUrl: 'tmpl/onboarding-auth-network-error.html'
			}).state('onboarding.sync', {
				url: '/sync',
				templateUrl: 'tmpl/onboarding-sync.html',
				disallowBackInto: true,
				controller: function ($scope, $state, $stateParams, storage, utils, onboarding) {
					var sa = function (f) { utils.safeApply($scope, f); };
					
					_.extend($scope, {
						error: {}
					});

					utils.hideKeyboard();
					utils.setScrollLock($scope);

					console.log('start.js: about to call sync.');
					storage.sync().then(function() {
						console.log('start.js: sync finished.');
						storage.getProfile().then(function (profile) {
							console.log('got profile ', profile, profile && profile.length);
							setTimeout(function() {
								$state.go(onboarding.next($state, utils, profile));
							}, 2000);
							// sa(function() { $state.go(checkOnboarded(utils, profile)); });
						}).catch(function(err) {
							sa(function(){ $scope.error.main = 'Failure getting profile.'; });
						});
					}).catch(function(err) {
						console.info('error syncing ', err);
						if (err && err.status === 0) {
							$state.go('onboarding.auth.network-error');
						} else {
							sa(function() { $scope.error.main = 'Error syncing'; });
						}
					});
				}
			}).state('onboarding.name', {
				url: '/name',
				templateUrl: 'tmpl/onboarding-name.html',
				resolve: {
					profile:function(storage)  {
						try {
							var d = storage.getProfile();
							d.catch(function (x) { console.log('ERROR reject profile ', x);	});
							return d;
						} catch(e) {
							console.log('ERROR exception ', e);
						}
					}
				},
				controller: function ($scope, $state, profile, utils, onboarding) {
					var personal = utils.getModel(profile, 'personal');
					_.extend($scope, {
						input: {
							firstname: personal.get('firstname'), 
							lastname: personal.get('lastname')
						},
						saveAndAdvance: function () {
							personal.set($scope.input);
							personal.save();
							$state.go(onboarding.next($state, utils, profile));
						}
					});
				}
			}).state('onboarding.bday', {
				url: '/bday',
				templateUrl: 'tmpl/onboarding-bday.html',
				resolve: {	profile:function(storage)  { return storage.getProfile(); }	},
				controller: function ($scope, $state, profile, utils, onboarding) {
					$scope.months = utils.MON_FULL;

					var personal = utils.getModel(profile, 'personal');

					_.extend($scope, {
						input: {
							birthyear: parseInt(personal.get('birthyear')),
							birthmonth: $scope.months[personal.get('birthmonth')],
							birthdate: personal.get('birthdate'),
							gender: personal.get('gender')
						},
						saveAndAdvance: function () {
							var xform = {
								birthyear: $scope.input.birthyear,
								birthmonth: $scope.months.indexOf($scope.input.birthmonth),
								birthdate: $scope.input.birthdate,
								gender: $scope.input.gender
							};
							console.log('setting properties', $scope.input, xform);
							personal.set(xform);
							personal.save();
							$state.go(onboarding.next($state, utils, profile));
						}
					});
					$scope.$watch('input.birthmonth', function(mm) {
						console.log('mm ', mm, ' by ', $scope.input.birthyear);
						if (mm && $scope.input.birthyear) {
							console.log('days in month ', utils.daysinMonth( $scope.months.indexOf(mm) + 1 , $scope.input.birthyear ));
							$scope.days = utils.range(1,utils.daysinMonth( $scope.months.indexOf(mm) + 1 , $scope.input.birthyear ) + 1);
							console.log('days ', $scope.days);
						}
					});
					$scope.$watch('input.birthmonth + input.birthyear + input.birthdate', function() {
						var mon = $scope.months.indexOf($scope.input.birthmonth);
						console.log($scope.input.birthyear, mon, $scope.input.birthmonth, $scope.input.birthdate);
						$scope.age = Math.floor(( new Date().valueOf() - new Date($scope.input.birthyear, mon, $scope.input.birthdate).valueOf() )/(365*utils.TWENTY_FOUR_HOURS_USEC));
						$scope.dob = $scope.input.birthyear + '-' + utils.paddate($scope.input.birthmonth) + '-' + utils.paddate($scope.input.birthdate);
						console.log('age ', $scope.age);
					});
				}
			}).state('onboarding.optinfo', {
				url: '/optinfo',
				templateUrl: 'tmpl/onboarding-optinfo.html',
				resolve: { profile: function (storage) { return storage.getProfile(); } },
				controller: function ($scope, $state, profile, utils, onboarding) {

					var personal = utils.getModel(profile, 'personal');

					_.extend($scope, {
						input: { 
							docgp: personal.get('docgp'), 
							docspec: personal.get('docspec'), 
							nhsno: personal.get('nhsno')
						},
						closeHelp: function () {
							$scope.helpSection = false;
						},
						showHelp: function (t) {
							$scope.helpSection = t;
						},
						saveAndAdvance: function () {
							personal.set($scope.input);
							personal.save();
							$state.go(onboarding.next($state, utils, profile));
						}
					});
				}
			});
			$urlRouterProvider.when('/onboarding', '/onboarding/tos');
			$urlRouterProvider.when('/onboarding/auth', '/onboarding/auth/signup');
		});
})();
