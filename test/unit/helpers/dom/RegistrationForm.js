define(['./Form'], function (Form) {

  var FIRSTNAME_FIELD = 'firstName';
  var LASTNAME_FIELD = 'lastName';
  var EMAIL_FIELD = 'login';
  var PASSWORD_FIELD = 'password';

  return Form.extend({

    firstnameField: function () {
      return this.input(FIRSTNAME_FIELD);
    },

    firstnameErrorField: function () {
      return this.error(FIRSTNAME_FIELD);
    },

    setFirstname: function (val) {
      var field = this.firstnameField();
      field.val(val);
      field.trigger('change');
    },

    lastnameField: function () {
      return this.input(LASTNAME_FIELD);
    },
    
    lastnameErrorField: function () {
      return this.error(LASTNAME_FIELD);
    },

    emailField: function () {
      return this.input(EMAIL_FIELD);
    },

    emailErrorField: function () {
      return this.error(EMAIL_FIELD);
    },

    setEmail: function (val) {
      var field = this.emailField();
      field.val(val);
      field.trigger('change');
    },

    passwordField: function () {
      return this.input(PASSWORD_FIELD);
    },

    passwordErrorField: function () {
      return this.error(PASSWORD_FIELD);
    },

    setPassword: function (val) {
      var field = this.passwordField();
      field.val(val);
      field.trigger('change');
      field.trigger('input');
    },

    focusOutPassword: function () {
      var field = this.passwordField();
      field.trigger('focusout');
    },

    hasPasswordComplexityUnsatisfied: function (type) {
      return this.$('#password-complexity-' + type).hasClass('password-complexity-unsatisfied') &&
             !this.$('#password-complexity-' + type).hasClass('password-complexity-satisfied') &&
             !this.$('#password-complexity-' + type).hasClass('password-complexity-error');
    },

    hasPasswordComplexitySatisfied: function (type) {
      return this.$('#password-complexity-' + type).hasClass('password-complexity-satisfied') &&
             !this.$('#password-complexity-' + type).hasClass('password-complexity-unsatisfied') &&
             !this.$('#password-complexity-' + type).hasClass('password-complexity-error');
    },

    hasPasswordComplexityError: function (type) {
      return this.$('#password-complexity-' + type).hasClass('password-complexity-error') &&
             !this.$('#password-complexity-' + type).hasClass('password-complexity-unsatisfied') &&
             !this.$('#password-complexity-' + type).hasClass('password-complexity-satisfied');
    }
  });

});
