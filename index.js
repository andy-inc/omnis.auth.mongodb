/**
 * Created by Andy <andy@sumskoy.com> on 12.03.14.
 */

var defaultConfig = {
    db: "db",
    collection: "users",
    primary: "email",
    salt: 10
};

var _config = {};

var model = {
    ns: "plugins.auth.mongodb",
    name: "model",
    type: "module",
    fn: function ($omnis, $application, $mongodb, $bcrypt, $crypto, $q) {
        var cfg = $omnis.extend(true, defaultConfig, _config);

        return $application.inject(plugin.ns, [cfg.db, function (db) {
            var collection = db.collection(cfg.collection);

            var key = {};
            key[cfg.primary] = 1;
            collection.ensureIndex(key, {unique: true});

            var cryptPassword = function (password) {
                return $q.ninvoke($bcrypt, 'genSalt', cfg.salt).then(function (salt) {
                    return $q.ninvoke($bcrypt, 'hash', password, salt);
                });
            };
            var makePassword = function (length, chars) {
                var index = (Math.random() * (chars.length - 1)).toFixed(0);
                return length > 0 ? chars[index] + makePasswd(length - 1, chars) : '';
            };

            var result = {

                /**
                 * Find one user object by unique key
                 *
                 * @param key
                 * @returns {Object|Null}
                 */
                findOne: function (key) {
                    var selector = {};
                    selector[cfg.primary] = key;
                    return result.findOneBySelector(selector);
                },

                /**
                 * Find one user by selector
                 * @param selector
                 * @returns {Object|Null}
                 */
                findOneBySelector: function (selector) {
                    return $q.ninvoke(collection, 'findOne', selector);
                },

                findOneById: function (id) {
                    if (typeof id === 'string') id = new $mongodb.ObjectID(id);
                    return result.findOneBySelector({_id: id});
                },

                /**
                 * Find any users by selector
                 * @param selector
                 * @returns {Array}
                 */
                find: function (selector) {
                    var cursor = collection.find(selector);
                    return $q.ninvoke(cursor, 'toArray');
                },

                /**
                 * Check password validation
                 *
                 * @param user
                 * @param password
                 * @returns {Boolean}
                 */
                checkPassword: function (user, password) {
                    return $q.ninvoke($bcrypt, 'compare', password, user.password);
                },

                /**
                 * Insert new user
                 * @param user
                 * @returns {Object}
                 */
                insert: function (user) {

                    return cryptPassword(user.password).then(function (result) {
                        user.password = result;
                    }).then(function () {
                            return $q.ninvoke(collection, 'insert', user, {
                                safe: true
                            }).then(function (results) {
                                    return results[0];
                                })
                        });
                },

                /**
                 * Update user by key
                 * @param key
                 * @param data
                 */
                update: function (key, data) {
                    var selector = {};
                    selector[cfg.primary] = key;
                    $q.ninvoke(collection, 'update', selector, {$set: data}).then(function () {
                        return result.findOne(key);
                    });
                },

                /**
                 * Create new random password
                 * @param length
                 * @param chars
                 * @returns {String}
                 */
                makePassword: function(length, chars){
                    if (chars == null){
                        chars = 'qwertyuiopasdfghjklzxcvbnm1234567890QWERTYUIOPASDFGHJKLZXCVBNM';
                    }
                    if (length == null) {
                        length = 6;
                    }
                    return makePassword(length, chars);
                }
            };

            return result;

        }])();
    }
};

var plugin = {
    ns: "plugins.auth.mongodb",
    name: "middleware",
    type: "middleware:before:router",
    fn: function ($q, model) {
        return function (req, res) {
            req.user = null;
            req.login = function (user) {
                req.session.userId = user._id.toHexString();
                var def = $q.defer();
                def.resolve();
                return def.promise;
            };
            req.logout = function () {
                delete req.session.userId;
                var def = $q.defer();
                def.resolve();
                return def.promise;
            };
            var _id = (req.session || {}).userId;
            if (!_id) return;
            return model.findOneById(_id).then(function (user) {
                req.user = user || null;
                if (req.user) {
                    req.user.$checkPassword = function (password) {
                        return model.checkPassword(req.user, password);
                    };
                    req.user.$logout = req.logout.bind(req);
                }
            });
        };
    }
};

module.exports = exports = function (config) {
    if (config) _config = config;
    return [model, plugin];
};