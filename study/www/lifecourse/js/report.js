/*jshint undef: true, strict:false, trailing:false, unused:false, quotmark:false */
/*jslint ass: false, sloppy: true, unparam: true */
/*global require, exports, console, process, module, L, angular, jQuery, Backbone, d3, window, _ */

angular.module('lifecourse')
  .config(function ($stateProvider, $urlRouterProvider) {
	$stateProvider.state('report', {   
		url: '/report',
		templateUrl: 'tmpl/report.html',
		resolve : {
			profile:function(storage)  { return storage.getProfile(); },
			prescriptions:function(storage)  { return storage.getPrescriptions(); },
			diary:function(storage)  { return storage.getDiary(); },
			meds: function (medsdb) { return medsdb; }
		},			
		controller:function($scope, $state, utils, prescriptions, meds, diary, profile, storage, notifications, remote) {
			// stuff
			var u = utils,
				sa = function(f) { utils.safeApply($scope, f); },
				personal = u.getModel(profile, 'personal'),
				taking = prescriptions.filter(function(x) { return x.get('taking'); })
					.map(function(x) { return _({
						id:x.id,
						type:'prescription',
						taking:true,
						medname:meds[x.id].name,
						medcat:meds[x.id].category,
						medcatlabel:meds[x.id].catlabel,
						medid:x.id,
						dosage:x.get('dosage'),
						frequency:x.get('frequency')
					}).chain().extend(storage.m2d(x,true)).value();
				});

			// feels = diary.filter(function(x) { return x.get('feel') !== undefined || x.get('palpitations') !== undefined || x.get('breathless') !== undefined; }),
			// inr = diary.filter(function(x) { return x.attributes.created !== undefined && x.attributes.type == 'inr'; }),
			// medtakens = diary.filter(function(x) { return x.get('medid') !== undefined; });

			// compile directly 
			var compileReport = function() { 
				return { 
					profile: storage.m2d(personal, true),
					diary: diary.filter(function(x) { return x.get('created') !== undefined; })
						.map(function(x) { return storage.m2d(x, true); }).concat(taking)
				};
			};

			// console.info('taking ~ ', taking, meds);
			// $scope.report = JSON.stringify(compileReport(), null, '   ');

			$scope.generatePDF = function() { 
				$scope.loading = true;
				/*var payload = { 
					personal: storage.m2d(personal),
					feels: feels.map(function(x) { return storage.m2d(x); }),
					inrs : inr.map(function(x) { return storage.m2d(x); }),
					medtakens : medtakens.map(function(m) { return storage.m2d(m); })
				};*/
				remote.request({ url:'/report/pdf', method:'POST', data: compileReport() }).then(function(response) { 
					console.info('got response from server : ', response);
					var url = remote.makePDFReportURL(response[0].response.uuid);
					console.info('opening', url);
					utils.openinSystemBrowser(url);
					sa(function() { delete $scope.loading;	});
				}).catch(function(ee) { 
					console.error('error ', ee);
				});
			};

			$scope.generateXLSX = function() { 
				$scope.loading = true;
				remote.request({ url:'/report/xlsx', method:'POST', data: compileReport() }).then(function(response) { 
					console.info('got response from server : ', response);
					var url = remote.makeXLSXReportURL(response[0].response.uuid);
					console.info('opening', url);
					utils.openinSystemBrowser(url);
					sa(function() { delete $scope.loading;	});
				}).catch(function(ee) { 
					console.error('error ', ee);
				});
			};
		}
	});
});
