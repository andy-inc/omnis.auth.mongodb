omnis.auth.mongodb
==========

Omnis authorization plugin store data to mongodb

Usage
---

```bash
$ npm i omnis.auth.mongodb
```

Define module with exported method `collection` - mongodb collection

```javascript
define('db', __filename, function (config, $mongodb, $q) {
    var _db;
    var DB = {

        get: function(){
            return _db;
        },

        collection: function(){
            var args = Array.prototype.slice.call(arguments);
            return _db.collection.apply(_db, args);
        }

    };

    var MongoClient = $mongodb.MongoClient;
    var deferred = $q.defer();
    MongoClient.connect(config.db.url, function(err, result){
        _db = result;
        if (err) return deferred.reject(err);
        return deferred.resolve(DB);
    });
    return deferred.promise;
});
```

Connect auth plugin to omnis

```javascript
app.plugin(require('omnis.auth.mongodb')({
    db: 'db',
    collection: 'users',
    primary: 'email', // or primary: 'username'
    salt: 10
}));
```

Login as user

```javascript
function(req, res){
    return req.login(user).then(function(){
        return res.send(204, null);
    });
}
```

Logout current user

```javascript
function(req, res){
    return req.user.logout().then(function(){
        return res.redirect('/login');
    });
}
```

Using auth model

```javascript
define('controller', __filename, ['plugins.auth.mongodb.model', function (authModel) {

    //use authModel

}]);

```

## Model methods

- `findOne(key)`: return user by primary key, findOne('test@test.com')
- `findOneById(id)`: return user by _id(String or ObjectId)
- `find(selector)`: return array of users by mongodb selector
- `checkPassword(user, password)`: check password with user.password
- `insert(user)`: insert new user, user must content `password` field
- `update(key, data)`: update user fields by primary key
- `makePassword(length, chars)`: generate new password with need length and writen chars

