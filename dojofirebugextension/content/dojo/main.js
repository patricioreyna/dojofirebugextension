/* See license.txt for terms of usage */

define([
    "firebug/lib/trace",
    "dojo/core/dojofirebugextension",
    "dojo/ui/panels"
], function(FBTrace, DojoExtension) {
        
    
// ********************************************************************************************* //
// The application/extension object

var theApp = {
        initialize: function() {
        
            // xxxHonza: defaults/preferences/helloworld.js prefs file is not loaded
            // if the extensions is bootstrapped.
        
            /* 
             * initialize the dojofirebugextension activable module.
             * this is needed here because extension modules are registered AFTER Firebug's default 
             * module initialization process
             */
            DojoExtension.dojofirebugextensionModel.initialize();
        
            if (FBTrace) {
                FBTrace.sysout("Dojo extension initialized");
            }
        },
        
        shutdown: function() {
            if (FBTrace) {
                FBTrace.sysout("Dojo extension shutdown");
            }

            // Extension shutdown
            DojoExtension.dojofirebugextensionModel.shutdown();
        }
        
};

return theApp;

// ********************************************************************************************* //
});