'use strict';

var _ = require('lodash');

module.exports = function(Resource, resource, association) {
  // access points
  var subResourceName =
    association.target.options.name.plural.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

  // Find reverse association
  var associationPaired;
  if (association.paired) {
    associationPaired = _.find(association.target.associations, association.paired);
  } else {
    associationPaired = _.findWhere(association.target.associations, {
      paired: association
    });
  }

  if (!associationPaired) {
    // Do not create the resource
    return;
  }

  var associatedResource = new Resource({
    app: resource.app,
    sequelize: resource.sequelize,
    model: association.target,
    endpoints: [
      resource.endpoints.singular + '/' + subResourceName,
      resource.endpoints.plural + '/:' + associationPaired.foreignIdentifierField + '/' +
        subResourceName + '/:id'
    ],
    actions: ['read', 'list']
  });

  associatedResource.read.fetch.before(function(req, res, context) {
    var where = {};
    where[association.source.primaryKeyField] = req.params[associationPaired.foreignIdentifierField];
    delete req.params[associationPaired.foreignIdentifierField];

    context.include = context.include || [];
    context.include.push({
      association: associationPaired,
      where: where
    });
    context.continue();
  });

  associatedResource.read.send.before(function(req, res, context) {
    delete context.instance.dataValues[associationPaired.as];
    context.continue();
  });

  associatedResource.list.fetch.before(function(req, res, context) {
    // Filter
    var where = {};
    where[association.source.primaryKeyField] = req.params.id;

    context.include = context.include || [];
    context.include.push({
      association: associationPaired,
      where: where
    });

    context.continue();
  });

  associatedResource.list.send.before(function(req, res, context) {
    context.instance.forEach(function(instance) {
      if (instance.dataValues[associationPaired.as]) {
        instance.dataValues[associationPaired.as].forEach(function(a) {
          delete a.dataValues[associationPaired.combinedName];
        });
      }
    });

    context.continue();
  });

  return associatedResource;
};
