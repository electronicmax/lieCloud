/* jshint undef: true, strict:false, trailing:false, unused:false, quotmark:false */
/* global require, exports, console, process, module, L, angular, _, jQuery, Backbone, window */


angular.module('lifecourse')
	.config(function($stateProvider) {
		$stateProvider.state('eula', {
            url: '/eula',
            templateUrl: 'tmpl/eula.html',
            resolve: {
                eulaHTML: function (utils) { return jQuery.ajax({ url: 'data/eula.html', type:'GET' }); }
            },
            controller: function ($scope, eulaHTML, $sce) {
            	$scope.eula = $sce.trustAsHtml(eulaHTML);
            }
        });
	});
