/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module, L, angular, _, jQuery, Backbone, d3, window */

angular.module('lifecourse')
	.directive('swipePage', function() { 
		return {
			restrict:'E',
			transclude:true,
			replace:true,
			templateUrl:'tmpl/swipe-page.html',
			controller:function($scope, $element, $transclude, utils) {

				var u = utils, sa = function(f) { utils.safeApply($scope, f); },			
					scrollBlock = false, to, 
					viewport = $element.find('.viewport'),
					w = viewport.outerWidth(),
					el, evtseq = [], startScrollTop, startScrollLeft;

				window.$el = $element;
					
				var update = function() { 
					var npages = $scope.npages = $element.find('.page').length;
					$scope.dots = u.range(npages); 
					$element.find('.page').outerWidth(w); // set to w.
					var viewidth =(w+2)*npages;
					// console.info('setting viewport width ', viewidth); 
					viewport.width(viewidth);			
				};

				$scope.$parent.$watch(function() { 
					// console.log('change'); 
					// console.log('viewportWidth > ', w, $element.find('.page').length);
					update();
				});

				$scope.clickDot = function(i) { 
					$scope.activepage = i;
					var currentElement = $element.find('.page')[i],
						view = $element.filter('.swipe-page');
					if (!currentElement || !view) { return ;}
					$element.filter('.swipe-page').animate({
						scrollLeft: jQuery(currentElement).position().left,
						scrollTop:0
					}, 200, 'swing', function() { 
						console.log('done anim');
					});
				};
				var snapScroll = function() { 
					// console.log('snap scrolling');
					var eL = $element.scrollLeft();
					if (eL > $scope.activepage * w && $scope.activepage < $scope.npages - 1) { 
						sa(function() { $scope.clickDot($scope.activepage + 1); });
					} else if (eL < $scope.activepage * w && $scope.activepage > 0) {
						sa(function() { $scope.clickDot($scope.activepage - 1); });						
					}
				};
				// $element.on('scroll', function() { 
				// 	if (to) { clearTimeout(to); }					
				// 	if (!w || scrollBlock) { console.log('returning ', w, scrollBlock); return; }
				// 	console.log('user scroll', $element.scrollLeft());										
				// 	to = setTimeout(snapScroll, 10); 
				// 	if (evtseq[0] = 'ts') { evtseq[1] = 'scroll'; };
				// });

				$element.on('scroll', function() { 
					if (evtseq[0] == 'ts') {
						evtseq[1] = 'scroll';
					} else {
						evtseq = [];
					}
				});
				$element.on('touchstart', function() { 
					evtseq = ['ts']; // reset touchseq
					// console.log('touchstart!!'); 
					startScrollTop = $element.scrollTop();
					startScrollLeft = $element.scrollLeft();
				});
				$element.on('touchend', function() { 
					// console.log('touchend!!'); 
					if (evtseq.length == 2 && 
						Math.abs($element.scrollTop() - startScrollTop) < Math.abs($element.scrollLeft() - startScrollLeft)) { 
						evtseq = [];						
						snapScroll();
					}
				});
				$element.on('click', function() { 
					// console.log('clearing');
					evtseq = [];
				});

				$scope.clickDot(0);
				update();				
			}
		};
	}); 
