/* jshint undef: true, strict:false, trailing:false, unused:false, quotmark: true */
/* global require, exports, console, process, module, L, angular, _, jQuery, window */

(function() {


	angular.module('lifecourse')
		.config(function($stateProvider, $urlRouterProvider) {
			$stateProvider.state('reauth', {
				url:'/reauth',
				templateUrl:'tmpl/reauth.html',
				resolve: {
                    profile:function(storage)  { return storage.getProfile(); },
                    credentials:function(remote)  { return remote.getCredentials(); }
                },
				controller:function($scope, $state, $stateParams, profile, remote, utils, credentials) {
					window.setUIViewTransition('transition-panright');
					console.log('credentials ', credentials);
					var u = utils, sa = function(f) { utils.safeApply($scope, f); },
						creds = credentials,
						errors = $scope.error = {},
						validateEmail = $scope.validateEmail = u.validateEmail,
						inputs = $scope.input = {
							email:creds.email || '',
		  					password:creds.password || ''
		  				};

					$scope.next = function(email, password) {
						delete errors.login;
						if (!(errors.email = $scope.validateEmail(email) === true)) { return; 	}
						$scope.submitting = true;
						remote.login(inputs.email, inputs.password).then(function() { 
							$state.go('home');
						}).catch(function(err) {
							$scope.submitting = false;
							if (err === null) {
								sa(function() {	$state.go('start-signup-network-error', {backpage:'reauth'}); });
							}
							sa(function() {
							 	errors.login = err.message || 'Incorrect username or password. Please check them and try again.'; 
							});
							return;
						});
					};
					$scope.resetPassword = function() {	$state.go('start-password-reset');};
					window.err = function(s) { sa(function() { errors.login = s; }); };
				}
			});
	});
})();
