/* jshint undef: true, strict:false, trailing:false, unused:false, quotmark:true */
/* global require, exports, console, process, module, L, angular, _, jQuery, Backbone, window, $, d3 */

angular.module('lifecourse')
	.config(function($stateProvider, $urlRouterProvider) {
		$stateProvider.state('input-feeling', {
			url:'/input-feel?id&type&val&day',
			templateUrl:'tmpl/input-feeling.html',
			resolve: { 
				profile:function(storage)  { return storage.getProfile(); },
				diary:function(storage) { return storage.getDiary(); }
			},
			controller:function($scope, $stateParams, $state, profile, diary, diaryFactory, utils) {
					// window.setUIViewTransition('transition-panright'); // bad! 
                    //console.log("stateparams id",$stateParams.id);
					var u = $scope.u = utils, sa = function(f) { utils.safeApply($scope, f); },
						type = $scope.type = $stateParams.type,
						val = $scope.val = $stateParams.val,
						day = $scope.day = $stateParams.day && new Date($stateParams.day) || new Date(),
						id = $stateParams.id,						
						entrymodel = $scope.m = id && diary.get(id),
						empty = $scope.empty={
							val : true
						},
						entry = $scope.entry = entrymodel && entrymodel.attributes && _(entrymodel.attributes).clone() || {
							created:day, 
							feel:(type == 'feel' ? val : undefined), 
							hr:(type == 'hr' ? '' : undefined),
							bp:(type == 'bp' ? '' : undefined),
							medinfo:(type == 'otherMedication' ? {} : undefined),
							activity:(type == 'activity' ? val : undefined),
							weight:(type == 'weight' ? {} : undefined),
							clinicalvisit:type == 'clinicalvisit' ? { nature:val } : undefined,
							symptoms:(type == 'symptoms' ? { symptom:val, severity:undefined } : undefined),
							otherMeasurement:(type == 'other' ? {} : undefined), // to be filled in 
							notes:'' // to be filled in 
						},
						feelStr = $scope.feelStr = (entry.feel !== undefined && ['Very Poorly', 'Poorly', 'Fine', 'Well', 'Very Well'][parseInt(entry.feel) - 1]),

						titles = {
							'bp' : 'blood pressure',
							'hr' : 'heart rate',
							'weight' : 'weight measurement',
							'other' : 'other measurement',
							'activity' : 'activity'
						},
						title = $scope.title = titles[type] || 'new entry',
						back = $scope.back = function() { window.history.back(); },
						save = $scope.save = function() {
							var s = $scope.entry,
								model = entrymodel;
							if (model) {
								console.log('updating existing model - ', model.id, model.attributes, entry);
								model.set(entry);
							} else {
								model = diaryFactory.makeNewEntry(diary, s);
							}
							model.save().then(function() { 
								console.info('done saving entry', model.attributes);
							}).catch(function(err) { 
								console.error('error saving diary entry');
							});
							$state.go('swipe-diary', { day: u.toISODateString(s.created) });
							// $scope.back();
						};

	                // scroll lock this view
	                utils.setScrollLock($scope);                

					//if file
					if ($scope.m && $scope.m.file) {
						$scope.m.getFileURL().then(function(furl) { 
							sa(function() { $scope.fileURL = furl; });
						});
					}
					//if med, append name to medinfo
					if ($scope.entry.medid){
						$scope.entry.medinfo.name = meds[$scope.entry.medid].name;
					}

					
					console.log("Entry model",entrymodel);
					console.log("$cope.entry",$scope.entry);
					$scope.$watch('entry.weight', function(e) { console.log('weight change ', e); });
					$scope.$watch('entry.weightunits', function(e) { console.log('weight units change ', e); });
					window.$sc = $scope;

				}
			});
	}).directive('inputHr', function() { 
			return { restrict:'E', scope:{model:'=',empty:'='}, replace:true, templateUrl:'tmpl/input-hr.html',
			controller:function($scope, utils){
				//check empty
				$scope.$watch('model',function(bp){	$scope.empty = $scope.model.length===0;	});
			}};
		}).directive('inputBp', function() { 
			return { restrict:'E', scope:{model:'=',empty:'='}, replace:true, templateUrl:'tmpl/input-bp.html', 
			controller:function($scope, utils) {
				$scope.$watch('systolic + diastolic', function() { 
					$scope.model = { systolic: parseInt($scope.model.systolic), diastolic : parseInt($scope.model.diastolic) };
				});
				var keys = ['systolic','diastolic'];
					$scope.$watch('model',function(){
						$scope.empty = keys.some(function(k){
							return (!$scope.model[k] || $scope.model[k].length===0);
					});
				},true);
			}};
		}).directive('inputMeasureOther', function() { 
			return { restrict:'E', scope:{model:'=', empty:'='}, replace:true, templateUrl:'tmpl/input-measure-other.html',
				controller: function($scope) {
					//check empty
					var keys = ['what','val'];
					$scope.$watch('model',function(){
						$scope.empty = keys.some(function(k){
							return (!$scope.model[k] || $scope.model[k].length===0);
						});
					},true);
				}
			};
		}).directive('inputMedOther', function() { 
			return { restrict:'E', scope:{model:'=', empty:'='}, replace:true, templateUrl:'tmpl/input-medication-other.html',
				controller:function($scope) {
					$scope.dose = ($scope.model.dose && $scope.model.dose.slice(0,-2)) || '';
					$scope.$watch('dose', function(d) {	
						if ($scope.dose && $scope.dose.trim().length > 0) { 
							$scope.model.dose = d + 'mg';
						} else {
							delete $scope.model.dose;
						}
					});
					var keys = ['name']
					$scope.$watch('model', function(){
						$scope.empty = keys.some(function(k){
							return (!$scope.model[k] || $scope.model[k].length===0);
						});
					},true);
				}
			};
		}).directive('inputActivity', function() { 
			return { restrict:'E', scope:{model:'=', empty:'='}, replace:true, templateUrl:'tmpl/input-activity.html',
				controller:function($scope){
					//check empty
					$scope.$watch('model', function(){
						$scope.empty = $scope.model.length===0;
					});
				}
			};
		}).directive('inputClinicalVisit', function() { 
			return { restrict:'E', scope:{model:'=', empty:'='}, replace:true, templateUrl:'tmpl/input-clinical-visit.html',
				controller:function($scope){
					//check empty
					var keys = ['nature'];
					$scope.$watch('model', function(){
						$scope.empty = keys.some(function(k){
							return (!$scope.model[k] || $scope.model[k].length===0);
						});
					},true);
				} 
			};
		}).directive('inputSymptoms', function() { 
			return { 
				restrict:'E', scope:{model:'=', empty:'='}, replace:true, templateUrl:'tmpl/input-symptoms.html',
				controller:function($scope) {
					$scope.setSeverity = function(i) { $scope.model.severity = i; };
					//check empty
					// var keys = ['severity','symptom'];
					var keys = ['symptom'];
					$scope.$watch('model', function(){
						$scope.empty = keys.some(function(k){
							return (!$scope.model[k] || $scope.model[k].length===0);
						});
					},true);

				} 
			};
		}).directive('inputWeight', function() { 
			return { restrict:'E', scope:{model:'=', empty:'='}, replace:true, templateUrl:'tmpl/input-weight.html', 
			controller:function($scope, utils) {
				$scope.units = $scope.model.units || 'kgs';
				$scope.val = $scope.model.val || '';
				$scope.valstones = $scope.model.valstones || '';
				$scope.vallbs = $scope.model.vallbs || '';

				$scope.$watch('valstones + vallbs', function() { 
					$scope.model = { stones: parseInt($scope.valstones), lbs : parseInt($scope.vallbs), units:'stlbs' };
				});
				$scope.$watch('val', function(v) { $scope.model = { val: v, units: $scope.units }; });
				//check empty
				var keys = ['val'];
				$scope.$watch('model', function(){
					$scope.empty = keys.some(function(k){
						return (!$scope.model[k] || $scope.model[k].length===0);
					});
				},true);
			}};
		});
