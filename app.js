(function() {
    Ember.Application.initializer({
        name: 'authentication',
        initialize: function(container, application) {
            container.register('authenticator:custom', App.GoogleAuthenticator);
            container.register('authorizer:custom', App.CustomAuthorizer);
            Ember.SimpleAuth.setup(container, application, {
                authorizerFactory: 'authorizer:custom',
            });
        }
    });

    App = Ember.Application.create({
        LOG_TRANSITIONS:true ,
        LOG_TRANSITIONS_INTERNAL:true ,
        LOG_ACTIVE_GENERATION: true,

    });


    // Add some routes
    App.Router.map(function() {
        this.route('login');
        this.resource('events', {path: 'events'},  function() {
        });
    });


    App.EventsRoute = Ember.Route.extend(Ember.SimpleAuth.AuthenticatedRouteMixin,{
        model: function() {
            return [ {date: "Apr 26th", title: "Science festival"},
                     {date: "Apr 27th", title: "Swim class"}
                    ];
        },
    });


    // Simple authentication
    App.Router.reopen({
        rootURL: 'index.html'
    });

    App.ApplicationRoute = Ember.Route.extend(Ember.SimpleAuth.ApplicationRouteMixin);

    App.LoginRoute = Ember.Route.extend({
        setupController: function(controller, model) {
            controller.set('errorMessage', null);
        },
        actions: {
            sessionAuthenticationFailed: function(error) {
                this.controller.set('errorMessage', error);
            },
        }
    });

    App.LoginController = Ember.Controller.extend(Ember.SimpleAuth.LoginControllerMixin, {
        authenticatorFactory: 'authenticator:custom'
      });

    // The authorizer that injects the auth token into every api request
    App.CustomAuthorizer = Ember.SimpleAuth.Authorizers.Base.extend({
        authorize: function(jqXHR, requestOptions) {
          if (this.get('session.isAuthenticated') && !Ember.isEmpty(this.get('session.token'))) {
            jqXHR.setRequestHeader('Authorization', 'Token: ' + this.get('session.token'));
          }
        }
      });


    Ember.OAuth2.config = {
        google: {
            clientId: "966028013244-i05fkt400pl0b5c8upnfi0dn304kk4b6.apps.googleusercontent.com",
            authBaseUri: 'https://accounts.google.com/o/oauth2/auth',
            redirectUri: 'http://127.0.0.1:5000/redirect.html',
            scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'
        } 
    } 

    App.oauth = Ember.OAuth2.create({providerId: 'google'});

    App.GoogleAuthenticator = Ember.SimpleAuth.Authenticators.Base.extend({
        restore: function(data) {
          return new Ember.RSVP.Promise(function(resolve, reject) {
            if (!Ember.isEmpty(data.token)) {
              resolve(data);
            } else {
              reject();
            }
          });
        },

        get_email: function(access_token) {
            // Call the google api with our token to get the user info
            return new Ember.RSVP.Promise(function(resolve, reject) {
                Ember.$.ajax({
                    url:         'https://www.googleapis.com/oauth2/v2/userinfo?access_token='+access_token,
                    type:        'GET',
                    contentType: 'application/json'
                }).then(function(response) {
                    resolve (response);
                }, function(xhr, status, error) {
                    console.log(error);
                    reject(error);
                });
            });
        },

        authenticate: function(credentials) {
            var _this = this;
            return new Ember.RSVP.Promise(function(resolve, reject) {
                // Setup handlers
                App.oauth.on('success', function(stateObj) {
                    // Setup the callback to resolve this function
                    token = this.getAccessToken();
                    // Get all the user info
                    _this.get_email(token).then(
                       function(resp) {
                           resolve({ token: token,
                                    userEmail: resp.email, 
                                    userFn: resp.given_name,
                                    userLn: resp.family_name,
                                    userPic: resp.picture,
                                    userGender: resp.gender,
                           });
                       },
                       function(rej) {
                           reject(rej);
                       } 
                   );
                });// oauth.on
                App.oauth.on('error', function(err) { reject(err.error);});
                App.oauth.authorize();
            });// return
        },

        invalidate: function() {
          var _this = this;
          return new Ember.RSVP.Promise(function(resolve) {
              // Do something with your API
              resolve();
          });
        },
    });

})();
