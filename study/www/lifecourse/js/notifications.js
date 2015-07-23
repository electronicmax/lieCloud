/* jshint undef: true, strict:false, trailing:false, unused:false, quotmark:false */
/* global require, exports, console, process, module, L, angular, _, jQuery, window, document */

angular.module('lifecourse')
    .factory('notifications', function(storage, utils, $state) {
        var u = utils, 
            store,
            getNotificationStuff = function(nid) { 
                if (!store) { console.error('local notifications not enabled');  return u.dreject(); }
                var d = u.deferred();
                store.then(function(lstore) { window.lstore = lstore; d.resolve(lstore.get(nid));   });
                return d.promise();
            },
            nl,
            ndebug = true,
            callbacks = {},
            callbacks_cancel = {},
            nlog = function() { if (ndebug) { console.log.apply(console, ['notifications::'].concat(_.toArray(arguments))); } };

        var NotificationsManager = {
            init : function() { 
                nlog('NOTIFICATIONSMANAGER :: INIT GETTING LOCAL STUFF');
                store = storage.getNotifications(); 
                nl.onclick = function (id, state, json) {
                    if (callbacks[id]) {
                        callbacks[id](id, state, json);
                        delete callbacks[id];
                    }
                };
                nl.oncancel = function (id, state, json) {
                    if (callbacks_cancel[id]) {
                        callbacks_cancel[id](id, state, json);
                        delete callbacks_cancel[id];
                    }
                };
                return this.updateNotifications();
            },            
            getScheduledNotifications:function() {
                if (!store) { return u.dresolve([]); }
                var d = u.deferred();
                nlog('nl > getScheduledIds');
                nl.getScheduledIds(function (scheduledIds) {
                    nlog('nl > getScheduledIds > ', scheduledIds);
                    u.when(scheduledIds.map(getNotificationStuff)).then(d.resolve).fail(d.reject);
                });
                return d.promise();
            },
            _removeOldStoredNotifications:function() { 
                // returns { id1: notification, id2: not2 ... } for unfired notifications
                nlog('_getFutureStoredNotitications ', typeof store);
                if (!store) { return u.dreject(); }
                var d = u.deferred(), today = new Date();
                store.then(function(lstore) {
                    nlog('notification :: getfuture - got lstore ', lstore.length);
                    d.resolve(lstore.filter(function(item) { 
                        if (item.get('type') == 'notification' && item.get('when').valueOf() < today.valueOf()) {
                            lstore.remove(item);
                        }
                    }));
                });
                return d.promise();
            },
            _getFutureStoredNotifications:function() { 
                // returns { id1: notification, id2: not2 ... } for unfired notifications
                nlog('_getFutureStoredNotitications ', typeof store);
                if (!store) { return u.dreject(); }
                var d = u.deferred(), today = new Date();
                store.then(function(lstore) {
                    nlog('notification :: getfuture - got lstore ', lstore.length);
                    d.resolve(lstore.filter(function(item) { 
                        return item.get('type') == 'notification' && item.get('when').valueOf() >= today.valueOf();
                    }));
                });
                return d.promise();
            },
            _addNL : function(id, time, message, title, onClick) {
                callbacks[id] = onClick;
                if (!_.isDate(time)) { 
                    console.error('_addNL :: date must be a date ', time); 
                } else {
                    console.log(' _addNL :: date is a date ', time);
                }
                if (!nl) { return u.dresolve(); }
                // nlog('addNL ~~~ ', JSON.stringify({id: id, date:time, message:message, title:title, autoCancel:true }));                
                var notification = {id: id, date:time, message:message, title:title, sound:null, autoCancel:false};
                nlog('NL:: nl.add ', JSON.stringify(notification));
                nl.add(notification);                
                return u.dresolve(); // d.promise();
            },
            nlcancel:function(id) { 

                if (!nl) { return u.dresolve(); } 
                var d = u.deferred();
                nl.getScheduledIds(function(ids) {
                    if (ids.indexOf(id) >= 0) {
                        nlog('NL:: nl.cancel', id);
                        // well this didn't work :( 
                        // nl.cancel(id, function() { 
                        //     nlog('success cancelling');
                        //     d.resolve();
                        // });
                        
                        var cb = function () {
                            d.resolve();
                        };
                        callbacks_cancel[id] = cb;
                        nl.cancel(id);
                        //d.resolve();
                    } else { d.resolve(); }
                });
                return d.promise();
            },
            updateNotifications:function() {
                // console.log('UPDATE NOTIFICATIONS');
                // find stack. 
                // try {  throw new Error();    } catch (e) { console.log(e.stack); }
                // updates cordova notifications to match what's in the database.
                if (!store) { return u.dreject(); }
                var d = u.deferred(), this_= this;                
                store.then(function(lstore) {
                    try { 
                        nlog('notifications :: lstore ', lstore.length);
                        nl.getScheduledIds(function (scheduledIds) {
                            nlog('notifications :: ALREADY SCHEDULED notifications > ', scheduledIds.length);
                            // step 1: first check all scheduled ids to make sure we know about them

                            // parallel version
                            // var d1 = u.when(scheduledIds.map(function(sid) { 
                            //     var n = lstore.get(sid), d_ = u.deferred();
                            //     if (n === undefined) {
                            //         console.error('got a notification have never heard about - cancelling it.', sid);
                            //         this_.nlcancel(sid).then(d_.resolve);
                            //         return d_.promise();
                            //     }                
                            // })), d2 = u.deferred();

                            // serial version
                            console.log('cancel one ', scheduledIds);
                            var d1 = u.dmap(scheduledIds, function(sid) { 
                                var n = lstore.get(sid);
                                if (n === undefined) {
                                    console.error('got a notification have never heard about - cancelling it.', sid, typeof sid);
                                    return this_.nlcancel(sid);
                                }                
                                return u.dresolve();
                            }), d2 = u.deferred();

                            // step 2: check all things we expect to have notifications about and
                            // create em 
                            this_._getFutureStoredNotifications().then(function(storednsd) { 
                                nlog('got future notifications that havent been created >> ', storednsd.length);

                                // parallel code
                                // u.when(_(storednsd).map(function(n) {
                                //     if (scheduledIds.indexOf(n) <= 0) {
                                //         return this_._addNL(n.id, n.get('when'), n.get('message'), n.get('title'), n.get('onClick'));
                                //     }
                                //     return u.dresolve();
                                // })).then(d2.resolve).fail(d2.reject);

                                // // serial code
                                console.log('future >> ', storednsd);
                                u.dmap(storednsd, function(n) {
                                    if (scheduledIds.indexOf(n.id) <= 0) {
                                        console.log('calling addNL with ', n.id, ' :::::::::: ', n.attributes);
                                        return this_._addNL(n.id, n.get('when'), n.get('message'), n.get('title'), n.get('onClick'));
                                    }
                                    return u.dresolve();
                                }).then(d2.resolve).fail(d2.reject);
                            });
                            u.when([d1,d2]).then(function (){
                                this_._removeOldStoredNotifications().then(d.resolve).fail(d.reject);   
                            }).fail(d.reject);
                        });
                    } catch(e) { console.error(e); }
                }).catch(d.reject);
                return d.promise();
            },
            createLocalNotificationwithId:function(id, lstore, title, message, when, onClick) { 
                nlog('new notification ', id, ' - being created with date ', when);
                var m = u.getModel(lstore, id, true);
                m.set({ when: when, title: title, message: message, type:'notification', onClick: onClick });
                return m;
            },            
            createLocalNotification:function(lstore, title, message, when, onClick) { 
                nlog('new OLD STYLE notification being created with date ', when);
                var id = u.numberGUID(7),
                    m = u.getModel(lstore, id, true);
                m.set({ when: when, title: title, message: message, type:'notification', onClick: onClick });
                return m;
            },
            getLocalNotifications:function(lstore) { 
                return lstore.models.filter(function(x) { return x.get('type') == 'notification'; });
            },
            isScheduled:function(lmodel) {
                var d = u.deferred();
                nl.getScheduledIds(function (scheduledIds) { 
                    if (scheduledIds.indexOf(lmodel.id) >= 0) { 
                        return d.resolve(true); 
                    } 
                    d.resolve(false); 
                });
                return d.promise();                
            },
            cancelLocalNotification:function(lmodel) {
                var d1 = u.deferred(), d2 = u.deferred(), this_ = this;
                this.nlcancel(lmodel.id).then(d1.resolve);
                console.info(' !!!!!!!!!!! calling destroy on lmodel ', lmodel.id);
                // lmodel.collection.remove(lmodel);
                lmodel.destroy().then(d2.resolve);
                // lmodel.collection.remove(lmodel);
                return u.when([d1,d2]);
            }
        };

        document.addEventListener('deviceready', function () {

            // nlog('notifications :: deviceready!');
            if (window.plugin.notification === undefined ||
                window.plugin.notification.local === undefined) {
                console.error("Local Notification Plugin is not installed.");
                nlog("NOTIFICATION :: Local Notification Plugin is not installed.");
                return;
            } 
            nl = window.plugin.notification && window.plugin.notification.local;
            window.nl = nl;
            nl.promptForPermission();
            nlog("notifications: about to ask if granted");
            nl.hasPermission(function (granted) {
                nlog("notifications: granted? ", granted);
                /*
                if (!granted) {
                    nlog("prompted");
                }
                */
            });

            var makeTestNotification = function(lstore)  {
                var lsh = NotificationsManager.createLocalNotification(lstore, "It's time to made a diary entry!", "Click to compose an entry now.", new Date(new Date().valueOf() + 30000), function (id, state, json) { console.log("Notification clicked, going to compose screen!", id, state, json); $state.go("grid-input"); });
                lsh.save().then(function() { 
                    // nlog('update notifications!');
                    NotificationsManager.updateNotifications().then(function () {
                        nlog("new notifications all done.");
                    });
                 });                
            };

            NotificationsManager.init().then(function () {
                 store.then(function(lstore) { 
                    // makeTestNotification(lstore); 
                    // DEBUG.
                });
             });
        }, false);

        return NotificationsManager;
    });
