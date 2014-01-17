define( [

    'underscore'
    , 'backbone'
    , 'models/info'
    , 'models/config'
    , 'models/items'
    , 'models/payouts'
    , 'models/invs'
    , 'lib/admin-key'
    , 'models/agents-cache'
    , 'models/base-sl-model'

] , function(

    _
    , Backbone
    , Info
    , Config
    , Items
    , Payouts
    , Invs
    , adminKey
    , agentsCache
    , BaseSlModel

) {
    'use strict';

    var submodelProgress = function( gachaProgressProperty , gachaInfoProperty , gacha , submodel ) {
        var submodelExpectedCount = ( gacha.get( 'info' ).get( gachaInfoProperty ) + 1 );
        var submodelProgressPercentage = ( submodel.length / submodelExpectedCount * 100 );
        gacha.set( gachaProgressProperty , submodelProgressPercentage );
    };

    var exports = Backbone.Model.extend( {
        defaults: {
            isValid: false
            , progressPercentage: 0
            , agentsCache: agentsCache
            , overrideProgress: null
        }

        , fetchedJSON: null

        , submodels: {

            info: {
                model: Info
                , weight: 10
                , adminOnly: false
                , fetch: true
            }

            , info_extra: {
                model: Backbone.Model
                , weight: 0
                , adminOnly: false
                , fetch: false
            }

            , config: {
                model: Config
                , weight: 10
                , adminOnly: true
                , fetch: true
            }

            , payouts: {
                model: Payouts
                , weight: 20
                , adminOnly: true
                , progress: _.partial( submodelProgress , 'payoutsProgressPercentage' , 'payoutCount' )
                , fetch: true
            }

            , items: {
                model: Items
                , weight: 30
                , adminOnly: false
                , progress: _.partial( submodelProgress , 'itemsProgressPercentage' , 'itemCount' )
                , fetch: true
            }

            , invs: {
                model: Invs
                , weight: 30
                , adminOnly: true
                , progress: _.partial( submodelProgress , 'invsProgressPercentage' , 'inventoryCount' )
                , fetch: true
            }

        }

        , initialize: function() {
            this.on( 'change' , this.updateProgress , this );

            _.each( this.submodels , function( submodelConfig , name ) {
                this.set( name , new submodelConfig.model( {} , { gacha: this } ) , { silent: true } );
                this.set( name + 'ProgressPercentage' , 0 , { silent: true } );

                // Echo all sub-model events as native on this model
                this.get( name ).on( 'all' , function() {
                    this.trigger.apply( this , arguments );
                } , this );

                this.on( 'change:' + name , this.listenToSubmodels , this );
            } , this );

            this.listenToSubmodels();
        }

        , listenToSubmodels: function() {
            this.stopListening( null , null , null );

            this.listenTo( this.get( 'info' ) , 'change:extra' , this.updateExtraFromInfo );
            this.listenTo( this.get( 'info_extra' ) , 'change' , this.updateInfoFromExtra );

            this.listenTo( this.get( 'info_extra' ) , 'change:btn_price' , this.recalculateOwnerAmount );
            this.listenTo( this.get( 'payouts' ) , 'add' , this.recalculateOwnerAmount );
            this.listenTo( this.get( 'payouts' ) , 'remove' , this.recalculateOwnerAmount );
            this.listenTo( this.get( 'payouts' ) , 'reset' , this.recalculateOwnerAmount );
            this.listenTo( this.get( 'payouts' ) , 'change:amount' , this.recalculateOwnerAmount );
        }

        , updateExtraFromInfo: function() {
            this.get( 'info_extra' ).set( this.get( 'info' ).get( 'extra' ) );
        }

        , updateInfoFromExtra: function() {
            this.get( 'info' ).set( 'extra' , _.clone( this.get( 'info_extra' ).attributes ) );
        }

        , recalculateOwnerAmount: function() {
            var ownerPayout = this.get( 'payouts' ).get( this.get( 'info' ).get( 'ownerKey' ) );

            if( ! ownerPayout ) {
                return;
            }

            ownerPayout.set( 'amount' , (
                // The new price
                this.get( 'info_extra' ).get( 'btn_price' )

                // Minus the total of all payouts
                - this.get( 'payouts' ).totalPrice

                // But don't count the owner in total payouts
                + ownerPayout.get( 'amount' )
            ) );
        }

        , updateProgress: function() {
            var progressPercentage = 0;

            _.each( this.submodels , function( submodelConfig , key ) {
                progressPercentage += ( this.get( key + 'ProgressPercentage' ) / 100 * submodelConfig.weight );
            } , this );

            if( null !== this.get( 'overrideProgress' ) ) {
                progressPercentage = this.get( 'overrideProgress' );
            }

            this.set( 'progressPercentage' , progressPercentage );
        }

        , fetch: function( options ) {
            // Input normalization
            options = options || {};

            // Get list of submodels to fetch
            var submodels = _.keys( this.submodels );
            var success = options.success;

            // Set my initial progress
            this.set( 'progressPercentage' , 0 );

            // Method to process one submodel
            var next = _.bind( function() {
                // Get next submodelName or we're done
                var submodelName = submodels.shift();
                if( ! submodelName ) {
                    this.set( 'progressPercentage' , 100 );

                    this.fetchedNotecardJSON = this.toNotecardJSON();

                    // NOTE: Doing these AFTER saving the fetchedJSON

                    // Populate items with new entries from inventory
                    if( this.get( 'items' ) && this.get( 'invs' ) ) {
                        this.get( 'items' ).populate( this.get( 'invs' ) , this.get( 'info' ).get( 'scriptName' ) );
                    }

                    // If there's not at least one payout record, add one for the owner
                    if( !this.get( 'payouts' ).length ) {
                        this.get( 'payouts' ).add( {
                            agentKey: this.get( 'info' ).get( 'ownerKey' )
                            , userName: this.get( 'info' ).get( 'ownerUserName' )
                            , displayName: this.get( 'info' ).get( 'ownerDisplayName' )
                            , amount: this.get( 'info' ).get( 'price' )
                        } );
                    }

                    if( success ) {
                        success();
                    }

                    return;
                }

                // Cache
                var submodelConfig = this.submodels[ submodelName ];
                var submodel = this.get( submodelName );

                // Skip admin-only if we're not admin or non-fetching submodels
                if(
                    ( !options.loadAdmin && submodelConfig.adminOnly )
                    || ( ! adminKey.load() && submodelConfig.adminOnly )
                    || !submodelConfig.fetch
                ) {
                    this.set( submodelName + 'ProgressPercentage' , 100 );
                    next();
                    return;
                }

                // Override success with next callback
                var fetchOptions = _.clone( options );
                fetchOptions.success = _.bind( function() {
                    this.set( submodelName + 'ProgressPercentage' , 100 );
                    next();
                } , this );
                if( submodelConfig.progress ) {
                    fetchOptions.progress = _.partial( submodelConfig.progress , this , submodel );
                }

                // And start the fetch
                submodel.fetch( fetchOptions );
            } , this );

            next();
        }

        , validate: function() {
            console.log( 'TODO' );
            this.set( 'isValid' , false );
        }

        , save: function() {
            console.log( 'TODO' );
        }

        , toJSON: function() {
            var json = this.constructor.__super__.toJSON.apply( this , arguments );

            _.each( json , function( value , key ) {
                // If the value has a toJSON method
                if( _.isObject( value ) && _.isFunction( value.toJSON ) ) {
                    json[ key ] = value.toJSON();
                }
            } , this );

            return json;
        }

        , fromNotecardJSON: function() {
            var returnValue = BaseSlModel.prototype.fromNotecardJSON.apply( this , arguments );
            this.get( 'items' ).populate( this.get( 'invs' ) , this.get( 'info' ).get( 'scriptName' ) );
            return returnValue;
        }

        , toNotecardJSON: function() {
            var json = this.constructor.__super__.toJSON.apply( this , arguments );

            _.each( json , function( value , key ) {
                // Only keep if the value has a toNotecardJSON method
                if( _.isObject( value ) && _.isFunction( value.toNotecardJSON ) ) {
                    json[ key ] = value.toNotecardJSON();
                } else {
                    delete json[ key ];
                }
            } , this );

            return json;
        }

        , hasChangedSinceFetch: function() {
            return ! _.isEqual( this.toNotecardJSON() , this.fetchedNotecardJSON );
        }
    } );

    return exports;
} );