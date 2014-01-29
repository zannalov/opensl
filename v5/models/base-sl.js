define( [

    'underscore'
    , 'backbone'
    , 'lib/admin-key'

] , function(

    _
    , Backbone
    , adminKeyStore

) {
    'use strict';

    var exports = {
        toPostJSON: function( options ) {
            return null;
        }

        // Stripped down and specialized for our comm protocol
        , sync: function( method , model , options ) {
            var type = {
                'create': 'post'
                , 'update': 'post'
                , 'patch':  'post'
                , 'delete': 'delete'
                , 'read':   'get'
            }[ method ];

            // Default options, unless specified.
            _.defaults( options || ( options = {} ) , {
                emulateHTTP: Backbone.emulateHTTP,
                emulateJSON: Backbone.emulateJSON
            } );

            // Default JSON-request options.
            var adminKey = adminKeyStore.load();
            var success = options.success;
            var error = options.error;
            var params = {
                type: 'POST'
                , dataType: 'json'
                , url: (
                    // always starts with a slash if it's present, and has to
                    // be present for any of this to work
                    document.location.pathname
                    + (
                        adminKey
                        ? adminKey + '/'
                        : ''
                    )
                    + type
                    + '/'
                    + _.result( model , 'url' )
                )
            };
            options.success = function( resp ) {
                if( null === resp ) {
                    if( _.isFunction( error ) ) {
                        error.apply( this , arguments );
                    } else {
                        throw 'There was an error talking with the object: ' + resp;
                    }
                } else {
                    if( success ) {
                        success.apply( this , arguments );
                    }
                }
            };
            if( ! _.isFunction( error ) ) {
                options.error = function( resp ) {
                    throw 'There was an error talking with the object: ' + resp;
                };
            }

            // Ensure that we have the appropriate request data.
            params.contentType = 'application/json';
            params.data = JSON.stringify( options.attrs || model.toPostJSON( options , method , type ) );

            // Make the request, allowing the user to override any Ajax options.
            var xhr = options.xhr = Backbone.ajax( _.extend( params , options ) );
            model.trigger( 'request' , model , xhr , options );
            return xhr;
        }
    };

    return exports;
} );