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

module.exports = exports = function (config) {
    if (config) _config = config;
    for(var key in defaultConfig) if (defaultConfig.hasOwnProperty(key) && _config[key] == null){
        _config[key] = defaultConfig[key];
    }


    var model = {
        require: require.bind(this),
        ns: "plugins.auth.mongodb",
        name: "model",
        type: "module",
        fn: ['$application', '$mongodb', '$bcrypt', '$crypto', '$q', _config.db, function ($application, $mongodb, $bcrypt, $crypto, $q, db) {
            var collection = db.collection(_config.collection);

            var cryptPassword = function (password) {
                return $q.ninvoke($bcrypt, 'genSalt', _config.salt).then(function (salt) {
                    return $q.ninvoke($bcrypt, 'hash', password, salt);
                });
            };
            var makePassword = function (length, chars) {
                var index = (Math.random() * (chars.length - 1)).toFixed(0);
                return length > 0 ? chars[index] + makePassword(length - 1, chars) : '';
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
                    selector[_config.primary] = key;
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
                    selector[_config.primary] = key;
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

            var key = {};
            key[_config.primary] = 1;
            return $q.ninvoke(collection, 'ensureIndex', key, {unique: true}).then(function(){
                return result;
            })
        }]
    };

    var plugin = {
        require: require.bind(this),
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

    return [model, plugin];
};