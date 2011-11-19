/* See license.txt for terms of usage */

(function() {

// ********************************************************************************************* //
// Use this file in case your extension uses an overlay and you want to load
// its main.js module. You just need to include this file into the overlay
// as follows:
//
// <script type="application/x-javascript" src="chrome://<ext-id>/content/mainOverlay.js"/>

// TODO: Replace with your <ext-id>
var extensionName = "dojofirebugextension"; 

var fbDojo_debugLogEnabled = false;
var waits = 0;
// ********************************************************************************************* //

if (!Firebug || !Firebug.getModuleLoaderConfig)
{
    if(FBTrace) {
        FBTrace.sysout("Firebug Overlay; 'chrome://firebug/content/moduleConfig.js' must be included!");
    }
    
    Components.utils.reportError("Firebug Overlay; 'chrome://firebug/content/moduleConfig.js' must be included!");    
    return;
}

var config = Firebug.getModuleLoaderConfig();
config.paths[extensionName] = "dojo";
/*
config.debug = true;
config.onDebug = function() {
    FBTrace.sysout.apply(FBTrace, arguments);
}
*/

fbDojo_logMsg = function(aMessage) {
    if(!fbDojo_debugLogEnabled) {
        return;
    }
    var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                   .getService(Components.interfaces.nsIConsoleService);
    consoleService.logStringMessage("DojoFirebugExtension AMD Loader - " + aMessage);
};

fbDojo_checkFirebugRequireIsLoaded = function() {
    //Components.utils.reportError("DojoExtensionAsynchLoader - executing checkFirebugRequireIsLoaded . Times: " + waits);
    fbDojo_logMsg("executing checkFirebugRequireIsLoaded . Times: " + waits);
    waits += 1;
    if (!Firebug.require || !Firebug.connection) {
        setTimeout(fbDojo_checkFirebugRequireIsLoaded, 10);
    } else {
        fbDojo_loadExtension();
    }

};

fbDojo_loadExtension = function() {
    
    //Components.utils.reportError("DojoExtensionAsynchLoader - executing loadExtension");
    fbDojo_logMsg("executing loadExtension");

    // Load main.js module (the entry point of the extension) + a support for tracing.
    Firebug.require(config, [
        extensionName + "/main",
        "firebug/lib/trace"
    ],
        function(Extension, FBTrace)
        {
            try
            {
                // Initialize the extension object. Extension intialization procedure
                // should be within this method (in main.js).
                Extension.initialize();
    
                if (FBTrace.DBG_INITIALIZE)
                    FBTrace.sysout("Firebug Overlay; Extension '" + extensionName + "' loaded!");
            }
            catch (err)
            {
                if (FBTrace.DBG_ERRORS)
                    FBTrace.sysout("Firebug Overlay; ERROR " + err);
            }
        }
    );
};


fbDojo_checkFirebugRequireIsLoaded();
return {};

// ********************************************************************************************* //
})();