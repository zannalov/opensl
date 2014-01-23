define( [

    'marionette'
    , 'hbs!dashboard/templates/header'
    , 'css!dashboard/styles/header'
    , 'bootstrap'
    , 'lib/constants'
    , 'lib/tooltip-placement'
    , 'lib/map-uri'

] , function(

    Marionette
    , template
    , headerStyles
    , bootstrap
    , CONSTANTS
    , tooltipPlacement
    , mapUri

) {
    'use strict';

    var exports = Marionette.ItemView.extend( {
        template: template

        , ui: {
            'tooltips': '[data-toggle=tooltip]'
            , 'dropdowns': '[data-toggle=dropdown]'
        }

        , templateHelpers: function() {
            if( null === this.model.get( 'freeMemory' ) ) {
                return {};
            }

            return {
                mapUrl: mapUri(
                    this.model.get( 'regionName' )
                    , this.model.get( 'position' ).x
                    , this.model.get( 'position' ).y
                    , this.model.get( 'position' ).z
                )

                , memoryState: (
                    null !== this.model.get( 'freeMemory' )
                    && this.model.get( 'freeMemory' ) < CONSTANTS.DANGER_MEMORY_THRESHOLD
                    ? 'danger'
                    : (
                        null !== this.model.get( 'freeMemory' )
                        && this.model.get( 'freeMemory' ) < CONSTANTS.WARN_MEMORY_THRESHOLD
                        ? 'warning'
                        : 'success'
                    )
                )

                , memoryIcon: (
                    null !== this.model.get( 'freeMemory' )
                    && this.model.get( 'freeMemory' ) < CONSTANTS.DANGER_MEMORY_THRESHOLD
                    ? 'fa-exclamation-circle'
                    : (
                        null !== this.model.get( 'freeMemory' )
                        && this.model.get( 'freeMemory' ) < CONSTANTS.WARN_MEMORY_THRESHOLD
                        ? 'fa-info-circle'
                        : 'fa-check-circle'
                    )
                )

                , freeMemoryPercentage: (
                    Math.round( this.model.get( 'freeMemory' ) / CONSTANTS.MAX_MEMORY * 1000 ) / 10
                )

                , lagState: (
                    1 !== this.model.get( 'scriptCount' )
                    ? 'info'
                    : (
                        CONSTANTS.WARN_SCRIPT_TIME < this.model.get( 'scriptTime' )
                        ? 'warning'
                        : 'success'
                    )
                )

                , lagIcon: (
                    1 !== this.model.get( 'scriptCount' )
                    ? 'fa-info-circle'
                    : (
                        CONSTANTS.WARN_SCRIPT_TIME < this.model.get( 'scriptTime' )
                        ? 'fa-exclamation-circle'
                        : (
                            this.model.get( 'scriptTime' )
                            ? 'fa-check-circle'
                            : 'fa-smile-o'
                        )
                    )
                )

                , ownerUrl: (
                    'secondlife:///app/agent/'
                    + this.model.get( 'ownerKey' )
                    + '/about'
                )
            };
        }

        , onRender: function() {
            this.ui.tooltips.tooltip( {
                html: true
                , container: 'body'
                , placement: tooltipPlacement
            } );

            this.ui.dropdowns.dropdown();
        }
    } );

    return exports;

} );
