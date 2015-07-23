/* jshint undef: true, strict:false, trailing:false, unused:false, quotmark:false */
/* global require, exports, console, process, module, L, angular, _, jQuery, Backbone, window */


angular.module('lifecourse')
	.config(function($stateProvider, $urlRouterProvider) {
		$stateProvider.state('subscribe', {
			url:'/subscribe',
			resolve : {
				profile:function(storage)  { return storage.getProfile(); },
            },
			templateUrl:'tmpl/subscribe.html',
			controller:function($scope, $stateParams, $state, utils, purchases, remote, profile) {
				var u = utils, sa = function(f) { utils.safeApply($scope, f); };
                var personal = utils.getModel(profile, "personal");

                $scope.gender = personal.get('gender');
                window.personal = personal;

                $scope.getSubscriptions = function() { 
                    $scope.loaded = false;
                    return remote.getSubscriptions().then(function(s) {
                        console.log('subscriptions >>', s && s[0]);
                        if (s && s[0] && s[0].response && s[0].response[0] && s[0].response[0].end) {
                            sa(function() { 
                                $scope.current_subs = {
                                    active:true,
                                    end : new Date(s[0].response[0].end),
                                    endString: new Date(s[0].response[0].end).toDateString()
                                };
                            });
                        } else {
                            purchases.getProducts().then(function(products) {
                                sa(function() { $scope.products = products; });
                            });
                        }
                        $scope.loaded = true;
                    }).catch(function(err) {
                        console.log('getSubscriptions error ', err);
                        sa(function() { 
                            $scope.loaded = true;
                            $scope.network_error = true;
                        });
                    });
                };


                $scope.getSubscriptions();

                // bought the PRO subscription ?
                $scope.ispro = personal.get("bought-lifecourse") || false;
                $scope.clickedButtons = false;
                $scope.doBuy = function (productId) {
                    if (!$scope.clickedButtons) {
                        // disable buttons immediately
                        $scope.clickedButtons = true;
                        purchases.buy(productId).then(function () {
                            $scope.ispro = personal.get("bought-lifecourse") || false;
                            if ($scope.ispro) {
                                $state.go("subconfirmation");
                            } else {
                                $scope.clickedButtons = false; // let them buy again, then
                            }
                        });
                    }
                };
                window.ss = $scope;
			}
		}).state('subconfirmation', {
            url:'/subconfirmation',
            resolve : { profile:function(storage)  { return storage.getProfile(); }  },
            templateUrl:'tmpl/subconfirmation.html',
            controller:function($scope,utils) {
                $scope.iOS = !utils.isiOS();
                $scope.Android = utils.isAndroid();                   
            }
        });
	});
