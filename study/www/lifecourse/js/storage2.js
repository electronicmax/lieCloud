/* jshint undef: true, strict:false, trailing:false, unused:false, -W110 */
/* global require, Backbone, PouchDB, $, exports, console, process, module, L, angular, _, jQuery, Backbone, SyncedStorage, SyncedStorageModel, SyncedStorageCollection*/

// Ax
// refactored to a+ promises format 

(function() { 
    angular.module('lifecourse')
        .factory('storage', function(remote, utils) {    

        	var DEBUG = false,
                FORCE_SAVE = false,
                debuglog = function() {
                    if (DEBUG) { console.log.apply(console, arguments); }
                },
                assert = function(b, s) { if (!b) { throw new Error(s); } }, 
                proxy  = function(parent, fn) { 
                    return function() { return fn.apply(parent, arguments); };
                },
                getSync = function() { 
                    return utils.getFactory('storagesync'); 
                },
                objMap = function(ino,pred) {
                    var out = {};
                    for (var k in ino) {
                        var v = pred(ino[k], k);
                        if (v !== undefined) { out[k] = v; }
                    }
                    return out;
                },
                prepare_id = function(id) { 
                    assert(id !== undefined, 'id must not be undefined');
                    assert(typeof id == 'string', 'id must be a string');
                    return id.trim(); 
                },
                deserialise_d = function(d) { 
                    // database representation to attribute rep
                    var deobj = function(v) {
                        if (v.type_) { 
                            if (v.type_ == 'date') { 
                                return new Date(v.val_); 
                            }
                            if (v.type_ == 'objref') { 
                                throw new Error("Not implemented yet"); 
                            }
                            throw new Error("Unknown type ", v.type_);
                        }
                        // no, so just map
                        return objMap(v, dispatch);
                    },
                    deprim = function(v) { 
                        // primitives are served up raw
                        return v; 
                    },
                    dispatch = function(v) { 
                        if (v === undefined) { return; }
                        if (_(v).isArray()) { return v.map(dispatch);  }                
                        if (_(v).isObject()) { return deobj(v); }
                        // not an object, not an array
                        return deprim(v);
                    };

                    return objMap(d, function(v, k) {
                        // skip special variables
                        if (k[0] == '_' || k[k.length-1] == "_") { return; }
                        // dispatch others
                        return dispatch(v);
                    });
                },
                d2m = function(d, model, replace_rev) {
                    var attrs = deserialise_d(d);
                    // model.set(attrs);
                    model.attributes = attrs;
                    // set special variables in model from doc //
                    _(model).extend({
                        _rev : replace_rev === false ? model._rev : d._rev,
                        virgin : d.virgin_,
                        uuid : d.uuid_,
                        deleted : d.deleted_,
                        nosync : d.nosync_,
                        file : d.file_,
                        fileUuid : d.fileuuid_,
                        filethumbnail : d.filethumbnail_,
                        filetype : d.filetype_,
                        filename : d.filename_,
                        fileext : d.fileext_
                    });
                    return model;
                },
                m2d = function(m, justattrs) {
                    // attribute to database representation SERIALISE
                    // justattrs => true means only attributes, not special vars
                    var mattrs = objMap(m.attributes, function(v,k) { 
                        if (k.length > 0 && k[k.length-1] !== '_') { return v; }
                        // else return undefined, which will kill it
                    }),
                    deobj = function(v) {
                        if (v instanceof Date) { 
                            return { type_: 'date', val_: v.toISOString() }; 
                        }
                        if (v instanceof Backbone.Model) {
                            return { type_: 'objectref', model_: v.id, collection_:v.c.name };
                        }
                        // raw model
                        return objMap(v, dispatch);
                    },
                    deprim = function(v) { 
                        // primitives are served up raw
                        return v; 
                    },
                    dispatch = function(v) { 
                        if (v === undefined) { return; }
                        if (_(v).isArray()) { return v.map(dispatch);  }                
                        if (_(v).isObject()) { return deobj(v); }
                        // not an object, not an array
                        return deprim(v);
                    };

                    if (justattrs) { 
                       debuglog('justdoc, forgoing extra vars', mattrs);
                       return objMap(mattrs, dispatch);
                    }
                    // keep track of special vars                    
                    // local: 
                    return _(objMap(mattrs, dispatch)).extend({
                        // rev_: forsyncing ? m._rev : undefined,
                        virgin_ : m.virgin,
                        uuid_ : m.uuid,
                        deleted_ : m.deleted,
                        nosync_ : m.nosync,
                        file_ : m.file,
                        fileuuid_ : m.fileUuid,
                        filethumbnail_ : m.filethumbnail,
                        filetype_ : m.filetype,
                        filename_ : m.filename,
                        fileext_ : m.fileext
                    });
                },
        		PouchModel = Backbone.Model.extend({
        			// idAttribute:'_id',
                    initialize:function(attrs, options) { 
                        var this_ = this;
                        this.id = options.id;
                        this._rev = options && options._rev;
                        this._syncops = Promise.resolve(); // root of syncops
                    },
                    isNew: function() { 
                        return !this._rev; 
                    },
                    save:function(attrs, options) { 
                        var this_ = this;
                        debuglog("save(", this.collection.name, '/', this.id, ")", attrs, options);
                        // try {  throw new Error('SHOW ME A STACK TRACE');  } catch(e) { console.log(e); }
                        this._syncops = this._syncops.then(function() { 
                            this_.virgin = options && options.virgin; 
                            debuglog("> SAFE SAVE ", this_.collection.name, '/', this_.id, ' > ', this_._rev);
                            return Backbone.Model.prototype.save.call(this_, attrs, options).then(function() { 
                                // GENERATE saveModel signal for sync.js
                                debuglog('triggering savemodel ', this_.collection.name, '/', this_.id, this_.virgin);
                                this_.collection.trigger('savemodel', this_);
                                return this_;
                            }).then(function() { 
                                debuglog("< SAFE SAVE ", this_.collection.name, '/', this_.id); 
                            }).then(function() { 
                                return this_; 
                            }).catch(function(ee) { 
                                console.error("error saving ", this_.collection.name, '/', this_.id, this_._rev);
                                throw (ee);
                            });
                        });
                        return this._syncops;
                    },
                    addFile:function(file) { 
                        return this.collection.uploadFile(file, this.id, this.uuid);
                    },
                    getFileURL:function() { 
                        // attachs tokens
                        var this_ = this;
                        return remote._makeFileAccessURL(this_.fileUuid);
                    },
                    getThumbnailURL:function() { 
                        // adds thumbnail url
                        if (this.file && this.filethumbnail) {
                            return "data:image/png;base64," + this.filethumbnail;
                        }
                    },
                    destroy:function(options) { 
                        //
                        debuglog("> Deleting ", this.collection.name, '/', this.id);
                        var this_ = this, c = this.collection;
                        this.attributes = {};
                        this.deleted = true;
                        return this.save(undefined, options).then(function() { 
                            debuglog('< done deleting ', c.name, '/', this_.id, c.length);

                            // --------------
                            delete c._byId[this_.id];
                            var index = c.models.indexOf(this_);
                            c.models.splice(index, 1);
                            c.length--;
                            this_.trigger('remove', this_, c, options);

                            // remove references to collection
                            delete this_.collection;
                            this_.off('all', c._onModelEvent, c);

                            debuglog(' new collection length ', c.length);
                            // ----------------
                            return this_;
                        });                        
                    },            
        			sync:function(method, model, options) {
                        // Warning; this sync concerns saving to local pouch only!
        				var db = model.collection.db,
                            collection = model.collection,
                            docid = model.id,
        					methods = {
        					'create':function() { 
                                // the reason this is *a bit* complicated is that instead of 
                                // deleting the document on delete, we simply give it a special flag.
                                window._m = model;
                                // debuglog('CREATE >> ', docid, model.attributes, docid, model._rev, model.id);
                                var model_doc = m2d(model);                                
                                return new Promise(function(resolve, reject) {
                                    // new structure model.
                                    debuglog('> CREATE ', model.collection.name, '/', model.id, '_rev : ', model._rev, ' virgin: ', model.virgin);
                                    db.put(model_doc, docid).then(function(res) { 
                                        // success! nothing conflicting to clobber
                                        debuglog('< CREATE ', model.collection.name, '/', model.id, '_rev : ', res.rev);
                                        // debuglog('success! nothing conflicting to clobber, resolving ', model.id, model.attributes, res.rev);
                                        model._rev = res.rev;
                                        resolve(model);
                                    }).catch(function(ee) {
                                        debuglog("< CREATEERROR ", model.collection.name, '/', model.id, ee);
                                        if (ee.name == 'conflict') {
                                            // then we are likely just overwriting a deleted object. 
                                            // clobber with a new revision, by retrieving our ghost

                                            // var m = collection.get(docid);
                                            // if (m) { throw new Error(' Already exists : ' + docid ); }

                                            // exists in the db, but not in things -> deleted, so we just overwrite.
                                            return db.get(docid).then(function(doc) {
                                                // it's a deleted ghost, now we just force it 
                                                debuglog(">> OVERWRITING ", model.collection.name, '/', model.id, docid, doc, doc._rev, '--> with ', model_doc);
                                                return db.put(model_doc, docid, doc._rev).then(function(res) {
                                                    debuglog("<< OVERWRITING ", model.collection.name, '/', model.id);
                                                    model._rev = res.rev;
                                                    return resolve(model); // ready to go!
                                                });
                                            }).catch(reject);
                                        } else {
                                            console.error('error - ', ee.name, model.id, model.attributes); 
                                            window._sqlerror = ee;
                                            reject(ee);
                                        }
                                    });
                                });
                            },
        					'read': function() { 
        						// reading
        						return db.get(docid).then(function(doc) { 
                                    if (doc.deleted_) { return undefined; }                            
                                    return d2m(doc, model);
        						});
        					},
        					'update': function() {
                                debuglog(' UPDATE (save) ', model.collection.name, '/', model.id, '_rev : ', model._rev, ' virgin: ', model.virgin, model.attributes);
                                var ds = m2d(model);
                                if (!FORCE_SAVE) {
                                    // here we respect the rev for efficiency
                                    debuglog('saving ', ds, model.id, model._rev);
                                    return db.put(ds, model.id, model._rev).then(function(res) { 
                                        // update local rev for future saves
                                        model._rev = res.rev;
                                        return model;
                                    }).catch(function(e) { 
                                        console.error('save error ', e);
                                        throw new Error(e);
                                    });
                                } else {
                                    // force mode, 
                                    return db.get(model.id).then(function(doc) { 
                                        return db.put(ds, model.id, doc._rev).then(function(res) { 
                                            // update local rev for future saves
                                            model._rev = res.rev;
                                            return model;
                                        });
                                    });
                                }
        					},
        					'patch' : function() { 
                                // todo
                                debuglog('patch called. no idea what this is for.');
                            },
        					'delete' : function() { 
                                // delete is not used because we simply save() with appropriate properties
                                utils.assert(false, "delete -- Code path error");
                    		}
        				};
                        return methods[method]();
        		}}),
        		PouchCollection = Backbone.Collection.extend({ 
        			model:PouchModel,
        			initialize:function(models, options) { 
                        // debuglog('initialise ', models, options);
                        var this_ = this;
        				assert(options && options.name !== undefined, 'name must be specified');
        				this.name = options.name;
                        this._initdb = new Promise(function(accept, reject) {
                            debuglog('initialising collection ', this_.name);
            				this_.db = new PouchDB(this_.name, {adapter:'websql'}, function(err) { 
                                if (err) { 
                                    console.error('Error initialising database ', this_.name, err); 
                                    return reject(); 
                                }
                                debuglog("Successfully initialised database ", this_.name);                                
                                accept();
                            }); // , { adapter : 'websql' });
                        });
        			},
                    doSync: function() { 
                        debuglog('initiating manual sync ', this.name);
                        return getSync().sync([this.name]);
                    },
                    getETag:function() { 
                        // gets our collection-specific etag
                        // debuglog('ETAG got model on GET > ', model.collection && model.collection.name, '/', model.id, model, model.nosync, model.attributes.val);                        
                        var this_ = this;
                        return remote.getCredentials().then(function(credentials) { 
                            var model = utils.getModel(this_, 'etag_', true);
                            var email = credentials && credentials.email;                            
                            debuglog('get ETAG (',email,') > ', model.collection && model.collection.name, ' => ', model.attributes[email]);
                            if (email) { 
                                return model && model.get(email);
                            } 
                            // no eTag.
                            return;
                        });
                    },
                    setETag:function(etag) { 
                        // saves our collection-specific etag
                        var model = utils.getModel(this, 'etag_', true), this_ = this;
                        return remote.getCredentials().then(function(credentials) { 
                            if (credentials) {
                                var email = credentials && credentials.email;
                                debuglog('== set ETAG (',email,') > ', model.collection && model.collection.name, ' => ', etag);
                                model.set(email, etag);
                                return model.save().then(function() { return etag; });
                            }
                            // no point saving an etag for something we don't have credentials for!
                            return Promise.resolve(model);
                        });
                    },
                    makeImmediate:function(modelid,attrs,nosync) {
                        // "make" is a conflict safe version of create, returning a deferred
                        // with an error if modelid already exists.
                        // warning: overrides the default implementation to get rid of ridiculous signature
                        // returns a promise instead of the model
                        // debuglog('making immediate ', this.name, modelid);
                        var this_ = this,
                            m = new this.model(attrs, {id:prepare_id(modelid)});
                        m.collection = this;  
                        m.nosync = nosync;
                        this_.add(m);
                        return m;
                    },
                    make:function(modelid, attrs, nosync) { 
                        var m = this.makeImmediate(modelid,attrs,nosync);
                        return m.save().then(function(m) { return m; });
                    },
                    modelId: function(m) { return m.id; },
                    _prepareModel:function(model, options) { 
                        // debuglog('preparemodel ', model.nosync, options && options.id, options && options.nosync, model);
                        var outm = Backbone.Collection.prototype._prepareModel.apply(this, arguments);
                        if (outm && options && options.id || options.nosync) {
                            _(outm).extend({ 
                                id : options.id,
                                nosync : options.nosync
                            });
                        }
                        return outm;
                    },
                    getVirgins:function() { 
                        return this.models.filter(function(x) { return x.virgin && !x.nosync; }); 
                    },
                    uploadFile:function(file, id, uuid) { 
                        // pass in an input file - and return the corresponding new model
                        var model_id = id ? id : utils.guid(),
                            this_ = this,
                            params = { collection: this.name, model: model_id };

                        if (uuid) { params.uuid  = uuid; }
                        var url = '/file/?'+ $.param(params),
                            fileSize = file.size,
                            fileName = file.name,
                            handleError = function(code, data) { 
                                var handlers = {
                                        0 : function() { throw new Error('Upload failed - connection error - please try again'); },
                                        401: function() { throw new Error("Upload failed, please log in and try again"); }, 
                                        402: function() { throw new Error("Upload failed, please check your subscription and try again"); },
                                        403: function() { throw new Error("Upload failed - assertion error - incorrect uuid provided ", params.uuid);  },
                                        404: function() { throw new Error("Upload failed - check your internet connection & try again ", params.uuid); },
                                        409: function() { 
                                            var e = new Error("Upload failed - assertion failed - model already exists ", params.collection, params.model, params.uuid);
                                            e.code = 409;
                                            throw e;
                                        }
                                    };
                                if (handlers[code]) { return handlers[code](); }
                                throw new Error("Unknown error ", code, data);
                            },
                            fd = new FormData();

                        fd.append('file', file, file.name);
                        debuglog('uploading file >> ', model_id);
                        return remote
                            .request({ method:"POST", url:url, data:fd, headers: { "Content-Type": undefined }})
                            .then(function(response) { 
                                debuglog("UPLOAD FILE RESPONSE " , response);
                                if (response.errors) { 
                                    var code = response.errors[0].code;
                                    handleError(code, response.errors[0]);
                                    return;
                                }
                                return new Promise(function(accept,reject) {
                                    var done = false,
                                        f = function(m) {
                                            // console.info("SAVEMODEL ", m, m.id);
                                            if (m.id == model_id) {
                                                // console.info('accepting!!');
                                                this_.off('savemodel', f);
                                                accept(this_.get(model_id));
                                                done = true;
                                                return;
                                            }
                                        };
                                    this_.on('savemodel', f);
                                    setTimeout(function() {
                                        if (!done) {
                                            this_.off('savemodel', f);
                                            console.error('never got save signal from server for model ', model_id);
                                            reject(); 
                                        }
                                    },5000);
                               });
                        }).catch(function(err) { 
                            // does this ever get called
                            console.error('UPLOAD ____ > got an error exception, not sure what to do ~~ ', err, err[1]);
                        });
                    },
                    getNonVirgins:function() { 
                        // TODO: speed this up using a view of deleted modesl
                        var this_ = this;
                        return this._initdb.then(function() {
                            return this_.db.allDocs({include_docs:true})
                                .then(function(results) {
                                    return results.rows.map(function(row) { 
                                        debuglog('row doc ', row.doc);
                                        if (row && row.doc && row.doc.deleted_ && !row.doc.virgin_ && !row.doc.nosync_) {
                                            var doc = row.doc,
                                                docid = row.id,
                                                model = new this_.model({}, { id:docid });
                                            model.collection = this_; // sets our collection 
                                            return d2m(doc, model);
                                        }
                                    }).filter(function(x) { return x !== undefined; });
                                }).then(function(dead_models) { 
                                    var living_unvirgin = this_.models.filter(function(x) { return !x.virgin && !x.nosync; });
                                    // debuglog('dead models > ', dead_models.length, dead_models);
                                    // debuglog('living_unvirgin > ', living_unvirgin.length, living_unvirgin);                                    
                                    return living_unvirgin.concat(dead_models);
                                });
                        });
                    },            
                    getDeleted:function(id) { 
                        // retrieves a deleted stub from the database so we can update them
                        debuglog(' getDeleted ', id);
                        var this_ = this;
                        return this._initdb.then(function() {
                            debuglog('init db ');
                            return this_.db.get(id).then(function(doc) {
                                debuglog('got doc! ', id, doc);
                                var model = new this_.model({}, { id:id });
                                model.collection = this_; // sets our collection 
                                return model; 
                            }).catch(function(ee) { 
                                debuglog(' error getting doc ', id, ' - ', ee);
                                if (ee.status == 404) { 
                                    // we don't actually have it, so create a shadow model
                                    var model = new this_.model({}, { id:id });
                                    model.collection = this_; 
                                    model.deleted = true;                                    
                                    return model;
                                }
                                throw ee;
                            });
                        });
                    },
                    get:function(id) { 
                        var b = Backbone.Collection.prototype.get.apply(this,arguments);
                        if (b && b.deleted) return undefined;
                        return b;
                    },
        			fetch:function() {  
                        // ps - you know this already, but 
                        // this fetch() from local pouch (nothing to do with the server!) 
        				var this_ = this, d = $.Deferred();
        				return this._initdb.then(function() { 
                            return this_.db.allDocs({include_docs:true})
                                .then(function(results) {
            						var models = results.rows.map(function(row) { 
                                        if (row && row.doc && row.doc.deleted_) { 
                                            // deleted
                                            return undefined; 
                                        }
                                        var doc = row.doc,
                                            docid = row.id,
                                            model = this_.get(docid) || new this_.model({}, { id:docid });

                                        return d2m(doc, model);
                                    }).filter(function(x) { return x !== undefined; });
            						this_.set(models);
            						return this_;
            					});
                            });
        			}
        		});

            var collection_cache = {},
                clearCache = function() { collection_cache = {}; };

        	var getCollection = function(name) { 
                if (collection_cache[name]) { return collection_cache[name]; }
                var c = new PouchCollection([], { name: name }),
                    d = collection_cache[name] = new Promise(function(resolve, reject) { 
                        c.fetch().then(function() { 
                            // register the collection with sync 
                            getSync().watchCollection(c);
                            resolve(c); 
                        }).catch(function(err) { reject(err); });
                    });
                return d;
        	};
            var destroyCollection = function(name) { 
                var db = new PouchDB(name, { adapter : 'websql' });
                return db.destroy();
            };
            var destroyAllCollections = function(name) { 
                clearCache();
                return PouchDB.allDbs().then(function(dbs) { 
                    return Promise.all(dbs.map(function(dbname) { 
                        var db = new PouchDB(dbname, {adapter:'websql'}); 
                        return db.destroy();
                    }));
                });
            };
    		return {
                initialize:function() { 
                    if (remote.getState() == remote.CONNECTED) {
                        this.sync().catch(function(e) { debuglog('error syncing, not connected ', e); });
                    }
                },
                getDiaryBPs:function() { 
                    return this.getDiary().then(function(diary){
                        var bps = diary.models.filter(function(model){
                            if(model.attributes.bp)
                                return true;
                            return false;
                        });
                        return bps;                        
                    });
                },
                get : function(name) {	return getCollection(name); },
    			getDiary: function() { return getCollection("Diary"); },
    			getAFIQs: function() { return getCollection("AFIQs"); },
    			getDocs: function() {  return getCollection("Docs"); },
    			getProfile: function() {  return getCollection("Profile"); },
                getPrescriptions: function () { return getCollection("Prescriptions");   },
                // getLocalStuff: function () { return getCollection("Stuff");  },
                getNotifications: function () { return getCollection("Notifications");  },
                getUsageLog: function () { return getCollection("UsageLog");  },
                getCollection : function(name) { return getCollection(name); },
                // used by storage-remote, our "friend"
                PouchModel:PouchModel,
                m2d:m2d, // also used for serialising/deserialising models to server
                d2m:d2m, // 
                deserialise_d:deserialise_d,
                PouchCollection:PouchCollection,
                getCache:function() { return collection_cache; },
                getCollections: function(cnames) { 
                    // optional list of cnames specifies collections to get
                    // defaults to standard AFinity set
                    var this_ = this;
                    if (cnames) { 
                        return Promise.all(cnames.map(function(n) { return this_.getCollection(n); }));
                    }
                    // return default set
                    return Promise.all([ 
                        this.getDiary(),
                        this.getAFIQs(),
                        this.getDocs(),
                        this.getProfile(),
                        this.getPrescriptions(),
                        this.getNotifications(),
                        this.getUsageLog()
                        // this.getLocalStuff()
                    ]);
                },
                // debug:
                pdb : function(name) { return new PouchDB(name, { adapter : 'websql' }); },

                // clear in memory cache
                clearCache : clearCache,

                // delete persistent data
                destroyCollection:destroyCollection,
                destroyAllCollections:destroyAllCollections,

                // proxy these for compatibility
                register: proxy(remote, remote.register), 
                login: proxy(remote, remote.login),
                validate: proxy(remote, remote.validate), 
                requestPasswordReset: proxy(remote, remote.requestPasswordReset),
                logout: proxy(remote, remote.logout),
                auth: proxy(remote, remote.auth),
                authToken: proxy(remote, remote.authToken),
                resetPassword: proxy(remote, remote.requestPasswordReset),
                authLogin: proxy(remote, remote.login),
                sync:function() { return getSync().sync();  }
    		};
   	});
})();
