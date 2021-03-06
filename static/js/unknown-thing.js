/**
 * Unknown thing.
 *
 * UI element representing an unknown thing type.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

const ActionDetail = require('./action-detail');
const API = require('./api');
const Thing = require('./thing');
const Utils = require('./utils');

/**
 * UnknownThing Constructor (extends Thing).
 *
 * @param Object description Thing description object.
 */
const UnknownThing = function(description, format) {
  this.displayedProperties = this.displayedProperties || {};
  if (description.properties) {
    for (const name in description.properties) {
      const prop = description.properties[name];
      const href = prop.href;
      if (href) {
        let detail;
        switch (prop.type) {
          case 'string':
            detail = new StringDetail(this, name);
            break;
          case 'number': {
            const min = prop.hasOwnProperty('min') ? prop.min : prop.minimum;
            const max = prop.hasOwnProperty('max') ? prop.max : prop.maximum;
            detail = new NumberDetail(this, name, prop.unit, min, max);
            break;
          }
          case 'boolean':
            detail = new BooleanDetail(this, name);
            break;
          default:
            continue;
        }

        const obj = {href, detail, type: prop.type};
        this.displayedProperties[name] = obj;
      }
    }
  }

  this.displayedActions = this.displayedActions || {};
  if (description.actions) {
    let href;
    for (const link of description.links) {
      if (link.rel === 'actions') {
        href = link.href;
        break;
      }
    }

    if (href) {
      for (const name in description.actions) {
        const action = description.actions[name];
        const detail = new ActionDetail(this, name, action.input, href);
        this.displayedActions[name] = {detail};
      }
    }
  }

  this.base = Thing;
  this.base(description, format);

  if (format == 'svg') {
    // For now the SVG view is just a link.
    return this;
  }

  if (format === 'htmlDetail') {
    this.attachHtmlDetail();
  }

  this.updateStatus();

  return this;
};

UnknownThing.prototype = Object.create(Thing.prototype);

/**
 * Update the display for the provided property.
 * @param {string} name - name of the property
 * @param {*} value - value of the property
 */
UnknownThing.prototype.updateProperty = function(name, value) {
  if (!this.displayedProperties.hasOwnProperty(name)) {
    return;
  }

  this.properties[name] = value;
  this.displayedProperties[name].detail.update();
};

/**
 * Set the provided property.
 * @param {string} name - name of the property
 * @param {*} value - value of the property
 */
UnknownThing.prototype.setProperty = function(name, value) {
  if (this.displayedProperties[name].type === 'number') {
    value = parseFloat(value);
  }

  const payload = {
    [name]: value,
  };
  fetch(this.displayedProperties[name].href, {
    method: 'PUT',
    body: JSON.stringify(payload),
    headers: Object.assign(API.headers(), {
      'Content-Type': 'application/json',
    }),
  }).then((response) => {
    if (response.status === 200) {
      this.updateProperty(name, value);
    } else {
      console.error(`Status ${response.status} trying to set ${name}`);
    }
  }).catch((error) => {
    console.error(`Error trying to set ${name}: ${error}`);
  });
};

UnknownThing.prototype.iconView = function() {
  return `<div class="unknown-thing">
  <img class="unknown-thing-icon" src="/images/unknown-thing.png" />
  </div>`;
};

/**
 * A generic string property detail.
 */
function StringDetail(thing, name) {
  this.thing = thing;
  this.name = name;
}

/**
 * Attach to the view.
 */
StringDetail.prototype.attach = function() {
  this.input = this.thing.element.querySelector(
    `#string-${Utils.escapeHtmlForIdClass(this.name)}`);
  this.input.addEventListener('blur', () => {
    this.thing.setProperty(this.name, this.input.value);
  });
  const form = this.input.parentNode;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    this.input.blur();
    return false;
  });
};

/**
 * Build the detail view.
 */
StringDetail.prototype.view = function() {
  return `<div class="thing-detail-container">
    <div class="thing-detail string-input">
      <div class="thing-detail-contents">
        <form class="generic-string">
          <input type="text"
            id="string-${Utils.escapeHtmlForIdClass(this.name)}"
            class="generic-string-input"/>
        </form>
      </div>
    </div>
    <div class="thing-detail-label">${Utils.escapeHtml(this.name)}</div>
  </div>`;
};

/**
 * Update the detail view with the new property value.
 */
StringDetail.prototype.update = function() {
  if (!this.input || this.thing.properties[this.name] == this.input.value) {
    return;
  }

  this.input.value = this.thing.properties[this.name];
};

/**
 * A generic numeric property detail.
 */
function NumberDetail(thing, name, unit, min, max) {
  this.thing = thing;
  this.name = name;
  this.unit = typeof unit === 'undefined' ? null : unit;
  this.min = typeof min === 'undefined' ? null : min;
  this.max = typeof max === 'undefined' ? null : max;
}

/**
 * Attach to the view.
 */
NumberDetail.prototype.attach = function() {
  this.input = this.thing.element.querySelector(
    `#number-${Utils.escapeHtmlForIdClass(this.name)}`);
  this.input.addEventListener('blur', () => {
    this.thing.setProperty(this.name, this.input.value);
  });
  if (this.min !== null && this.max !== null) {
    this.input.addEventListener('click', () => {
      this.thing.setProperty(this.name, this.input.value);
    });
  }
  const form = this.input.parentNode;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    this.input.blur();
    return false;
  });
};

/**
 * Build the detail view.
 */
NumberDetail.prototype.view = function() {
  const min = this.min === null ? '' : `min=${Utils.escapeHtml(this.min)}`;
  const max = this.max === null ? '' : `max=${Utils.escapeHtml(this.max)}`;
  const cls = max && min ? '' : 'hide-number-spinner';
  let unit = '';
  if (this.unit !== null) {
    unit =
      `<div class="generic-number-label">${Utils.escapeHtml(this.unit)}</div>`;
  }

  return `<div class="thing-detail-container">
    <div class="thing-detail number-input">
      <div class="thing-detail-contents">
        <form class="generic-number">
          <input type="number"
            id="number-${Utils.escapeHtmlForIdClass(this.name)}"
            class="generic-number-input ${cls}"
            ${min} ${max} value="0" step="any" />
        </form>
        ${unit}
      </div>
    </div>
    <div class="thing-detail-label">${Utils.escapeHtml(this.name)}</div>
  </div>`;
};

/**
 * Update the detail view with the new property value.
 */
NumberDetail.prototype.update = function() {
  if (!this.input || this.thing.properties[this.name] == this.input.value) {
    return;
  }

  this.input.value = this.thing.properties[this.name];
};

/**
 * A generic boolean property detail.
 */
function BooleanDetail(thing, name) {
  this.thing = thing;
  this.name = name;
}

/**
 * Attach to the view.
 */
BooleanDetail.prototype.attach = function() {
  this.input = this.thing.element.querySelector(
    `#checkbox-${Utils.escapeHtmlForIdClass(this.name)}`);
  this.input.addEventListener('click', () => {
    this.thing.setProperty(this.name, this.input.checked);
  });
};

/**
 * Build the detail view.
 */
BooleanDetail.prototype.view = function() {
  return `<div class="thing-detail-container">
    <div class="thing-detail boolean-switch">
      <div class="thing-detail-contents">
        <form class="generic-boolean">
          <input type="checkbox"
            id="checkbox-${Utils.escapeHtmlForIdClass(this.name)}"
            class="generic-checkbox" />
          <label for="checkbox-${Utils.escapeHtml(this.name)}"></label>
        </form>
      </div>
    </div>
    <div class="thing-detail-label">${Utils.escapeHtml(this.name)}</div>
  </div>`;
};

/**
 * Update the detail view with the new property value.
 */
BooleanDetail.prototype.update = function() {
  if (!this.input || this.thing.properties[this.name] == this.input.value) {
    return;
  }

  this.input.checked = this.thing.properties[this.name];
};

module.exports = UnknownThing;
