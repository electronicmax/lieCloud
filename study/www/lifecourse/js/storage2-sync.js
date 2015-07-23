 /* jshint undef: true, strict:false, trailing:false, unused:false, -W110 */
/* global require, Backbone, PouchDB, $, exports, console, process, module, L, angular, _, jQuery, Backbone, SyncedStorage, SyncedStorageModel, SyncedStorageCollection*/

// sync 
//   remote sync logic for storage.js to v2 PInCH Server
// 
(function() { 
    angular.module('lifecourse')
    	.factory('storagesync', function(storage, remote, utils) {

            var u = utils,
                DEBUG = false,
                debuglog = function() {
                    if (DEBUG) { console.log.apply(console, arguments); }
                },
                collateCollectionUnvirginModels = function(collection) { 
                    // collates all unvirgin models from specified collections
                    // updated protocol :: 09.05.2015 
                    // now we first check eTag to see if it exists, if so then we proceed
                    var pack = function(m, suppressUUID) { 
                        var doc = storage.m2d(m, true);
                        return {
                            data: JSON.stringify(doc),
                            collection: m.collection.name,
                            model:m.id,
                            uuid: !suppressUUID ? m.uuid : undefined,
                            isDeleted:!!m.deleted,
                            isFile:m.file
                        };
                    };
                    return collection.getETag().then(function(etag) { 
                        if (etag) { 
                            return collection.getNonVirgins().then(function(nvs) { 
                                return nvs.map(pack);
                            });
                        } 
                        // otherwise we get all living models and suppress their UUIDs (oh god)
                        var tosend = collection.models.filter(function(x) { return !x.nosync; });
                        debuglog("~~~~ NO ETAG ", collection && collection.name, " so we're going to send> ", tosend.length, tosend.map(function(x) { return x.id; }));                        
                        return tosend.map(function(x) { return pack(x,true); });
                    });
                },
                unpack = function(doc) { 
                    // unpacks response from server
                    var docdata = doc.data && JSON.parse(doc.data) || {};
                    docdata.deleted_ = doc.isDeleted;
                    docdata.uuid_ = doc.uuid;
                    docdata.timestamp_ = doc.timestamp;
                    docdata.prevuuid_ = doc.previousUuid;
                    docdata.file_ = doc.isFile;
                    docdata.fileuuid_ = (doc.isFile && doc.file.uuid) || undefined;
                    docdata.filethumbnail_ = (doc.isFile && doc.file.thumbnail) || undefined;
                    docdata.filetype_ = (doc.isFile && doc.file.mimetype) || undefined;                                        
                    docdata.filename_ = (doc.isFile && doc.file.name) || undefined;
                    docdata.fileext_ = (doc.isFile && doc.file.extension) || undefined;                    
                    return docdata;
                },
                resolveConflict = function(model, docdata) {
                    debuglog('got a conflict, defaulting to reverting to incoming version', model.attributes, 'vs', docdata);
                    storage.d2m(docdata, model, false);
                };

            var Syncer = function() {
                // watch for remote
                var this_ = this;

                this.syncingCollections = {};

                // for watch collections\
                this.dirty_collections = {};
                this.debounce_sync = _.debounce(function() { 
                    var cs = _(this_.dirty_collections).values();
                    this_.dirty_collections = {};
                    debuglog('debounced sync, calling sync from watch ', cs.map(function(x) { return x.name; }));
                    return cs.map(function(c) { 
                        // comment this out .. 
                        return this_.syncCollection(c);  
                    });
                }, 1000); // tune this timeout

                remote.on('socket:model', function(sync_etag) { 
                    debuglog('SOCKET :: got a request to sync ', sync_etag);
                    var etag = sync_etag.etag, 
                        cname = sync_etag.collection;
                    if (!this_.syncingCollections[cname]) {
                        this_.syncingCollections[cname] = true;                        
                        return storage.getCollection(cname).then(function(c) { 
                            return c.getETag().then(function(old_etag) { 
                                if (old_etag && old_etag == etag) { 
                                    debuglog("SYNC TRIGGER(): eTag Matches, so we just sleep on this one");
                                    this_.resumeRemoteListening(c);
                                    return;
                                } else {
                                    debuglog("SYNC TRIGGER(): eTag Doesn't match so we'll initiate a sync on ", cname);
                                    return this_.syncCollection(c);
                                }
                            });
                        });
                    } else { 
                        debuglog("SYNC TRIGGER() : not watching atm ¬_¬"); 
                    }
                });
                // set up syncing ---------
                if (remote.getState() == remote.CONNECTED) { this_.sync();  }
                remote.on('stateChange', function(state) { 
                    if (state == remote.CONNECTED) { this_.sync(); }
                });
            };

            Syncer.prototype = {
                suppressRemoteListening:function(c) { this.syncingCollections[c.name] = true; },
                resumeRemoteListening:function(c) { 
                    // debuglog('resuming remote for ', c);
                    delete this.syncingCollections[c.name]; 
                    // debuglog(' syncing collections ', this.syncingCollections);
                },
                watchCollection:function(c) { 
                    var this_ = this;
                    c.on('savemodel', function(m) { 
                        debuglog('savemodel signal, testing dirty ', m.collection.name, m.id, m.virgin, m.nosync, m);
                        if (!m.virgin && !m.nosync && remote.getState() == remote.CONNECTED) { 
                            debuglog('triggering dirty on ', m.collection.name, '/', m.id, m.virgin, m.nosync);
                            this_.dirty_collections[c.name] = c;
                            this_.debounce_sync();
                        }
                    });
                },
                syncCollection : function(collection) { 
                    var this_ = this,
                        collated_promise = collateCollectionUnvirginModels(collection);

                    return collection.getETag().then(function(old_etag) {
                        debuglog('syncCollection ', collection.name, ' - ', old_etag);
                        this_.suppressRemoteListening(collection);
                        return collated_promise.then(function(collated_arr) { 
                            debuglog('>> sync ! collection etag ', collection.name, collated_arr.length, collated_arr);
                            // >> new 
                            var committing = u.dict(collated_arr.map(function(tosend) { 
                                console.info('to send ', tosend.model, tosend.collection, collection.name, collection.get(tosend.model));
                                    var mid = tosend.model, 
                                        cid = tosend.collection,
                                        attrs = _(collection.get(mid) && collection.get(mid).attributes || {}).clone();
                                    return [JSON.stringify([cid,mid]), attrs];
                                })),
                                getCommitting = function(doc) {
                                    var mid = doc.model, cid = doc.collection;
                                    return committing[JSON.stringify([cid,mid])];
                                },
                                isCommitting = function(doc) { 
                                    return getCommitting(doc) !== undefined;
                                };

                            // console.log('collated arr committing >', committing);
                            // 
                            return remote.request({ 
                                url: ['','collection', collection.name].join('/'), method: 'PATCH', data: collated_arr,
                                headers: old_etag ? { range: old_etag } : {}
                            }).then(function (res) {

                                var data = res[0],
                                    status = res[1], 
                                    headers = res[2],
                                    new_etag = headers('etag'),
                                    conflicts = data.errors && data.errors.filter(function(err) { return err.name == 'ModelConflict'; }) || [],
                                    othererrors = data.errors && data.errors.filter(function(err) { return err.name !== 'ModelConflict'; }) || [];

                                // debuglog('sync res ', collection.name, ' !!!!!!!!!!!!!  !!!!!!!!!!!! data ', data, ' status ', status, ' headers ', headers);
                                debuglog(collection.name,  ' ~~ sync response :: >> ', 'errors : ', data.errors, conflicts, ' responses ', data.response);

                                return Promise.all(conflicts.map(function(err) { 
                                    // Step 1 :: handle conflicts. 
                                    // in the case of a conflict, err.latest contains
                                    // the latest document known to the server. we retrieve the corresponding
                                    // model

                                    var modelid = err.data.latest.model, 
                                        cname = err.data.latest.collection, 
                                        isDeleted = err.data.latest.isDeleted || !collection.get(modelid),
                                        docdata = unpack(err.data.latest);

                                    u.assert(cname == collection.name, "collection name doesnt match " + cname + " - " + collection.name );

                                    debuglog('conflict res ~ ', modelid, cname, docdata);
                                    if (isDeleted) {
                                        return collection.getDeleted(modelid).then(function(model) { 
                                            resolveConflict(model, docdata);
                                            model.deleted = true; // reset this so it stays deleted.
                                            return model.save(undefined, {virgin:true}).then(function() { return model; });
                                        });
                                    }
                                    // otherwise still living
                                    var model = collection.get(modelid); //  || utils.getModel(collection,modelid); // might need to be resurrected.
                                    // if (!model) { throw new Error("Consistency Error : no model for conflicted object collection: "+  collection.name + " modelid: " + modelid); }
                                    resolveConflict(model, docdata);
                                    return model.save(undefined, {virgin:true}).then(function() { return model; });
                                })).then(function(conflictmodels) { 
                                    // Step 2 :: update responses
                                    // for all responses other than conflicted ones, we take them wholesale:
                                    // that is, for models we know about we update them, for models
                                    // we don't know about, we create them
                                    return Promise.all(data.response.map(function(r) { 
                                        if (!r.collection) { throw new Error(' Error no collection specified ' + r ); }
                                        debuglog('received from server ', r.collection, '/', r.model, unpack(r), r, 'iscommitting? > ', isCommitting(r), r.data, getCommitting(r));
                                        u.assert(r.collection == collection.name, "Response collection mismatch ", r.collection, collection.name);
                                        // var mp = r.isDeleted ? collection.getDeleted(r.model) : (collection.get(r.model) && Promise.resolve(collection.get(r.model)) || collection.make(r.model));
                                        var mp = r.isDeleted ? collection.getDeleted(r.model) : Promise.resolve(utils.getModel(collection,r.model));                                    
                                        return mp.then(function(model) {
                                            // if (r.isDeleted) { debuglog("Got deleted model ", model.id); }
                                            // ignore conflict models cos we already saved them
                                            if (conflictmodels.indexOf(model) >= 0) { return model; }

                                            var docdata = unpack(r),
                                                dedocdata = storage.deserialise_d(docdata);
                                            // new code --------------------------------
                                            // console.log("sync() ", 'v?', model.virgin, 'docdata', dedocdata, model.attributes, u.definedEqual(dedocdata, model.attributes), _(model.attributes).keys().length === 0);
                                            debuglog("sync() ", r.collection, '/', r.model, ': v?', model.virgin, 'isCommitting?', isCommitting(r), ' ', 'isequal', u.definedEqual(getCommitting(r), model.attributes), model.attributes, getCommitting(r));

                                            if (!model.uuid || 
                                                (isCommitting(r) && u.definedEqual(getCommitting(r), model.attributes)) ||
                                                (!isCommitting(r) && model.virgin)) {
                                                debuglog('sync() :: successfully safe to save from server ', model.collection.name, '/', model.id, model, model.virgin);
                                                storage.d2m(docdata,model,false);
                                                return model.save(undefined, {virgin:true}).then(function() { return model; });
                                            } else {
                                                debuglog('sync() :: ERR ', model.id, ' got some sort of conflict, more recent so lets leave virgin untrue, setting uuid_ ', docdata.uuid_);
                                                model.uuid = docdata.uuid_;
                                                return model; // model.save().then(function() { return model; });  // will echo back round to another sync.
                                            }
                                        });
                                    }));
                                }).then(function(response) { 
                                    // finally, update our etags
                                    debuglog(collection.name, ' end of sync :: committing etag >>>> ', new_etag, collection.name);
                                    return collection.setETag(new_etag);
                                });                        
                            }).then(function() { 
                                // resume listening for remote updates
                                // debuglog('end of sync :: resuming normal listening to socket ');
                                debuglog('resuming remote listening ', collection.name);
                                this_.resumeRemoteListening(collection);
                                return;
                            });
                        });
                    });
                },
                sync : function(names) {
                    // sync all collections!
                    var this_  = this;
                    debuglog("manual sync with ", names);
                    if (remote.authed()) {
                        return storage.getCollections(names).then(function(collections) { 
                            debuglog('collections > ', collections);
                            var sync_returns = collections.map(function(c) { 
                                debuglog('manually syncing > ', c.name);
                                return this_.syncCollection(c).then(function() { 
                                    debuglog("~~ << DONE SYNCING COLLECTION ", c.name);
                                }); 
                            });
                            debuglog('sync returns ', sync_returns);
                            return Promise.all(sync_returns).then(function() { 
                                debuglog('DONE sync returns');
                            });
                        });
                    } 
                    return Promise.reject(new Error("not connected"));
                }
            };

            var instance = new Syncer();
            window._sync = instance;
            return instance;
    });
})();
