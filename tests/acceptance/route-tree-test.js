import Ember from "ember";
import { test } from 'ember-qunit';
import { module } from 'qunit';
import startApp from '../helpers/start-app';
import { visit, find, findAll, click, triggerEvent } from 'ember-native-dom-helpers';

let App;
const { run } = Ember;

let port;

module('Route Tree Tab', {
  beforeEach() {
    App = startApp({
      adapter: 'basic'
    });
    port = App.__container__.lookup('port:main');
  },
  afterEach() {
    run(App, App.destroy);
  }
});

function routeValue(name, props) {
  let value = {
    name,
    controller: {
      name,
      className: `${name.replace(/\./g, '_').classify()}Controller`,
      exists: true
    },
    routeHandler: {
      name,
      className: `${name.replace(/\./g, '_').classify()}Route`
    },
    template: {
      name: name.replace(/\./g, '/')
    }
  };
  props = props || {};
  return Ember.$.extend(true, {}, value, props);
}

let routeTree = {
  value: routeValue('application'),
  children: [{
    value: routeValue('post', { controller: { exists: false } }),
    children: [{
      value: routeValue('post.new', { url: 'post/new' }),
      children: []
    }, {
      value: routeValue('post.edit', { url: 'post/edit' }),
      children: []
    }]
  }]
};

test("Route tree is successfully displayed", async function(assert) {
  port.reopen({
    send(name/*, message*/) {
      if (name === 'route:getTree') {
        this.trigger('route:routeTree', { tree: routeTree });
      }
    }
  });

  await visit('route-tree');

  let routeNodes = findAll('.js-route-tree-item');
  assert.equal(routeNodes.length, 4);

  let routeNames = [...findAll('.js-route-name')].map(function(item) {
    return item.textContent.trim();
  });
  assert.deepEqual(routeNames, ['application', 'post', 'post.new', 'post.edit']);

  let routeHandlers = [...findAll('.js-route-handler')].map(function(item) {
    return item.textContent.trim();
  });
  assert.deepEqual(routeHandlers, ['ApplicationRoute', 'PostRoute', 'PostNewRoute', 'PostEditRoute']);

  let controllers = [...findAll('.js-route-controller')].map(function(item) {
    return item.textContent.trim();
  });

  assert.deepEqual(controllers, ['ApplicationController', 'PostController', 'PostNewController', 'PostEditController']);

  let templates = [...findAll('.js-route-template')].map(function(item) {
    return item.textContent.trim();
  });

  assert.deepEqual(templates, ['application', 'post', 'post/new', 'post/edit']);

  let titleTips = [...findAll('span[title]', routeNodes)].map((n) => n.getAttribute('title')).sort();

  assert.deepEqual(titleTips, [
    "",
    "",
    "ApplicationController",
    "ApplicationRoute",
    "PostController",
    "PostEditController",
    "PostEditRoute",
    "PostNewController",
    "PostNewRoute",
    "PostRoute",
    "application",
    "application",
    "post",
    "post",
    "post.edit",
    "post.new",
    "post/edit",
    "post/edit",
    "post/new",
    "post/new"
  ], 'expected title tips');
});

test("Clicking on route handlers and controller sends an inspection message", async function(assert) {
  let name, message, applicationRow;

  port.reopen({
    send(n, m) {
      name = n;
      message = m;

      if (name === 'route:getTree') {
        this.trigger('route:routeTree', { tree: routeTree });
      }
    }
  });

  await visit('route-tree');
  name = null;
  message = null;
  applicationRow = find('.js-route-tree-item');
  await click('.js-route-handler', applicationRow);
  assert.equal(name, 'objectInspector:inspectRoute');
  assert.equal(message.name, 'application');

  name = null;
  message = null;
  await click('.js-route-controller', applicationRow);
  assert.equal(name, 'objectInspector:inspectController');
  assert.equal(message.name, 'application');

  name = null;
  message = null;
  let postRow = findAll('.js-route-tree-item')[1];
  await click('.js-route-controller', postRow);
  assert.equal(name, null, "If controller does not exist, clicking should have no effect.");
  assert.equal(message, null);
});

test("Current Route is highlighted", async function(assert) {
  port.reopen({
    send(name/*, message*/) {
      if (name === 'route:getTree') {
        this.trigger('route:routeTree', { tree: routeTree });
      } else if (name === 'route:getCurrentRoute') {
        this.trigger('route:currentRoute', { name: 'post.edit' });
      }
    }
  });


  let routeNodes;

  await visit('route-tree');
  routeNodes = findAll('.js-route-tree-item .js-route-name');
  let isCurrent = [...routeNodes].map(item => item.classList.contains('list__cell_highlight'));
  assert.deepEqual(isCurrent, [true, true, false, true]);

  run(() => port.trigger('route:currentRoute', { name: 'post.new' }));
  await wait();
  routeNodes = findAll('.js-route-tree-item .js-route-name');
  isCurrent = [...routeNodes].map(item => item.classList.contains('list__cell_highlight'));
  assert.deepEqual(isCurrent, [true, true, true, false], 'Current route is bound');
});

test("Hiding non current route", async function(assert) {
  port.reopen({
    send(name/*, message*/) {
      if (name === 'route:getTree') {
        this.trigger('route:routeTree', { tree: routeTree });
      } else if (name === 'route:getCurrentRoute') {
        this.trigger('route:currentRoute', { name: 'post.edit' });
      }
    }
  });

  await visit('route-tree');
  let routeNodes = findAll('.js-route-tree-item');
  assert.equal(routeNodes.length, 4);
  let checkbox = find('.js-filter-hide-routes input');
  checkbox.checked = true;
  await triggerEvent(checkbox, 'change');
  routeNodes = findAll('.js-route-tree-item');
  assert.equal(routeNodes.length, 3);
});
