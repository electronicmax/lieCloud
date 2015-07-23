/* jshint undef: true, strict:false, trailing:false, unused:false, quotmark:false */
/* global require, exports, console, process, module, L, angular, _, jQuery, window, document, store, device */

(function() {

    angular.module('lifecourse')
        .factory('purchases', function(storage, remote, utils, $state, $timeout) {
            // console.info("Purchases Manager purchases factory top");
            var u = utils,
                init_success, init_fail,
                ASK_FOR_GRACE = -9999,
                DEBUG = true,
                debuglog = function() { 
                    if (DEBUG) {
                        console.log.apply(console, ['[purchases.js]'].concat(_.toArray(arguments)));
                    }
                },
                validateReceipt = function() {
                    if (utils.isiOS()) { return remote.validateAppStoreReceipt.apply(remote,arguments); }
                    if (utils.isAndroid()) { return remote.validatePlayStoreReceipt.apply(remote,arguments); }
                    throw new Error("purchases.validateReceipt ~ Unknown platform ", device && device.platform);
                },
                askforGrace = function() {
                    if (utils.isiOS()) { return remote.askforGraceAppStore.apply(remote,arguments); }
                    if (utils.isAndroid()) { return remote.askforGracePlayStore.apply(remote,arguments); }
                    throw new Error("purchases.askForGrace ~ Unknown platform ", device && device.platform);
                },
                PurchasesManager = {
                productList: {
                    "1monthpro2": {subinfo: "1-month"},  
                    "1yearpro2" : {subinfo: "1-year"}
                },
                buy: function (productName) {
                    debuglog("purchases: buy", productName);
                    var this_ = this;

                    return new Promise(function(win, lose) {
                        store.order(productName)
                            .then(function (order) {  win(order);  })
                            .error(lose);
                    });
                },
                initialised : new Promise(function(suc_cb, fail_cb) { 
                    init_success = suc_cb; 
                    init_fail = fail_cb;
                }),
                getProducts : function() {  
                    var this_ = this;
                    return this.initialised.then(function() { 
                        var infos = store.products.map(function(p) {
                            var info = _(p).chain().clone().extend(this_.productList[p.id]).value();
                            return info;
                        });
                        return infos;
                    }); 
                },
                addListeners:function() { 
                    store.products.map(function(product) { 
                        var productId = product.id;
                        console.info('listening to ', productId);
                        store.when(productId).approved(function(product) {
                            console.info('purchases.js >> APPROVE cb ', productId, product, product.transaction, product.transaction && product.transaction.transactionReceipt);
                            if (!product.transaction) { 
                                console.error("There is no transaction on this product.", product, product.transaction, product.transactions);
                                product.finish();
                            } else {
                                console.info('transaction receipt is here , time to verify ');
                                product.verify();
                            }
                        });
                        store.when(productId).verified(function(product, error) { 
                            console.info('purchases.js > got VERIFIED callback - ', product, error);
                            product.finish();
                        });
                        store.when(productId).unverified(function(product, error) { 
                            console.error('purchases.js > got UNVERIFIED callback - ', product, error);
                            // todo this is bad. means for some reason server didn't get the message.
                            if (error && error.code == ASK_FOR_GRACE) { 
                                var receipt = product && product.transaction;
                                askforGrace(product, receipt).then(function() {
                                    console.info('asked for grace');
                                    product.finish();
                                }).catch(function(error) { 
                                    console.error('ask for grace failed.', error);
                                });
                            } 
                        });
                        store.when(productId).updated(function(product) { console.info('product UPDATED ', product);   });       
                    });             
                },
                init: function() {
                    // initialise, called on device ready
                    var this_ = this;
                    debuglog("Purchases Manager init");
                    store.verbosity = store.DEBUG;
                    if (!window.store) {
                        debuglog('Purchases Manager error: store not available');
                        init_fail();
                        return this.initialised;
                    }

                    store.validator = function(product, callback) {
                        var transaction = product && product.transaction;
                        validateReceipt(product,transaction).then(function(result) { 
                            var code = result && result[1];                                
                            debuglog('validateAppStore promise OK > ', result, code);
                            if (code == 201) {
                                debuglog('callback truth -- payment has been made');
                                callback(true, result);
                            } else {
                                debuglog(' callback code is not 201 ');
                                callback(false, {  code: store.PURCHASE_EXPIRED,  message: "Error "  });
                            }
                        }).catch(function(error) {
                            console.log("Caught error",error);
                            // catch store conflicts
                            if (error.name == 'AppStoreReceiptConflict') {
                                // this means that the server already has it
                                debuglog('GOT AppStoreReceiptConflict Error');                                    
                                return callback(true); // finalise the purchase
                            }
                            if (error.name == 'PlayStoreReceiptConflict') {
                                debuglog('GOT PlayStoreReceiptConflict Error');
                                return callback(true);
                            }

                            debuglog('falling back to asking for grace > ', error);
                            callback(false, {code:ASK_FOR_GRACE, message:error.message, name:error.name });                                
                        });
                    };

                    // Enable maximum logging level
                    store.verbosity = store.DEBUG;

                    // Inform the store of your products
                    debuglog('Purchases Manager register product');

                    _(this.productList).keys().map(function (productId) {
                        console.info('store registering ', productId);
                        store.register({
                            id:     productId,
                            alias:  productId,
                            type:   store.PAID_SUBSCRIPTION
                        });
                    });

                    this_.addListeners();                    

                    // Log all errors
                    store.error(function(error) { 
                        console.error('Purchases Manager ERROR ' + error.code + ': ' + error.message);  
                    });                    
                    store.ready(init_success); 
                    store.refresh();
                    return this.initialised;
                }
            };

            document.addEventListener('deviceready', function () {
                // debuglog("Purchases factory deviceready called - ", window.device && window.device.platform);
                $timeout(function() { 
                    debuglog('initialising store');
                    PurchasesManager.init().then(function() {
                        debuglog("Purchases Manager finished, store is done.");
                    });
                }, 10000);
            }, false);

            debuglog("Purchases factory running.");
            window.pm = PurchasesManager;
            return PurchasesManager;
        }).factory('purchasesTester', function(purchases) {
            return {
                test: function() {
                    purchases.initialised.then(function() {
                        console.log('purchasesTester :: initialised store now running tests');
                        var prodc = _(purchases.productList).keys()[0];
                        purchases.buy(prodc).then(function(x) {
                            console.log("purchasesTester :: SUCCESS CONT", x);
                        }).catch(function(err) {
                            console.error("purchasesTester :: ERROR CONT", err);
                        });
                    });
                },
                testBadReceipt: function() {
                    var fakeProduct = {

                    };
                    // purchases.validate();
                }
            };
        });

})();

/* 
                
                updatePurchaseState: function() { 
                    var purchases = store.products.filter(function(x) { return x.owned; }),
                        ispro = purchases.length > 0,
                        purchaseid = ispro && purchases[0].id;

                    console.info("UPDATING PURCHASES STATE ", ispro, purchaseid);

                    return this.setPurchaseState(ispro, purchaseid);
                },
                setPurchaseState : function(ispro, type, date) { 
                    var d = u.deferred();
                    storage.getProfile().then(function (profile) {
                        var personal = utils.getModel(profile, "personal");
                        if (ispro !== personal.get('bought-lifecourse')) { 
                            debuglog("purchases: buy, order, profile", profile);
                            personal.set("bought-lifecourse", ispro); // e.g. sets bought-afinitypro, used in home.js to set $scope.ispro
                            if (type) { personal.set("bought-lifecourse-type", type); } else { personal.unset('bought-lifecourse-type'); }
                            if (date) { personal.set('bought-lifecourse-date', date); } 
                            personal.save().then(function () {
                                debuglog("purchases: SAVED: ", personal.attributes);
                                d.resolve(ispro);
                            });
                        } else {
                            // already the same
                            d.resolve(ispro);
                        }
                    });
                    return d.promise();
                },
*/

