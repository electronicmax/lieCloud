/* jshint undef: true, strict:false, trailing:false, unused:false, -W110 */
/* global require, Backbone, PouchDB, $, exports, console, store, process, module, L, angular, io, _, jQuery, Backbone, SyncedStorage, SyncedStorageModel, SyncedStorageCollection */

// sync
//   remote sync logic for storage.js to v2 PInCH Server
//

(function() {
    angular.module('lifecourse')
        .factory('remote', function (utils, $state, $http) {
            var DEBUG = true,
                u = utils,
                debuglog = function() {
                    if (DEBUG) { console.log.apply(console, arguments); }
                },
                getCredentials = function() { 
                    return utils.getFactory('storage').getProfile().then(function(c) {
                        var m = utils.getModel(c, 'credentials', true);
                        if (m && m.get('token') && m.get('email')) {
                            return { token: m.get('token'), email : m.get('email') };
                        }
                        return {};
                    });
                },
                validateToken = function () {  return request({ url: '/auth/validate',  method: 'GET' });   },
                setCredentials = function (email, token) {
                    return utils.getFactory('storage').getProfile().then(function(c) {
                        var m = utils.getModel(c, 'credentials', true);
                        if (email && token) {
                            debuglog("remote :: SETTING NEW AUTHED USER ", email, " :: ", token);
                            m.set('email', email);
                            m.set('token', token);
                            remote.trigger('authenticated', email);
                        } else { 
                            m.unset('email');
                            m.unset('token');
                            disconnect();
                            remote.trigger('unauthenticated');
                        }
                        return m.save();
                    });
                },
                // states 
                PENDING = -1,
                NOT_AUTHED = 0,
                AUTHED_DISCONNECTED = 1,
                CONNECTED = 2,
                PAYMENT_NEEDED = 3,
                state = PENDING,                
                switchState = function(next_state) {
                    debuglog('remote :: switchState', next_state);
                    var prev_state = state;
                    if (prev_state == next_state) { return; }
                    state = next_state;                    
                    iremote.trigger('stateChange', state);

                    if (next_state == NOT_AUTHED) {
                        setCredentials(); // clear token
                        disconnect();                        
                        u.isOnboarded().then(function(onboarded) {
                            if (onboarded) { return $state.go('reauth'); }
                        });
                        // otherwise don't do anything
                    }
                    if (next_state == AUTHED_DISCONNECTED) {
                        console.info(' :: disconnected ::');
                        // don't do anything
                    }
                    if (next_state == PAYMENT_NEEDED) {
                        console.info(' :: payment needed ::');
                        u.isOnboarded().then(function(onboarded) {
                            if (onboarded) { return $state.go('reauth'); }
                        });
                    }
                    if (next_state == CONNECTED) {
                        // yay
                    }
                },
                request = function (options) {
                    var requireToken = options.requireToken !== false,
                        doSwitchState = options.switchState !== false;

                    return getCredentials().then(function(creds) {
                        if (requireToken && !creds) { throw new Error("No credentials stored, cannot remote - " + JSON.stringify(options));  }
                        var token = options.overrideToken || (creds && creds.token);
                        console.log('token is ', token);
                        return new Promise(function(resolve, reject) { 
                            debuglog('request :: ', utils.REMOTE_SERVER_URL + options.url);
                            $http(_.extend({}, options, {
                                url: utils.REMOTE_SERVER_URL + options.url, // not sure about this
                                headers: _.extend({}, options.headers, token ? { 'Authorization': 'token ' + token } : {})
                            })).success(function() { 
                                debuglog("success arguments ", arguments);
                                resolve.call(resolve, arguments); 
                            }).error(function(err, code) { 
                                console.error('request err', err, code);
                                window._err = err;                                
                                if (err === null) { 
                                    if (doSwitchState) { switchState(AUTHED_DISCONNECTED); }
                                    return reject(err);
                                }
                                if (code == 401 || err.code == 401) { 
                                    // token invalid, 
                                    if (doSwitchState) { switchState(NOT_AUTHED); }
                                    return reject.call(reject, arguments); 
                                } else if (code == 402 || err.code == 402) { 
                                    if (doSwitchState) { switchState(PAYMENT_NEEDED); }
                                    return reject.call(reject, arguments); 
                                } else if (err && err.errors) { 
                                    return reject.call(reject, err.errors[0]); 
                                }
                            });
                        });
                    });
                },
                socket,
                // 
                connect = function () {
                    // TODO: This should be replaced with utils.REMOTE_SERVER_URL + "/ws" or something
                    debuglog('connect!');
                    if (socket && state == CONNECTED) { 
                        debuglog('already connected --');
                        return Promise.resolve(socket); 
                    }
                    return getCredentials().then(function(credentials) { 
                        var token = credentials && credentials.token;
                        if (socket) { disconnect(); }
                        return new Promise(function(accept, reject) {
                            switchState(PENDING);
                            debuglog('WS connect ', utils.REMOTE_WS_BASE + ' -- ', utils.REMOTE_WS_PATH + '?token=' + token);
                            socket = io.connect(utils.REMOTE_WS_BASE, 
                                {   
                                    path: utils.REMOTE_WS_PATH,
                                    query:'token=' + token || '',
                                    transports: ['websocket'],
                                    'force new connection':true
                                }
                            );
                            socket.on('connect_error', function(evt) {
                                debuglog("SOCKET ERROR :: connection", evt); 
                                switchState(token ? AUTHED_DISCONNECTED : NOT_AUTHED);
                                reject();
                            });
                            socket.on('connect', function(evt) { 
                                debuglog("SOCKET :: connection", evt); 
                                switchState(CONNECTED);
                                accept();
                            });
                            socket.on('disconnect', function(evt) { 
                                console.error("SOCKET :: DISCONNECT", evt);  
                                switchState(token ? AUTHED_DISCONNECTED : NOT_AUTHED);
                            });
                            socket.on('model', function (event) { 
                                debuglog('SOCKET :: ONMESSAGE ', event);
                                remote.trigger('socket:model', event); 
                            });
                        });
                    });
                },
                disconnect = function () {
                    // we really don't want to do this
                    if (socket) { 
                        // we really don't wa
                        var s = socket.disconnect();
                        socket = undefined;
                        return s;
                    }
                },

                getSubscriptions = function() {
                    return request({url:'/subscription', method:'GET'});
                },

                validateAppStoreReceipt = function(product,txn) {
                    debuglog("validateAppStoreRequest ", product, txn);
                    utils.assert(product.price !== undefined, 'Price is undefined');
                    utils.assert(product.currency !== undefined, 'Currency is undefined');
                    if (txn.transactionReceipt === undefined) { return Promise.reject(new Error("no Transaction receipt"));    }
                    var data = { 
                        transactionReceipt:txn.transactionReceipt, 
                        productId:product.id,      
                        alias:product.alias,
                        type:product.type,
                        title:product.title,
                        description:product.description,
                        localizedPrice:product.price
                    };
                    console.info('validateAppStoreReceipt >> sending ~ ', data);
                    return request({ url:'/subscription/appstore', method:'POST', data: data });
                },

                validatePlayStoreReceipt = function(p,txn) {
                    console.log("validatePlayStoreREceipt!!!!!");
                    // from https://github.com/PinchMedicalUK/pinch-apps/blob/9c52bf563a15e808fdd38b2665a63e1158a148af/apps/hypertension/www/js/remote.js
                    console.info("validatePlayStoreRequest p,txn", p,txn);
                    console.log("validator arguments",arguments);
                    var post_url = "/subscription/playstore",
                        receipt = JSON.parse(txn.receipt),
                        product = store.get(receipt.productId),
                        post_data = {
                            receipt:txn.receipt,
                            signature:txn.signature,
                            productId:product.alias,
                            currency:product.currency,
                            amount:product.price.substr(product.currency.length)
                         }; 
                    console.info("post_data",post_data);                    
                    return request({ url:post_url,  method:'POST', data: post_data  });               
                },

                // when validation fails, call this
                askForGraceAppStore = function(product,txn) {
                    console.info('remote ~ asking for Grace', product, txn);
                    utils.assert(product.price !== undefined, 'Price is undefined');
                    utils.assert(product.currency !== undefined, 'Currency is undefined');
                    var data = { 
                        transactionReceipt:txn.transactionReceipt, 
                        productId:product.id,      
                        alias:product.alias,
                        type:product.type,
                        title:product.title,
                        description:product.description,
                        localizedPrice:product.price
                    };
                    return request({ url:'/subscription/grace', method:'POST', data: data });
                },

                askForGracePlayStore = function(product,txn) {
                    // todo please @treebirg look at this for me!
                    var post_data = {
                        receipt:txn.receipt,
                        signature:txn.signature,
                        productId:product.alias,
                        currency:product.currency,
                        amount:product.price.substr(product.currency.length)
                    };                     
                    return request({ url:'/subscription/grace', method:'POST',  data: post_data });                    
                },
                
                deprecate = utils.deprecate;

            var remote = {
                /* call these from the login / signup page */
                register: function (email, password) {
                    return request({
                        url: '/auth/register',
                        method: 'POST',
                        requireToken:false,
                        data: { email: email, password: password },
                        switchState:false                        
                    }).then(function (res) {
                        var token = res[0].response.token;
                        debuglog('register() setting token > ', token);
                        return setCredentials(email, token).then(function() { 
                           return connect();
                        });
                    });
                },
                login: function (email, password) { // alias authLogin
                    return request({
                        url: '/auth/login',
                        method: 'POST',
                        requireToken:false,                        
                        data: { email: email, password: password },
                        switchState:false                        
                    }).then(function (res) {
                        debuglog('response > ', res);
                        var token = res[0].response.token;                        
                        debuglog('login() setting token > ', token);
                        return setCredentials(email,token).then(connect);
                    });
                },
                validate: function () {
                    return request({ 
                        url: '/auth/validate', method: 'POST', switchState:false  
                    });
                },
                requestPasswordReset: function (email) { // alias requestPasswordReset
                    return request({
                        url: '/auth/request_password_reset',
                        method: 'POST',
                        data: { email: email },
                        switchState:false                        
                    });
                },
                authed: function() { 
                    return getCredentials().then(function(credentials) { return credentials !== undefined; });
                },                
                // not used by apps yet:
                logout: function () {  
                    disconnect(); 
                    setCredentials();  
                },
                _makeFileAccessURL:function(fileUuid) {
                    return request({
                        url: '/file/' + fileUuid + '/token',
                        method: 'GET'
                    }).then(function (res) {
                        console.log(res[0]);
                        var token = res[0].response.token;
                        return utils.REMOTE_SERVER_URL + "/file/" + fileUuid + '?token=' + token;
                    });
                },
                makePDFReportURL: function (reportUuid) {
                    return utils.REMOTE_SERVER_URL + '/report/pdf/' + reportUuid;
                },
                makeXLSXReportURL: function (reportUuid) {
                    return utils.REMOTE_SERVER_URL + '/report/xlsx/' + reportUuid;
                },
                getState:function() { return state; },
                connect:connect,
                disconnect:disconnect,
                validateAppStoreReceipt:validateAppStoreReceipt,
                validatePlayStoreReceipt:validatePlayStoreReceipt,
                askForGracePlayStore:askForGracePlayStore,
                askForGraceAppStore:askForGraceAppStore,
                getSubscriptions:getSubscriptions,
                NOT_AUTHED : NOT_AUTHED,
                AUTHED_DISCONNECTED : AUTHED_DISCONNECTED,
                CONNECTED : CONNECTED,
                PENDING : PENDING,
                PAYMENT_NEEDED : PAYMENT_NEEDED,
                getCredentials:getCredentials,
                request: request
             };

             _(remote).extend({ 
                auth: deprecate(remote.validate, 'remote.auth() is deprecated. use remote.validate() instead.'),
                authToken: deprecate(remote.validate, 'remote.auth() is deprecated. use remote.validate() instead.'),
                resetPassword: deprecate(remote.requestPasswordReset, 'remote.resetPassword(email) is deprecated. use remote.requestPasswordReset(email) instead.'),
                authLogin: deprecate(remote.login, 'remote.authLogin(email, password) is deprecated. use remote.login(email, password) instead.')
            });

            var iremote = _.extend(remote, Backbone.Events);

            window._remote = iremote;
            window._getSocket = function() { return socket; };

            // set initial state
            setTimeout(function() { debuglog('connect? '); connect(); }, 1000);
            return iremote;
        });
})();
