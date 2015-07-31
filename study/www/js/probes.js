/* jshint undef: true, strict:false, trailing:false, unused:false, quotmark:false */
/* global require, exports, console, process, module, L, angular, _, jQuery, FastClick, device, document, window, setTimeout, $, Keyboard, Backbone */



var tojson = function(x) { return JSON.stringify(x); };

angular.module('liecloud', ['lifecourse', 'ui.router'])
	.constant('probes', [
		{
			id:'1a',
			title:'social stenography: secrets in plain sight',
			href:'probes/steno1a.png',
			description:'This plugin lets you post messages to Facebook that actually mean other things.  <p> When you post something, it gets encoded a simple innocuous message, your friends can decode your message using a plug-in.'
		},
		{
			id:'1b',
			href:'probes/steno1b.png',
			title:'social stenography: secrets in plain sight',
			description:'You can also opt to not tell some of your friends about the encoded messages.'
		},
		{
			id:'2',
			title:'lieCal',
			href:'probes/lieCal.png',
			description:'lieCal is a fictional shared calendaring application for your workplace.  It integrates with your regular work calendar and lets you fill in days with that you want to have free to yourself with fake (but realistic) meetings, based on your past history.'
		},
		{
			id:'3',
			href:'probes/liecation.png',
			title:'lieCation',
			description:'lieCation is an app that you can use to make it seem that you are somewhere when you are not, such as a holiday, festival or work trip.<p> It allows you to schedule a series of social media posts located at a particular remote location, and helps you hand-pick an instagram feed for them as well'
		},
		{
			id:'4',
			href:'probes/lieMoves.png',
			title:'location sharing with falsification',
			description:'lieMoves is a social location sharing application for your mobile phone that lets you broadcast your location. But you can also tell it to falsify your tracks for some time if you like - by mimicing your past, impersonating others such as friends, or by engaging in activities that give of impressions of your choice.'
		},
		{
			id:'5',
			href:'probes/liemapper.png',
			title:'mapping lie propagation',
			description:'lieMapper is a visualisation of your social network, that will show you how far a lie would spread if it started at a particular person.'
		}
	]).config(function($stateProvider, $urlRouterProvider) {
		$urlRouterProvider.otherwise('/show/1a');
		$stateProvider.state('show', {
			url: '/show/:id',
			templateUrl: 'tmpl/probe.html',
			controller: function ($scope, $state, $stateParams, $sce, probes, utils) {
				console.info('show ', $stateParams);
				var id = $stateParams.id || '1a'; 
				var probe = $scope.probe = _(probes.filter(function(f) { return id == f.id; })[0] || {}).clone();
				console.log('params id ', $stateParams.id, id, ' ', probe);
				if (!probe.id) { $state.go('sorry'); return; }
				probe.description = $sce.trustAsHtml(probe.description);
				$scope.probeIndx = probes.map(function(x) { return x.id; }).indexOf(probe.id);
				$scope.probes = probes;

				$scope.next = function() {
					var nextIndx = $scope.probeIndx + 1;
					if (probes[nextIndx]) { 
						$state.go('show', {id:probes[nextIndx].id});
					} else {
						$state.go('thanks');						
					}
				};
				$scope.prev = function() {
					if ($scope.probeIndx > 0) { 
						$state.go('show', {id:probes[$scope.probeIndx-1].id});
					}
				};
			}
		}).state('sorry', {
			url:'/sorry',
			templateUrl:'tmpl/sorry.html'
		}).state('thanks', {
			url:'/thanks',
			templateUrl:'tmpl/thanks.html'
		});
	}).controller('probes', function($scope, $state, probes) {
		console.info('probes', probes);

	});
