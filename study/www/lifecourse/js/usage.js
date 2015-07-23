/* jshint undef: true, strict:false, trailing:false, unused:false, quotmark:false */
/* global require, exports, console, process, module, L, angular, _, jQuery, window, document, Image, Backbone, syncedStorageGUID */

(function() {

	angular
		.module('lifecourse').factory('usage',function(storage, utils) {
			var c, u = utils,
				dfd = storage.getUsageLog(),
				newLogObj = function(type, date) { 
					var oid = type+'-'+utils.guid(5),	
					m = utils.getModel(c,oid);
					m.set({type:type, date:date});
					return m;
				};

			dfd.then(function(_c) { c = _c; });

			return {
				logAppLaunch: function(date) {
					var _h = function() { 
						var l8 = c.get('latest') || u.getModel(c, 'latest');
						l8.set({'launch': new Date()});
						l8.save();
						var lg = newLogObj('applaunch');
						lg.save();
						console.info('saving ', lg);
						return lg;
					};
					if (!c) { return dfd.then(_h);	} else { _h(); }
				},
				getLastLaunchTime: function() {	return c.get('latest').get('launch');	}
				// other events here
			};
	});
})();

