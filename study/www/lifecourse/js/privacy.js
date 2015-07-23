/* jshint undef: true, strict:false, trailing:false, unused:false, quotmark:false */
/* global require, exports, console, process, module, L, angular, _, jQuery, Backbone, window */


angular.module('lifecourse')
	.config(function($stateProvider) {
		$stateProvider.state('privacy', {
            url: '/privacy',
            templateUrl: 'tmpl/privacy.html',
            resolve: {
                privacyHTML: function (utils) { return jQuery.ajax({ url: 'data/privacy.html', type:'GET' }); }
            },
            controller: function ($scope, privacyHTML, $sce) {
            	$scope.privacy = $sce.trustAsHtml(privacyHTML);
            }
        });
	});
