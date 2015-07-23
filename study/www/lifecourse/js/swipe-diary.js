/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module, L, angular, _, $, jQuery, Backbone, window, clearTimeout, setTimeout */

angular.module('lifecourse')
	.config(function($stateProvider, $urlRouterProvider) {
		$stateProvider.state('swipe-diary', {
			url:'/swipe-diary?day',
			templateUrl:'tmpl/swipe-diary.html',
            resolve: {  
                diary:function(storage)  { return storage.getDiary(); },
                meds: function (medsdb) { return medsdb; }              
            },
			controller:function($scope, $stateParams, $timeout, diary, diaryFactory, meds, remote, utils) {
                var u = $scope.u = utils, 
                    sa = function(f) { u.safeApply($scope, f); },
                    makeCard = function(title) { 
                        var date = u.plusDays( $stateParams.day ? new Date($stateParams.day) : new Date() , title);
                        return {
                            classes: {}, title: title, 
                            date: date,
                            entries : (diarybyday && diarybyday[u.startofDay(date)]) || [] 
                        };
                    }, 
                    diarybyday = u.dictCat(diary.filter(function(x) { return x.get('created'); }).map(function(x) { 
                        return [ u.startofDay(x.get('created')), x ];
                    })),
                    cur_card_offset = 0,
                    cards = $scope.cards = [makeCard(cur_card_offset)],
                    reaper,
                    REAPER_TIMEOUT = 30000000,
                    removeAllBut = function(card) {
                        var indx = cards.indexOf(card);
                        if (indx >= 0) {
                            cards.splice(0,indx);
                            cards.splice(1);
                        }
                    },
                    swipeRight = $scope.swipeRight = function() { 
                        sa(function() {     
                            console.info('swiperight ');
                            // if (reaper) { $timeout.cancel(reaper); }
                            // cards.map(function(c) { c.classes = { exitRight : true }; });                            
                            // determine next card
                            var cur = cards.filter(function(x) { return x.title == cur_card_offset; })[0];
                            cur.classes = {exitRight:true};

                            // remove the offset class when transitioning is complete
                            var cco = cur_card_offset;                            
                            $timeout(function(){ setOffs(cco); }, 1000);

                            cur_card_offset--;
                            var newCard = cards.filter(function(x) { return x.title == cur_card_offset; })[0];
                            if (newCard === undefined) { 
                                newCard = makeCard(cur_card_offset); 
                            } else {
                                console.log('setting offs curCard manually >> ', cur_card_offset);                                
                                setOffs(cur_card_offset);
                            }
                            $scope.cur_card = newCard;
                            newCard.classes = { enterLeft : true };
                            if (cards.indexOf(newCard) < 0) { cards.splice(0, 0, newCard);  }
                            $timeout(function() { newCard.classes = {transitioning:true}; }, 100);                                                
                            // reaper = $timeout(function() { 
                            //     removeAllBut(newCard);  
                            //     console.info('reaped',  cards.map(function(x) { return x.title; }));                                
                            // }, REAPER_TIMEOUT);                            
                        });
                    },
                    swipeLeft = $scope.swipeLeft = function() { 
                        sa(function() { 
                            // if (reaper) { $timeout.cancel(reaper); }                        
                            // cards.map(function(c) { c.classes = { exitLeft : true }; });                            
                            var cur = cards.filter(function(x) { return x.title == cur_card_offset; })[0];
                            cur.classes = {exitLeft:true};

                            // remove the offset class when transitioning is complete                            
                            var cco = cur_card_offset;
                            $timeout(function(){ setOffs(cco); }, 1000);
                            cur_card_offset++;
                            var newCard = cards.filter(function(x) { return x.title == cur_card_offset; })[0];
                            if (newCard === undefined) { 
                                newCard = makeCard(cur_card_offset); 
                            } else {
                                // already existing, clear the offset
                                console.log('setting offs curCard manually >> ', cur_card_offset);
                                setOffs(cur_card_offset);
                            }
                            $scope.cur_card = newCard;                            
                            newCard.classes = { enterRight : true };
                            if (cards.indexOf(newCard) < 0) { cards.splice(cards.length, 0, newCard); }
                            $timeout(function() { newCard.classes = {transitioning:true}; }, 100);
                            // reaper = $timeout(function() { 
                            //     removeAllBut(newCard); 
                            //     console.info('reaped',  cards.map(function(x) { return x.title; }));
                            // }, REAPER_TIMEOUT);
                        });
                    },
                    evt2pos = function(evt) { 
                        return { 
                            x : (evt.originalEvent.touches.length && evt.originalEvent.touches|| evt.originalEvent.changedTouches)[0].clientX,
                            y : (evt.originalEvent.touches.length && evt.originalEvent.touches || evt.originalEvent.changedTouches)[0].clientY
                        };
                    },
                    start_pos,
                    dist = function(p1,p2) {
                        return Math.sqrt( Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2) );
                    },
                    diff = function(p1, p2) {
                        return { x: p2.x - p1.x, y : p2.y - p1.y };
                    },
                    H_THRESH = 50,
                    dragStart = function(evt) { 
                        start_pos = evt2pos(evt);
                        sa(function() { 
                            cards.map(function(x) { x.classes.transitioning = false; });
                        });
                        // console.info('dragstart', start_pos);
                    },
                    dragEnd = function(evt) { 
                        console.log('dragend evt ', evt);
                        var end = evt2pos(evt),
                            sediff = diff(start_pos,end);
                        if (sediff.x > H_THRESH) {
                            console.info('SWIPE RIGHT THRESH diff ', sediff.x);
                            swipeRight();
                        } else if (sediff.x < -H_THRESH) {
                            console.info('SWIPE LEFT THRESH diff ', sediff.x);
                            swipeLeft();
                        } else {
                            console.info('didnt make thresh diff ', sediff.x);                            
                            // reset to none
                            setOffs(cur_card_offset);                            
                        }
                    },
                    setOffs = function(cardno, offs) { 
                        if (!offs) {
                            console.info('clearing offsets ',  $('.swipe-diary .card[cardno='+cardno+']').length);
                            $('.swipe-diary .card[cardno='+cardno+']').css('left', '').css('right', '');
                            return;
                        }
                        console.log('setting offs for ', cardno);
                        $('.swipe-diary .card[cardno='+cardno+']').css({  left: 20 + offs.x, right: 20 - offs.x  } );
                    },
                    drag = function(evt) { 
                        // console.info('drag', evt);
                        // cur = cards.filter(function(x) { return x.title == cur_card_offset; })[0],                            
                        var pos = evt2pos(evt),
                            delta = diff(start_pos, pos);

                        setOffs(cur_card_offset, delta);
                    };

                $scope.cur_card = $scope.cards[0];                            
                $scope.diary = diary;
                $scope.meds = meds;
                $scope.diaryFactory = diaryFactory;

                $('.swipe-diary').on('touchstart', '.card', dragStart);
                $('.swipe-diary').on('touchend', '.card', dragEnd);
                $('.swipe-diary').on('touchmove', '.card', drag);

                // scroll lock this view
                utils.setScrollLock($scope);                

                $scope.$on('$destroy', function() { 
                    if (reaper) { $timeout.cancel(reaper); }
                    $('.swipe-diary').off('touchstart', '.card', dragStart);
                    $('.swipe-diary').off('touchend', '.card', dragEnd);
                    $('.swipe-diary').off('touchmove', '.card', drag);
                });
                window.ss = $scope;
            }
        });
    }).directive('diaryEntriesContainer',function(){
        return {
            restrict:'E',
            replace:true,
            scope: { diary:'=', meds:'=', entries:'=' },
            templateUrl:'tmpl/diary-entries-container.html',
            controller:function($scope, $sce, utils) { 
                var u = utils, sa = function(f) { utils.safeApply($scope, f); },
                    expandeds = $scope.expandedstates = u.dict($scope.entries.map(function(ent) { 
                        return [ent.id, {state: false}];
                    })),
                    expandedCB = $scope.expandedCB = function(id) { 
                        console.info('expanded cb ', id, expandeds);
                        _(expandeds).map(function(v,k) {
                            if (k !== id && v.state) { 
                                console.log('clearing state ', k);
                                expandeds[k].state = false; 
                            }
                        });
                    },
                    deletecb = $scope.deletecb = function(entry) {
                        $scope.entries = _($scope.entries).without(entry);
                        console.log('deleting ', entry.id);
                        entry.destroy();
                    };
                    // entries = $scope.entries =  $scope.diaryfactory.getDayEntries($scope.diary, $scope.date);
                // console.log('entries ', entries);
            }
        };    
    }).directive('swipeDiaryPage', function() { 
        return { 
            restrict:'E',
            replace:true,
            scope: { diary:'=', date:'=', meds:'=', entries:'=' },
            templateUrl:'tmpl/swipe-diary-page.html',
            controller:function($scope, $sce, utils) { 
                var u = utils, sa = function(f) { utils.safeApply($scope, f); },
                    dow = $scope.dow = function(date)  { return utils.DOW_FULL[date.getDay()]; },
                    month = $scope.month = function(date) { 
                        // console.log('date ', date);
                        return utils.MON_FULL[date.getMonth()];
                    },
                    orderCreated = $scope.orderCreated = function(x) { return x.attributes.created; },
                    expandeds = $scope.expandedstates = u.dict($scope.entries.map(function(ent) { 
                        return [ent.id, {state: false}];
                    })),
                    expandedCB = $scope.expandedCB = function(id) { 
                        console.info('expanded cb ', id, expandeds);
                        _(expandeds).map(function(v,k) {
                            if (k !== id && v.state) { 
                                console.log('clearing state ', k);
                                expandeds[k].state = false; 
                            }
                        });
                    },
                    deletecb = $scope.deletecb = function(entry) {
                        $scope.entries = _($scope.entries).without(entry);
                        console.log('deleting ', entry.id);
                        entry.destroy();
                    };
                    // entries = $scope.entries =  $scope.diaryfactory.getDayEntries($scope.diary, $scope.date);
                // console.log('entries ', entries);
            }
        };
    }).directive('swipeDiaryEntry', function() { 
        return { 
            restrict:'E',
            replace:true,
            scope: { m:'=', meds:'=', expandedcb:'=', showButtons:'=expanded', deletecb:'=' },
            templateUrl:'tmpl/swipe-diary-entry.html',
            controller:function($scope, $sce, $timeout, utils) {
                var u = utils, sa = function(f) { utils.safeApply($scope, f); },
                    feels = $scope.feels = ['very poorly', 'poorly', 'fine', 'well','very well'],
                    m = $scope.m,
                    entry = $scope.entry = _(m.attributes).clone(),
                    click = $scope.click = function(c) { 
                        if ($scope.entry.deleteShowing) { 
                            $scope.entry.deleteShowing = false;
                            return;
                        }
                        $scope.edit(m);
                    };
                entry.textfeels = entry.feel ? feels[parseInt(entry.feel)-1] : undefined ;                
                if ($scope.entry.medid) {
                    $scope.entry.medinfo = _($scope.entry.medinfo || {}).chain().clone().extend($scope.meds[$scope.entry.medid]).value();
                }
                $scope.showDelete = function() { $scope.entry.deleteShowing = true; };
                $scope.timeString = function(d) { return u.toHHMMampm(d); };
                $scope.hideDelete = function(e) { $scope.entry.deleteShowing = false;   };
                $scope.pad = function(v) { return u.pad(v); };
                $scope.todate = function(str) { return new Date(parseInt(str)); };
                $scope.toggleButtonVisibility=function() {
                    $scope.showButtons = !$scope.showButtons;
                    if ($scope.showButtons && $scope.expandedcb) { $scope.expandedcb(m.id); }
                };
                $scope.textType = !(entry.feel || entry.symptoms || entry.medinfo || entry.clinicalvisit || entry.activity) && entry.notes;                
                $scope.feelType = !$scope.textType && entry.feel;
                $scope.medType = entry.medinfo;
                $scope.bpType = entry.bp;
                $scope.qrskType = entry.qrisk;
                $scope.hrType = entry.hr;
                $scope.weightType = entry.weight;
                $scope.inrType = entry.type == 'inr';
                $scope.fileType = m.file;
                if (m.file) {
                    $scope.bgURL = u.profilePhotoStyle(m.getThumbnailURL());
                    $scope.fileThumbnailURL = m.getThumbnailURL();
                    m.getFileURL().then(function(url) {
                        sa(function() { $scope.fileURL = url; });
                    });
                }
                $scope.otherMeasureType = entry.otherMeasurement !== undefined;
                $scope.clinicalVisitType = entry.clinicalvisit !== undefined;
                $scope.activityType = entry.activity !== undefined;

                $timeout(function() { $scope.loaded = true; }, 100);
            }
        };

    });
