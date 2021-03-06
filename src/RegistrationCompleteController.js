/*!
 * Copyright (c) 2017, Okta, Inc. and/or its affiliates. All rights reserved.
 * The Okta software accompanied by this notice is provided pursuant to the Apache License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and limitations under the License.
 */

define([
  'okta',
  'util/Enums',
  'util/FormController',
  'util/FormType'
],
function (Okta, Enums, FormController, FormType) {

  var _ = Okta._;

  return FormController.extend({
    className: 'registration-complete',
    Model: function () {
    },

    Form: {
      title: _.partial(Okta.loc, 'registration.complete.title', 'login'),
      noButtonBar: true,
      formChildren: function () {
        return [
          FormType.View({
            View: Okta.View.extend({
              template: '\
              <span>{{desc}}</span>\
              ',
              getTemplateData: function () {
                var email = this.options.appState.get('username');
                return { 'desc': Okta.loc('registration.complete.desc', 'login', [email]) };
              }
            })
          })
        ];
      }
    }
  });

});
