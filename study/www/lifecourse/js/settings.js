/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module, L, angular, _, jQuery, Backbone, window, d3 */

angular.module('lifecourse')
	.config(function($stateProvider, $urlRouterProvider) {
		$stateProvider.state('settings', {
			url:'/settings',
			templateUrl:'tmpl/settings.html',
			diary:function(storage)  { return storage.getDiary(); },
			resolve: {	
				diary: function(storage) { return storage.getDiary(); },
				profile:function(storage)  { return storage.getProfile(); },
				demodiary: function(utils) { 
		        	var u = utils, d = u.deferred();
			        d3.csv('data/demo-diary.csv').get(function(err, rows) { 
			          	if (err) { 
			          		d.reject();		
			          		console.error('could not load ', err);
			          		return;
			          	}
			          	d.resolve(rows);
			        });
					return d.promise();
				},
				credentials:function(remote) { 
					return remote.getCredentials();
				}
			},			
			controller:function($scope, $state, utils, diary, profile, demodiary, storage, credentials, diaryFactory, purchases) {
				var u = utils,
					sa = function(f) { utils.safeApply($scope, f); },
					personal = u.getModel(profile, 'personal'),
					feedback = $scope.feedback = {},
					creds = credentials;

				$scope.clickCount = 0;
				$scope.email = creds.email;
				$scope.ispro = personal.get("bought-lifecourse") || false;				

				$scope.restoreEnabled = true;
				$scope.restorePurchases = function() { 
					delete $scope.restoreEnabled;
					$scope.restoreSpinner = true;
					purchases.initialised.then(function() { 
						// console.log('calling update purchase state > ');
						purchases.updatePurchaseState().then(function(ispro) { 
							// console.log('updatePurchaseState returned!!!!!!!!!!!! ', ispro);
							sa(function() { $scope.ispro = ispro; });
						});
					});
				};

                $scope.sendDiagnostics = function() {
                    console.log("sendDiagnostics");
                    u.sendFeedback(creds, {"src": "diagnostics"});
                    console.log("sendDiagnostics2");
                };

				$scope.inputs = {
					showECGs:personal.get('showECGs'),
					showSummary:personal.get('showSummary')
				};
				$scope.doReset = function() { 
					var email = creds.email;
					storage.resetPassword(email).then(function() { 
						delete feedback.error;
						sa(function() { feedback.status = true; });
					}).fail(function(err) {	
						console.error('setting feedback error to ', err.status);
						sa(function() { 
							delete feedback.status;							
							feedback.error = err.status;  
						});
					});
				};

				$scope.$watch('inputs.showECGs', function(val) { 
					if (val !== undefined) { 
						console.log('saving showecg ', val);					
						personal.set('showECGs', val); 
						personal.save();
					}
				});
				$scope.$watch('inputs.showSummary', function(val) { 
					if (val !== undefined) { 
						console.log('saving showsummary ', val);
						personal.set('showSummary', val); 
						personal.save();
					}
				});

				$scope.deleteCollections = function() { 
					storage.destroyAllCollections().then(function() { 
						sa(function() { $state.go('home'); });
					}).catch(function(err) { console.error(err); })
				};
				$scope.deleteProfile = function() { 
                    _(profile.models).map(function(model,i){
                        model.attributes = {};
                        model.save();
                    });
					$state.go('onboarding.tos');
				};
				$scope.deleteDiary = function() { 
					diary.models.concat().map(function(x) { 
						console.log('deleting ', x);
						x.destroy();
					});
				};
				$scope.preloadDiary = function() {
					var daystart = demodiary.length;
					var today = new Date().valueOf();
					_(demodiary).map(function(x,i) {
						var e = {};
						console.log(i, daystart, ' -- ', today, u.TWENTY_FOUR_HOURS_USEC, today-daystart*u.TWENTY_FOUR_HOURS_USEC) ;
						e.created = new Date( (today-daystart*u.TWENTY_FOUR_HOURS_USEC) + i*u.TWENTY_FOUR_HOURS_USEC ).valueOf();
						e.id = 'diary-entry-' + u.guid();
						e.notes = x.notes;
						e.feel = parseInt(x.feel);
						if (x.palpitations == 'yes') { e.symptoms = {palpitations:true}; }
						if (x.fatigue == 'yes') { e.symptoms = {fatigue:true}; }
						if (x.dizziness == 'yes') { e.symptoms = {dizziness:true}; }
						if (x.breathless == 'yes') { e.symptoms = {breathless:true}; }						
						var entry = diaryFactory.makeNewEntry(diary, e);
						diary.add(entry);
						// console.log('creating entry ', entry.attributes, ' from x ', x);
						// console.log('entry attributes ', entry.attributes, entry.id);
						entry.save();
					});
				};
				$scope.resetPurchaseState = function() { 
                    var personal = utils.getModel(profile, "personal"), 
                    	d = u.deferred();
                    personal.unset("bought-lifecourse"); // e.g. sets bought-afinitypro, used in home.js to set $scope.ispro
                    personal.unset("bought-lifecourse-type");
                    personal.unset("bought-lifecourse-date"); // LONG since epoch of the bought time
                    personal.save().then(function () {
                        console.log("purchases: SAVED: ", personal);
                        d.resolve();
                    });
                    return d.promise();
				};
				window._p = profile;
				window._diary = diary;
			}
		});
	});
