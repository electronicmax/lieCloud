/* jshint undef: true, strict:false, trailing:false, unused:false, quotmark:false */
/* global require, exports, console, process, module, L, angular, _, jQuery, window, document, Image, Backbone, syncedStorageGUID */

(function(){
	
	angular.module('lifecourse').factory('ReminderFactoryEngine', function(utils, medReminders, diaryFactory) { 
		return {
			getMedReminders:function(diary,prescriptions,meds) { 
				var daysAgo = 2;
				var afterDate = new Date(new Date().setDate(new Date().getDate()-daysAgo));
				var reminders = [];
				var now = new Date();

				for(var i =0;i<=daysAgo;i++){
					var tempDate = new Date(new Date().setDate(now.getDate()-i));
					reminders = reminders.concat(medReminders.getNextReminders(prescriptions, diary,tempDate));
				}


				return reminders;
			},
		};
	});

	angular.module('lifecourse').directive('upcomingRemindersWidget', function() { 
		return {
			restrict:'E',
			replace:true,
			scope: {diary:'=', prescriptions:'=', meds:'='},
			templateUrl:'tmpl/upcoming-reminders-widget.html',
			controller:function($scope, $element, $state, $timeout, utils, ReminderFactory) { 				
				var u = utils, sa = function(f) { utils.safeApply($scope, f); },
					diary = $scope.diary,
					meds = $scope.meds,
					today = u.startofDay(new Date()),
					refreshReminders = $scope.refreshReminders = function()  {
						var newr = ReminderFactory.getReminders($scope.diary, $scope.prescriptions, $scope.meds);
						console.log("newr .... ",newr);
						if ($scope.reminders) {
							var new_by_id = utils.dict(newr.map(function(x) { return [x.id, x]; })),
								old_by_id = utils.dict($scope.reminders.map(function(x) { return [x.id, x]; }));
							// kill the oldies
							$scope.reminders.concat().map(function(r) { 
								if (new_by_id[r.id] === undefined) {
									$scope.reminders = _($scope.reminders).without(r);
								} 
							});
							newr.map(function(r) { 
								if (old_by_id[r.id] === undefined) {
									$scope.reminders.push(r);
								}
							});
							return;
						} 
						// otherwise just replace
						$scope.reminders = newr;
						console.log("$scope.reminders .... ",$scope.reminders);
					};
				$scope.$watch('prescriptions', refreshReminders);
				$scope.$watchCollection('diary.models', function() { 
					$timeout(refreshReminders, 500); 
				});
				refreshReminders();
				window.ssw=$scope;
			}
		};
	}).directive('reminderTakeMed', function() { 
		return {
			restrict:'E',
			replace:true,
			templateUrl:'tmpl/reminder-take-med.html',
			scope: {diary:'=', prescriptions:'=', r:'=medinfo', meds:'='},
			controller:function($scope, $element, $state, $timeout, utils, diaryFactory) {
				console.log("$scope.r",$scope.r); 				
				var u = utils, sa = function(f) { utils.safeApply($scope, f); },
					options = $scope.options = ['yes', 'no'],
					toRelativeDateString = $scope.toRelativeDateString = function(d){
						if(u.getDaysOffsetFromToday($scope.r.date)<-1){
							return "on "+u.toRelativeDateString($scope.r.date);
						}
						return u.toRelativeDateString($scope.r.date).toLowerCase();
					}
					toMedName = $scope.toMedName = function(d) { 
						if (d.medid && $scope.meds[d.medid]) { return $scope.meds[d.medid].name; }
					},
					onResponse = $scope.onResponse = function(response) {
						console.log("medTaked response: ",response); 
						$scope.response = response;	
						console.log("$scope.r.date = ",$scope.r.date);						
						var mtde = diaryFactory._medTaken($scope.diary, $scope.r.medid, $scope.r.dose, $scope.r.date, $scope.r.date, response =='yes');
						console.info('med taken diary entry ', mtde); 
						mtde.save();
					};

				window.$ssw=$scope;
			}
		};	
	}).directive('reminderDailyFeel', function() {
		return {
			restrict:'E',
			replace:true,
			templateUrl:'tmpl/reminder-daily-feel.html',
			scope: {diary:'='},
			controller:function($scope, $element, $state, $timeout, diaryFactory, utils) { 				
				var u = utils, sa = function(f) { utils.safeApply($scope, f); },
					onResponse = $scope.onResponse = function(response) {
						console.info('daily feel >> setting response ', response);						
						$scope.response = response;	// trigger collapse						
						console.info('create daily feel > ', response);
						var eed = diaryFactory.makeNewEntry($scope.diary, {	feel: response });
						eed.save();						
					};
				window.$ssw=$scope;
			}
		};		
	});
})();