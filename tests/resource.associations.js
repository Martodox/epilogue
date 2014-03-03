var express = require('express'),
    request = require('request'),
    http = require('http'),
    expect = require('chai').expect,
    Sequelize = require('sequelize'),
    _ = require('lodash'),
    async = require('async'),
    rest = require('../lib');

var test = {};
describe('Resource(associations)', function() {
  before(function() {
    test.db = new Sequelize('main', null, null, {
      dialect: 'sqlite',
      logging: false
    });

    test.User = test.db.define('users', { 
      id:       { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true }, 
      username: { type: Sequelize.STRING, unique: true }, 
      email:    { type: Sequelize.STRING, unique: true, validate: { isEmail: true } } 
    }, {
      underscored: true,
      timestamps: false
    });

    test.Address = test.db.define('addresses', { 
      id:             { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true }, 
      street:         { type: Sequelize.STRING },
      state_province: { type: Sequelize.STRING },
      postal_code:    { type: Sequelize.STRING },
      country_code:   { type: Sequelize.STRING }
    }, {
      underscored: true,
      timestamps: false
    });

    test.User.belongsTo(test.Address);  // user has an address_id
  });

  beforeEach(function(done) {
    test.db
      .sync({ force: true })
      .success(function() {
        test.app = express();
        test.app.use(express.json());
        test.app.use(express.urlencoded()); 

        rest.initialize({ app: test.app });
        rest.resource({
          model: test.User,
          include: [test.Address],
          endpoints: ['/users', '/users/:id']
        });
        rest.resource({
          model: test.Address,
          endpoints: ['/addresses', '/addresses/:id']
        });

        test.server = http.createServer(test.app);
        test.server.listen(48281, null, null, function() {
          test.baseUrl =
            'http://' + test.server.address().address + ':' + test.server.address().port;
          done();
        });
      });
  });

  afterEach(function(done) {
    test.db
      .getQueryInterface()
      .dropAllTables()
      .success(function() {
        test.server.close(done);
      });
  });

  // TESTS
  describe('read', function() {
    it('should include prefetched data for relations', function(done) {
      request.post({
        url: test.baseUrl + '/addresses',
        json: { street: '‎221B Baker Street', state_province: 'London', postal_code: 'NW1', country_code: '44'}
      }, function(error, response, body) {
        expect(response.statusCode).to.equal(201);
        var address = body;
        
        request.post({
          url: test.baseUrl + '/users',
          json: { username: 'arthur', email: 'arthur@gmail.com', address_id: address.id }
        }, function(error, response, body) {
          expect(response.statusCode).to.equal(201);

          request.get({
            url: test.baseUrl + '/users/' + body.id
          }, function(error, response, body) {
            expect(response.statusCode).to.equal(200);
            var result = _.isObject(body) ? body : JSON.parse(body);            
            var expected = {
              id: result.id,
              username: 'arthur',
              email: 'arthur@gmail.com',
              address_id: address.id,
              address: {
                id: address.id,
                street: '‎221B Baker Street', 
                state_province: 'London', 
                postal_code: 'NW1', 
                country_code: '44'
              }
            };

            expect(result).to.eql(expected);
            done();
          });
        });
      });
    });

  });

  describe('list', function() {
    beforeEach(function(done) {
      test.expectedResult = [];
      var testData = [
        {
          user: { username: "sherlock", email: "sherlock@gmail.com" },
          address: { street: '‎221B Baker Street', state_province: 'London, UK', postal_code: 'NW1', country_code: '44'}
        },
        {
          user: { username: "barack", email: "barack@gmail.com" },
          address: { street: '‎1600 Pennsylvania Ave', state_province: 'Washington, DC', postal_code: '20500', country_code: '001'}
        },
        {
          user: { username: "tony", email: "tony@gmail.com" },
          address: { street: '‎633 Stag Trail RD', state_province: 'Caldwell, NJ', postal_code: '07006', country_code: '001'}
        },
        {
          user: { username: "eddie", email: "eddie@gmail.com" },
          address: { street: '‎1313 Mockingbird Ln', state_province: 'Lincoln, CA', postal_code: '95648', country_code: '001'}  
        },
        {
          user: { username: "lucy", email: "lucy@gmail.com" },
          address: { street: '‎623 East 68th Street', state_province: 'New York, NY', postal_code: '10065', country_code: '001'}
        }
      ];

      async.each(testData, function(info, callback) {
        request.post({
          url: test.baseUrl + '/addresses',
          json: info.address
        }, function(error, response, body) {
          expect(response.statusCode).to.equal(201);
          var userData = info.user;
          userData.address_id = body.id;
          var address = _.isObject(body) ? body : JSON.parse(body);

          request.post({
            url: test.baseUrl + '/users',
            json: userData
          }, function(error, response, body) {
            expect(response.statusCode).to.equal(201);

            var record = body;
            record.address_id = address.id;
            record.address = address;
            test.expectedResult.push(record);
            callback();
          });
        }); 
      }, function(err) {
        expect(err).to.be.null;
        done();
      });
    });

    afterEach(function() {
      delete test.expectedResults;
    });

    it('should include prefetched data for relations', function(done) {
      request.get({ url: test.baseUrl + '/users' }, function(error, response, body) {
        var result = _.isObject(body) ? body : JSON.parse(body);
        expect(result).to.eql(test.expectedResult);
        done();
      });
    });

  });

});
