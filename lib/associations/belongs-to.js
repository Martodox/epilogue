'use strict';

module.exports = function(Resource, resource, association) {
  // access points
  var subResourceName =
    association.target.options.name.singular.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

  var associatedResource = new Resource({
    app: resource.app,
    sequelize: resource.sequelize,
    model: association.target,
    endpoints: [resource.endpoints.singular + '/' + subResourceName],
    actions: ['read']
  });

  associatedResource.read.send.before(function(req, res, context) {
    delete context.instance.dataValues[association.identifierField];
    context.continue();
  });

  return associatedResource;
};
