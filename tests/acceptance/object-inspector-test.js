import Ember from "ember";
import { test } from 'ember-qunit';
import { module } from 'qunit';
import startApp from '../helpers/start-app';
import { visit, find, findAll, click, fillIn, keyEvent } from 'ember-native-dom-helpers';

let App;
let port, message, name;


module('Object Inspector', {
  beforeEach() {
    App = startApp({
      adapter: 'basic'
    });
    port = App.__container__.lookup('port:main');
    port.reopen({
      send(n, m) {
        name = n;
        message = m;
      }
    });
  },
  afterEach() {
    name = null;
    message = null;
    Ember.run(App, App.destroy);
  }
});

const objectAttr = {
  name: 'Object Name',
  objectId: 1,
  errors: [],
  details: [
    {
      name: 'Own Properties',
      expand: true,
      properties: [{
        name: 'id',
        value: 1
      }]
    }
  ]
};

function objectFactory(props) {
  return Ember.$.extend(true, {}, objectAttr, props);
}

function objectToInspect() {
  return objectFactory({
    name: 'My Object',
    objectId: 'objectId',
    errors: [],
    details: [
      {
        name: 'First Detail',
        expand: false,
        properties: [{
          name: 'numberProperty',
          value: {
            inspect: 1,
            value: 'type-number'
          }
        }]
      },
      {
        name: 'Second Detail',
        properties: [
          {
            name: 'objectProperty',
            value: {
              inspect: 'Ember Object Name',
              type: 'type-ember-object'
            }
          }, {
            name: 'stringProperty',
            value: {
              inspect: 'String Value',
              type: 'type-ember-string'
            }
          }
        ]
      }
    ]
  });
}

test("The object displays correctly", async function (assert) {
  let obj = objectFactory({ name: 'My Object' });
  await visit('/');

  await triggerPort('objectInspector:updateObject', obj);

  assert.equal(find('.js-object-name').textContent, 'My Object');
  assert.equal(find('.js-object-detail-name').textContent, 'Own Properties');
  assert.ok(find('.js-object-detail').classList.contains('mixin_state_expanded'), 'The "Own Properties" detail is expanded by default');
});

test("Object details", async function (assert) {
  let firstDetail, secondDetail;

  await visit('/');

  await triggerPort('objectInspector:updateObject', objectToInspect());

  assert.equal(find('.js-object-name').textContent, 'My Object');
  firstDetail = findAll('.js-object-detail')[0];
  secondDetail = findAll('.js-object-detail')[1];
  assert.equal(find('.js-object-detail-name', firstDetail).textContent, 'First Detail');
  assert.notOk(firstDetail.classList.contains('mixin_state_expanded'), 'Detail not expanded by default');

  await click('.js-object-detail-name', firstDetail);

  assert.ok(firstDetail.classList.contains('mixin_state_expanded'), 'Detail expands on click.');
  assert.notOk(secondDetail.classList.contains('mixin_state_expanded'), 'Second detail does not expand.');
  assert.equal(findAll('.js-object-property', firstDetail).length, 1);
  assert.equal(find('.js-object-property-name', firstDetail).textContent, 'numberProperty');
  assert.equal(find('.js-object-property-value', firstDetail).textContent, '1');

  await click('.js-object-detail-name', firstDetail);

  assert.notOk(firstDetail.classList.contains('mixin_state_expanded'), 'Expanded detail minimizes on click.');
  await click('.js-object-detail-name', secondDetail);

  assert.ok(secondDetail.classList.contains('mixin_state_expanded'));
  assert.equal(findAll('.js-object-property', secondDetail).length, 2);
  assert.equal(findAll('.js-object-property-name', secondDetail)[0].textContent, 'objectProperty');
  assert.equal(findAll('.js-object-property-value', secondDetail)[0].textContent, 'Ember Object Name');
  assert.equal(findAll('.js-object-property-name', secondDetail)[1].textContent, 'stringProperty');
  assert.equal(findAll('.js-object-property-value', secondDetail)[1].textContent, 'String Value');
});

test("Digging deeper into objects", async function (assert) {
  let secondDetail;

  await visit('/');

  triggerPort('objectInspector:updateObject', objectToInspect());

  secondDetail = findAll('.js-object-detail')[1];
  await click('.js-object-detail-name', secondDetail);

  await click('.js-object-property .js-object-property-value');

  assert.equal(name, 'objectInspector:digDeeper');
  assert.deepEqual(message, { objectId: 'objectId', property: 'objectProperty' });

  let nestedObject = {
    parentObject: 'objectId',
    name: 'Nested Object',
    objectId: 'nestedObject',
    property: 'objectProperty',
    details: [{
      name: 'Nested Detail',
      properties: [{
        name: 'nestedProp',
        value: {
          inspect: 'Nested Prop',
          type: 'type-string'
        }
      }]
    }]
  };

  await triggerPort('objectInspector:updateObject', nestedObject);

  assert.equal(find('.js-object-name').textContent, 'My Object', 'Title stays as the initial object.');
  assert.equal(find('.js-object-trail').textContent, '.objectProperty', 'Nested property shows below title');
  assert.equal(find('.js-object-detail-name').textContent, 'Nested Detail');
  await click('.js-object-detail-name');

  assert.ok(find('.js-object-detail').classList.contains('mixin_state_expanded'));
  assert.equal(find('.js-object-property-name').textContent, 'nestedProp');
  assert.equal(find('.js-object-property-value').textContent, 'Nested Prop');
  await click('.js-object-inspector-back');

  assert.notOk(find('.js-object-trail'), 0);
});

test("Computed properties", async function (assert) {
  await visit('/');

  let obj = {
    name: 'My Object',
    objectId: 'myObject',
    details: [{
      name: 'Detail',
      properties: [{
        name: 'computedProp',
        value: {
          inspect: '<computed>',
          type: 'type-descriptor',
          computed: true
        }
      }]
    }]
  };

  await triggerPort('objectInspector:updateObject', obj);

  await click('.js-object-detail-name');
  await click('.js-calculate');

  assert.equal(name, 'objectInspector:calculate');
  assert.deepEqual(message, { objectId: 'myObject', property: 'computedProp', mixinIndex: 0 });
  await triggerPort('objectInspector:updateProperty', {
    objectId: 'myObject',
    property: 'computedProp',
    value: {
      inspect: 'Computed value'
    },
    mixinIndex: 0
  });

  assert.equal(find('.js-object-property-value').textContent, 'Computed value');
});

test("Properties are bound to the application properties", async function (assert) {
  await visit('/');

  let obj = {
    name: 'My Object',
    objectId: 'object-id',
    details: [{
      name: 'Own Properties',
      expand: true,
      properties: [{
        name: 'boundProp',
        value: {
          inspect: 'Teddy',
          type: 'type-string',
          computed: false
        }
      }]

    }]
  };
  await triggerPort('objectInspector:updateObject', obj);

  assert.equal(find('.js-object-property-value').textContent, 'Teddy');
  await triggerPort('objectInspector:updateProperty', {
    objectId: 'object-id',
    mixinIndex: 0,
    property: 'boundProp',
    value: {
      inspect: 'Alex',
      type: 'type-string',
      computed: false
    }
  });

  await click('.js-object-property-value');

  let txtField = find('.js-object-property-value-txt');
  assert.equal(txtField.value, '"Alex"');
  await fillIn(txtField, '"Joey"');

  await keyEvent('.js-object-property-value-txt', 'keyup', 13);
  assert.equal(name, 'objectInspector:saveProperty');
  assert.equal(message.property, 'boundProp');
  assert.equal(message.value, 'Joey');
  assert.equal(message.mixinIndex, 0);

  await triggerPort('objectInspector:updateProperty', {
    objectId: 'object-id',
    mixinIndex: 0,
    property: 'boundProp',
    value: {
      inspect: 'Joey',
      type: 'type-string',
      computed: false
    }
  });

  assert.equal(find('.js-object-property-value').textContent, 'Joey');
});

test("Stringified json should not get double parsed", async function (assert) {
  await visit('/');

  let obj = {
    name: 'My Object',
    objectId: 'object-id',
    details: [{
      name: 'Own Properties',
      expand: true,
      properties: [{
        name: 'boundProp',
        value: {
          inspect: '{"name":"teddy"}',
          type: 'type-string',
          computed: false
        }
      }]

    }]
  };
  await triggerPort('objectInspector:updateObject', obj);

  await click('.js-object-property-value');

  let txtField = find('.js-object-property-value-txt');
  assert.equal(txtField.value, '"{"name":"teddy"}"');
  await fillIn(txtField, '"{"name":"joey"}"');

  await keyEvent('.js-object-property-value-txt', 'keyup', 13);
  assert.equal(name, 'objectInspector:saveProperty');
  assert.equal(message.property, 'boundProp');
  assert.equal(message.value, '{"name":"joey"}');
  assert.equal(message.mixinIndex, 0);
});

test("Send to console", async function (assert) {
  await visit('/');

  let obj = {
    name: 'My Object',
    objectId: 'object-id',
    details: [{
      name: 'Own Properties',
      expand: true,
      properties: [{
        name: 'myProp',
        value: {
          inspect: 'Teddy',
          type: 'type-string',
          computed: false
        }
      }]

    }]
  };
  await triggerPort('objectInspector:updateObject', obj);

  await click('.js-send-to-console-btn');

  assert.equal(name, 'objectInspector:sendToConsole');
  assert.equal(message.objectId, 'object-id');
  assert.equal(message.property, 'myProp');

  await click('.js-send-object-to-console-btn');

  assert.equal(name, 'objectInspector:sendToConsole');
  assert.equal(message.objectId, 'object-id');
  assert.equal(message.property, undefined);
});

test("Read only CPs cannot be edited", async function (assert) {
  await visit('/');

  let obj = {
    name: 'My Object',
    objectId: 'object-id',
    details: [{
      name: 'Own Properties',
      expand: true,
      properties: [{
        name: 'readCP',
        readOnly: true,
        value: {
          computed: true,
          inspect: 'Read',
          type: 'type-string'
        }
      }, {
        name: 'readCP',
        readOnly: false,
        value: {
          computed: true,
          inspect: 'Write',
          type: 'type-string'
        }
      }]
    }]
  };
  await triggerPort('objectInspector:updateObject', obj);
  await click('.js-object-property-value');
  assert.notOk(find('.js-object-property-value-txt'));

  let valueElements = findAll('.js-object-property-value');
  await click(valueElements[valueElements.length - 1]);

  assert.ok(find('.js-object-property-value-txt'));
});

test("Dropping an object due to destruction", async function (assert) {
  await visit('/');

  let obj = {
    name: 'My Object',
    objectId: 'myObject',
    details: [{
      name: 'Detail',
      properties: []
    }]
  };

  await triggerPort('objectInspector:updateObject', obj);

  assert.equal(find('.js-object-name').textContent.trim(), 'My Object');
  await triggerPort('objectInspector:droppedObject', { objectId: 'myObject' });

  assert.notOk(find('.js-object-name'));
});

test("Date fields are editable", async function (assert) {
  await visit('/');

  let date = new Date();

  let obj = {
    name: 'My Object',
    objectId: 'myObject',
    details: [{
      name: 'First Detail',
      expand: false,
      properties: [{
        name: 'dateProperty',
        value: {
          inspect: date.toString(),
          type: 'type-date'
        }
      }]
    }]
  };
  await triggerPort('objectInspector:updateObject', obj);
  assert.ok(true);

  await click('.js-object-detail-name');
  await click('.js-object-property-value');

  let field = find('.js-object-property-value-date');
  assert.ok(field);
  await fillIn(field, '2015-01-01');

  assert.equal(name, 'objectInspector:saveProperty');
  assert.equal(message.property, 'dateProperty');
  assert.equal(message.dataType, 'date');

  let newDate = new Date(message.value);
  assert.equal(newDate.getMonth(), 0);
  assert.equal(newDate.getDate(), 1);
  assert.equal(newDate.getFullYear(), 2015);
});

test("Errors are correctly displayed", async function (assert) {
  let obj = objectFactory({
    name: 'My Object',
    objectId: '1',
    errors: [
      { property: 'foo' },
      { property: 'bar' }
    ]
  });
  await visit('/');
  await triggerPort('objectInspector:updateObject', obj);

  assert.equal(find('.js-object-name').textContent, 'My Object');
  assert.equal(findAll('.js-object-inspector-errors').length, 1);
  assert.equal(findAll('.js-object-inspector-error').length, 2);

  await click('.js-send-errors-to-console');

  assert.equal(name, 'objectInspector:traceErrors');
  assert.equal(message.objectId, '1');

  await triggerPort('objectInspector:updateErrors', {
    objectId: '1',
    errors: [
      { property: 'foo' }
    ]
  });

  assert.ok(find('.js-object-inspector-error'));

  await triggerPort('objectInspector:updateErrors', {
    objectId: '1',
    errors: []
  });

  assert.notOk(find('.js-object-inspector-errors'));
});
